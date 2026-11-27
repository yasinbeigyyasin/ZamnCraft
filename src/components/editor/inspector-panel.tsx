import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Grip,
  Layers,
  MousePointer2,
  Plus,
  Settings2,
  Sparkles,
  Square,
  StretchHorizontal,
} from "lucide-react";

function InspectorField({
  label,
  value = "—",
  displayLabel = label,
}: {
  label: string;
  value?: string;
  displayLabel?: string;
}) {
  return (
    <label className="inspector-field">
      <span>{displayLabel}</span>
      <input disabled aria-label={label} value={value} readOnly />
    </label>
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
        {title === "Effects" ? (
          <Plus size={13} aria-hidden="true" />
        ) : (
          <ChevronDown size={12} aria-hidden="true" />
        )}
      </div>
      {children}
    </section>
  );
}

export function InspectorPanel() {
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
            <p>Nothing selected</p>
            <p className="muted">Select an element to edit its properties</p>
          </div>
        </div>
        <InspectorSection title="Position">
          <label className="inspector-select">
            <span>Type</span>
            <select disabled aria-label="Position type" defaultValue="absolute">
              <option value="absolute">Absolute</option>
            </select>
          </label>
          <div className="field-grid">
            <InspectorField label="X" />
            <InspectorField label="Y" />
          </div>
        </InspectorSection>
        <InspectorSection title="Size">
          <div className="field-grid">
            <InspectorField label="Width" displayLabel="W" />
            <InspectorField label="Height" displayLabel="H" />
          </div>
          <div className="field-captions">
            <span>
              <ChevronDown size={9} aria-hidden="true" />
              Fixed width
            </span>
            <span>
              <ChevronDown size={9} aria-hidden="true" />
              Fixed height
            </span>
          </div>
        </InspectorSection>
        <InspectorSection title="Layout">
          <fieldset
            disabled
            className="layout-options"
            aria-label="Layout mode"
          >
            <button type="button" aria-pressed="true">
              <Square size={10} aria-hidden="true" />
              Free
            </button>
            <button type="button" aria-pressed="false">
              <Layers size={10} aria-hidden="true" />
              Stack
            </button>
            <button type="button" aria-pressed="false">
              <Grip size={10} aria-hidden="true" />
              Grid
            </button>
          </fieldset>
          <div className="property-row">
            <span>Alignment</span>
            <div className="alignment-icons" aria-hidden="true">
              <ArrowLeft size={12} />
              <StretchHorizontal size={12} />
              <ArrowRight size={12} />
              <span />
              <ArrowUp size={12} />
              <ArrowDown size={12} />
            </div>
          </div>
        </InspectorSection>
        <InspectorSection title="Styles">
          <div className="property-row">
            <span>Fill</span>
            <span className="fill-value">
              <span className="checker-swatch" aria-hidden="true" />
              None<span className="fill-dash">—</span>
            </span>
          </div>
          <div className="field-grid">
            <InspectorField label="Opacity" value="100%" />
            <InspectorField label="Radius" value="0" />
          </div>
          <div className="property-row">
            <span>Border</span>
            <Plus size={12} aria-hidden="true" />
          </div>
        </InspectorSection>
        <InspectorSection title="Effects">
          <p className="effects-empty">
            <Sparkles size={12} aria-hidden="true" />
            No effects applied
          </p>
        </InspectorSection>
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
