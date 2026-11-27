export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export const RESIZE_HANDLES: ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];
export type CanvasRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type AlignmentGuide = {
  axis: "x" | "y";
  value: number;
  start: number;
  end: number;
};

/** All coordinates and the snap threshold are in unscaled world pixels. */
export function manipulateRect(
  initial: CanvasRect,
  delta: { x: number; y: number },
  handle: ResizeHandle | null,
  targets: CanvasRect[],
  threshold: number,
  minimum = { width: 8, height: 8 },
): { rect: CanvasRect; guides: AlignmentGuide[] } {
  const rect = { ...initial };
  if (!handle) {
    rect.x += delta.x;
    rect.y += delta.y;
  } else {
    if (handle.includes("e"))
      rect.width = Math.max(minimum.width, initial.width + delta.x);
    if (handle.includes("s"))
      rect.height = Math.max(minimum.height, initial.height + delta.y);
    if (handle.includes("w")) {
      rect.width = Math.max(minimum.width, initial.width - delta.x);
      rect.x = initial.x + initial.width - rect.width;
    }
    if (handle.includes("n")) {
      rect.height = Math.max(minimum.height, initial.height - delta.y);
      rect.y = initial.y + initial.height - rect.height;
    }
  }
  const guides: AlignmentGuide[] = [];
  for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? "width" : "height";
    const cross = axis === "x" ? "y" : "x";
    const crossSize = axis === "x" ? "height" : "width";
    const leading = handle?.includes(axis === "x" ? "w" : "n");
    const trailing = handle?.includes(axis === "x" ? "e" : "s");
    if (handle && !leading && !trailing) continue;
    const anchors = !handle
      ? [rect[axis], rect[axis] + rect[size] / 2, rect[axis] + rect[size]]
      : [rect[axis] + (trailing ? rect[size] : 0)];
    let best:
      { distance: number; value: number; target: CanvasRect } | undefined;
    for (const target of targets) {
      for (const value of [
        target[axis],
        target[axis] + target[size] / 2,
        target[axis] + target[size],
      ]) {
        for (const anchor of anchors) {
          const distance = value - anchor;
          // Prefer the first equal-distance guide despite DOM measurement rounding.
          if (
            Math.abs(distance) > threshold ||
            (best && Math.abs(distance) >= Math.abs(best.distance) - 0.001)
          )
            continue;
          if (
            handle &&
            rect[size] + (leading ? -distance : distance) < minimum[size]
          )
            continue;
          best = { distance, value, target };
        }
      }
    }
    if (best) {
      if (!handle || leading) rect[axis] += best.distance;
      if (handle) rect[size] += leading ? -best.distance : best.distance;
      guides.push({
        axis,
        value: best.value,
        start: Math.min(rect[cross], best.target[cross]),
        end: Math.max(
          rect[cross] + rect[crossSize],
          best.target[cross] + best.target[crossSize],
        ),
      });
    }
  }
  return { rect, guides };
}
