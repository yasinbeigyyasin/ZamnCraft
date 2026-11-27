"use client";

import { useId, useRef, useState } from "react";
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
import { IconButton } from "./editor-controls";
import { PagesPanel, AssetsPanel } from "./sidebar-library";

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
  const selected = useEditorStore(
    (state) => state.selectedElementId === element.id,
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
        style={{ paddingLeft: 4 + depth * 16 }}
        onClick={() => select(element.id)}
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
          title={`${element.name} — double-click or press F2 to rename`}
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
        <div id={childrenId} hidden={!expanded}>
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
