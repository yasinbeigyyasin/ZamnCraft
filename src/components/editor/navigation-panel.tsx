import { useId } from "react";
import { CircleHelp, Frame, Home, Layers, LayoutTemplate } from "lucide-react";
import {
  useEditorStore,
  type EditorElement,
  type SidebarTab,
} from "@/store/useEditorStore";
import { IconButton } from "./editor-controls";

const tabs: SidebarTab[] = ["pages", "layers", "assets"];

function ElementLayers({ elements }: { elements: EditorElement[] }) {
  const selectedElementId = useEditorStore((state) => state.selectedElementId);
  const select = useEditorStore((state) => state.setSelectedElementId);
  return (
    <ul className="element-layers">
      {elements.map((element) => (
        <li key={element.id}>
          <button
            type="button"
            className="layer-row"
            aria-pressed={selectedElementId === element.id}
            onClick={() => select(element.id)}
          >
            <Frame size={13} aria-hidden="true" />
            {element.name}
          </button>
          {element.children.length > 0 && (
            <ElementLayers elements={element.children} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function NavigationPanel({ onHelp }: { onHelp: () => void }) {
  const tab = useEditorStore((state) => state.tab);
  const setTab = useEditorStore((state) => state.setTab);
  const id = useId();
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
                ? "1"
                : item === "layers"
                  ? elements.length
                  : "0"}
            </span>
          </div>
          {item === "pages" ? (
            <>
              <div className="page-row" aria-current="page">
                <Home size={13} strokeWidth={1.5} aria-hidden="true" />
                <span>Home</span>
                <span className="page-path">/</span>
              </div>
              <p className="sidebar-note">
                Your site starts here.
                <br />A little blank space. A lot of possibility.
              </p>
            </>
          ) : item === "layers" && elements.length > 0 ? (
            <ElementLayers elements={elements} />
          ) : (
            <div className="empty-panel">
              {item === "layers" ? (
                <Layers size={24} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <LayoutTemplate
                  size={24}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              )}
              <p>
                {item === "layers" ? "No layers yet" : "A home for your assets"}
              </p>
              <p className="muted">
                {item === "layers"
                  ? "Your page structure will appear here as you build."
                  : "Components and uploads will live here when you add them."}
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
