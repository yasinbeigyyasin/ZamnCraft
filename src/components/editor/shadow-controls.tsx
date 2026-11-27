"use client";

import { useState } from "react";
import {
  parseShadow,
  shadowLayers,
  updateShadowLayer,
  type ShadowParts,
} from "@/lib/shadow";
import { ColorField } from "./color-field";
import { PropertyRow, SegmentedControl } from "./property-controls";
import { ScrubInput } from "./scrub-input";

export function ShadowControls({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const layers = shadowLayers(value);
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, layers.length - 1));
  const shadow = parseShadow(layers[index] ?? "");
  const patch = (next: Partial<ShadowParts>) =>
    onChange(updateShadowLayer(value, index, next));
  return (
    <>
      {layers.length > 1 && (
        <div
          className="shadow-layer-tabs"
          role="group"
          aria-label="Shadow layers"
        >
          {layers.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={index === i}
              onClick={() => setSelected(i)}
            >
              Shadow {i + 1}
            </button>
          ))}
        </div>
      )}
      {shadow ? (
        <>
          <PropertyRow label="Type">
            <SegmentedControl
              label="Shadow type"
              value={shadow.inset ? "inset" : "outer"}
              options={[
                { value: "outer", label: "Drop" },
                { value: "inset", label: "Inner" },
              ]}
              onChange={(value) => patch({ inset: value === "inset" })}
            />
          </PropertyRow>
          <PropertyRow label="Offset">
            <ScrubInput
              label="Shadow X"
              displayLabel="X"
              value={shadow.x}
              onChange={(x) => patch({ x })}
            />
            <ScrubInput
              label="Shadow Y"
              displayLabel="Y"
              value={shadow.y}
              onChange={(y) => patch({ y })}
            />
          </PropertyRow>
          <PropertyRow label="Blur">
            <ScrubInput
              label="Shadow blur"
              displayLabel="B"
              min={0}
              value={shadow.blur}
              onChange={(blur) => patch({ blur })}
            />
          </PropertyRow>
          <PropertyRow label="Spread">
            <ScrubInput
              label="Shadow spread"
              displayLabel="S"
              value={shadow.spread}
              onChange={(spread) => patch({ spread })}
            />
          </PropertyRow>
          <ColorField
            label="Shadow color"
            value={shadow.color}
            onChange={(color) => patch({ color })}
          />
          <p className="shadow-control-hint">
            Lower blur creates a harder edge.
          </p>
        </>
      ) : (
        <p className="shadow-control-hint" role="status">
          This shadow uses relative units or CSS expressions. It is preserved;
          choose a preset to edit it with pixel controls.
        </p>
      )}
    </>
  );
}
