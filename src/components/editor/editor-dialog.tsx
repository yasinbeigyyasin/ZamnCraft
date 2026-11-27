import { useEffect, useRef } from "react";
import { Code2, File, Globe, X } from "lucide-react";
import { IconButton, tools } from "./editor-controls";
import { InspectorPanel } from "./inspector-panel";
import { NavigationPanel } from "./navigation-panel";

export type EditorDialogKind =
  | "preview"
  | "export"
  | "project"
  | "help"
  | "navigation"
  | "inspector";

const titles: Record<EditorDialogKind, string> = {
  preview: "Site preview",
  export: "Export Code",
  project: "Untitled project",
  help: "Editor shortcuts",
  navigation: "Project navigation",
  inspector: "Inspector properties",
};

const emptyStates = {
  export: {
    icon: Code2,
    heading: "Something great is on its way.",
    description:
      "Your Desktop frame is ready. Code generation will be added in a later step.",
  },
  preview: {
    icon: Globe,
    heading: "Your Desktop frame is ready.",
    description:
      "Live website preview will be added after element editing. For now, explore your frame on the canvas.",
  },
  project: {
    icon: File,
    heading: "A new beginning.",
    description:
      "This is the ZamnCraft editor with an infinite canvas. UI state lasts for this session only; nothing is stored on a server.",
  },
};

export function EditorDialog({
  kind,
  onDismiss,
  onHelp,
}: {
  kind: EditorDialogKind;
  onDismiss: () => void;
  onHelp: () => void;
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

  const empty =
    kind in emptyStates ? emptyStates[kind as keyof typeof emptyStates] : null;

  return (
    <dialog
      ref={ref}
      className={`editor-dialog ${kind === "preview" ? "preview-dialog" : ""}`}
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
      {kind === "navigation" ? (
        <NavigationPanel onHelp={onHelp} />
      ) : kind === "inspector" ? (
        <InspectorPanel />
      ) : kind === "help" ? (
        <div className="dialog-content">
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
            Hold Ctrl or Cmd and scroll to zoom at the pointer. Drawing, text
            editing, and property editing come in later steps.
          </p>
        </div>
      ) : (
        empty && (
          <div className="dialog-content dialog-empty">
            <empty.icon
              size={24}
              strokeWidth={1.5}
              className="muted"
              aria-hidden="true"
            />
            <h3>{empty.heading}</h3>
            <p className="dialog-description">{empty.description}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={onDismiss}
            >
              Back to editor
            </button>
          </div>
        )
      )}
    </dialog>
  );
}
