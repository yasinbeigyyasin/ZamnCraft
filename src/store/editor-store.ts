import { create } from "zustand";

export type EditorTool = "select" | "frame" | "text" | "stack" | "component";
export type SidebarTab = "pages" | "layers" | "assets";

type EditorState = {
  tool: EditorTool;
  tab: SidebarTab;
  zoom: number;
  setTool: (tool: EditorTool) => void;
  setTab: (tab: SidebarTab) => void;
  setZoom: (zoom: number) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  tool: "select",
  tab: "pages",
  zoom: 100,
  setTool: (tool) => set({ tool }),
  setTab: (tab) => set({ tab }),
  setZoom: (zoom) => {
    if (Number.isFinite(zoom)) set({ zoom: Math.max(25, Math.min(200, zoom)) });
  },
}));
