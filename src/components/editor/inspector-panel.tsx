"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  findElementById,
  getLayoutMode,
  getSizingMode,
  useEditorStore,
  type EditorElement,
} from "@/store/editor-store";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Grip,
  Layers,
  MousePointer2,
  Settings2,
  Sparkles,
  Square,
  StretchHorizontal,
} from "lucide-react";

function NumberField({
  label,
  value,
  onChange,
  displayLabel = label,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  displayLabel?: string;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  return (
    <label className="inspector-field">
      <span>{displayLabel}</span>
      <input
        type="number"
        step="any"
        aria-label={label}
        min={min}
        max={max}
        value={focused ? draft : value}
        onFocus={() => {
          setDraft(String(value));
          setFocused(true);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = event.target.valueAsNumber;
          if (
            Number.isFinite(next) &&
            (min === undefined || next >= min) &&
            (max === undefined || next <= max)
          )
            onChange(next);
        }}
        onBlur={() => setFocused(false)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  displayLabel = label,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  displayLabel?: string;
}) {
  return (
    <label className="inspector-select">
      <span>{displayLabel}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
  clearable = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const hex = /^#[\da-f]{3,8}$/i.test(value) ? value : "#000000";
  const picker =
    hex.length === 4
      ? `#${hex
          .slice(1)
          .split("")
          .map((char) => char + char)
          .join("")}`
      : hex.slice(0, 7);
  return (
    <div className="inspector-color property-row">
      <span>{label}</span>
      <input
        type="color"
        aria-label={`${label} color picker`}
        value={picker}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="text"
        aria-label={`${label} hex`}
        spellCheck={false}
        value={focused ? draft : value}
        onFocus={() => {
          setDraft(value);
          setFocused(true);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(next))
            onChange(next);
        }}
        onBlur={() => setFocused(false)}
      />
      {clearable && (
        <button
          type="button"
          className="color-clear"
          aria-label="Remove fill"
          onClick={() => onChange("transparent")}
        >
          ×
        </button>
      )}
    </div>
  );
}

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="inspector-section" aria-label={title}>
      <div className="inspector-section-heading">
        <h3>{title}</h3>
        <ChevronDown size={12} aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}

function numeric(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function InspectorProperties({ element }: { element?: EditorElement }) {
  const updateStyles = useEditorStore((state) => state.updateStyles);
  const updatePosition = useEditorStore((state) => state.updatePosition);
  const updateSize = useEditorStore((state) => state.updateSize);
  const updateLayout = useEditorStore((state) => state.updateLayout);
  const updateText = useEditorStore((state) => state.updateText);
  const styles = element?.styles ?? {};
  const id = element?.id ?? "";
  const mode = getLayoutMode(styles);
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!id) return;
    const node = document.querySelector<HTMLElement>(
      `[data-editor-element="${CSS.escape(id)}"]`,
    );
    if (!node) return;
    const measure = () =>
      setMeasured({ width: node.offsetWidth, height: node.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [id]);
  const patch = (styles: CSSProperties) => updateStyles(id, styles);
  return (
    <fieldset
      className="inspector-properties"
      disabled={!element}
      aria-label="Element properties"
    >
      <InspectorSection title="Position">
        <SelectField
          label="Position type"
          displayLabel="Type"
          value={styles.position === "absolute" ? "absolute" : "relative"}
          options={[
            ["absolute", "Absolute"],
            ["relative", "Relative"],
          ]}
          onChange={(position) =>
            updatePosition(id, {
              position: position as "absolute" | "relative",
            })
          }
        />
        <div className="field-grid">
          <NumberField
            label="X"
            value={numeric(styles.left)}
            onChange={(left) => updatePosition(id, { left })}
          />
          <NumberField
            label="Y"
            value={numeric(styles.top)}
            onChange={(top) => updatePosition(id, { top })}
          />
        </div>
      </InspectorSection>
      <InspectorSection title="Size">
        <div className="field-grid">
          <NumberField
            label="Width"
            displayLabel="W"
            min={0}
            value={numeric(styles.width, measured.width)}
            onChange={(value) => updateSize(id, "width", value)}
          />
          <NumberField
            label="Height"
            displayLabel="H"
            min={0}
            value={numeric(styles.height, measured.height)}
            onChange={(value) => updateSize(id, "height", value)}
          />
          {(["width", "height"] as const).map((axis) => (
            <SelectField
              key={axis}
              label={`${axis === "width" ? "Width" : "Height"} sizing`}
              displayLabel={axis === "width" ? "Width" : "Height"}
              value={getSizingMode(styles[axis])}
              options={[
                ["fixed", "Fixed"],
                ["fill", "Fill"],
                ["fit", "Fit"],
              ]}
              onChange={(value) =>
                updateSize(
                  id,
                  axis,
                  value === "fixed"
                    ? measured[axis]
                    : (value as "fill" | "fit"),
                )
              }
            />
          ))}
        </div>
      </InspectorSection>
      <InspectorSection title="Layout">
        <div className="layout-options" role="group" aria-label="Layout mode">
          {(
            [
              ["free", "Free", Square],
              ["stack", "Stack", Layers],
              ["grid", "Grid", Grip],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              type="button"
              key={value}
              aria-pressed={mode === value}
              onClick={() => updateLayout(id, value)}
            >
              <Icon size={10} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {mode !== "free" && (
          <>
            {mode === "stack" ? (
              <SelectField
                label="Direction"
                value={styles.flexDirection ?? "column"}
                options={[
                  ["row", "Horizontal"],
                  ["column", "Vertical"],
                ]}
                onChange={(value) =>
                  patch({ flexDirection: value as "row" | "column" })
                }
              />
            ) : (
              <NumberField
                label="Columns"
                value={Number(
                  String(styles.gridTemplateColumns ?? "").match(
                    /repeat\((\d+)/,
                  )?.[1] ?? 2,
                )}
                min={1}
                max={12}
                onChange={(value) => {
                  if (Number.isInteger(value))
                    patch({
                      gridTemplateColumns: `repeat(${value}, minmax(0, 1fr))`,
                    });
                }}
              />
            )}
            <div className="field-grid inspector-spaced">
              <NumberField
                label="Gap"
                min={0}
                value={numeric(styles.gap)}
                onChange={(gap) => patch({ gap })}
              />
              <NumberField
                label="Padding"
                min={0}
                value={numeric(styles.padding)}
                onChange={(padding) => patch({ padding })}
              />
            </div>
            <div className="property-row inspector-spaced">
              <span>Alignment</span>
              <div
                className="alignment-icons"
                role="group"
                aria-label="Layout alignment"
              >
                {(
                  [
                    ["flex-start", "Main start", ArrowLeft],
                    ["center", "Main center", StretchHorizontal],
                    ["flex-end", "Main end", ArrowRight],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    type="button"
                    key={label}
                    aria-label={label}
                    title={label}
                    aria-pressed={
                      (styles.justifyContent ?? "flex-start") === value
                    }
                    onClick={() => patch({ justifyContent: value })}
                  >
                    <Icon size={12} aria-hidden="true" />
                  </button>
                ))}
                {(
                  [
                    ["flex-start", "Cross start", ArrowUp],
                    ["center", "Cross center", StretchHorizontal],
                    ["flex-end", "Cross end", ArrowDown],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    type="button"
                    key={label}
                    aria-label={label}
                    title={label}
                    aria-pressed={styles.alignItems === value}
                    onClick={() => patch({ alignItems: value })}
                  >
                    <Icon size={12} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </InspectorSection>
      <InspectorSection title="Styles">
        <ColorField
          label="Fill"
          value={String(styles.backgroundColor ?? "transparent")}
          clearable
          onChange={(backgroundColor) => patch({ backgroundColor })}
        />
        <div className="field-grid inspector-spaced">
          <NumberField
            label="Opacity"
            displayLabel="Opacity %"
            value={Number((numeric(styles.opacity, 1) * 100).toFixed(2))}
            min={0}
            max={100}
            onChange={(value) => patch({ opacity: value / 100 })}
          />
          <NumberField
            label="Radius"
            value={numeric(styles.borderRadius)}
            min={0}
            onChange={(borderRadius) => patch({ borderRadius })}
          />
        </div>
        <div className="inspector-spaced">
          <SelectField
            label="Border"
            value={styles.borderStyle ?? "none"}
            options={[
              ["none", "None"],
              ["solid", "Solid"],
              ["dashed", "Dashed"],
              ["dotted", "Dotted"],
            ]}
            onChange={(value) =>
              patch({
                borderStyle: value,
                borderWidth: styles.borderWidth ?? 1,
                borderColor: styles.borderColor ?? "#000000",
              })
            }
          />
          <NumberField
            label="Border width"
            value={numeric(styles.borderWidth)}
            min={0}
            onChange={(borderWidth) =>
              patch({
                borderWidth,
                borderStyle:
                  styles.borderStyle && styles.borderStyle !== "none"
                    ? styles.borderStyle
                    : "solid",
              })
            }
          />
          <ColorField
            label="Border color"
            value={String(styles.borderColor ?? "#000000")}
            onChange={(borderColor) => patch({ borderColor })}
          />
        </div>
      </InspectorSection>
      {element?.type === "text" && (
        <InspectorSection title="Typography">
          <label className="inspector-text-label">
            Content
            <textarea
              aria-label="Text content"
              value={element.content ?? element.name}
              onChange={(event) => updateText(id, event.target.value)}
            />
          </label>
          <div className="field-grid inspector-spaced">
            <NumberField
              label="Font size"
              min={1}
              value={numeric(styles.fontSize, 16)}
              onChange={(fontSize) => patch({ fontSize })}
            />
            <SelectField
              label="Weight"
              value={String(styles.fontWeight ?? 400)}
              options={Array.from(
                { length: 9 },
                (_, index) =>
                  [
                    String((index + 1) * 100),
                    String((index + 1) * 100),
                  ] as const,
              )}
              onChange={(value) => patch({ fontWeight: Number(value) })}
            />
          </div>
          <ColorField
            label="Text color"
            value={String(styles.color ?? "#111111")}
            onChange={(color) => patch({ color })}
          />
          <SelectField
            label="Text alignment"
            value={styles.textAlign ?? "left"}
            options={[
              ["left", "Left"],
              ["center", "Center"],
              ["right", "Right"],
              ["justify", "Justify"],
            ]}
            onChange={(value) =>
              patch({ textAlign: value as CSSProperties["textAlign"] })
            }
          />
        </InspectorSection>
      )}
      <InspectorSection title="Effects">
        <p className="effects-empty">
          <Sparkles size={12} aria-hidden="true" />
          No effects applied
        </p>
      </InspectorSection>
    </fieldset>
  );
}

export function InspectorPanel() {
  const selected = useEditorStore((state) =>
    state.selectedElementId
      ? findElementById(state.elements, state.selectedElementId)
      : undefined,
  );
  return (
    <div className="inspector-panel">
      <div className="panel-heading">
        <h2>Inspector</h2>
        <Settings2 size={13} className="muted" aria-hidden="true" />
      </div>
      <div className="inspector-scroll">
        <div className="inspector-empty">
          <span className="inspector-selection-icon">
            <MousePointer2 size={13} aria-hidden="true" />
          </span>
          <div>
            <p>{selected?.name ?? "Nothing selected"}</p>
            <p className="muted">
              {selected
                ? "Changes apply live"
                : "Select an element to edit its properties"}
            </p>
          </div>
        </div>
        <InspectorProperties key={selected?.id ?? "none"} element={selected} />
      </div>
      <footer className="panel-footer inspector-footer">
        <span className="small-brand" aria-hidden="true">
          Z
        </span>
        <span>ZamnCraft</span>
        <span className="editor-badge">Editor</span>
      </footer>
    </div>
  );
}
