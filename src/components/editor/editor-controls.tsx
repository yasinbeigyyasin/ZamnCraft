import type { ComponentProps } from "react";
import {
  Frame,
  Layers,
  MousePointer2,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { EditorTool } from "@/store/useEditorStore";

export const tools: {
  id: EditorTool;
  label: string;
  shortcut: string;
  icon: LucideIcon;
}[] = [
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "frame", label: "Frame", shortcut: "F", icon: Frame },
  { id: "text", label: "Text", shortcut: "T", icon: Type },
];

export const upcomingTools = [{ id: "stack", label: "Stack", icon: Layers }];

export function IconButton({
  icon: Icon,
  label,
  className = "",
  ...props
}: Omit<ComponentProps<"button">, "children" | "aria-label"> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={15} strokeWidth={1.7} aria-hidden="true" />
    </button>
  );
}
