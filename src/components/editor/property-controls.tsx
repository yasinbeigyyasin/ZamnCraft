"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Square, type LucideIcon } from "lucide-react";

export type ControlOption = {
  value: string;
  label: string;
  icon?: LucideIcon;
  hint?: string;
  group?: string;
};

export function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="property-grid-row">
      <span className="property-label">{label}</span>
      <div className="property-controls">{children}</div>
    </div>
  );
}

export function SegmentedControl({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly ControlOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="group" aria-label={label} className="segmented-control">
      {options.map((option, index) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            disabled={disabled}
            aria-label={option.label}
            data-value={option.value}
            aria-pressed={value === option.value}
            title={option.hint ?? option.label}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight" || event.key === "ArrowDown")
                next = (index + 1) % options.length;
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
                next = (index + options.length - 1) % options.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = options.length - 1;
              else return;
              event.preventDefault();
              event.stopPropagation();
              onChange(options[next].value);
              refs.current[next]?.focus();
            }}
          >
            {Icon && <Icon size={13} aria-hidden="true" />}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PopoverSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly ControlOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const selected = options.find((option) => option.value === value);
  const typeahead = useRef({ text: "", time: 0 });
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useEffect(() => {
    if (!open) return;
    const node = popup.current!;
    node.showPopover();
    const position = () => {
      const bounds = trigger.current?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(288, window.innerWidth - 16);
      node.style.width = `${Math.max(Math.min(bounds.width, width), Math.min(232, width))}px`;
      node.style.maxHeight = `${Math.min(340, window.innerHeight - 24)}px`;
      node.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - node.offsetWidth - 8))}px`;
      node.style.top = `${Math.max(8, Math.min(bounds.bottom + 6, window.innerHeight - node.offsetHeight - 8))}px`;
    };
    position();
    const index = Math.max(
      0,
      optionsRef.current.findIndex((option) => option.value === value),
    );
    setActive(index);
    optionRefs.current[index]?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !node.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      node.hidePopover();
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, value]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const SelectedIcon = selected?.icon;
  return (
    <div className="popover-select">
      <button
        type="button"
        ref={trigger}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-controls={open ? id : undefined}
        aria-expanded={open}
        disabled={disabled || !options.length}
        className="select-trigger"
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }
        }}
      >
        {SelectedIcon && <SelectedIcon size={13} aria-hidden="true" />}
        <span>{selected?.label ?? "Choose…"}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={popup}
          id={id}
          popover="manual"
          role="listbox"
          aria-label={label}
          className="floating-select"
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
              close();
              return;
            }
            if (event.key === "Tab") {
              close();
              return;
            }
            let next = active;
            if (event.key === "ArrowDown") next = (active + 1) % options.length;
            else if (event.key === "ArrowUp")
              next = (active + options.length - 1) % options.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.length - 1;
            else if (
              event.key.length === 1 &&
              !event.ctrlKey &&
              !event.metaKey &&
              event.key !== " "
            ) {
              const now = Date.now();
              typeahead.current = {
                text:
                  (now - typeahead.current.time < 700
                    ? typeahead.current.text
                    : "") + event.key.toLowerCase(),
                time: now,
              };
              const match = options.findIndex((option) =>
                option.label.toLowerCase().startsWith(typeahead.current.text),
              );
              if (match >= 0) next = match;
            } else return;
            event.preventDefault();
            setActive(next);
            optionRefs.current[next]?.focus();
          }}
        >
          <div className="select-caption">{label}</div>
          {options.map((option, index) => {
            const Icon = option.icon ?? Square;
            return (
              <div key={option.value}>
                {option.group && option.group !== options[index - 1]?.group && (
                  <div className="select-section-caption">{option.group}</div>
                )}
                <button
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="option"
                  aria-label={option.label}
                  aria-selected={value === option.value}
                  tabIndex={active === index ? 0 : -1}
                  data-value={option.value}
                  onFocus={() => setActive(index)}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                >
                  <Check
                    size={12}
                    style={{
                      visibility: value === option.value ? "visible" : "hidden",
                    }}
                    aria-hidden="true"
                  />
                  <Icon size={13} aria-hidden="true" />
                  <span>{option.label}</span>
                  {option.hint && <small>{option.hint}</small>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
