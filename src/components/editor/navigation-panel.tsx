"use client";

import { useId, useRef, useState, type CSSProperties } from "react";
import {
  Component,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Frame,
  Layers,
  Square,
  Type,
  Trash2,
} from "lucide-react";
import {
  useEditorStore,
  type EditorElement,
  type SidebarTab,
} from "@/store/useEditorStore";
import { IconButton, tools } from "./editor-controls";
import { PagesPanel, AssetsPanel } from "./sidebar-library";

import { canReparentElements } from "@/store/editor-store";

let draggedLayerIds: string[] | null = null;
const tabs: SidebarTab[] = ["pages", "layers", "assets"];

function countElements(elements: EditorElement[]): number {
  return elements.reduce(
    (count, element) => count + 1 + countElements(element.children),
    0,
  );
}

function LayerItem({
  element,
  depth,
  component = false,
}: {
  component?: boolean;
  element: EditorElement;
  depth: number;
}) {
  const selected = useEditorStore((state) =>
    state.selectedElementIds.includes(element.id),
  );
  const select = useEditorStore((state) => state.setSelectedElementId);
  const renameElement = useEditorStore((state) => state.renameElement);
  const deleteElement = useEditorStore((state) => state.deleteElement);
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(element.name);
  const cancelRename = useRef(false);
  const selectRef = useRef<HTMLButtonElement>(null);
  const childrenId = useId();
  const linked = component || Boolean(element.componentId);
  const Icon = element.componentId
    ? Component
    : element.vector
      ? (tools.find((tool) => tool.id === element.vector!.kind)?.icon ?? Square)
      : element.type === "text"
        ? Type
        : element.type === "button"
          ? Square
          : Frame;

  function startRename() {
    select(element.id);
    setDraft(element.name);
    cancelRename.current = false;
    setRenaming(true);
  }

  return (
    <li>
      <div
        className="layer-row"
        data-layer-id={element.id}
        data-selected={selected}
        data-component={linked}
        draggable={!renaming && !linked && !element.breakpoint}
        onDragStart={(event) => {
          if (
            renaming ||
            linked ||
            element.breakpoint ||
            (event.target instanceof Element &&
              event.target.closest(".layer-delete, .layer-disclosure, input"))
          ) {
            event.preventDefault();
            return;
          }
          const state = useEditorStore.getState();
          if (!selected) state.setSelectedElementId(element.id);
          draggedLayerIds = [...useEditorStore.getState().selectedElementIds];
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "application/x-zamncraft-layers",
            JSON.stringify(draggedLayerIds),
          );
        }}
        onDragOver={(event) => {
          if (
            !draggedLayerIds ||
            !canReparentElements(
              useEditorStore.getState().elements,
              draggedLayerIds,
              element.id,
            )
          )
            return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          event.currentTarget.dataset.dropTarget = "true";
        }}
        onDragLeave={(event) => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          )
            delete event.currentTarget.dataset.dropTarget;
        }}
        onDragEnd={() => {
          draggedLayerIds = null;
          document
            .querySelectorAll("[data-drop-target]")
            .forEach((row) => row.removeAttribute("data-drop-target"));
        }}
        onDrop={(event) => {
          event.preventDefault();
          delete event.currentTarget.dataset.dropTarget;
          const ids = draggedLayerIds;
          draggedLayerIds = null;
          if (
            ids &&
            useEditorStore.getState().reparentElements(ids, element.id)
          )
            setExpanded(true);
        }}
        style={{ paddingLeft: 4 + depth * 16 }}
        onMouseDown={(event) => {
          if (event.target instanceof HTMLInputElement) return;
          if (event.shiftKey || event.ctrlKey || event.metaKey)
            event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target instanceof HTMLInputElement) return;
          const state = useEditorStore.getState();
          if (event.shiftKey) {
            const panel = event.currentTarget.closest('[role="tabpanel"]');
            const visible = panel
              ? [...panel.querySelectorAll<HTMLElement>("[data-layer-id]")]
                  .filter((row) => row.getClientRects().length > 0)
                  .map((row) => row.dataset.layerId!)
              : [];
            state.selectRange(
              element.id,
              visible,
              event.ctrlKey || event.metaKey,
            );
          } else if (event.ctrlKey || event.metaKey)
            state.toggleSelection(element.id);
          else select(element.id);
        }}
      >
        {element.children.length > 0 ? (
          <button
            type="button"
            className="layer-disclosure"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${element.name}`}
            aria-expanded={expanded}
            aria-controls={childrenId}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown size={12} aria-hidden="true" />
            ) : (
              <ChevronRight size={12} aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="layer-disclosure" aria-hidden="true" />
        )}
        <Icon className="layer-type-icon" size={13} aria-hidden="true" />
        {renaming ? (
          <input
            className="layer-name-input"
            aria-label={`Rename ${element.name}`}
            value={draft}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (!cancelRename.current) renameElement(element.id, draft);
              setRenaming(false);
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                cancelRename.current = event.key === "Escape";
                event.currentTarget.blur();
                requestAnimationFrame(() => selectRef.current?.focus());
              }
            }}
          />
        ) : null}
        <button
          ref={selectRef}
          type="button"
          className="layer-name"
          hidden={renaming}
          aria-pressed={selected}
          aria-keyshortcuts="F2"
          title={`${element.name} — drag onto a frame to move inside; Shift+click for a range; Ctrl/⌘+click to toggle; double-click or F2 to rename`}
          onDoubleClick={startRename}
          onKeyDown={(event) => {
            if (event.key === "F2") {
              event.preventDefault();
              startRename();
            }
          }}
        >
          {element.name}
        </button>
        <button
          type="button"
          className="layer-delete"
          aria-label={`Delete ${element.name}`}
          title={`Delete ${element.name} and its children`}
          onClick={(event) => {
            event.stopPropagation();
            const panel =
              event.currentTarget.closest<HTMLElement>('[role="tabpanel"]');
            deleteElement(element.id);
            panel?.focus({ preventScroll: true });
          }}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      {element.children.length > 0 && (
        <div
          id={childrenId}
          className="layer-children"
          style={{ "--tree-depth": depth } as CSSProperties}
          hidden={!expanded}
        >
          <ElementLayers
            elements={element.children}
            depth={depth + 1}
            component={linked}
          />
        </div>
      )}
    </li>
  );
}

function ElementLayers({
  elements,
  depth = 0,
  component = false,
}: {
  component?: boolean;
  elements: EditorElement[];
  depth?: number;
}) {
  return (
    <ul
      className="element-layers"
      aria-label={depth === 0 ? "Page layers" : "Child layers"}
    >
      {elements.map((element) => (
        <LayerItem
          key={element.id}
          element={element}
          depth={depth}
          component={component}
        />
      ))}
    </ul>
  );
}

export function NavigationPanel({ onHelp }: { onHelp: () => void }) {
  const tab = useEditorStore((state) => state.tab);
  const setTab = useEditorStore((state) => state.setTab);
  const id = useId();
  const pages = useEditorStore((state) => state.pages);
  const components = useEditorStore((state) => state.components);
  const activePageId = useEditorStore((state) => state.activePageId);
  const elements = useEditorStore((state) => state.elements);

  return (
    <div className="navigation-panel">
      <div role="tablist" aria-label="Project panels" className="panel-tabs">
        {tabs.map((item, index) => (
          <button
            key={item}
            id={`${id}-tab-${item}`}
            role="tab"
            aria-selected={tab === item}
            aria-controls={`${id}-panel-${item}`}
            tabIndex={tab === item ? 0 : -1}
            onClick={() => setTab(item)}
            onKeyDown={(event) => {
              let next: SidebarTab | undefined;
              if (event.key === "ArrowRight")
                next = tabs[(index + 1) % tabs.length];
              if (event.key === "ArrowLeft")
                next = tabs[(index + tabs.length - 1) % tabs.length];
              if (event.key === "Home") next = tabs[0];
              if (event.key === "End") next = tabs[tabs.length - 1];
              if (next) {
                event.preventDefault();
                setTab(next);
                document.getElementById(`${id}-tab-${next}`)?.focus();
              }
            }}
            className="panel-tab"
          >
            {item}
          </button>
        ))}
      </div>
      {tabs.map((item) => (
        <div
          key={item}
          id={`${id}-panel-${item}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${item}`}
          tabIndex={0}
          hidden={tab !== item}
          className="navigation-content"
        >
          <div className="section-label">
            <span>
              {item === "pages"
                ? "Site pages"
                : item === "layers"
                  ? "Page layers"
                  : "Your library"}
            </span>
            <span>
              {item === "pages"
                ? pages.length
                : item === "layers"
                  ? countElements(elements)
                  : components.length}
            </span>
          </div>
          {item === "pages" ? (
            <PagesPanel />
          ) : item === "assets" ? (
            <AssetsPanel />
          ) : elements.length > 0 ? (
            <ElementLayers key={activePageId} elements={elements} />
          ) : (
            <div className="empty-panel">
              <Layers size={24} strokeWidth={1.5} aria-hidden="true" />
              <p>No layers yet</p>
              <p className="muted">
                Your page structure will appear here as you build.
              </p>
            </div>
          )}
        </div>
      ))}
      <footer className="panel-footer">
        <span className="editor-ready">
          <span />
          Editor ready
        </span>
        <IconButton icon={CircleHelp} label="Editor help" onClick={onHelp} />
      </footer>
    </div>
  );
}
