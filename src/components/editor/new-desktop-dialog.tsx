"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, X } from "lucide-react";
import { IconButton } from "./editor-controls";
import { PropertyRow } from "./property-controls";
import { ScrubInput } from "./scrub-input";

const sizes = [
  { width: 1280, height: 800, label: "Laptop" },
  { width: 1440, height: 900, label: "Desktop" },
  { width: 1536, height: 864, label: "Large laptop" },
  { width: 1920, height: 1080, label: "Full HD" },
];

export function NewDesktopDialog({
  onDismiss,
  onCreate,
}: {
  onDismiss: () => void;
  onCreate: (width: number, height: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState(1440),
    [height, setHeight] = useState(900);
  const valid =
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= 1 &&
    width <= 10000 &&
    height >= 1 &&
    height <= 10000;
  useEffect(() => {
    const node = dialog.current!,
      trigger = document.activeElement;
    node.showModal();
    close.current?.focus();
    return () => {
      node.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="editor-dialog new-desktop-dialog"
      data-canvas-ui
      aria-labelledby="new-desktop-title"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="dialog-heading">
        <h2 id="new-desktop-title">New desktop</h2>
        <IconButton
          ref={close}
          icon={X}
          label="Close dialog"
          onClick={onDismiss}
        />
      </div>
      <form
        className="new-desktop-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onCreate(width, height);
        }}
      >
        <p>
          Add a blank desktop beside your existing frames. Nothing will be
          replaced.
        </p>
        <div
          className="desktop-size-presets"
          role="group"
          aria-label="Desktop size presets"
        >
          {sizes.map((size) => (
            <button
              key={size.width}
              type="button"
              aria-label={`${size.label} ${size.width} by ${size.height}`}
              aria-pressed={width === size.width && height === size.height}
              onClick={() => {
                setWidth(size.width);
                setHeight(size.height);
              }}
            >
              <Monitor size={22} strokeWidth={1.4} />
              <span>{size.label}</span>
              <small>
                {size.width} × {size.height}
              </small>
            </button>
          ))}
        </div>
        <div className="desktop-custom-size">
          <h3>Custom size</h3>
          <PropertyRow label="Dimensions">
            <ScrubInput
              label="Desktop width"
              displayLabel="W"
              value={width}
              min={1}
              max={10000}
              onChange={setWidth}
              onCancel={setWidth}
            />
            <ScrubInput
              label="Desktop height"
              displayLabel="H"
              value={height}
              min={1}
              max={10000}
              onChange={setHeight}
              onCancel={setHeight}
            />
          </PropertyRow>
          <p className="desktop-size-note" role={valid ? undefined : "alert"}>
            {valid
              ? "Width and height in pixels · up to 10,000 each"
              : "Enter whole-pixel dimensions between 1 and 10,000."}
          </p>
        </div>
        <button
          type="submit"
          className="create-desktop-button"
          disabled={!valid}
        >
          <Monitor size={14} />
          Create desktop
        </button>
      </form>
    </dialog>
  );
}
