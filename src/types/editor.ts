import type { CSSProperties } from "react";

export interface ElementEffects {
  appear: {
    enabled: boolean;
    opacity: number;
    offsetX: number;
    offsetY: number;
    scale: number;
  };
  hover: {
    enabled: boolean;
    scale: number;
    rotate: number;
    fill?: string;
    opacity?: number;
  };
  press: { enabled: boolean; scale: number };
  transition: {
    type: "spring" | "ease";
    duration: number;
    stiffness: number;
    damping: number;
  };
  blur: number;
  shadow: string;
}

export interface EditorElement {
  id: string;
  name: string;
  type: "frame" | "text" | "button";
  children: EditorElement[];
  styles: CSSProperties;
  content?: string;
  breakpoint?: "desktop" | "tablet" | "mobile";
  componentId?: string;
  componentRole?: "master" | "instance";
  componentSourceId?: string;
  // Preserve free-layout offsets while a parent arranges children in flow.
  freePosition?: Pick<CSSProperties, "position" | "left" | "top">;
  // Optional for older document trees; new elements receive independent defaults.
  effects?: ElementEffects;
  animations: Record<string, unknown>;
}

export type EditorTool =
  "select" | "scale" | "hand" | "frame" | "stack" | "text";
export type SidebarTab = "pages" | "layers" | "assets";
export type Point = { x: number; y: number };
export type CanvasConfig = { zoom: number; pan: Point };

export interface EditorPage {
  id: string;
  name: string;
  path: string;
  elements: EditorElement[];
  canvasConfig: CanvasConfig;
}

export interface MasterComponent {
  id: string;
  name: string;
  element: EditorElement;
}

export interface WorkspaceDocument {
  canvasBackground?: string;
  projectTitle: string;
  pages: EditorPage[];
  components: MasterComponent[];
  activePageId: string;
}
export interface HistorySnapshot extends WorkspaceDocument {
  selectedElementId: string | null;
}
