"use client";

import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { Monitor } from "lucide-react";
import { useEditorStore, type EditorElement } from "@/store/useEditorStore";

function pastePlainText(event: ClipboardEvent<HTMLSpanElement>) {
  event.preventDefault();
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!event.currentTarget.contains(range.commonAncestorContainer)) return;
  range.deleteContents();
  const text = document.createTextNode(
    event.clipboardData.getData("text/plain"),
  );
  range.insertNode(text);
  range.setStartAfter(text);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

const ElementNode = memo(function ElementNodeView({
  element,
  canInteract,
  root = false,
  parentStyles,
}: {
  element: EditorElement;
  canInteract: () => boolean;
  root?: boolean;
  parentStyles?: CSSProperties;
}) {
  const selected = useEditorStore(
    (state) => state.selectedElementId === element.id,
  );
  const zoom = useEditorStore((state) =>
    selected ? state.canvasConfig.zoom : 1,
  );
  const nodeRef = useRef<HTMLElement | null>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const cancelEditRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const content = element.content ?? element.name;
  const Tag = element.type === "button" ? "button" : "div";
  const fillsStack =
    parentStyles?.display === "flex" &&
    (parentStyles.flexDirection?.startsWith("column")
      ? element.styles.height === "100%"
      : element.styles.width === "100%");

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!selected || !node) return;
    const measure = () => {
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      setDimensions((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [selected, element.type]);

  useEffect(() => {
    if (!editing || !textRef.current) return;
    textRef.current.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(textRef.current);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing]);

  useEffect(() => {
    if (!selected && editing) textRef.current?.blur();
  }, [selected, editing]);

  function handleClick(event: MouseEvent<HTMLElement>) {
    if (!canInteract() || editing) {
      event.stopPropagation();
      return;
    }
    const state = useEditorStore.getState();
    if (state.activeTool === "select") {
      event.stopPropagation();
      state.setSelectedElementId(element.id);
      return;
    }
    const parent =
      element.type === "frame"
        ? event.currentTarget
        : event.currentTarget.parentElement?.closest<HTMLElement>(
            '[data-element-type="frame"]',
          );
    if (!parent) return;
    const parentId = parent.dataset.editorElement;
    if (!parentId) return;
    event.stopPropagation();
    const bounds = parent.getBoundingClientRect();
    state.addElement(parentId, state.activeTool, {
      x:
        (event.clientX - bounds.left) / state.canvasConfig.zoom -
        parent.clientLeft +
        parent.scrollLeft,
      y:
        (event.clientY - bounds.top) / state.canvasConfig.zoom -
        parent.clientTop +
        parent.scrollTop,
    });
  }

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        nodeRef.current = node;
      }}
      data-editor-element={element.id}
      data-element-type={element.type}
      data-selected={selected}
      className="canvas-element"
      style={{
        ...element.styles,
        position: element.styles.position || "relative",
        ...(root ? { position: "relative", left: 0, top: 0 } : {}),
        ...(fillsStack && element.styles.position !== "absolute"
          ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 }
          : {}),
      }}
      aria-label={element.name}
      {...(element.type === "button"
        ? { type: "button" as const, tabIndex: -1 }
        : {})}
      onClick={handleClick}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (
          element.type !== "text" ||
          !canInteract() ||
          useEditorStore.getState().activeTool !== "select"
        )
          return;
        useEditorStore.getState().setSelectedElementId(element.id);
        cancelEditRef.current = false;
        setEditing(true);
      }}
    >
      {element.type === "text" ? (
        <span
          ref={textRef}
          className="canvas-text-content"
          contentEditable={editing ? "plaintext-only" : false}
          suppressContentEditableWarning
          role={editing ? "textbox" : undefined}
          aria-label={editing ? `${element.name} content on canvas` : undefined}
          aria-multiline={editing ? true : undefined}
          spellCheck={editing}
          onPointerDown={(event) => {
            if (editing && event.button === 0) event.stopPropagation();
          }}
          onBlur={(event) => {
            if (!editing) return;
            if (!cancelEditRef.current)
              useEditorStore
                .getState()
                .updateText(
                  element.id,
                  event.currentTarget.innerText.replace(/\r\n/g, "\n"),
                );
            cancelEditRef.current = false;
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (!editing) return;
            event.stopPropagation();
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              cancelEditRef.current = true;
              event.currentTarget.textContent = content;
              event.currentTarget.blur();
            } else if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          onPaste={pastePlainText}
          onDrop={(event) => {
            event.preventDefault();
          }}
        >
          {content}
        </span>
      ) : element.type === "button" ? (
        content
      ) : null}
      {element.children.map((child) => (
        <ElementNode
          key={child.id}
          element={child}
          canInteract={canInteract}
          parentStyles={element.styles}
        />
      ))}
      {/* Counter-scaling keeps selection borders and labels screen-sized. */}
      {selected && (
        <span
          className="canvas-selection-box"
          style={{
            width: dimensions.width * zoom,
            height: dimensions.height * zoom,
            transform: `scale(${1 / zoom})`,
          }}
          aria-hidden="true"
        >
          <span className="canvas-selection-label">
            {element.name}
            <span>
              {dimensions.width} × {dimensions.height}
            </span>
          </span>
        </span>
      )}
    </Tag>
  );
});

export function CanvasRenderer({
  canInteract,
}: {
  canInteract: () => boolean;
}) {
  const elements = useEditorStore((state) => state.elements);
  const selectedElementId = useEditorStore((state) => state.selectedElementId);
  const zoom = useEditorStore((state) => state.canvasConfig.zoom);

  return elements.map((element) => (
    <div
      key={element.id}
      className={element.type === "frame" ? "canvas-artboard" : "canvas-root"}
      style={{
        left: element.styles.left ?? 0,
        top: element.styles.top ?? 0,
        width:
          element.styles.width === "100%"
            ? "100%"
            : typeof element.styles.width === "number"
              ? element.styles.width
              : "max-content",
        height:
          element.styles.height === "100%"
            ? "100%"
            : typeof element.styles.height === "number"
              ? element.styles.height
              : undefined,
      }}
    >
      {element.type === "frame" && selectedElementId !== element.id && (
        <div
          className="canvas-frame-label"
          style={{ transform: `scale(${1 / zoom})` }}
        >
          <Monitor size={12} aria-hidden="true" />
          <span>{element.name}</span>
          <span>
            {element.styles.width} × {element.styles.height}
          </span>
        </div>
      )}
      <ElementNode element={element} canInteract={canInteract} root />
    </div>
  ));
}
