export type HSVA = { h: number; s: number; v: number; a: number };
const clamp = (n: number, max = 1) => Math.min(max, Math.max(0, n));

export function normalizeHex(value: string): string | null {
  if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value))
    return null;
  const hex = value.slice(1).toLowerCase();
  return "#" + (hex.length < 5 ? [...hex].map((c) => c + c).join("") : hex);
}

export function hexToHsva(value: string): HSVA {
  const hex = normalizeHex(value) ?? "#000000";
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h =
    d === 0
      ? 0
      : max === r
        ? ((g - b) / d) % 6
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return {
    h,
    s: max === 0 ? 0 : d / max,
    v: max,
    a: hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1,
  };
}

export function hsvaToHex({ h, s, v, a }: HSVA): string {
  h = ((h % 360) + 360) % 360;
  s = clamp(s);
  v = clamp(v);
  a = clamp(a);
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const byte = (n: number) =>
    Math.round(n * 255 + 1e-8)
      .toString(16)
      .padStart(2, "0");
  return "#" + rgb.map((n) => byte(n + m)).join("") + (a < 1 ? byte(a) : "");
}

/** Resolve saved CSS colors without replacing their original text until edited. Browser only. */
export function cssColorToHex(value: string): string {
  const hex = normalizeHex(value);
  if (hex) return hex;
  const context = document.createElement("canvas").getContext("2d");
  if (!context || !CSS.supports("color", value)) return "#000000";
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return (
    "#" +
    [r, g, b, ...(a < 255 ? [a] : [])]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}
