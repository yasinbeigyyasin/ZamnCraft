"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Frame,
  Hand,
  Home,
  Maximize,
  Minus,
  Monitor,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Play,
  Plus,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { IconButton, tools } from "./editor-controls";
import { EditorDialog, type EditorDialogKind } from "./editor-dialog";
import { InspectorPanel } from "./inspector-panel";
import { NavigationPanel } from "./navigation-panel";

export function EditorShell() {
  const { tool, zoom, setTool, setZoom } = useEditorStore();
  const [dialog, setDialog] = useState<EditorDialogKind | null>(null);
  const activeTool = tools.find((item) => item.id === tool)!;

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

      const selected = tools.find(
        (item) => item.shortcut.toLowerCase() === event.key.toLowerCase(),
      );
      if (selected) {
        event.preventDefault();
        setTool(selected.id);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dialog, setTool]);

  return (
    <main className="editor-shell">
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
            onClick={() => setDialog("navigation")}
            aria-haspopup="dialog"
          />
        </div>
        <nav className="tool-bar" aria-label="Editor tools">
          {tools.map(({ id, label, shortcut, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={`${label} (${shortcut})`}
              aria-keyshortcuts={shortcut.toLowerCase()}
              aria-pressed={tool === id}
              title={`${label} (${shortcut})`}
              onClick={() => setTool(id)}
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
            onClick={() => setDialog("inspector")}
            aria-haspopup="dialog"
          />
          <IconButton
            icon={Play}
            label="Preview site"
            onClick={() => setDialog("preview")}
            aria-haspopup="dialog"
          />
          <button
            type="button"
            className="export-button"
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
        <aside className="navigation-sidebar" aria-label="Project navigation">
          <NavigationPanel onHelp={() => setDialog("help")} />
        </aside>

        <section
          aria-label="Design canvas"
          className={`canvas canvas-tool-${tool}`}
          style={{
            backgroundSize: `${(20 * zoom) / 100}px ${(20 * zoom) / 100}px`,
          }}
        >
          <div className="canvas-breadcrumb">
            <Home size={12} strokeWidth={1.5} aria-hidden="true" />
            <span>Home</span>
            <ChevronRight size={12} aria-hidden="true" />
            <span>Canvas</span>
          </div>
          <div className="canvas-device">
            <Monitor size={12} strokeWidth={1.5} aria-hidden="true" />
            <span>Desktop</span>
          </div>
          <div className="canvas-empty">
            <div className="canvas-emblem" aria-hidden="true">
              <Frame size={30} strokeWidth={1} />
              <span className="emblem-spark">
                <Plus size={13} />
              </span>
            </div>
            <h1>Big ideas start with a blank canvas.</h1>
            <p>
              A space to design, build, and make it yours.
              <br />
              Your next great website starts here.
            </p>
            <div className="canvas-shortcuts" aria-label="Tool shortcuts">
              <Frame size={12} aria-hidden="true" />
              <span>Frame tool</span>
              <kbd>F</kbd>
              <span className="shortcut-divider" aria-hidden="true" />
              <MousePointer2 size={11} aria-hidden="true" />
              <span>Select</span>
              <kbd>V</kbd>
            </div>
          </div>
          <p className="canvas-tool-status" role="status">
            <span className="status-dot" />
            {activeTool.label} selected
          </p>
          <div
            className="canvas-controls"
            role="group"
            aria-label="Canvas zoom"
          >
            <IconButton
              icon={Hand}
              label="Hand tool (panning is not available yet)"
              disabled
            />
            <span className="control-divider" aria-hidden="true" />
            <IconButton
              icon={Minus}
              label="Zoom out"
              disabled={zoom <= 25}
              onClick={() => setZoom(zoom - 25)}
            />
            <button
              type="button"
              className="zoom-value"
              onClick={() => setZoom(100)}
              title="Reset grid zoom to 100%"
              aria-label={`Grid zoom ${zoom}%, reset to 100%`}
            >
              {zoom}%
            </button>
            <IconButton
              icon={Plus}
              label="Zoom in"
              disabled={zoom >= 200}
              onClick={() => setZoom(zoom + 25)}
            />
            <span className="control-divider" aria-hidden="true" />
            <IconButton
              icon={Maximize}
              label="Reset canvas view"
              onClick={() => setZoom(100)}
            />
          </div>
          <span className="canvas-signature">MADE TO MAKE.</span>
        </section>

        <aside className="inspector-sidebar" aria-label="Inspector">
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
