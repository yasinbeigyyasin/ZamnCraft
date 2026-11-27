"use client";

import { useState } from "react";
import { useEditorStore } from "@/store/editor-store";

export function WorkspaceSettings({ onDismiss }: { onDismiss: () => void }) {
  const { projectTitle, renameProject, replaceWorkspace, persistenceError } =
    useEditorStore();
  const [title, setTitle] = useState(projectTitle);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<"reset" | "starter" | null>(
    null,
  );
  return (
    <div className="workspace-settings">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!renameProject(title))
            setError("Enter a project title between 1 and 80 characters.");
          else onDismiss();
        }}
      >
        <label htmlFor="project-title">Project title</label>
        <input
          id="project-title"
          value={title}
          maxLength={80}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setTitle(event.target.value);
            setError("");
          }}
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="secondary-button">
          Rename project
        </button>
      </form>
      <p className="workspace-save-status" role="status">
        {persistenceError ??
          "Automatically saved in this browser. Your pages, components, and project title stay here when you refresh. History is kept for this session only."}
      </p>
      <section aria-label="Workspace actions">
        <button
          type="button"
          className="library-button"
          onClick={() => setConfirmation("starter")}
        >
          Load Landing Page Starter
        </button>
        <p className="muted">
          Explore a ready-to-edit Navbar, Hero, CTA button, and Feature cards.
        </p>
        <button
          type="button"
          className="library-button"
          onClick={() => setConfirmation("reset")}
        >
          Reset to clean canvas
        </button>
      </section>
      {confirmation && (
        <div
          className="workspace-confirm"
          role="group"
          aria-label="Replace workspace confirmation"
        >
          <p>
            {confirmation === "starter"
              ? "Load the starter template?"
              : "Reset to a clean canvas?"}{" "}
            This replaces all current pages and components. You can undo it
            before refreshing.
          </p>
          <div className="library-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                replaceWorkspace(confirmation === "starter");
                onDismiss();
              }}
            >
              Confirm replacement
            </button>
            <button type="button" onClick={() => setConfirmation(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
