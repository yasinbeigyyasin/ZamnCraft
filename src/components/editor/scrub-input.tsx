"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";

export function ScrubInput({
  label,
  value,
  onChange,
  displayLabel = label,
  min = -10000000,
  max = 10000000,
  unit = "px",
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  displayLabel?: string;
  min?: number;
  max?: number;
  unit?: string;
  step?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const gesture = useRef<{
    x: number;
    value: number;
    pointer: number;
    node: HTMLButtonElement;
  } | null>(null);
  const current = useRef({ value, onChange, min, max });
  current.current = { value, onChange, min, max };
  const clamp = (number: number) =>
    Math.min(
      current.current.max,
      Math.max(current.current.min, Math.round(number * 1000) / 1000),
    );
  const finish = (cancel = false) => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    useEditorStore.getState().endHistory(cancel);
    if (active.node.hasPointerCapture(active.pointer))
      active.node.releasePointerCapture(active.pointer);
    setScrubbing(false);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    const cancel = () => finishRef.current(true);
    const key = (event: KeyboardEvent) => {
      if (
        gesture.current &&
        (event.key === "Escape" ||
          ((event.ctrlKey || event.metaKey) && /^(z|y)$/i.test(event.key)))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key, true);
      cancel();
    };
  }, []);
  return (
    <div
      className={`scrub-input inspector-field ${scrubbing ? "is-scrubbing" : ""}`}
    >
      <button
        type="button"
        className="scrub-prefix"
        aria-label={`Scrub ${label}`}
        title={`Drag to adjust ${label} · Shift for 10×`}
        disabled={disabled}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          event.preventDefault();
          if (document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
          useEditorStore.getState().beginHistory();
          gesture.current = {
            x: event.clientX,
            value: current.current.value,
            pointer: event.pointerId,
            node: event.currentTarget,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setScrubbing(true);
        }}
        onPointerMove={(event) => {
          const active = gesture.current;
          if (!active || active.pointer !== event.pointerId) return;
          const next = clamp(
            active.value +
              (event.clientX - active.x) * step * (event.shiftKey ? 10 : 1),
          );
          current.current.onChange(next);
          setDraft(String(next));
        }}
        onPointerUp={() => finish()}
        onPointerCancel={() => finish(true)}
        onLostPointerCapture={() => finish(true)}
        onClick={(event) => {
          if (event.detail === 0) input.current?.focus();
        }}
      >
        {displayLabel}
      </button>
      <input
        ref={input}
        type="number"
        inputMode="decimal"
        aria-label={label}
        step="any"
        min={min}
        max={max}
        disabled={disabled}
        value={focused ? draft : value}
        onFocus={() => {
          setDraft(String(value));
          setFocused(true);
          useEditorStore.getState().beginHistory();
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = event.target.valueAsNumber;
          if (Number.isFinite(next) && next >= min && next <= max)
            onChange(next);
        }}
        onBlur={() => {
          setFocused(false);
          useEditorStore.getState().endHistory();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            event.stopPropagation();
            const next = clamp(
              current.current.value +
                (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 10 : 1),
            );
            setDraft(String(next));
            onChange(next);
          } else if (event.key === "Enter") event.currentTarget.blur();
          else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            useEditorStore.getState().endHistory(true);
            event.currentTarget.blur();
          }
        }}
      />
      {unit && (
        <span className="scrub-unit" aria-hidden="true">
          {unit}
        </span>
      )}
    </div>
  );
}
