"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  findElementById,
  useEditorStore,
  type EditorElement,
} from "@/store/editor-store";
import {
  manipulateRect,
  scaleRect,
  RESIZE_HANDLES,
  type AlignmentGuide,
  type CanvasRect,
  type ResizeHandle,
} from "@/lib/canvas-geometry";

type Gesture = {
  mode: "select" | "scale";
  source: EditorElement;
  id: string;
  pointerId: number;
  node: HTMLElement;
  start: { x: number; y: number };
  zoom: number;
  rect: CanvasRect;
  styles: CSSProperties;
  origin: { left: number; top: number };
  targets: CanvasRect[];
  handle: ResizeHandle | null;
  minimum: { width: number; height: number };
  moved: boolean;
};

export function useCanvasManipulation(
  viewportRef: RefObject<HTMLElement | null>,
  suspended: boolean,
  suppressClick: () => void,
) {
  const gesture = useRef<Gesture | null>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [active, setActive] = useState(false);
  const selectedId = useEditorStore((state) => state.selectedElementId);
  const tool = useEditorStore((state) => state.activeTool);

  const finish = useCallback((cancel = false) => {
    const current = gesture.current;
    gesture.current = null;
    if (!current) return;
    useEditorStore.getState().endHistory(cancel);
    if (current.node.hasPointerCapture(current.pointerId))
      current.node.releasePointerCapture(current.pointerId);
    setGuides([]);
    setActive(false);
  }, []);

  useEffect(() => {
    if (
      gesture.current &&
      (suspended ||
        tool !== gesture.current.mode ||
        selectedId !== gesture.current.id)
    )
      finish(true);
  }, [suspended, tool, selectedId, finish]);

  useEffect(() => {
    const cancel = () => finish(true);
    const key = (event: KeyboardEvent) => {
      if (
        gesture.current &&
        (event.key === "Escape" ||
          ((event.ctrlKey || event.metaKey) &&
            ["z", "y"].includes(event.key.toLowerCase())))
      ) {
        event.preventDefault();
        cancel();
      }
    };
    const visibility = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", visibility);
      cancel();
    };
  }, [finish]);

  function start(event: PointerEvent<HTMLElement>) {
    const state = useEditorStore.getState();
    const viewport = viewportRef.current;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (
      !viewport ||
      !target ||
      gesture.current ||
      suspended ||
      (state.activeTool !== "select" && state.activeTool !== "scale") ||
      event.button !== 0 ||
      !event.isPrimary ||
      target.isContentEditable ||
      target.closest(
        "input, textarea, select, [role='textbox'], [data-canvas-ui]",
      )
    )
      return;
    const node = target.closest<HTMLElement>("[data-editor-element]");
    const id = node?.dataset.editorElement;
    const element = id ? findElementById(state.elements, id) : undefined;
    if (!id || !node || !element) return;
    const handleName = target.closest<HTMLElement>("[data-resize-handle]")
      ?.dataset.resizeHandle;
    const handle = RESIZE_HANDLES.find((value) => value === handleName) ?? null;
    const { zoom, pan } = state.canvasConfig;
    const viewportBounds = viewport.getBoundingClientRect();
    const worldRect = (node: HTMLElement): CanvasRect => {
      const bounds = node.getBoundingClientRect();
      return {
        x: (bounds.left - viewportBounds.left - pan.x) / zoom,
        y: (bounds.top - viewportBounds.top - pan.y) / zoom,
        width: bounds.width / zoom,
        height: bounds.height / zoom,
      };
    };
    const parent = node.parentElement?.closest<HTMLElement>(
      "[data-editor-element]",
    );
    const siblings = parent
      ? Array.from(parent.children).filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement && !!child.dataset.editorElement,
        )
      : Array.from(
          viewport.querySelectorAll<HTMLElement>(
            ".canvas-world > div > [data-editor-element]",
          ),
        );
    const targets = siblings
      .filter((sibling) => sibling !== node)
      .map(worldRect);
    if (parent) {
      const parentRect = worldRect(parent);
      targets.unshift({
        x: parentRect.x + parent.clientLeft,
        y: parentRect.y + parent.clientTop,
        width: parent.clientWidth,
        height: parent.clientHeight,
      });
    }
    const positioned = getComputedStyle(parent ? node : node.parentElement!);
    gesture.current = {
      mode: state.activeTool,
      source: {
        ...element,
        styles: {
          ...element.styles,
          fontSize:
            element.styles.fontSize ??
            parseFloat(getComputedStyle(node).fontSize),
        },
      },
      id,
      node,
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      zoom,
      rect: worldRect(node),
      styles: { ...element.styles },
      origin: {
        left:
          typeof element.styles.left === "number"
            ? element.styles.left
            : parseFloat(positioned.left) || 0,
        top:
          typeof element.styles.top === "number"
            ? element.styles.top
            : parseFloat(positioned.top) || 0,
      },
      targets,
      handle,
      minimum: {
        width: Math.max(8, node.offsetWidth - node.clientWidth),
        height: Math.max(8, node.offsetHeight - node.clientHeight),
      },
      moved: false,
    };
    state.setSelectedElementId(id);
    useEditorStore.getState().beginHistory();
    // Capture on the element, not the viewport, so ordinary clicks and double-clicks retain their target.
    node.setPointerCapture(event.pointerId);
    if (handle) {
      event.preventDefault();
    }
  }

  function move(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!event.buttons) {
      finish();
      return;
    }
    if (
      !current.moved &&
      Math.hypot(
        event.clientX - current.start.x,
        event.clientY - current.start.y,
      ) < 3
    )
      return;
    current.moved = true;
    suppressClick();
    setActive(true);
    event.preventDefault();
    if (current.mode === "scale" && current.handle) {
      const { rect, factor } = scaleRect(
        current.rect,
        {
          x: (event.clientX - current.start.x) / current.zoom,
          y: (event.clientY - current.start.y) / current.zoom,
        },
        current.handle,
      );
      useEditorStore.getState().scaleElement(current.source, factor, {
        width: rect.width,
        height: rect.height,
        minWidth: 0,
        minHeight: 0,
        flexShrink: 0,
        left: current.origin.left + rect.x - current.rect.x,
        top: current.origin.top + rect.y - current.rect.y,
      });
      setGuides([]);
      return;
    }
    const { rect, guides } = manipulateRect(
      current.rect,
      {
        x: (event.clientX - current.start.x) / current.zoom,
        y: (event.clientY - current.start.y) / current.zoom,
      },
      current.handle,
      event.altKey ? [] : current.targets,
      6 / current.zoom,
      current.minimum,
    );
    const rounded = (value: number) => Math.round(value * 100) / 100;
    const patch: CSSProperties = {};
    const { handle, origin } = current;
    if (!handle || handle.includes("w"))
      patch.left = rounded(origin.left + rect.x - current.rect.x);
    if (!handle || handle.includes("n"))
      patch.top = rounded(origin.top + rect.y - current.rect.y);
    if (handle && (handle.includes("w") || handle.includes("e")))
      Object.assign(patch, {
        width: rounded(rect.width),
        minWidth: 0,
        flexShrink: 0,
      });
    if (handle && (handle.includes("n") || handle.includes("s")))
      Object.assign(patch, {
        height: rounded(rect.height),
        minHeight: 0,
        flexShrink: 0,
      });
    useEditorStore.getState().updateStyles(current.id, patch);
    setGuides(guides);
  }

  return { gesture, active, guides, start, move, finish };
}
