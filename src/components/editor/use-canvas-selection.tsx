"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { useEditorStore } from "@/store/editor-store";
import { selectedRoots } from "@/lib/selection";

type Marquee = {
  pointerId: number;
  viewport: HTMLElement;
  x: number;
  y: number;
  endX: number;
  endY: number;
  moved: boolean;
  targetId: string | null;
  before: string[];
  anchor: string | null;
};
export function useCanvasSelection(
  viewportRef: RefObject<HTMLElement | null>,
  suspended: boolean,
) {
  const ref = useRef<Marquee | null>(null);
  const [draft, setDraft] = useState<Marquee | null>(null);
  const tool = useEditorStore((state) => state.activeTool);
  const page = useEditorStore((state) => state.activePageId);
  const finish = useCallback((cancel = false) => {
    const current = ref.current;
    ref.current = null;
    setDraft(null);
    if (!current) return;
    if (cancel)
      useEditorStore
        .getState()
        .setSelectedElementIds(current.before, current.anchor);
    if (current.viewport.hasPointerCapture(current.pointerId))
      current.viewport.releasePointerCapture(current.pointerId);
  }, []);
  useEffect(() => {
    if (ref.current) finish(true);
  }, [suspended, tool, page, finish]);
  useEffect(() => {
    const cancel = () => finish(true);
    const hidden = () => {
      if (document.hidden) cancel();
    };
    const key = (event: KeyboardEvent) => {
      if (
        ref.current &&
        (event.key === "Escape" ||
          ((event.ctrlKey || event.metaKey) &&
            ["z", "y"].includes(event.key.toLowerCase())))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key, true);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key, true);
      document.removeEventListener("visibilitychange", hidden);
      cancel();
    };
  }, [finish]);
  function start(event: PointerEvent<HTMLElement>) {
    const state = useEditorStore.getState(),
      viewport = viewportRef.current;
    if (
      suspended ||
      !viewport ||
      ref.current ||
      event.button !== 0 ||
      !event.isPrimary ||
      !(event.ctrlKey || event.metaKey) ||
      (state.activeTool !== "select" && state.activeTool !== "scale")
    )
      return false;
    event.preventDefault();
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-editor-element]")
        : null;
    ref.current = {
      pointerId: event.pointerId,
      viewport,
      x: event.clientX,
      y: event.clientY,
      endX: event.clientX,
      endY: event.clientY,
      targetId: target?.dataset.editorElement ?? null,
      moved: false,
      before: [...state.selectedElementIds],
      anchor: state.selectionAnchorId,
    };
    viewport.setPointerCapture(event.pointerId);
    return true;
  }
  function move(event: PointerEvent<HTMLElement>) {
    const current = ref.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!event.buttons) {
      finish(true);
      return;
    }
    if (
      !current.moved &&
      Math.hypot(event.clientX - current.x, event.clientY - current.y) < 3
    )
      return;
    event.preventDefault();
    const next = {
      ...current,
      moved: true,
      endX: event.clientX,
      endY: event.clientY,
    };
    ref.current = next;
    setDraft(next);
    const left = Math.min(next.x, next.endX),
      top = Math.min(next.y, next.endY),
      right = Math.max(next.x, next.endX),
      bottom = Math.max(next.y, next.endY);
    const hits = [
      ...current.viewport.querySelectorAll<HTMLElement>(
        "[data-editor-element]",
      ),
    ]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= left - 0.5 &&
          rect.top >= top - 0.5 &&
          rect.right <= right + 0.5 &&
          rect.bottom <= bottom + 0.5
        );
      })
      .map((node) => node.dataset.editorElement!);
    const state = useEditorStore.getState();
    state.setSelectedElementIds(
      selectedRoots(state.elements, hits).map((node) => node.id),
    );
  }
  function up(event: PointerEvent<HTMLElement>) {
    const current = ref.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!current.moved && current.targetId)
      useEditorStore.getState().toggleSelection(current.targetId);
    finish();
  }
  const bounds = viewportRef.current?.getBoundingClientRect();
  const overlay =
    draft && bounds ? (
      <div
        className="canvas-marquee"
        data-selection-marquee
        aria-hidden="true"
        style={{
          left: Math.min(draft.x, draft.endX) - bounds.left,
          top: Math.min(draft.y, draft.endY) - bounds.top,
          width: Math.abs(draft.endX - draft.x),
          height: Math.abs(draft.endY - draft.y),
        }}
      />
    ) : null;
  return { ref, start, move, up, finish, overlay };
}
