"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronRight, Hand, Home, Maximize, Minus, Plus } from "lucide-react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  useEditorStore,
  type Point,
} from "@/store/useEditorStore";
import { IconButton, tools } from "./editor-controls";
import { CanvasRenderer } from "./CanvasRenderer";
import { useCanvasManipulation } from "./use-canvas-manipulation";

function isTextInput(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      !!target.closest("input, textarea, select, [role='textbox']"))
  );
}

export function Canvas({ suspended = false }: { suspended?: boolean }) {
  const { activeTool, canvasConfig, setPan, setZoom, setSelectedElementId } =
    useEditorStore();
  const { zoom, pan } = canvasConfig;
  const viewportRef = useRef<HTMLElement>(null);
  const spaceRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    start: Point;
    pan: Point;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClick = useCallback(() => {
    suppressClickRef.current = true;
  }, []);
  const manipulation = useCanvasManipulation(
    viewportRef,
    suspended,
    suppressClick,
  );
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const activeToolLabel = tools.find((item) => item.id === activeTool)?.label;
  const canInteract = useCallback(
    () =>
      !suspended &&
      !suppressClickRef.current &&
      !dragRef.current &&
      !manipulation.gesture.current &&
      !spaceRef.current,
    [suspended, manipulation.gesture],
  );

  const finishPan = useCallback(() => {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && viewport?.hasPointerCapture(drag.pointerId))
      viewport.releasePointerCapture(drag.pointerId);
    setIsPanning(false);
  }, []);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { width, height } = viewport.getBoundingClientRect();
    const root = useEditorStore.getState().elements[0];
    if (!root || width <= 0 || height <= 0) return;
    const rootWidth =
      typeof root.styles.width === "number" ? root.styles.width : 1200;
    const rootHeight =
      typeof root.styles.height === "number" ? root.styles.height : 800;
    const nextZoom = Math.max(
      MIN_ZOOM,
      Math.min(1, (width - 96) / rootWidth, (height - 144) / rootHeight),
    );
    setZoom(nextZoom);
    setPan({
      x: (width - rootWidth * nextZoom) / 2,
      y: (height - rootHeight * nextZoom) / 2,
    });
  }, [setPan, setZoom]);

  useEffect(() => {
    fitToView();
  }, [fitToView]);

  useEffect(() => {
    function clearGesture() {
      spaceRef.current = false;
      setSpacePressed(false);
      finishPan();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (
        suspended ||
        event.code !== "Space" ||
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isTextInput(event.target)
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest("button, a, [role='tab']")
      )
        return;
      event.preventDefault();
      manipulation.finish(true);
      spaceRef.current = true;
      setSpacePressed(true);
    }
    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      spaceRef.current = false;
      setSpacePressed(false);
    }
    function handleVisibility() {
      if (document.hidden) clearGesture();
    }
    if (suspended) clearGesture();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearGesture);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearGesture);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [suspended, finishPan, manipulation.finish]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (suspended || dragRef.current || manipulation.gesture.current) return;
      const rect = viewport!.getBoundingClientRect();
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? rect.height
            : 1;
      const delta = Math.max(-1000, Math.min(1000, event.deltaY * unit));
      const currentZoom = useEditorStore.getState().canvasConfig.zoom;
      setZoom(currentZoom * Math.exp(-delta * 0.002), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
    // A passive wheel listener cannot prevent the browser's own Ctrl/Cmd zoom.
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [suspended, setZoom, manipulation.gesture]);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (
      suspended ||
      manipulation.gesture.current ||
      (event.target instanceof Element &&
        event.target.closest("[data-canvas-ui]"))
    )
      return;
    if (event.button !== 0 && event.button !== 1) return;
    if (event.button === 0 && isTextInput(event.target)) return;
    suppressClickRef.current = false;
    event.currentTarget.focus({ preventScroll: true });
    if (event.button !== 1 && !spaceRef.current) {
      manipulation.start(event);
      return;
    }
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      pan: { ...useEditorStore.getState().canvasConfig.pan },
    };
    suppressClickRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }

  function zoomFromCenter(nextZoom: number) {
    const viewport = viewportRef.current;
    if (viewport)
      setZoom(nextZoom, {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2,
      });
  }

  return (
    <section
      id="editor-canvas"
      ref={viewportRef}
      aria-label="Design canvas"
      aria-describedby="canvas-navigation-help"
      tabIndex={0}
      className={`canvas canvas-tool-${activeTool} ${spacePressed ? "canvas-pan-ready" : ""} ${isPanning ? "canvas-panning" : ""} ${manipulation.active ? "canvas-manipulating" : ""}`}
      style={{
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: manipulation.active
          ? manipulation.gesture.current?.handle
            ? `${manipulation.gesture.current.handle}-resize`
            : "move"
          : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={(event) => {
        manipulation.move(event);
        const drag = dragRef.current;
        if (drag && drag.pointerId === event.pointerId)
          setPan({
            x: drag.pan.x + event.clientX - drag.start.x,
            y: drag.pan.y + event.clientY - drag.start.y,
          });
      }}
      onPointerUp={(event) => {
        if (event.pointerId === manipulation.gesture.current?.pointerId)
          manipulation.finish();
        if (event.pointerId === dragRef.current?.pointerId) finishPan();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === manipulation.gesture.current?.pointerId)
          manipulation.finish(true);
        finishPan();
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerId === manipulation.gesture.current?.pointerId)
          manipulation.finish(true);
        finishPan();
      }}
      onClick={(event) => {
        if (!canInteract()) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("[data-canvas-ui]")) return;
        const state = useEditorStore.getState();
        if (state.activeTool === "select") {
          setSelectedElementId(null);
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        const { zoom, pan } = state.canvasConfig;
        state.addElement(null, state.activeTool, {
          x: (event.clientX - bounds.left - pan.x) / zoom,
          y: (event.clientY - bounds.top - pan.y) / zoom,
        });
      }}
      onAuxClick={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
    >
      <div
        className="canvas-world"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <CanvasRenderer canInteract={canInteract} />
        {manipulation.guides.map((guide, index) => (
          <span
            key={index}
            className="canvas-alignment-guide"
            data-guide-axis={guide.axis}
            aria-hidden="true"
            style={
              guide.axis === "x"
                ? {
                    left: guide.value,
                    top: guide.start - 8 / zoom,
                    width: 1 / zoom,
                    height: guide.end - guide.start + 16 / zoom,
                  }
                : {
                    top: guide.value,
                    left: guide.start - 8 / zoom,
                    height: 1 / zoom,
                    width: guide.end - guide.start + 16 / zoom,
                  }
            }
          />
        ))}
      </div>
      <div className="canvas-breadcrumb" data-canvas-ui>
        <Home size={12} strokeWidth={1.5} aria-hidden="true" />
        <span>Home</span>
        <ChevronRight size={12} aria-hidden="true" />
        <span>Canvas</span>
      </div>
      <p className="canvas-tool-status" role="status" data-canvas-ui>
        <span className="status-dot" />
        {isPanning ? "Panning" : `${activeToolLabel} selected`}
      </p>
      <p id="canvas-navigation-help" className="canvas-pan-hint" data-canvas-ui>
        <kbd>Space</kbd> + drag to pan <span>· Ctrl / ⌘ + scroll to zoom</span>
      </p>
      <div
        className="canvas-controls"
        role="group"
        aria-label="Canvas zoom"
        data-canvas-ui
      >
        <span
          className="canvas-hand-hint"
          title="Hold Space and drag, or drag with the middle mouse button"
          aria-hidden="true"
        >
          <Hand size={14} />
        </span>
        <span className="control-divider" aria-hidden="true" />
        <IconButton
          icon={Minus}
          label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => zoomFromCenter(zoom - 0.25)}
        />
        <button
          type="button"
          className="zoom-value"
          onClick={() => zoomFromCenter(1)}
          title="Reset zoom to 100%"
          aria-label={`Canvas zoom ${Math.round(zoom * 100)}%, reset to 100%`}
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton
          icon={Plus}
          label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => zoomFromCenter(zoom + 0.25)}
        />
        <span className="control-divider" aria-hidden="true" />
        <IconButton
          icon={Maximize}
          label="Reset canvas view"
          onClick={fitToView}
        />
      </div>
    </section>
  );
}
