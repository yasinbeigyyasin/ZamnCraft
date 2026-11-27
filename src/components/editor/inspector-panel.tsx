"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  Component,
  Frame,
  Grip,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Square,
  Type,
  MousePointer2,
} from "lucide-react";
import {
  findElementById,
  getLayoutMode,
  getSizingMode,
  useEditorStore,
  type EditorElement,
} from "@/store/editor-store";
import { DEFAULT_EFFECTS } from "@/lib/element-effects";
import { tools } from "./editor-controls";
import { ScrubInput } from "./scrub-input";
import { ColorField } from "./color-field";
import { ShadowControls } from "./shadow-controls";
import {
  PopoverSelect,
  PropertyRow,
  SegmentedControl,
  type ControlOption,
} from "./property-controls";

const numeric = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const options = (
  items: readonly (readonly [string, string])[],
): ControlOption[] => items.map(([value, label]) => ({ value, label }));
const sizing = options([
  ["fixed", "Fixed"],
  ["fill", "Fill"],
  ["fit", "Fit"],
]);
const layouts: ControlOption[] = [
  { value: "free", label: "Free", icon: Square },
  { value: "stack", label: "Stack", icon: Layers },
  { value: "grid", label: "Grid", icon: Grip },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inspector-section" aria-label={title}>
      <div className="inspector-section-heading">
        <h3>{title}</h3>
      </div>
      <div className="section-controls">{children}</div>
    </section>
  );
}
function Feature({
  title,
  active,
  onToggle,
  children,
  checkboxLabel,
}: {
  title: string;
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
  checkboxLabel?: string;
}) {
  const Icon = active ? Minus : Plus;
  return (
    <section className="inspector-section feature-section" aria-label={title}>
      <div className="inspector-section-heading">
        <h3>{title}</h3>
        {checkboxLabel ? (
          <label
            className="feature-toggle"
            title={`${active ? "Remove" : "Add"} ${title}`}
          >
            <input
              type="checkbox"
              aria-label={checkboxLabel}
              checked={active}
              onChange={onToggle}
            />
            <Icon size={14} aria-hidden="true" />
          </label>
        ) : (
          <button
            type="button"
            className="feature-toggle"
            aria-label={`${active ? "Remove" : "Add"} ${title.toLowerCase()}`}
            onClick={onToggle}
          >
            <Icon size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {active && (
        <div className="section-controls feature-content">{children}</div>
      )}
    </section>
  );
}
function Choice({
  label,
  value,
  items,
  onChange,
  displayLabel = label,
  popover = false,
}: {
  label: string;
  value: string;
  items: ControlOption[];
  onChange: (value: string) => void;
  displayLabel?: string;
  popover?: boolean;
}) {
  return (
    <PropertyRow label={displayLabel}>
      {popover ? (
        <PopoverSelect
          label={label}
          value={value}
          options={items}
          onChange={onChange}
        />
      ) : (
        <SegmentedControl
          label={label}
          value={value}
          options={items}
          onChange={onChange}
        />
      )}
    </PropertyRow>
  );
}
function EffectsInspector({ element }: { element: EditorElement }) {
  const effects = element.effects ?? DEFAULT_EFFECTS;
  const update = useEditorStore((state) => state.updateEffects),
    replay = useEditorStore((state) => state.replayAnimation);
  const id = element.id;
  const animated =
    effects.appear.enabled || effects.hover.enabled || effects.press.enabled;
  return (
    <>
      <div className="inspector-category">Effects & motion</div>
      <Feature
        title="Appear"
        active={effects.appear.enabled}
        checkboxLabel="Appear enabled"
        onToggle={() =>
          update(id, { appear: { enabled: !effects.appear.enabled } })
        }
      >
        <div role="group" aria-label="Appear settings">
          <PropertyRow label="Starting">
            <ScrubInput
              label="Appear opacity"
              displayLabel="α"
              unit="%"
              min={0}
              max={100}
              value={effects.appear.opacity * 100}
              onChange={(value) =>
                update(id, { appear: { opacity: value / 100 } })
              }
            />
            <ScrubInput
              label="Appear scale"
              displayLabel="Scale"
              unit="×"
              step={0.01}
              min={0}
              max={10}
              value={effects.appear.scale}
              onChange={(scale) => update(id, { appear: { scale } })}
            />
          </PropertyRow>
          <PropertyRow label="Offset">
            <ScrubInput
              label="Appear X offset"
              displayLabel="X"
              value={effects.appear.offsetX}
              onChange={(offsetX) => update(id, { appear: { offsetX } })}
            />
            <ScrubInput
              label="Appear Y offset"
              displayLabel="Y"
              value={effects.appear.offsetY}
              onChange={(offsetY) => update(id, { appear: { offsetY } })}
            />
          </PropertyRow>
          <button
            type="button"
            className="effect-replay"
            onClick={() => replay(id)}
          >
            <RotateCcw size={12} />
            Replay animation
          </button>
        </div>
      </Feature>
      <Feature
        title="Hover"
        active={effects.hover.enabled}
        checkboxLabel="Hover enabled"
        onToggle={() =>
          update(id, { hover: { enabled: !effects.hover.enabled } })
        }
      >
        <div role="group" aria-label="Hover settings">
          <PropertyRow label="Transform">
            <ScrubInput
              label="Hover scale"
              displayLabel="Scale"
              unit="×"
              step={0.01}
              min={0}
              max={10}
              value={effects.hover.scale}
              onChange={(scale) => update(id, { hover: { scale } })}
            />
            <ScrubInput
              label="Hover rotate"
              displayLabel="°"
              unit="deg"
              value={effects.hover.rotate}
              onChange={(rotate) => update(id, { hover: { rotate } })}
            />
          </PropertyRow>
          <label className="override-toggle">
            <input
              type="checkbox"
              aria-label="Hover fill override"
              checked={effects.hover.fill !== undefined}
              onChange={(event) =>
                update(id, {
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
              onChange={(fill) => update(id, { hover: { fill } })}
            />
          )}
          <label className="override-toggle">
            <input
              type="checkbox"
              aria-label="Hover opacity override"
              checked={effects.hover.opacity !== undefined}
              onChange={(event) =>
                update(id, {
                  hover: { opacity: event.target.checked ? 1 : undefined },
                })
              }
            />
            Opacity override
          </label>
          {effects.hover.opacity !== undefined && (
            <PropertyRow label="Opacity">
              <ScrubInput
                label="Hover opacity"
                displayLabel="α"
                unit="%"
                min={0}
                max={100}
                value={effects.hover.opacity * 100}
                onChange={(value) =>
                  update(id, { hover: { opacity: value / 100 } })
                }
              />
            </PropertyRow>
          )}
        </div>
      </Feature>
      <Feature
        title="Press"
        active={effects.press.enabled}
        checkboxLabel="Press enabled"
        onToggle={() =>
          update(id, { press: { enabled: !effects.press.enabled } })
        }
      >
        <PropertyRow label="Scale">
          <ScrubInput
            label="Press scale"
            displayLabel="Scale"
            unit="×"
            step={0.01}
            min={0}
            max={10}
            value={effects.press.scale}
            onChange={(scale) => update(id, { press: { scale } })}
          />
        </PropertyRow>
      </Feature>
      {animated && (
        <Section title="Transition">
          <Choice
            label="Transition"
            displayLabel="Type"
            value={effects.transition.type}
            items={options([
              ["ease", "Ease"],
              ["spring", "Spring"],
            ])}
            onChange={(value) =>
              update(id, { transition: { type: value as "ease" | "spring" } })
            }
          />
          {effects.transition.type === "ease" ? (
            <PropertyRow label="Duration">
              <ScrubInput
                label="Transition duration"
                displayLabel="Time"
                unit="s"
                step={0.01}
                min={0}
                max={10}
                value={effects.transition.duration}
                onChange={(duration) =>
                  update(id, { transition: { duration } })
                }
              />
            </PropertyRow>
          ) : (
            <>
              <PropertyRow label="Stiffness">
                <ScrubInput
                  label="Spring stiffness"
                  displayLabel="K"
                  unit=""
                  min={1}
                  max={1000}
                  value={effects.transition.stiffness}
                  onChange={(stiffness) =>
                    update(id, { transition: { stiffness } })
                  }
                />
              </PropertyRow>
              <PropertyRow label="Damping">
                <ScrubInput
                  label="Spring damping"
                  displayLabel="D"
                  unit=""
                  min={1}
                  max={100}
                  value={effects.transition.damping}
                  onChange={(damping) =>
                    update(id, { transition: { damping } })
                  }
                />
              </PropertyRow>
            </>
          )}
        </Section>
      )}
      <Feature
        title="Shadow"
        active={effects.shadow !== "none"}
        onToggle={() =>
          update(id, {
            shadow: effects.shadow === "none" ? "0 4px 12px #00000026" : "none",
          })
        }
      >
        <Choice
          label="Shadow preset"
          displayLabel="Preset"
          popover
          value={
            ["0 4px 12px #00000026", "0 8px 24px #00000040"].includes(
              effects.shadow,
            )
              ? effects.shadow
              : "custom"
          }
          items={[
            {
              value: "0 4px 12px #00000026",
              label: "Soft",
              icon: Layers,
              hint: "4 / 12",
              group: "Presets",
            },
            {
              value: "0 8px 24px #00000040",
              label: "Strong",
              icon: Layers,
              hint: "8 / 24",
              group: "Presets",
            },
            {
              value: "custom",
              label: "Custom",
              icon: Square,
              hint: "Editable",
              group: "Advanced",
            },
          ]}
          onChange={(shadow) => {
            if (shadow !== "custom") update(id, { shadow });
          }}
        />
        <ShadowControls
          value={effects.shadow}
          onChange={(shadow) => update(id, { shadow })}
        />
      </Feature>
      <Section title="Blur">
        <PropertyRow label="Amount">
          <ScrubInput
            label="Blur"
            displayLabel="Blur"
            min={0}
            max={100}
            value={effects.blur}
            onChange={(blur) => update(id, { blur })}
          />
        </PropertyRow>
      </Section>
    </>
  );
}

function ElementHeader({ element }: { element: EditorElement }) {
  const cancelRename = useRef(false);
  const rename = useEditorStore((state) => state.renameElement);
  const [name, setName] = useState(element.name),
    [focused, setFocused] = useState(false);
  const Icon = element.componentId
    ? Component
    : element.vector
      ? (tools.find((tool) => tool.id === element.vector!.kind)?.icon ?? Square)
      : element.type === "text"
        ? Type
        : element.type === "frame"
          ? Frame
          : Square;
  const state = useEditorStore();
  function parentOf(
    nodes: EditorElement[],
    parent?: EditorElement,
  ): EditorElement | undefined {
    for (const node of nodes) {
      if (node.id === element.id) return parent;
      const found = parentOf(node.children, node);
      if (found) return found;
    }
  }
  const parent = parentOf(state.elements);
  const canAlign = parent && getLayoutMode(parent.styles) === "free";
  function align(axis: "x" | "y", fraction: number) {
    if (!parent || !canAlign) return;
    const outer = document.querySelector<HTMLElement>(
      `[data-editor-element="${CSS.escape(parent.id)}"]`,
    );
    const inner = document.querySelector<HTMLElement>(
      `[data-editor-element="${CSS.escape(element.id)}"]`,
    );
    if (!outer || !inner) return;
    const parentBounds = outer.getBoundingClientRect();
    const bounds = inner.getBoundingClientRect();
    const offset =
      axis === "x"
        ? (bounds.left - parentBounds.left) / state.canvasConfig.zoom -
          outer.clientLeft +
          outer.scrollLeft
        : (bounds.top - parentBounds.top) / state.canvasConfig.zoom -
          outer.clientTop +
          outer.scrollTop;
    const currentOffset = numeric(
      axis === "x" ? element.styles.left : element.styles.top,
    );
    const size =
      axis === "x"
        ? outer.clientWidth - inner.offsetWidth
        : outer.clientHeight - inner.offsetHeight;
    state.updatePosition(
      element.id,
      axis === "x"
        ? { left: currentOffset + size * fraction - offset }
        : { top: currentOffset + size * fraction - offset },
    );
  }
  return (
    <div className="element-header">
      <div className="element-identity">
        <span className="element-type-icon">
          <Icon size={16} />
        </span>
        <div>
          <small>{element.componentRole ?? element.type}</small>
          <input
            className="element-name"
            aria-label="Layer name"
            value={focused ? name : element.name}
            onFocus={() => {
              setName(element.name);
              cancelRename.current = false;
              setFocused(true);
            }}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (!cancelRename.current) rename(element.id, name);
              setFocused(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.preventDefault();
                cancelRename.current = true;
                setName(element.name);
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      </div>
      <div
        className="quick-alignment"
        role="group"
        aria-label="Quick alignment"
      >
        {(
          [
            ["Align Left", AlignLeft, "x", 0],
            ["Align Center", AlignCenter, "x", 0.5],
            ["Align Right", AlignRight, "x", 1],
            ["Align Top", AlignStartVertical, "y", 0],
            ["Align Middle", AlignCenterVertical, "y", 0.5],
            ["Align Bottom", AlignEndVertical, "y", 1],
          ] as const
        ).map(([label, AlignIcon, axis, fraction]) => (
          <button
            type="button"
            key={label}
            aria-label={label}
            title={
              canAlign ? label : "Select a child in a Free layout to align"
            }
            disabled={!canAlign}
            onClick={() => align(axis, fraction)}
          >
            <AlignIcon size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}

function InspectorProperties({ element }: { element: EditorElement }) {
  const { updateStyles, updatePosition, updateSize, updateLayout, updateText } =
    useEditorStore();
  const styles = element.styles,
    id = element.id,
    mode = getLayoutMode(styles);
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  useEffect(() => {
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
  const patch = (next: CSSProperties) => updateStyles(id, next);
  const fill = Boolean(
    styles.backgroundColor &&
    styles.backgroundColor !== "transparent" &&
    styles.backgroundColor !== "none",
  );
  const border = Boolean(styles.borderStyle && styles.borderStyle !== "none");
  return (
    <div
      className="inspector-properties"
      role="group"
      aria-label="Element properties"
    >
      <Section title="Position">
        <Choice
          label="Position type"
          displayLabel="Position"
          value={styles.position === "absolute" ? "absolute" : "relative"}
          items={options([
            ["absolute", "Absolute"],
            ["relative", "Relative"],
          ])}
          onChange={(position) =>
            updatePosition(id, {
              position: position as "absolute" | "relative",
            })
          }
        />
        <PropertyRow label="Offset">
          <ScrubInput
            label="X"
            value={numeric(styles.left)}
            onChange={(left) => updatePosition(id, { left })}
          />
          <ScrubInput
            label="Y"
            value={numeric(styles.top)}
            onChange={(top) => updatePosition(id, { top })}
          />
        </PropertyRow>
      </Section>
      <Section title="Size">
        <PropertyRow label="Dimensions">
          <ScrubInput
            label="Width"
            displayLabel="W"
            min={0}
            value={numeric(styles.width, measured.width)}
            onChange={(value) => updateSize(id, "width", value)}
          />
          <ScrubInput
            label="Height"
            displayLabel="H"
            min={0}
            value={numeric(styles.height, measured.height)}
            onChange={(value) => updateSize(id, "height", value)}
          />
        </PropertyRow>
        {(["width", "height"] as const).map((axis) => (
          <Choice
            key={axis}
            label={`${axis === "width" ? "Width" : "Height"} sizing`}
            displayLabel={axis === "width" ? "Width" : "Height"}
            value={getSizingMode(styles[axis])}
            items={
              element.vector
                ? sizing.filter((option) => option.value !== "fit")
                : sizing
            }
            onChange={(value) =>
              updateSize(
                id,
                axis,
                value === "fixed" ? measured[axis] : (value as "fill" | "fit"),
              )
            }
          />
        ))}
      </Section>
      <Section title="Layout">
        <Choice
          label="Layout mode"
          displayLabel="Layout"
          value={mode}
          items={layouts}
          onChange={(value) =>
            updateLayout(id, value as "free" | "stack" | "grid")
          }
        />
        {mode !== "free" && (
          <>
            {mode === "stack" ? (
              <Choice
                label="Direction"
                value={styles.flexDirection ?? "column"}
                items={[
                  { value: "row", label: "Row", icon: ArrowRight },
                  { value: "column", label: "Column", icon: ArrowDown },
                ]}
                onChange={(value) =>
                  patch({ flexDirection: value as "row" | "column" })
                }
              />
            ) : (
              <PropertyRow label="Columns">
                <ScrubInput
                  label="Columns"
                  displayLabel="#"
                  unit=""
                  min={1}
                  max={12}
                  value={Number(
                    String(styles.gridTemplateColumns ?? "").match(
                      /repeat\((\d+)/,
                    )?.[1] ?? 2,
                  )}
                  onChange={(value) => {
                    if (Number.isInteger(value))
                      patch({
                        gridTemplateColumns: `repeat(${value}, minmax(0, 1fr))`,
                      });
                  }}
                />
              </PropertyRow>
            )}
            <PropertyRow label="Spacing">
              <ScrubInput
                label="Gap"
                min={0}
                value={numeric(styles.gap)}
                onChange={(gap) => patch({ gap })}
              />
              <ScrubInput
                label="Padding"
                displayLabel="Pad"
                min={0}
                value={numeric(styles.padding)}
                onChange={(padding) => patch({ padding })}
              />
            </PropertyRow>
            <PropertyRow label="Alignment">
              <div
                className="alignment-icons"
                role="group"
                aria-label="Layout alignment"
              >
                {(
                  [
                    ["flex-start", "Main start", ArrowLeft, "justifyContent"],
                    ["center", "Main center", AlignCenter, "justifyContent"],
                    ["flex-end", "Main end", ArrowRight, "justifyContent"],
                    ["flex-start", "Cross start", ArrowUp, "alignItems"],
                    [
                      "center",
                      "Cross center",
                      AlignCenterVertical,
                      "alignItems",
                    ],
                    ["flex-end", "Cross end", ArrowDown, "alignItems"],
                  ] as const
                ).map(([value, label, Icon, key]) => (
                  <button
                    type="button"
                    key={label}
                    aria-label={label}
                    title={label}
                    aria-pressed={(styles[key] ?? "flex-start") === value}
                    onClick={() => patch({ [key]: value })}
                  >
                    <Icon size={12} />
                  </button>
                ))}
              </div>
            </PropertyRow>
          </>
        )}
      </Section>
      <Section title="Appearance">
        <PropertyRow label="Opacity">
          <ScrubInput
            label="Opacity"
            displayLabel="α"
            unit="%"
            min={0}
            max={100}
            value={Number((numeric(styles.opacity, 1) * 100).toFixed(2))}
            onChange={(value) => patch({ opacity: value / 100 })}
          />
        </PropertyRow>
        <PropertyRow label="Radius">
          <ScrubInput
            label="Radius"
            displayLabel="R"
            min={0}
            value={numeric(styles.borderRadius)}
            onChange={(borderRadius) => patch({ borderRadius })}
          />
        </PropertyRow>
      </Section>
      <Feature
        title="Fill"
        active={fill}
        onToggle={() =>
          patch({ backgroundColor: fill ? "transparent" : "#ffffff" })
        }
      >
        <ColorField
          label="Fill"
          value={String(styles.backgroundColor ?? "#ffffff")}
          onChange={(backgroundColor) => patch({ backgroundColor })}
        />
      </Feature>
      <Feature
        title="Border"
        active={border}
        onToggle={() =>
          patch({
            borderStyle: border ? "none" : "solid",
            borderWidth: styles.borderWidth || 1,
            borderColor: styles.borderColor ?? "#333333",
          })
        }
      >
        <Choice
          label="Border"
          displayLabel="Style"
          popover
          value={styles.borderStyle ?? "solid"}
          items={[
            {
              value: "solid",
              label: "Solid",
              icon: Square,
              hint: "Continuous",
              group: "Line style",
            },
            {
              value: "dashed",
              label: "Dashed",
              icon: Square,
              hint: "Segments",
              group: "Line style",
            },
            {
              value: "dotted",
              label: "Dotted",
              icon: Grip,
              hint: "Dots",
              group: "Line style",
            },
          ]}
          onChange={(borderStyle) => patch({ borderStyle })}
        />
        <PropertyRow label="Weight">
          <ScrubInput
            label="Border width"
            displayLabel="W"
            min={0}
            value={numeric(styles.borderWidth, 1)}
            onChange={(borderWidth) => patch({ borderWidth })}
          />
        </PropertyRow>
        <ColorField
          label="Border color"
          value={String(styles.borderColor ?? "#333333")}
          onChange={(borderColor) => patch({ borderColor })}
        />
      </Feature>
      {element.type === "text" && (
        <Section title="Typography">
          <PropertyRow label="Content">
            <textarea
              className="text-control"
              aria-label="Text content"
              value={element.content ?? element.name}
              onChange={(event) => updateText(id, event.target.value)}
            />
          </PropertyRow>
          <PropertyRow label="Font size">
            <ScrubInput
              label="Font size"
              displayLabel="T"
              min={1}
              value={numeric(styles.fontSize, 16)}
              onChange={(fontSize) => patch({ fontSize })}
            />
          </PropertyRow>
          <Choice
            label="Weight"
            popover
            value={String(styles.fontWeight ?? 400)}
            items={Array.from({ length: 9 }, (_, index) => ({
              value: String((index + 1) * 100),
              label: String((index + 1) * 100),
              icon: Type,
              hint: [
                "Thin",
                "Extra light",
                "Light",
                "Regular",
                "Medium",
                "Semibold",
                "Bold",
                "Extra bold",
                "Black",
              ][index],
              group: index < 4 ? "Text" : "Emphasis",
            }))}
            onChange={(value) => patch({ fontWeight: Number(value) })}
          />
          <ColorField
            label="Text color"
            value={String(styles.color ?? "#111111")}
            onChange={(color) => patch({ color })}
          />
          <Choice
            label="Text alignment"
            displayLabel="Align"
            value={styles.textAlign ?? "left"}
            items={options([
              ["left", "Left"],
              ["center", "Center"],
              ["right", "Right"],
              ["justify", "Justify"],
            ])}
            onChange={(value) =>
              patch({ textAlign: value as CSSProperties["textAlign"] })
            }
          />
        </Section>
      )}
      <section aria-label="Effects & Animations">
        <EffectsInspector element={element} />
      </section>
    </div>
  );
}

function CanvasSettings() {
  const state = useEditorStore();
  const insert = (type: "frame" | "text", stack = false) => {
    const root = state.elements.find((item) => item.type === "frame");
    state.beginHistory();
    const id = state.addElement(root?.id ?? null, type, { x: 40, y: 40 });
    if (id && stack) state.updateLayout(id, "stack");
    state.endHistory();
  };
  return (
    <div className="canvas-settings">
      <div className="canvas-settings-intro">
        <MousePointer2 size={22} />
        <h3>Canvas Settings</h3>
        <p>Select a layer to inspect it, or start with something new.</p>
      </div>
      <Section title="Workspace">
        <ColorField
          label="Background"
          value={state.canvasBackground}
          onChange={state.setCanvasBackground}
        />
        <PropertyRow label="Zoom">
          <ScrubInput
            label="Canvas zoom"
            displayLabel="Z"
            unit="%"
            min={25}
            max={200}
            value={Math.round(state.canvasConfig.zoom * 100)}
            onChange={(value) => state.setZoom(value / 100)}
          />
        </PropertyRow>
      </Section>
      <Section title="Quick insert">
        <div className="quick-insert">
          {[
            ["Frame", Frame, () => insert("frame")],
            ["Text", Type, () => insert("text")],
            ["Stack", Layers, () => insert("frame", true)],
          ].map(([label, Icon, action]) => {
            const I = Icon as typeof Frame;
            return (
              <button
                type="button"
                key={String(label)}
                onClick={action as () => void}
              >
                <I size={16} />
                <span>{String(label)}</span>
              </button>
            );
          })}
        </div>
      </Section>
      <div className="canvas-settings-tip">
        <kbd>F</kbd> Frame <kbd>T</kbd> Text <kbd>S</kbd> Stack
        <br />
        <kbd>Space</kbd> + drag to pan
      </div>
    </div>
  );
}

export function InspectorPanel() {
  useEffect(() => () => useEditorStore.getState().endHistory(), []);
  const selected = useEditorStore((state) =>
    state.selectedElementId
      ? findElementById(state.elements, state.selectedElementId)
      : undefined,
  );
  return (
    <div
      className="inspector-panel"
      onFocusCapture={(event) => {
        if (
          (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement) &&
          event.target.type !== "number"
        )
          useEditorStore.getState().beginHistory();
      }}
      onBlurCapture={(event) => {
        if (
          (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement) &&
          event.target.type !== "number"
        )
          useEditorStore.getState().endHistory();
      }}
    >
      <div className="panel-heading">
        <h2>{selected ? "Design" : "Canvas"}</h2>
        <span className="panel-heading-hint">
          {selected ? "Live properties" : "Workspace"}
        </span>
      </div>
      <div className="inspector-scroll">
        {selected ? (
          <>
            <ElementHeader key={`name-${selected.id}`} element={selected} />
            <InspectorProperties key={selected.id} element={selected} />
          </>
        ) : (
          <CanvasSettings />
        )}
      </div>
      <footer className="panel-footer inspector-footer">
        <span className="small-brand">Z</span>
        <span>ZamnCraft</span>
        <span className="editor-badge">Editor</span>
      </footer>
    </div>
  );
}
