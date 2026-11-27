"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Code2,
  PanelLeft,
  PanelRight,
  Play,
  Square,
} from "lucide-react";
import { Canvas } from "./canvas";
import { useEditorStore } from "@/store/useEditorStore";
import { IconButton, tools, upcomingTools } from "./editor-controls";
import { EditorDialog, type EditorDialogKind } from "./editor-dialog";
import { InspectorPanel } from "./inspector-panel";
import { NavigationPanel } from "./navigation-panel";

export function EditorShell() {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const preview = useEditorStore((state) => state.isPreviewMode);
  const setPreviewMode = useEditorStore((state) => state.setPreviewMode);
  const [dialog, setDialog] = useState<EditorDialogKind | null>(null);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        dialog ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest("input, textarea, select, [role='textbox']")))
      )
        return;

      if (preview) {
        if (event.key === "Escape") {
          event.preventDefault();
          setPreviewMode(false);
          document.getElementById("preview-toggle")?.focus();
        }
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        const state = useEditorStore.getState();
        if (state.selectedElementId) {
          event.preventDefault();
          const focused = document.activeElement;
          state.deleteElement(state.selectedElementId);
          requestAnimationFrame(() => {
            if (focused && !focused.isConnected)
              document
                .getElementById("editor-canvas")
                ?.focus({ preventScroll: true });
          });
        }
        return;
      }

      const selected = tools.find(
        (item) => item.shortcut.toLowerCase() === event.key.toLowerCase(),
      );
      if (selected) {
        event.preventDefault();
        setActiveTool(selected.id);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dialog, setActiveTool, preview, setPreviewMode]);

  return (
    <main className={`editor-shell ${preview ? "editor-preview" : ""}`}>
      <header className="top-bar">
        <div className="toolbar-project">
          <button
            className="brand-mark"
            aria-label="About ZamnCraft"
            onClick={() => setDialog("project")}
          >
            <span />
            <span />
            <span />
          </button>
          <span className="toolbar-divider" aria-hidden="true" />
          <IconButton
            icon={ArrowLeft}
            label="Project overview"
            onClick={() => setDialog("project")}
          />
          <button
            type="button"
            className="project-name"
            onClick={() => setDialog("project")}
            aria-haspopup="dialog"
          >
            <span>Untitled</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
          <span className="workspace-label">
            <Check size={12} aria-hidden="true" /> Local workspace
          </span>
          <IconButton
            icon={PanelLeft}
            label="Open project navigation"
            className="navigation-toggle"
            hidden={preview}
            onClick={() => setDialog("navigation")}
            aria-haspopup="dialog"
          />
        </div>
        <nav className="tool-bar" aria-label="Editor tools" hidden={preview}>
          {tools.map(({ id, label, shortcut, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={`${label} (${shortcut})`}
              aria-keyshortcuts={shortcut.toLowerCase()}
              aria-pressed={activeTool === id}
              title={`${label} (${shortcut})${id === "select" ? "" : " — click on the canvas or inside a frame to add"}`}
              onClick={(event) => {
                setActiveTool(id);
                if (event.detail > 0)
                  document
                    .getElementById("editor-canvas")
                    ?.focus({ preventScroll: true });
              }}
              className="tool-button"
            >
              <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
              {id === "frame" && (
                <ChevronDown
                  size={9}
                  className="tool-chevron"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
          {upcomingTools.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="tool-button"
              disabled
              aria-label={`${label} (coming soon)`}
              title={`${label} — coming soon`}
            >
              <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="toolbar-actions">
          <span className="avatar" title="Your workspace">
            Y
          </span>
          <span className="toolbar-divider" aria-hidden="true" />
          <IconButton
            icon={PanelRight}
            label="Open inspector"
            className="inspector-toggle"
            hidden={preview}
            onClick={() => setDialog("inspector")}
            aria-haspopup="dialog"
          />
          <IconButton
            id="preview-toggle"
            icon={preview ? Square : Play}
            label={preview ? "Exit preview" : "Preview site"}
            aria-pressed={preview}
            onClick={() => {
              setPreviewMode(!preview);
              if (!preview)
                document
                  .getElementById("editor-canvas")
                  ?.focus({ preventScroll: true });
            }}
          />
          <button
            type="button"
            className="export-button"
            hidden={preview}
            aria-label="Export Code"
            aria-haspopup="dialog"
            onClick={() => setDialog("export")}
          >
            <Code2 size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Export Code</span>
          </button>
        </div>
      </header>

      <div className="editor-workspace">
        <aside
          className="navigation-sidebar"
          aria-label="Project navigation"
          hidden={preview}
        >
          <NavigationPanel onHelp={() => setDialog("help")} />
        </aside>

        <Canvas suspended={dialog !== null} />

        <aside
          className="inspector-sidebar"
          aria-label="Inspector"
          hidden={preview}
        >
          <InspectorPanel />
        </aside>
      </div>
      {dialog && (
        <EditorDialog
          kind={dialog}
          onDismiss={() => setDialog(null)}
          onHelp={() => setDialog("help")}
        />
      )}
    </main>
  );
}
