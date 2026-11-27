"use client";

import { useRef, useState } from "react";
import { Component, Home, File, Pencil, Plus, Trash2 } from "lucide-react";
import { canCreateComponent, componentOwner } from "@/lib/editor-components";
import { findElementById, useEditorStore } from "@/store/editor-store";
import type { EditorPage } from "@/types/editor";
import { IconButton } from "./editor-controls";

function PagePathForm({
  initial = "",
  onSave,
  onCancel,
}: {
  initial?: string;
  onSave: (path: string) => boolean;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  return (
    <form
      className="page-path-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim() || !onSave(value))
          setError(
            "Use a unique path, such as /about (letters, numbers, / and -).",
          );
      }}
    >
      <input
        autoFocus
        aria-label="Page path"
        placeholder="/about"
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          setValue(event.target.value);
          setError("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      {error && <p role="alert">{error}</p>}
      <div className="library-actions">
        <button type="submit" className="secondary-button">
          Save page
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PageRow({ page }: { page: EditorPage }) {
  const active = useEditorStore((state) => state.activePageId === page.id);
  const onlyPage = useEditorStore((state) => state.pages.length === 1);
  const { switchPage, renamePage, deletePage } = useEditorStore();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const Icon = page.path === "/" ? Home : File;
  return (
    <li>
      <div
        className="page-row"
        aria-current={active ? "page" : undefined}
        data-page-id={page.id}
      >
        <Icon size={13} strokeWidth={1.5} aria-hidden="true" />
        <button
          ref={button}
          type="button"
          className="page-select"
          aria-label={`Open page ${page.path}`}
          aria-current={active ? "page" : undefined}
          onClick={() => switchPage(page.id)}
          onDoubleClick={() => setRenaming(true)}
          onKeyDown={(event) => {
            if (event.key === "F2") {
              event.preventDefault();
              setRenaming(true);
            }
          }}
        >
          {page.name}
        </button>
        <span className="page-path">{page.path}</span>
        <IconButton
          icon={Pencil}
          label={`Rename page ${page.path}`}
          onClick={() => {
            setDeleting(false);
            setRenaming(!renaming);
          }}
        />
        <IconButton
          icon={Trash2}
          label={`Delete page ${page.path}`}
          disabled={onlyPage}
          onClick={() => {
            setRenaming(false);
            setDeleting(!deleting);
          }}
        />
      </div>
      {renaming && (
        <PagePathForm
          initial={page.path}
          onCancel={() => {
            setRenaming(false);
            button.current?.focus();
          }}
          onSave={(path) => {
            if (!renamePage(page.id, path)) return false;
            setRenaming(false);
            button.current?.focus();
            return true;
          }}
        />
      )}
      {deleting && (
        <div
          className="page-delete-confirm"
          role="group"
          aria-label={`Delete page ${page.path} confirmation`}
        >
          <p>Delete {page.path} and its canvas? This cannot be undone.</p>
          <div className="library-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={(event) => {
                const panel =
                  event.currentTarget.closest<HTMLElement>('[role="tabpanel"]');
                deletePage(page.id);
                panel?.focus();
              }}
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleting(false);
                button.current?.focus();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function PagesPanel() {
  const pages = useEditorStore((state) => state.pages);
  const addPage = useEditorStore((state) => state.addPage);
  const [adding, setAdding] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <ul className="page-list" aria-label="Site pages">
        {pages.map((page) => (
          <PageRow key={page.id} page={page} />
        ))}
      </ul>
      <button
        ref={trigger}
        type="button"
        className="library-button"
        onClick={() => setAdding(!adding)}
      >
        <Plus size={13} aria-hidden="true" />
        Add page
      </button>
      {adding && (
        <PagePathForm
          onCancel={() => {
            setAdding(false);
            trigger.current?.focus();
          }}
          onSave={(path) => {
            if (!addPage(path)) return false;
            setAdding(false);
            trigger.current?.focus();
            return true;
          }}
        />
      )}
      <p className="sidebar-note">
        Your site starts here.
        <br />A little blank space. A lot of possibility.
      </p>
    </>
  );
}

export function AssetsPanel() {
  const {
    components,
    elements,
    selectedElementId,
    createComponent,
    insertComponent,
    detachInstance,
    editMaster,
    pages,
  } = useEditorStore();
  const owner = selectedElementId
    ? componentOwner(elements, selectedElementId)
    : undefined;
  const canCreate = Boolean(
    selectedElementId && canCreateComponent(elements, selectedElementId),
  );
  return (
    <>
      <button
        type="button"
        className="library-button"
        disabled={!canCreate}
        title="Select a non-component subtree to make it reusable"
        onClick={() => {
          if (selectedElementId) createComponent(selectedElementId);
        }}
      >
        <Component size={14} aria-hidden="true" />
        Create Component
      </button>
      {owner && (
        <div className="component-status">
          <span>
            {owner.componentRole === "master"
              ? "Master Component"
              : "Component instance"}
          </span>
          {owner.componentRole === "instance" && (
            <button
              type="button"
              className="library-button"
              onClick={() => detachInstance(owner.id)}
            >
              Detach instance
            </button>
          )}
          <p className="muted">
            {owner.componentRole === "master"
              ? "Edits here update all linked instances."
              : "Master updates replace linked styles and structure. Detach to edit independently."}
          </p>
        </div>
      )}
      {components.length ? (
        <ul className="asset-list" aria-label="Saved components">
          {components.map((component) => {
            const hasMaster = pages.some(
              (page) =>
                findElementById(page.elements, component.element.id)
                  ?.componentRole === "master",
            );
            return (
              <li
                key={component.id}
                className="asset-row"
                data-component-id={component.id}
              >
                <div className="asset-name">
                  <Component size={14} aria-hidden="true" />
                  <span>{component.name}</span>
                </div>
                <div className="library-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    aria-label={`Insert ${component.name} instance`}
                    onClick={() => insertComponent(component.id)}
                  >
                    Insert
                  </button>
                  <button
                    type="button"
                    disabled={!hasMaster}
                    title={
                      hasMaster
                        ? "Select the master on its page"
                        : "The master was deleted; the saved component can still be inserted"
                    }
                    aria-label={`Edit ${component.name} master`}
                    onClick={() => editMaster(component.id)}
                  >
                    Edit master
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-panel">
          <Component size={24} strokeWidth={1.5} aria-hidden="true" />
          <p>A home for your assets</p>
          <p className="muted">
            Select a Frame, Stack, or Text and create a reusable component.
          </p>
        </div>
      )}
    </>
  );
}
