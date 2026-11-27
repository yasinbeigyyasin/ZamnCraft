"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { Check, X } from "lucide-react";
import {
  cssColorToHex,
  hexToHsva,
  hsvaToHex,
  normalizeHex,
  type HSVA,
} from "@/lib/color";
import { useEditorStore } from "@/store/editor-store";
import { PropertyRow } from "./property-controls";
import { ScrubInput } from "./scrub-input";

const swatches = [
  "#ffffff",
  "#111111",
  "#777777",
  "#0099ff",
  "#7657ff",
  "#ef4444",
  "#ff8800",
  "#22c55e",
];

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value),
    [focused, setFocused] = useState(false),
    [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const colorLabel = label.endsWith("color") ? label : `${label} color`;
  return (
    <PropertyRow label={label}>
      <div className="color-control">
        <button
          ref={trigger}
          type="button"
          className="color-swatch checkerboard"
          aria-label={`${colorLabel} picker`}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? id : undefined}
          onClick={() => setOpen(!open)}
        >
          <span style={{ backgroundColor: value }} />
        </button>
        <input
          type="text"
          aria-label={`${label} hex`}
          spellCheck={false}
          value={focused ? draft : value}
          onFocus={() => {
            setDraft(value);
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            setDraft(event.target.value);
            const hex = normalizeHex(event.target.value);
            if (hex) onChange(hex);
          }}
        />
      </div>
      {open && (
        <ColorPicker
          id={id}
          label={label}
          value={value}
          onChange={onChange}
          trigger={trigger}
          onClose={(restoreFocus = true) => {
            setOpen(false);
            if (restoreFocus) trigger.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </PropertyRow>
  );
}

function ColorPicker({
  id,
  label,
  value,
  onChange,
  trigger,
  onClose,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  trigger: RefObject<HTMLButtonElement | null>;
  onClose: (restoreFocus?: boolean) => void;
}) {
  const colorLabel = label.endsWith("color") ? label : `${label} color`;
  const popup = useRef<HTMLDivElement>(null),
    close = useRef<HTMLButtonElement>(null);
  const [color, setColor] = useState(() => hexToHsva(cssColorToHex(value)));
  const [hexDraft, setHexDraft] = useState(""),
    [hexFocused, setHexFocused] = useState(false);
  const emitted = useRef(value);
  const latest = useRef({ color, onChange });
  latest.current = { color, onChange };
  const gesture = useRef<{
    pointer: number;
    node: HTMLDivElement;
    before: HSVA;
  } | null>(null);
  const commit = (patch: Partial<HSVA>) => {
    const next = { ...latest.current.color, ...patch };
    latest.current.color = next;
    setColor(next);
    emitted.current = hsvaToHex(next);
    latest.current.onChange(emitted.current);
  };
  useEffect(() => {
    if (value !== emitted.current) {
      const next = hexToHsva(cssColorToHex(value));
      if (next.s === 0) next.h = latest.current.color.h;
      setColor(next);
      emitted.current = value;
    }
  }, [value]);
  const finish = (cancel = false) => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    useEditorStore.getState().endHistory(cancel);
    if (cancel) {
      setColor(active.before);
      latest.current.color = active.before;
    }
    if (active.node.hasPointerCapture(active.pointer))
      active.node.releasePointerCapture(active.pointer);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const dismissRef = useRef(onClose);
  dismissRef.current = onClose;
  useEffect(() => {
    const node = popup.current!;
    node.showPopover();
    const position = () => {
      const bounds = trigger.current?.getBoundingClientRect();
      if (!bounds) return;
      node.style.width = `${Math.min(280, window.innerWidth - 24)}px`;
      node.style.maxHeight = `${window.innerHeight - 24}px`;
      const sidebar = trigger.current
        ?.closest(".inspector-sidebar")
        ?.getBoundingClientRect();
      const left =
        sidebar && sidebar.left > node.offsetWidth + 24
          ? sidebar.left - node.offsetWidth - 12
          : bounds.right - node.offsetWidth;
      node.style.left = `${Math.max(12, Math.min(left, window.innerWidth - node.offsetWidth - 12))}px`;
      node.style.top = `${Math.max(12, Math.min(bounds.bottom + 8, window.innerHeight - node.offsetHeight - 12))}px`;
    };
    position();
    close.current?.focus({ preventScroll: true });
    const outside = (event: globalThis.PointerEvent) => {
      if (
        event.target instanceof Node &&
        !node.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        dismissRef.current(false);
    };
    const blur = () => finishRef.current(true);
    const cancelHistoryKey = (event: KeyboardEvent) => {
      if (
        gesture.current &&
        (event.ctrlKey || event.metaKey) &&
        /^(z|y)$/i.test(event.key)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        finishRef.current(true);
      }
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", cancelHistoryKey, true);
    return () => {
      finishRef.current(true);
      node.hidePopover();
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", cancelHistoryKey, true);
    };
  }, [trigger]);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    commit({
      s: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      v:
        1 -
        Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    });
  };
  const hex = hsvaToHex(color),
    opaque = hsvaToHex({ ...color, a: 1 });
  return (
    <div
      ref={popup}
      id={id}
      popover="manual"
      role="dialog"
      aria-label={colorLabel}
      className="color-popover"
      onBlurCapture={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget) &&
          !trigger.current?.contains(event.relatedTarget)
        )
          onClose(false);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          if (gesture.current) finish(true);
          else onClose();
        }
      }}
    >
      <header className="color-popover-heading">
        <span>{colorLabel}</span>
        <button
          ref={close}
          type="button"
          aria-label="Close color picker"
          onClick={() => onClose()}
        >
          <X size={14} />
        </button>
      </header>
      <div className="color-picker-body">
        <div
          className="color-area"
          role="group"
          aria-label={`${label} saturation and brightness`}
          aria-describedby={`${id}-help`}
          tabIndex={0}
          style={{ backgroundColor: `hsl(${color.h} 100% 50%)` }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            event.preventDefault();
            event.currentTarget.focus();
            useEditorStore.getState().beginHistory();
            gesture.current = {
              pointer: event.pointerId,
              node: event.currentTarget,
              before: { ...color },
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            move(event);
          }}
          onPointerMove={(event) => {
            if (gesture.current?.pointer === event.pointerId) move(event);
          }}
          onPointerUp={() => finish()}
          onPointerCancel={() => finish(true)}
          onLostPointerCapture={() => finish(true)}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 0.1 : 0.01;
            if (
              ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                event.key,
              )
            ) {
              event.preventDefault();
              useEditorStore.getState().beginHistory();
              commit(
                event.key === "ArrowLeft" || event.key === "ArrowRight"
                  ? {
                      s: Math.max(
                        0,
                        Math.min(
                          1,
                          color.s + (event.key === "ArrowRight" ? step : -step),
                        ),
                      ),
                    }
                  : {
                      v: Math.max(
                        0,
                        Math.min(
                          1,
                          color.v + (event.key === "ArrowUp" ? step : -step),
                        ),
                      ),
                    },
              );
              useEditorStore.getState().endHistory();
            }
          }}
        >
          <span
            className="color-area-thumb"
            style={{
              left: `${color.s * 100}%`,
              top: `${(1 - color.v) * 100}%`,
              backgroundColor: opaque,
            }}
          />
        </div>
        <p id={`${id}-help`} className="sr-only">
          Left and right adjust saturation. Up and down adjust brightness. Hold
          Shift for larger steps. Escape cancels a drag.
        </p>
        <div className="color-picker-tracks">
          <span className="color-preview checkerboard">
            <span style={{ backgroundColor: hex }} />
          </span>
          <div>
            <input
              className="color-range hue-range"
              type="range"
              aria-label={`${label} hue`}
              min={0}
              max={359}
              value={Math.round(color.h)}
              onChange={(event) => commit({ h: Number(event.target.value) })}
            />
            <div className="alpha-track checkerboard">
              <input
                className="color-range alpha-range"
                style={{
                  backgroundImage: `linear-gradient(to right, transparent, ${opaque})`,
                }}
                type="range"
                aria-label={`${label} opacity`}
                min={0}
                max={100}
                value={Math.round(color.a * 100)}
                onChange={(event) =>
                  commit({ a: Number(event.target.value) / 100 })
                }
              />
            </div>
          </div>
        </div>
        <div className="color-picker-values">
          <label className="color-hex-field">
            <span>Hex</span>
            <input
              aria-label={`${label} picker hex`}
              spellCheck={false}
              value={hexFocused ? hexDraft : opaque.toUpperCase()}
              onFocus={() => {
                setHexDraft(opaque.toUpperCase());
                setHexFocused(true);
              }}
              onBlur={() => setHexFocused(false)}
              onChange={(event) => {
                setHexDraft(event.target.value);
                const normalized = normalizeHex(
                  event.target.value.startsWith("#")
                    ? event.target.value
                    : `#${event.target.value}`,
                );
                if (normalized) {
                  const next = hexToHsva(normalized);
                  commit({
                    ...next,
                    a: normalized.length === 9 ? next.a : color.a,
                  });
                }
              }}
            />
          </label>
          <ScrubInput
            label={`${label} alpha`}
            displayLabel="A"
            unit="%"
            min={0}
            max={100}
            value={Math.round(color.a * 100)}
            onChange={(a) => commit({ a: a / 100 })}
          />
        </div>
        <div className="color-picker-values color-hsv-values">
          <ScrubInput
            label={`${label} saturation`}
            displayLabel="S"
            unit="%"
            min={0}
            max={100}
            value={Math.round(color.s * 100)}
            onChange={(s) => commit({ s: s / 100 })}
          />
          <ScrubInput
            label={`${label} brightness`}
            displayLabel="B"
            unit="%"
            min={0}
            max={100}
            value={Math.round(color.v * 100)}
            onChange={(v) => commit({ v: v / 100 })}
          />
        </div>
        <div className="color-swatches-heading">Quick colors</div>
        <div className="color-swatches">
          {swatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Use ${swatch}`}
              aria-pressed={opaque === swatch}
              style={{ backgroundColor: swatch }}
              onClick={() => {
                const next = hexToHsva(swatch);
                commit({ ...next, a: color.a });
              }}
            >
              {opaque === swatch && (
                <Check
                  size={12}
                  style={{
                    color:
                      hexToHsva(swatch).v > 0.8 && hexToHsva(swatch).s < 0.2
                        ? "#111"
                        : "#fff",
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
