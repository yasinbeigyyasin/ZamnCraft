"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  isVectorTool,
  lineGeometry,
  pathGeometry,
  penPath,
  shapeGeometry,
  type PenPoint,
} from "@/lib/vector";
import { useEditorStore } from "@/store/editor-store";
import type { Point, VectorTool, ShapeTool } from "@/types/editor";

type Draft = {
  tool: VectorTool;
  parentId: string | null;
  origin: Point;
  points: PenPoint[];
  end: Point;
  pointerId: number | null;
  viewport: HTMLElement;
};
function shapeRect(draft: Draft) {
  const a = draft.points[0],
    b = draft.end;
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.max(1, Math.abs(b.x - a.x)),
    height: Math.max(1, Math.abs(b.y - a.y)),
  };
}
export function useVectorDrawing(
  viewportRef: RefObject<HTMLElement | null>,
  suspended: boolean,
) {
  const activeTool = useEditorStore((state) => state.activeTool);
  const pageId = useEditorStore((state) => state.activePageId);
  const zoom = useEditorStore((state) => state.canvasConfig.zoom);
  const ref = useRef<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const update = (value: Draft | null) => {
    ref.current = value;
    setDraft(value);
  };
  const cancel = useCallback(() => {
    const d = ref.current;
    ref.current = null;
    setDraft(null);
    if (d?.pointerId !== null && d?.viewport.hasPointerCapture(d.pointerId))
      d.viewport.releasePointerCapture(d.pointerId);
  }, []);
  const finish = useCallback(
    (closed = false) => {
      const d = ref.current;
      if (!d) return;
      if (d.points.length < 2 && d.tool === "pen") {
        cancel();
        return;
      }
      let geometry, rect;
      if (d.tool === "pen" || d.tool === "pencil") {
        const result = pathGeometry(
          d.tool,
          d.points.length === 1 ? [d.points[0], d.points[0]] : d.points,
          closed,
        );
        geometry = result.vector;
        rect = {
          left: result.left,
          top: result.top,
          width: result.width,
          height: result.height,
        };
      } else {
        const a = d.points[0];
        rect = shapeRect(d);
        if (
          Math.hypot(d.end.x - a.x, d.end.y - a.y) <
          3 / useEditorStore.getState().canvasConfig.zoom
        )
          rect = {
            left: a.x,
            top: a.y,
            width: 100,
            height: d.tool === "line" || d.tool === "arrow" ? 1 : 100,
          };
        if (d.tool === "line" || d.tool === "arrow") {
          const result = lineGeometry(
            d.tool,
            a,
            Math.hypot(d.end.x - a.x, d.end.y - a.y) <
              3 / useEditorStore.getState().canvasConfig.zoom
              ? { x: a.x + 100, y: a.y }
              : d.end,
          );
          geometry = result.vector;
          rect = {
            left: result.left,
            top: result.top,
            width: result.width,
            height: result.height,
          };
        } else geometry = shapeGeometry(d.tool, d.end.x < a.x, d.end.y < a.y);
      }
      cancel();
      useEditorStore.getState().addVector(d.parentId, geometry, {
        ...rect,
        left: rect.left - d.origin.x,
        top: rect.top - d.origin.y,
      });
    },
    [cancel],
  );
  useEffect(() => {
    cancel();
  }, [activeTool, pageId, suspended, cancel]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !ref.current ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            "input,textarea,button,[role='listbox'],[role='combobox'],[contenteditable='plaintext-only']",
          ))
      )
        return;
      if (
        ["Escape", "Enter", "Backspace", "Delete"].includes(event.key) ||
        ((event.ctrlKey || event.metaKey) &&
          ["z", "y"].includes(event.key.toLowerCase()))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "Enter") finish();
        else cancel();
      }
    };
    const hidden = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
      cancel();
    };
  }, [cancel, finish]);
  function world(event: PointerEvent<HTMLElement>): Point {
    const bounds = viewportRef.current!.getBoundingClientRect();
    const { zoom, pan } = useEditorStore.getState().canvasConfig;
    return {
      x: (event.clientX - bounds.left - pan.x) / zoom,
      y: (event.clientY - bounds.top - pan.y) / zoom,
    };
  }
  function start(event: PointerEvent<HTMLElement>) {
    if (
      suspended ||
      event.button !== 0 ||
      !event.isPrimary ||
      !isVectorTool(activeTool)
    )
      return false;
    const viewport = viewportRef.current;
    if (!viewport) return false;
    event.preventDefault();
    const point = world(event);
    let next: Draft;
    if (ref.current?.tool === "pen") {
      const d = ref.current;
      if (
        d.points.length >= 3 &&
        Math.hypot(point.x - d.points[0].x, point.y - d.points[0].y) * zoom < 7
      ) {
        finish(true);
        return true;
      }
      // shortcut: cap Pen paths at 2,000 anchors; use streamed geometry for larger illustrations.
      if (d.points.length >= 2000) {
        finish();
        return true;
      }
      const previous = d.points[d.points.length - 1];
      next = {
        ...d,
        points:
          Math.hypot(point.x - previous.x, point.y - previous.y) * zoom < 2
            ? d.points
            : [...d.points, point],
        pointerId: event.pointerId,
      };
    } else {
      const parent =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-element-type="frame"]')
          : null;
      const bounds = parent?.getBoundingClientRect(),
        viewportBounds = viewport.getBoundingClientRect();
      const { pan } = useEditorStore.getState().canvasConfig;
      next = {
        tool: activeTool,
        points: [point],
        end: point,
        pointerId: event.pointerId,
        viewport,
        parentId: parent?.dataset.editorElement ?? null,
        origin:
          bounds && parent
            ? {
                x:
                  (bounds.left - viewportBounds.left - pan.x) / zoom +
                  parent.clientLeft -
                  parent.scrollLeft,
                y:
                  (bounds.top - viewportBounds.top - pan.y) / zoom +
                  parent.clientTop -
                  parent.scrollTop,
              }
            : { x: 0, y: 0 },
      };
    }
    update(next);
    viewport.setPointerCapture(event.pointerId);
    return true;
  }
  function move(event: PointerEvent<HTMLElement>) {
    const d = ref.current;
    if (!d || d.pointerId !== event.pointerId) return;
    if (!event.buttons) return;
    let point = world(event);
    const points = [...d.points],
      a = points[0];
    if (d.tool === "pencil") {
      const previous = points[points.length - 1];
      // shortcut: cap a freehand stroke at 5,000 samples; add path simplification for longer strokes.
      if (
        points.length < 5000 &&
        Math.hypot(point.x - previous.x, point.y - previous.y) * zoom >= 1.5
      )
        points.push(point);
    } else if (d.tool === "pen") {
      const last = points[points.length - 1];
      points[points.length - 1] = {
        ...last,
        dx: point.x - last.x,
        dy: point.y - last.y,
      };
    } else if (event.shiftKey) {
      const dx = point.x - a.x,
        dy = point.y - a.y;
      if (d.tool === "line" || d.tool === "arrow") {
        const angle =
            (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4,
          distance = Math.hypot(dx, dy);
        point = {
          x: a.x + Math.cos(angle) * distance,
          y: a.y + Math.sin(angle) * distance,
        };
      } else {
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        point = {
          x: a.x + (dx < 0 ? -size : size),
          y: a.y + (dy < 0 ? -size : size),
        };
      }
    }
    update({ ...d, points, end: point });
  }
  function up(event: PointerEvent<HTMLElement>) {
    const d = ref.current;
    if (!d || d.pointerId !== event.pointerId) return;
    if (d.tool === "pen") {
      update({ ...d, pointerId: null });
      if (d.viewport.hasPointerCapture(event.pointerId))
        d.viewport.releasePointerCapture(event.pointerId);
    } else finish();
  }
  let overlay = null;
  if (draft) {
    const isPath = draft.tool === "pen" || draft.tool === "pencil";
    const rect = shapeRect(draft);
    const a = draft.points[0];
    const line =
      draft.tool === "line" || draft.tool === "arrow"
        ? lineGeometry(draft.tool, a, draft.end)
        : null;
    const path = line
      ? line.vector.path
      : isPath
        ? penPath(draft.points)
        : shapeGeometry(
            draft.tool as ShapeTool,
            draft.end.x < a.x,
            draft.end.y < a.y,
          ).path;
    overlay = (
      <svg
        className="vector-draft"
        aria-hidden="true"
        data-vector-draft={draft.tool}
      >
        <path
          d={path}
          transform={
            line
              ? `translate(${line.left} ${line.top})`
              : isPath
                ? undefined
                : `translate(${rect.left} ${rect.top}) scale(${rect.width / 100} ${rect.height / 100})`
          }
          fill={
            isPath || draft.tool === "line" || draft.tool === "arrow"
              ? "none"
              : "#0099ff18"
          }
          stroke="#0099ff"
          strokeWidth={1.5 / zoom}
          vectorEffect={isPath ? undefined : "non-scaling-stroke"}
        />
        {draft.tool === "pen" &&
          draft.points.map((point, index) => (
            <g key={index}>
              {point.dx || point.dy ? (
                <>
                  <path
                    d={`M ${point.x - (point.dx ?? 0)} ${point.y - (point.dy ?? 0)} L ${point.x + (point.dx ?? 0)} ${point.y + (point.dy ?? 0)}`}
                    stroke="#0099ff"
                    strokeWidth={1 / zoom}
                  />
                  <circle
                    cx={point.x + (point.dx ?? 0)}
                    cy={point.y + (point.dy ?? 0)}
                    r={2 / zoom}
                    fill="#0099ff"
                  />
                </>
              ) : null}
              <circle
                cx={point.x}
                cy={point.y}
                r={3 / zoom}
                fill="white"
                stroke="#0099ff"
                strokeWidth={1 / zoom}
              />
            </g>
          ))}
      </svg>
    );
  }
  return { ref, overlay, start, move, up, cancel, finish };
}
