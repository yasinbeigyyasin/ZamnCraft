import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { WorkspaceSettings } from "./workspace-settings";
import { FigmaExport } from "./figma-export";
import { CodeExport } from "./code-export";
import { IconButton, tools } from "./editor-controls";
import { InspectorPanel } from "./inspector-panel";
import { NavigationPanel } from "./navigation-panel";

export type EditorDialogKind =
  "export" | "figma" | "project" | "help" | "navigation" | "inspector";

const titles: Record<EditorDialogKind, string> = {
  export: "Export Code",
  figma: "Copy UI to Figma",
  project: "Local workspace",
  help: "Editor shortcuts",
  navigation: "Project navigation",
  inspector: "Inspector properties",
};

export function EditorDialog({
  kind,
  onDismiss,
  onHelp,
  onFigma,
}: {
  kind: EditorDialogKind;
  onDismiss: () => void;
  onHelp: () => void;
  onFigma: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, [kind]);

  return (
    <dialog
      ref={ref}
      data-kind={kind}
      className={`editor-dialog ${kind === "export" || kind === "figma" ? "export-dialog" : ""}`}
      aria-labelledby="editor-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      <div className="dialog-heading">
        <h2 id="editor-dialog-title">{titles[kind]}</h2>
        <IconButton
          ref={closeRef}
          icon={X}
          label="Close dialog"
          onClick={onDismiss}
        />
      </div>
      {kind === "project" ? (
        <WorkspaceSettings onDismiss={onDismiss} />
      ) : kind === "export" ? (
        <CodeExport />
      ) : kind === "figma" ? (
        <FigmaExport />
      ) : kind === "navigation" ? (
        <NavigationPanel onHelp={onHelp} />
      ) : kind === "inspector" ? (
        <InspectorPanel />
      ) : kind === "help" ? (
        <div className="dialog-content">
          <button type="button" className="secondary-button" onClick={onFigma}>
            Copy UI to Figma
          </button>
          <p className="dialog-description">
            Select a tool using the toolbar or these shortcuts.
          </p>
          <div className="shortcut-list">
            {tools.map(({ id, label, shortcut, icon: Icon }) => (
              <div key={id}>
                <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>{label}</span>
                <kbd>{shortcut}</kbd>
              </div>
            ))}
          </div>
          <p className="dialog-description">
            Hold Space and drag, or drag with the middle mouse button, to pan.
            Scroll or use a trackpad to pan; Shift + scroll pans horizontally.
            Drag empty canvas in Select mode to roam. Hold Ctrl or Cmd and
            scroll to zoom at the pointer. Use New desktop to add a blank
            artboard with preset or custom dimensions. Select Frame or Text,
            then click on the canvas or inside a frame to add an element.
            Double-click text to edit; Enter saves, Shift+Enter adds a line, and
            Escape cancels. In Layers, expand frames with their arrows and
            double-click a name (or press F2) to rename it. Delete or Backspace
            removes the selected layer and its children when you are not typing.
            Use the Inspector to adjust position, size, layout, styles, and
            typography. In Select mode, drag an element to move it or use its
            eight handles to resize. Choose Scale (K) to scale proportions,
            text, spacing, borders, and contents together. Edges and centers
            snap to the parent and siblings; hold Alt or Option to bypass
            snapping. Escape cancels an active drag or resize. In Effects &
            Animations, enable appear, hover, or press effects and set their
            transition. Replay animation tests appear on the editing canvas.
            Play opens the live preview without editing handles; press Escape or
            Exit preview to return to your selection and camera. Press C or use
            Create Component in Assets to turn a selected subtree into a master.
            Insert linked instances from Assets; edits to the master update them
            across pages. Detach an instance to edit it independently. Pages
            supports adding, renaming, deleting, and switching page canvases.
            Export Code generates React, Vue, Svelte, or HTML/CSS for the
            current page, with copy and download controls. Add Tablet or Mobile
            with the canvas breakpoint controls; choose any top-level frame,
            including custom desktops, in Preview. Ctrl/Cmd+Z undoes;
            Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. A history shortcut during a drag
            cancels it first. Open Local workspace to rename, reset, or load a
            starter. Changes save automatically in this browser; history lasts
            until refresh.
          </p>
        </div>
      ) : null}
    </dialog>
  );
}
