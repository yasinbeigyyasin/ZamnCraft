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
import { createPortal } from "react-dom";
import { PopoverSelect } from "./property-controls";
import { BREAKPOINTS } from "@/lib/workspace";
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
  const activePageId = useEditorStore((state) => state.activePageId);
  const pageName = useEditorStore(
    (state) =>
      state.pages.find((page) => page.id === state.activePageId)?.name ??
      "Home",
  );
  const preview = useEditorStore((state) => state.isPreviewMode);
  const previewRootId = useEditorStore((state) => state.previewRootId);
  const elements = useEditorStore((state) => state.elements);
  const { zoom, pan } = canvasConfig;
  const viewportRef = useRef<HTMLElement>(null);
  const fittedPages = useRef(new Set<string>());
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
    suspended || preview,
    suppressClick,
  );
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setToolbarTarget(document.getElementById("toolbar-breakpoints"));
  }, []);
  const canvasBackground = useEditorStore((state) => state.canvasBackground);
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const activeToolLabel = tools.find((item) => item.id === activeTool)?.label;
  const canInteract = useCallback(
    () =>
      !suspended &&
      !preview &&
      !suppressClickRef.current &&
      !dragRef.current &&
      !manipulation.gesture.current &&
      !spaceRef.current,
    [suspended, preview, manipulation.gesture],
  );

  const finishPan = useCallback(() => {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && viewport?.hasPointerCapture(drag.pointerId))
      viewport.releasePointerCapture(drag.pointerId);
    setIsPanning(false);
  }, []);

  const fitToView = useCallback(
    (focusId?: string) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const { width, height } = viewport.getBoundingClientRect();
      const state = useEditorStore.getState();
      const target =
        focusId ?? (state.isPreviewMode ? state.previewRootId : null);
      const roots = target
        ? state.elements.filter((element) => element.id === target)
        : state.elements;
      if (!roots.length || width <= 0 || height <= 0) return;
      const boxes = roots.map((root) => ({
        x: typeof root.styles.left === "number" ? root.styles.left : 0,
        y: typeof root.styles.top === "number" ? root.styles.top : 0,
        width:
          typeof root.styles.width === "number"
            ? root.styles.width
            : root.type === "frame"
              ? 1200
              : 200,
        height:
          typeof root.styles.height === "number"
            ? root.styles.height
            : root.type === "frame"
              ? 800
              : 24,
      }));
      const left = Math.min(...boxes.map((box) => box.x)),
        top = Math.min(...boxes.map((box) => box.y));
      const rootWidth =
        Math.max(...boxes.map((box) => box.x + box.width)) - left;
      const rootHeight =
        Math.max(...boxes.map((box) => box.y + box.height)) - top;
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(1, (width - 96) / rootWidth, (height - 144) / rootHeight),
      );
      setZoom(nextZoom);
      setPan({
        x: (width - rootWidth * nextZoom) / 2 - left * nextZoom,
        y: (height - rootHeight * nextZoom) / 2 - top * nextZoom,
      });
    },
    [setPan, setZoom],
  );

  useEffect(() => {
    const { canvasConfig } = useEditorStore.getState();
    if (
      !fittedPages.current.has(activePageId) &&
      canvasConfig.zoom === 1 &&
      canvasConfig.pan.x === 0 &&
      canvasConfig.pan.y === 0
    )
      fitToView();
    fittedPages.current.add(activePageId);
    finishPan();
  }, [fitToView, activePageId, finishPan]);

  useEffect(() => {
    if (preview) fitToView();
  }, [preview, previewRootId, fitToView]);

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
    if (preview && event.button !== 1 && !spaceRef.current) return;
    suppressClickRef.current = false;
    event.currentTarget.focus({ preventScroll: true });
    if (event.button !== 1 && !spaceRef.current && activeTool !== "hand") {
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

  const breakpointControls = (
    <div
      className="canvas-breakpoints"
      role="group"
      aria-label="Canvas breakpoints"
      data-canvas-ui
    >
      {preview ? (
        <PopoverSelect
          label="Preview breakpoint"
          value={previewRootId ?? ""}
          options={elements
            .filter((element) => element.breakpoint)
            .map((element) => ({
              value: element.id,
              label: `${element.name} · ${element.styles.width}px`,
              hint: "Preview",
            }))}
          onChange={(value) => useEditorStore.getState().setPreviewRoot(value)}
        />
      ) : (
        BREAKPOINTS.map((config) => {
          const frame = elements.find(
            (element) => element.breakpoint === config.id,
          );
          if (config.id === "desktop" && !frame) return null;
          return (
            <button
              key={config.id}
              type="button"
              disabled={
                suspended ||
                (!frame &&
                  !elements.some((element) => element.type === "frame"))
              }
              aria-label={`${frame ? "Focus" : "Add"} ${config.name} breakpoint`}
              onClick={() => {
                if (frame) {
                  setSelectedElementId(frame.id);
                  fitToView(frame.id);
                } else if (config.id !== "desktop") {
                  useEditorStore.getState().addBreakpoint(config.id);
                  fitToView();
                }
              }}
            >
              {frame ? "" : "+ "}
              {config.name} <span>{config.width}</span>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <section
      id="editor-canvas"
      ref={viewportRef}
      aria-label={preview ? "Live preview" : "Design canvas"}
      aria-describedby="canvas-navigation-help"
      tabIndex={0}
      className={`canvas ${preview ? "canvas-preview" : ""} canvas-tool-${activeTool} ${spacePressed || activeTool === "hand" ? "canvas-pan-ready" : ""} ${isPanning ? "canvas-panning" : ""} ${manipulation.active ? "canvas-manipulating" : ""}`}
      style={{
        backgroundColor: canvasBackground,
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: manipulation.active
          ? manipulation.gesture.current?.handle
            ? `${manipulation.gesture.current.handle}-resize`
            : "move"
          : undefined,
      }}
      onPointerDownCapture={() => {
        if (!preview)
          viewportRef.current
            ?.querySelectorAll<HTMLElement>("[data-editor-element]")
            .forEach((node) =>
              node.getAnimations().forEach((animation) => animation.cancel()),
            );
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
        if (state.activeTool === "hand") return;
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
      {!preview && toolbarTarget
        ? createPortal(breakpointControls, toolbarTarget)
        : breakpointControls}
      <div className="canvas-breadcrumb" data-canvas-ui hidden={preview}>
        <Home size={12} strokeWidth={1.5} aria-hidden="true" />
        <span>{pageName}</span>
        <ChevronRight size={12} aria-hidden="true" />
        <span>Canvas</span>
      </div>
      <p className="canvas-tool-status" role="status" data-canvas-ui>
        <span className="status-dot" />
        {preview
          ? "Live preview · Esc to exit"
          : isPanning
            ? "Panning"
            : `${activeToolLabel} selected`}
      </p>
      <p
        id="canvas-navigation-help"
        className="canvas-pan-hint"
        data-canvas-ui
        hidden={preview}
      >
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
          onClick={() => fitToView()}
        />
      </div>
    </section>
  );
}
