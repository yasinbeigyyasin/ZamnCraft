import type { CSSProperties } from "react";
import type { EditorElement } from "@/types/editor";
import { formatShadow, parseShadow, shadowLayers } from "./shadow";

const lengths = new Set([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "left",
  "right",
  "top",
  "bottom",
  "inset",
  "gap",
  "rowGap",
  "columnGap",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "paddingInline",
  "paddingBlock",
  "paddingInlineStart",
  "paddingInlineEnd",
  "paddingBlockStart",
  "paddingBlockEnd",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "marginInline",
  "marginBlock",
  "fontSize",
  "letterSpacing",
  "textIndent",
  "wordSpacing",
  "flexBasis",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "outlineWidth",
  "outlineOffset",
  "perspective",
]);
const pixelStrings = new Set([
  ...lengths,
  "lineHeight",
  "border",
  "borderTop",
  "borderRight",
  "borderBottom",
  "borderLeft",
  "outline",
  "gridTemplateColumns",
  "gridTemplateRows",
  "textShadow",
  "filter",
  "transform",
]);
const round = (value: number) => Math.round(value * 10000) / 10000;

function scaleShadow(value: string, factor: number): string {
  if (value === "none") return value;
  return shadowLayers(value)
    .map((layer) => {
      const parts = parseShadow(layer);
      // Preserve expressions and relative units instead of replacing unsupported saved CSS.
      return parts
        ? formatShadow({
            ...parts,
            x: round(parts.x * factor),
            y: round(parts.y * factor),
            blur: round(parts.blur * factor),
            spread: round(parts.spread * factor),
          })
        : layer;
    })
    .join(", ");
}

export function scaleStyles(
  styles: CSSProperties,
  factor: number,
): CSSProperties {
  return Object.fromEntries(
    Object.entries(styles).map(([key, value]) => [
      key,
      typeof value === "number" && lengths.has(key)
        ? round(value * factor)
        : typeof value === "string" && pixelStrings.has(key)
          ? value.replace(
              /(-?(?:\d*\.)?\d+)px\b/g,
              (_, number: string) => `${round(Number(number) * factor)}px`,
            )
          : typeof value === "string" && key === "boxShadow"
            ? scaleShadow(value, factor)
            : value,
    ]),
  ) as CSSProperties;
}

/** Bake scaling into editable values; percentages and unitless ratios remain responsive. */
export function scaleElementTree(
  source: EditorElement,
  factor: number,
  rootStyles: CSSProperties = {},
): EditorElement {
  return {
    ...source,
    styles: { ...scaleStyles(source.styles, factor), ...rootStyles },
    ...(source.freePosition
      ? { freePosition: scaleStyles(source.freePosition, factor) }
      : {}),
    ...(source.effects
      ? {
          effects: {
            ...source.effects,
            appear: {
              ...source.effects.appear,
              offsetX: round(source.effects.appear.offsetX * factor),
              offsetY: round(source.effects.appear.offsetY * factor),
            },
            hover: { ...source.effects.hover },
            press: { ...source.effects.press },
            transition: { ...source.effects.transition },
            blur: Math.min(100, round(source.effects.blur * factor)),
            shadow: scaleShadow(source.effects.shadow, factor),
          },
        }
      : {}),
    children: source.children.map((child) => scaleElementTree(child, factor)),
  };
}
