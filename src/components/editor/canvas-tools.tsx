"use client";

import { useEffect, useState } from "react";
import { Component, Type } from "lucide-react";
import type { EditorTool } from "@/types/editor";
import { useEditorStore } from "@/store/editor-store";
import { canCreateComponent } from "@/lib/editor-components";
import { tools } from "./editor-controls";
import { PopoverSelect } from "./property-controls";

const focusCanvas = () =>
  document.getElementById("editor-canvas")?.focus({ preventScroll: true });
function ToolGroup({
  ids,
  label,
  disabled,
}: {
  ids: EditorTool[];
  label: string;
  disabled: boolean;
}) {
  const active = useEditorStore((state) => state.activeTool);
  const [remembered, setRemembered] = useState(ids[0]);
  const selected = ids.includes(active) ? active : remembered;
  useEffect(() => {
    if (ids.includes(active)) setRemembered(active);
  }, [active, ids]);
  const tool = tools.find((item) => item.id === selected)!;
  const Icon = tool.icon;
  function choose(id: EditorTool) {
    setRemembered(id);
    useEditorStore.getState().setActiveTool(id);
    requestAnimationFrame(focusCanvas);
  }
  return (
    <div className="dock-tool-group" data-active={ids.includes(active)}>
      <button
        type="button"
        className="dock-tool"
        aria-label={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
        title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
        aria-pressed={ids.includes(active)}
        disabled={disabled}
        onClick={() => choose(selected)}
      >
        <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
      </button>
      <PopoverSelect
        label={label}
        value={selected}
        placement="top"
        disabled={disabled}
        options={ids.map((id) => {
          const item = tools.find((tool) => tool.id === id)!;
          return {
            value: id,
            label: item.label,
            icon: item.icon,
            hint: item.shortcut,
          };
        })}
        onChange={(id) => choose(id as EditorTool)}
      />
    </div>
  );
}

export function CanvasTools({ disabled }: { disabled: boolean }) {
  const active = useEditorStore((state) => state.activeTool);
  const canCreate = useEditorStore((state) =>
    Boolean(
      state.selectedElementIds.length === 1 &&
      state.selectedElementId &&
      canCreateComponent(state.elements, state.selectedElementId),
    ),
  );
  return (
    <nav className="canvas-tool-dock" aria-label="Editor tools" data-canvas-ui>
      <ToolGroup
        label="Choose movement tool"
        ids={["select", "hand", "scale"]}
        disabled={disabled}
      />
      <ToolGroup
        label="Choose frame tool"
        ids={["frame", "stack"]}
        disabled={disabled}
      />
      <ToolGroup
        label="Choose shape tool"
        ids={[
          "rectangle",
          "ellipse",
          "line",
          "arrow",
          "triangle",
          "polygon",
          "star",
        ]}
        disabled={disabled}
      />
      <ToolGroup
        label="Choose drawing tool"
        ids={["pen", "pencil"]}
        disabled={disabled}
      />
      <button
        type="button"
        className="dock-tool"
        aria-label="Text (T)"
        title="Text (T)"
        aria-pressed={active === "text"}
        disabled={disabled}
        onClick={() => {
          useEditorStore.getState().setActiveTool("text");
          focusCanvas();
        }}
      >
        <Type size={18} strokeWidth={1.7} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="dock-tool component-tool"
        aria-label="Component (C)"
        title="Create Component (C)"
        disabled={disabled || !canCreate}
        onClick={() => {
          const state = useEditorStore.getState();
          if (state.selectedElementId)
            state.createComponent(state.selectedElementId);
        }}
      >
        <Component size={18} strokeWidth={1.7} aria-hidden="true" />
      </button>
    </nav>
  );
}
