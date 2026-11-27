import type { CSSProperties } from "react";
import type {
  EditorElement,
  EditorTool,
  Point,
  ShapeTool,
  VectorGeometry,
  VectorTool,
} from "@/types/editor";

export const VECTOR_TOOLS: VectorTool[] = [
  "rectangle",
  "ellipse",
  "line",
  "arrow",
  "triangle",
  "polygon",
  "star",
  "pen",
  "pencil",
];
export const isVectorTool = (tool: EditorTool): tool is VectorTool =>
  VECTOR_TOOLS.includes(tool as VectorTool);
const n = (value: number) => Number(value.toFixed(3));
export interface PenPoint extends Point {
  dx?: number;
  dy?: number;
}
export function penPath(points: PenPoint[], closed = false): string {
  if (!points.length) return "";
  let path = `M ${n(points[0].x)} ${n(points[0].y)}`;
  const segment = (a: PenPoint, b: PenPoint) =>
    a.dx || a.dy || b.dx || b.dy
      ? ` C ${n(a.x + (a.dx ?? 0))} ${n(a.y + (a.dy ?? 0))} ${n(b.x - (b.dx ?? 0))} ${n(b.y - (b.dy ?? 0))} ${n(b.x)} ${n(b.y)}`
      : ` L ${n(b.x)} ${n(b.y)}`;
  for (let i = 1; i < points.length; i++)
    path += segment(points[i - 1], points[i]);
  if (closed && points.length > 2)
    path += segment(points[points.length - 1], points[0]) + " Z";
  return path;
}
export function shapeGeometry(
  kind: ShapeTool,
  reverseX = false,
  reverseY = false,
): VectorGeometry {
  let path: string;
  if (kind === "rectangle") path = "M 0 0 L 100 0 L 100 100 L 0 100 Z";
  else if (kind === "ellipse")
    path =
      "M 50 0 C 77.614 0 100 22.386 100 50 C 100 77.614 77.614 100 50 100 C 22.386 100 0 77.614 0 50 C 0 22.386 22.386 0 50 0 Z";
  else if (kind === "line" || kind === "arrow") {
    const x1 = reverseX ? 100 : 0,
      x2 = reverseX ? 0 : 100;
    const y1 = reverseY ? 100 : 0,
      y2 = reverseY ? 0 : 100;
    path = `M ${x1} ${y1} L ${x2} ${y2}`;
    if (kind === "arrow") {
      const dx = (x2 - x1) * 0.16,
        dy = (y2 - y1) * 0.16;
      path += ` M ${x2 - dx - dy * 0.6} ${y2 - dy + dx * 0.6} L ${x2} ${y2} L ${x2 - dx + dy * 0.6} ${y2 - dy - dx * 0.6}`;
    }
  } else {
    const sides = kind === "triangle" ? 3 : kind === "polygon" ? 6 : 10;
    const points = Array.from({ length: sides }, (_, i) => {
      const radius = kind === "star" && i % 2 ? 22 : 50;
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / sides;
      return {
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
      };
    });
    path = penPath(points, true);
  }
  return { kind, path, width: 100, height: 100 };
}
export function pathGeometry(
  kind: "pen" | "pencil",
  points: PenPoint[],
  closed = false,
) {
  const bounds = points.flatMap((p) => [
    p,
    { x: p.x + (p.dx ?? 0), y: p.y + (p.dy ?? 0) },
    { x: p.x - (p.dx ?? 0), y: p.y - (p.dy ?? 0) },
  ]);
  const padding = closed ? 0 : 1;
  const left = Math.min(...bounds.map((p) => p.x)) - padding,
    top = Math.min(...bounds.map((p) => p.y)) - padding;
  const width = Math.max(
      1,
      Math.max(...bounds.map((p) => p.x)) - left + padding,
    ),
    height = Math.max(1, Math.max(...bounds.map((p) => p.y)) - top + padding);
  return {
    left,
    top,
    width,
    height,
    vector: {
      kind,
      width,
      height,
      path: penPath(
        points.map((p) => ({ ...p, x: p.x - left, y: p.y - top })),
        closed,
      ),
    } satisfies VectorGeometry,
  };
}
export function lineGeometry(kind: "line" | "arrow", a: Point, b: Point) {
  const points = [a, b];
  if (kind === "arrow") {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const length = Math.min(18, Math.hypot(b.x - a.x, b.y - a.y) * 0.4);
    const side = length * 0.45;
    points.push(
      {
        x: b.x - Math.cos(angle) * length - Math.sin(angle) * side,
        y: b.y - Math.sin(angle) * length + Math.cos(angle) * side,
      },
      b,
      {
        x: b.x - Math.cos(angle) * length + Math.sin(angle) * side,
        y: b.y - Math.sin(angle) * length - Math.cos(angle) * side,
      },
    );
  }
  const left = Math.min(...points.map((p) => p.x)) - 1,
    top = Math.min(...points.map((p) => p.y)) - 1;
  const width = Math.max(...points.map((p) => p.x)) - left + 1,
    height = Math.max(...points.map((p) => p.y)) - top + 1;
  const local = points.map((p) => ({ x: p.x - left, y: p.y - top }));
  return {
    left,
    top,
    width,
    height,
    vector: {
      kind,
      width,
      height,
      path:
        penPath(local.slice(0, 2)) +
        (kind === "arrow" ? " " + penPath(local.slice(2)) : ""),
    } satisfies VectorGeometry,
  };
}
export function validVector(value: unknown): value is VectorGeometry {
  if (!value || typeof value !== "object") return false;
  const v = value as VectorGeometry;
  if (
    !VECTOR_TOOLS.includes(v.kind) ||
    !Number.isFinite(v.width) ||
    !Number.isFinite(v.height) ||
    v.width <= 0 ||
    v.height <= 0 ||
    v.width > 1e7 ||
    v.height > 1e7 ||
    typeof v.path !== "string" ||
    v.path.length > 200000 ||
    !/^M[\s\d.,+\-MLCZ]+$/.test(v.path)
  )
    return false;
  const commands = v.path.match(/[MLCZ][^MLCZ]*/g);
  return Boolean(
    commands?.every((command) => {
      const values = command
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);
      return (
        values.length === { M: 2, L: 2, C: 6, Z: 0 }[command[0]] &&
        values.every(
          (value) =>
            /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(value) &&
            Math.abs(Number(value)) <= 1e7,
        )
      );
    }),
  );
}
const xml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );
/** Shared SVG image rendering keeps every export target identical to the canvas. */
export function vectorPresentation(element: EditorElement): CSSProperties {
  if (!element.vector) return {};
  const { vector: v, styles: s } = element;
  const width = typeof s.width === "number" ? s.width : v.width,
    height = typeof s.height === "number" ? s.height : v.height;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${xml(width)}" height="${xml(height)}" viewBox="0 0 ${v.width} ${v.height}" preserveAspectRatio="none"><path d="${xml(v.path)}" fill="${xml(s.backgroundColor ?? "none")}" stroke="${xml(s.borderColor ?? "#111111")}" stroke-width="${xml(s.borderStyle === "none" ? 0 : (s.borderWidth ?? 0))}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${s.borderStyle === "dashed" ? "6 4" : s.borderStyle === "dotted" ? "1 4" : "none"}" vector-effect="non-scaling-stroke"/></svg>`;
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderStyle: "none",
  };
}
