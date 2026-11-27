import type { ComponentProps } from "react";
import {
  Frame,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Triangle,
  Hexagon,
  Star,
  PenTool,
  Pencil,
  Scaling,
  Hand,
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
  { id: "select", label: "Move", shortcut: "V", icon: MousePointer2 },
  { id: "scale", label: "Scale", shortcut: "K", icon: Scaling },
  { id: "hand", label: "Hand", shortcut: "H", icon: Hand },
  { id: "frame", label: "Frame", shortcut: "F", icon: Frame },
  { id: "stack", label: "Stack", shortcut: "S", icon: Layers },
  { id: "text", label: "Text", shortcut: "T", icon: Type },
  { id: "rectangle", label: "Rectangle", shortcut: "R", icon: Square },
  { id: "ellipse", label: "Ellipse", shortcut: "O", icon: Circle },
  { id: "line", label: "Line", shortcut: "L", icon: Minus },
  { id: "arrow", label: "Arrow", shortcut: "Shift+L", icon: ArrowUpRight },
  { id: "triangle", label: "Triangle", shortcut: "", icon: Triangle },
  { id: "polygon", label: "Polygon", shortcut: "", icon: Hexagon },
  { id: "star", label: "Star", shortcut: "", icon: Star },
  { id: "pen", label: "Pen", shortcut: "P", icon: PenTool },
  { id: "pencil", label: "Pencil", shortcut: "Shift+P", icon: Pencil },
];

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
