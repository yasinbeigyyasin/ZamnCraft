import { create } from "zustand";
import type {
  CanvasConfig,
  EditorElement,
  EditorTool,
  Point,
  SidebarTab,
} from "@/types/editor";

export type {
  CanvasConfig,
  EditorElement,
  EditorTool,
  Point,
  SidebarTab,
} from "@/types/editor";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

export function findElementById(
  elements: EditorElement[],
  id: string,
): EditorElement | undefined {
  for (const element of elements) {
    if (element.id === id) return element;
    const child = findElementById(element.children, id);
    if (child) return child;
  }
}

function updateElement(
  elements: EditorElement[],
  id: string,
  update: (element: EditorElement) => EditorElement,
): EditorElement[] {
  return elements.map((element) => {
    if (element.id === id) return update(element);
    const children = updateElement(element.children, id, update);
    return children.some((child, index) => child !== element.children[index])
      ? { ...element, children }
      : element;
  });
}

export interface EditorState {
  elements: EditorElement[];
  selectedElementId: string | null;
  activeTool: EditorTool;
  tab: SidebarTab;
  canvasConfig: CanvasConfig;
  setElements: (elements: EditorElement[]) => void;
  addElement: (
    parentId: string | null,
    type: "frame" | "text",
    position: Point,
  ) => string | null;
  updateText: (id: string, content: string) => void;
  setSelectedElementId: (id: string | null) => void;
  setActiveTool: (tool: EditorTool) => void;
  setTab: (tab: SidebarTab) => void;
  setPan: (pan: Point) => void;
  /** Zoom is a scale factor; an optional viewport-space anchor stays stationary. */
  setZoom: (zoom: number, anchor?: Point) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  elements: [
    {
      id: "desktop",
      name: "Desktop",
      type: "frame",
      children: [],
      styles: {
        position: "relative",
        width: 1200,
        height: 800,
        backgroundColor: "#ffffff",
        color: "#111111",
      },
      animations: {},
    },
  ],
  selectedElementId: null,
  activeTool: "select",
  tab: "pages",
  canvasConfig: { zoom: 1, pan: { x: 0, y: 0 } },
  setElements: (elements) =>
    set((state) => ({
      elements,
      selectedElementId:
        state.selectedElementId &&
        findElementById(elements, state.selectedElementId)
          ? state.selectedElementId
          : null,
    })),
  addElement: (parentId, type, position) => {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y))
      return null;
    let createdId: string | null = null;
    set((state) => {
      const parent =
        parentId === null ? null : findElementById(state.elements, parentId);
      if (parentId !== null && parent?.type !== "frame") return state;
      const element: EditorElement = {
        id: crypto.randomUUID(),
        name: type === "frame" ? "Frame" : "Text",
        type,
        children: [],
        styles: {
          position: "absolute",
          left: parentId === null ? position.x : Math.max(0, position.x),
          top: parentId === null ? position.y : Math.max(0, position.y),
          width: 200,
          ...(type === "frame"
            ? { height: 200, backgroundColor: "#e5e5e5" }
            : {
                minHeight: 24,
                fontSize: 16,
                lineHeight: 1.5,
                color: parentId === null ? "#ffffff" : "#111111",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }),
        },
        ...(type === "text" ? { content: "Double click to edit" } : {}),
        animations: {},
      };
      createdId = element.id;
      return {
        elements:
          parentId === null
            ? [...state.elements, element]
            : updateElement(state.elements, parentId, (frame) => ({
                ...frame,
                children: [...frame.children, element],
              })),
        selectedElementId: element.id,
        activeTool: "select",
      };
    });
    return createdId;
  },
  updateText: (id, content) =>
    set((state) => {
      const element = findElementById(state.elements, id);
      if (element?.type !== "text" || element.content === content) return state;
      return {
        elements: updateElement(state.elements, id, (text) => ({
          ...text,
          content,
        })),
      };
    }),
  setSelectedElementId: (id) =>
    set((state) => ({
      selectedElementId:
        id === null || findElementById(state.elements, id) ? id : null,
    })),
  setActiveTool: (activeTool) => set({ activeTool }),
  setTab: (tab) => set({ tab }),
  setPan: (pan) => {
    if (Number.isFinite(pan.x) && Number.isFinite(pan.y)) {
      set((state) => ({
        canvasConfig: { ...state.canvasConfig, pan: { ...pan } },
      }));
    }
  },
  setZoom: (zoom, anchor) => {
    if (
      !Number.isFinite(zoom) ||
      (anchor && (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)))
    )
      return;
    set((state) => {
      const previous = state.canvasConfig;
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      const pan = anchor
        ? {
            x:
              anchor.x -
              ((anchor.x - previous.pan.x) * nextZoom) / previous.zoom,
            y:
              anchor.y -
              ((anchor.y - previous.pan.y) * nextZoom) / previous.zoom,
          }
        : previous.pan;
      return { canvasConfig: { zoom: nextZoom, pan } };
    });
  },
}));
