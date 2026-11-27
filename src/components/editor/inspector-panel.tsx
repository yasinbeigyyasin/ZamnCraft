"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  findElementById,
  getLayoutMode,
  getSizingMode,
  useEditorStore,
  type EditorElement,
} from "@/store/editor-store";
import { DEFAULT_EFFECTS } from "@/lib/element-effects";
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
  RotateCcw,
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

function ShadowField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  return (
    <label className="effect-shadow-label">
      Shadow CSS
      <input
        aria-label="Shadow"
        value={focused ? draft : value}
        spellCheck={false}
        onFocus={() => {
          setDraft(value);
          setFocused(true);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          if (CSS.supports("box-shadow", event.target.value))
            onChange(event.target.value);
        }}
        onBlur={() => setFocused(false)}
      />
    </label>
  );
}

function EffectsInspector({ element }: { element?: EditorElement }) {
  const effects = element?.effects ?? DEFAULT_EFFECTS;
  const updateEffects = useEditorStore((state) => state.updateEffects);
  const replayAnimation = useEditorStore((state) => state.replayAnimation);
  const id = element?.id ?? "";
  return (
    <InspectorSection title="Effects & Animations">
      <label className="effect-toggle">
        <input
          type="checkbox"
          aria-label="Appear enabled"
          checked={effects.appear.enabled}
          onChange={(event) =>
            updateEffects(id, { appear: { enabled: event.target.checked } })
          }
        />
        Appear
      </label>
      <fieldset
        className="effect-fields"
        disabled={!effects.appear.enabled}
        aria-label="Appear settings"
      >
        <div className="field-grid">
          <NumberField
            label="Appear opacity"
            displayLabel="Opacity %"
            value={effects.appear.opacity * 100}
            min={0}
            max={100}
            onChange={(value) =>
              updateEffects(id, { appear: { opacity: value / 100 } })
            }
          />
          <NumberField
            label="Appear scale"
            displayLabel="Scale"
            value={effects.appear.scale}
            min={0}
            max={10}
            onChange={(scale) => updateEffects(id, { appear: { scale } })}
          />
          <NumberField
            label="Appear X offset"
            displayLabel="Offset X"
            value={effects.appear.offsetX}
            onChange={(offsetX) => updateEffects(id, { appear: { offsetX } })}
          />
          <NumberField
            label="Appear Y offset"
            displayLabel="Offset Y"
            value={effects.appear.offsetY}
            onChange={(offsetY) => updateEffects(id, { appear: { offsetY } })}
          />
        </div>
        <button
          type="button"
          className="effect-replay"
          onClick={() => replayAnimation(id)}
        >
          <RotateCcw size={12} aria-hidden="true" />
          Replay animation
        </button>
      </fieldset>
      <label className="effect-toggle">
        <input
          type="checkbox"
          aria-label="Hover enabled"
          checked={effects.hover.enabled}
          onChange={(event) =>
            updateEffects(id, { hover: { enabled: event.target.checked } })
          }
        />
        Hover
      </label>
      <fieldset
        className="effect-fields"
        disabled={!effects.hover.enabled}
        aria-label="Hover settings"
      >
        <div className="field-grid">
          <NumberField
            label="Hover scale"
            displayLabel="Scale"
            value={effects.hover.scale}
            min={0}
            max={10}
            onChange={(scale) => updateEffects(id, { hover: { scale } })}
          />
          <NumberField
            label="Hover rotate"
            displayLabel="Rotate °"
            value={effects.hover.rotate}
            onChange={(rotate) => updateEffects(id, { hover: { rotate } })}
          />
        </div>
        <label className="effect-toggle">
          <input
            type="checkbox"
            aria-label="Hover fill override"
            checked={effects.hover.fill !== undefined}
            onChange={(event) =>
              updateEffects(id, {
                hover: { fill: event.target.checked ? "#0099ff" : undefined },
              })
            }
          />
          Fill override
        </label>
        {effects.hover.fill !== undefined && (
          <ColorField
            label="Hover fill"
            value={effects.hover.fill}
            onChange={(fill) => updateEffects(id, { hover: { fill } })}
          />
        )}
        <label className="effect-toggle">
          <input
            type="checkbox"
            aria-label="Hover opacity override"
            checked={effects.hover.opacity !== undefined}
            onChange={(event) =>
              updateEffects(id, {
                hover: { opacity: event.target.checked ? 1 : undefined },
              })
            }
          />
          Opacity override
        </label>
        {effects.hover.opacity !== undefined && (
          <NumberField
            label="Hover opacity"
            displayLabel="Opacity %"
            value={effects.hover.opacity * 100}
            min={0}
            max={100}
            onChange={(value) =>
              updateEffects(id, { hover: { opacity: value / 100 } })
            }
          />
        )}
      </fieldset>
      <label className="effect-toggle">
        <input
          type="checkbox"
          aria-label="Press enabled"
          checked={effects.press.enabled}
          onChange={(event) =>
            updateEffects(id, { press: { enabled: event.target.checked } })
          }
        />
        Press
      </label>
      <fieldset
        className="effect-fields"
        disabled={!effects.press.enabled}
        aria-label="Press settings"
      >
        <NumberField
          label="Press scale"
          displayLabel="Scale"
          value={effects.press.scale}
          min={0}
          max={10}
          onChange={(scale) => updateEffects(id, { press: { scale } })}
        />
      </fieldset>
      <div className="inspector-spaced">
        <SelectField
          label="Transition"
          value={effects.transition.type}
          options={[
            ["ease", "Ease"],
            ["spring", "Spring"],
          ]}
          onChange={(value) =>
            updateEffects(id, {
              transition: { type: value as "ease" | "spring" },
            })
          }
        />
        {effects.transition.type === "ease" ? (
          <NumberField
            label="Transition duration"
            displayLabel="Duration (s)"
            value={effects.transition.duration}
            min={0}
            max={10}
            onChange={(duration) =>
              updateEffects(id, { transition: { duration } })
            }
          />
        ) : (
          <div className="field-grid">
            <NumberField
              label="Spring stiffness"
              displayLabel="Stiffness"
              value={effects.transition.stiffness}
              min={1}
              max={1000}
              onChange={(stiffness) =>
                updateEffects(id, { transition: { stiffness } })
              }
            />
            <NumberField
              label="Spring damping"
              displayLabel="Damping"
              value={effects.transition.damping}
              min={1}
              max={100}
              onChange={(damping) =>
                updateEffects(id, { transition: { damping } })
              }
            />
          </div>
        )}
      </div>
      <div className="inspector-spaced">
        <NumberField
          label="Blur"
          displayLabel="Blur (px)"
          value={effects.blur}
          min={0}
          max={100}
          onChange={(blur) => updateEffects(id, { blur })}
        />
      </div>
      <div className="inspector-spaced">
        <SelectField
          label="Shadow preset"
          value={
            ["none", "0 4px 12px #00000026", "0 8px 24px #00000040"].includes(
              effects.shadow,
            )
              ? effects.shadow
              : "custom"
          }
          options={[
            ["none", "None"],
            ["0 4px 12px #00000026", "Soft"],
            ["0 8px 24px #00000040", "Strong"],
            ["custom", "Custom"],
          ]}
          onChange={(shadow) => {
            if (shadow !== "custom") updateEffects(id, { shadow });
          }}
        />
      </div>
      <ShadowField
        value={effects.shadow}
        onChange={(shadow) => updateEffects(id, { shadow })}
      />
    </InspectorSection>
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
      <EffectsInspector element={element} />
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
