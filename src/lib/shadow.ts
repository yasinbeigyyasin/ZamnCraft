export type ShadowParts = {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
};

/** Split CSS lists/tokens without splitting inside color functions. */
function split(value: string, separator: "comma" | "space"): string[] {
  const parts: string[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    if (value[i] === ")") depth--;
    if (
      depth === 0 &&
      (separator === "comma" ? value[i] === "," : /\s/.test(value[i]))
    ) {
      const part = value.slice(start, i).trim();
      if (part) parts.push(part);
      start = i + 1;
    }
  }
  const last = value.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}
export function shadowLayers(value: string): string[] {
  return value.trim() === "none" ? [] : split(value, "comma");
}
export function parseShadow(value: string): ShadowParts | null {
  const tokens = split(value, "space"),
    lengths: number[] = [];
  let color = "currentColor",
    inset = false;
  for (const token of tokens) {
    if (token.toLowerCase() === "inset") inset = true;
    else if (/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:px)?$/i.test(token))
      lengths.push(parseFloat(token));
    else if (/^[+-]?(?:\d|\.)/.test(token)) return null;
    else if (color === "currentColor") color = token;
    else return null;
  }
  if (
    lengths.length < 2 ||
    lengths.length > 4 ||
    (lengths[2] ?? 0) < 0 ||
    lengths.some((n) => !Number.isFinite(n))
  )
    return null;
  return {
    x: lengths[0],
    y: lengths[1],
    blur: lengths[2] ?? 0,
    spread: lengths[3] ?? 0,
    color,
    inset,
  };
}
export function formatShadow(shadow: ShadowParts): string {
  return `${shadow.inset ? "inset " : ""}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`;
}
export function updateShadowLayer(
  value: string,
  index: number,
  patch: Partial<ShadowParts>,
): string {
  const layers = shadowLayers(value),
    current = parseShadow(layers[index] ?? "");
  if (!current) return value;
  layers[index] = formatShadow({ ...current, ...patch });
  return layers.join(", ");
}
