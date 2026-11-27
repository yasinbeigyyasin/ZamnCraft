import type { CSSProperties } from "react";

export interface EditorElement {
  id: string;
  name: string;
  type: "frame" | "text" | "button";
  children: EditorElement[];
  styles: CSSProperties;
  // Animation data stays open until the animation schema is defined.
  animations: any;
}

export type EditorTool = "select" | "frame" | "text";
export type SidebarTab = "pages" | "layers" | "assets";
export type Point = { x: number; y: number };
export type CanvasConfig = { zoom: number; pan: Point };
