import { create } from "zustand";
import {
  canCreateComponent,
  componentOwner,
  detachComponent,
  instantiateComponent,
  syncInstances,
} from "@/lib/editor-components";
import type { CSSProperties } from "react";
import {
  createDefaultEffects,
  mergeEffects,
  type EffectsPatch,
} from "@/lib/element-effects";
export type { ElementEffects } from "@/types/editor";

import type {
  EditorPage,
  MasterComponent,
  CanvasConfig,
  EditorElement,
  EditorTool,
  Point,
  SidebarTab,
} from "@/types/editor";

export type {
  EditorPage,
  MasterComponent,
  CanvasConfig,
  EditorElement,
  EditorTool,
  Point,
  SidebarTab,
} from "@/types/editor";

export type LayoutMode = "free" | "stack" | "grid";
export type SizingMode = "fixed" | "fill" | "fit";

export function getLayoutMode(styles: CSSProperties): LayoutMode {
  return styles.display === "flex"
    ? "stack"
    : styles.display === "grid"
      ? "grid"
      : "free";
}

export function getSizingMode(value: CSSProperties["width"]): SizingMode {
  return value === "100%"
    ? "fill"
    : value === "fit-content" || value === "auto" || value === undefined
      ? "fit"
      : "fixed";
}
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

function removeElement(elements: EditorElement[], id: string): EditorElement[] {
  return elements
    .filter((element) => element.id !== id)
    .map((element) => {
      const children = removeElement(element.children, id);
      return children.length !== element.children.length ||
        children.some((child, index) => child !== element.children[index])
        ? { ...element, children }
        : element;
    });
}

export interface EditorState {
  elements: EditorElement[];
  pages: EditorPage[];
  activePageId: string;
  components: MasterComponent[];
  addPage: (path: string) => string | null;
  renamePage: (id: string, path: string) => boolean;
  deletePage: (id: string) => void;
  switchPage: (id: string) => void;
  createComponent: (id: string) => string | null;
  insertComponent: (componentId: string) => string | null;
  detachInstance: (id: string) => void;
  editMaster: (componentId: string) => void;
  selectedElementId: string | null;
  activeTool: EditorTool;
  tab: SidebarTab;
  canvasConfig: CanvasConfig;
  isPreviewMode: boolean;
  previewCanvasConfig: CanvasConfig | null;
  animationReplay: { elementId: string; sequence: number } | null;
  setPreviewMode: (enabled: boolean) => void;
  replayAnimation: (id: string) => void;
  updateEffects: (id: string, patch: EffectsPatch) => void;
  setElements: (elements: EditorElement[]) => void;
  addElement: (
    parentId: string | null,
    type: "frame" | "text",
    position: Point,
  ) => string | null;
  updateText: (id: string, content: string) => void;
  updateStyles: (id: string, styles: CSSProperties) => void;
  updatePosition: (
    id: string,
    position: Pick<CSSProperties, "position" | "left" | "top">,
  ) => void;
  updateSize: (
    id: string,
    axis: "width" | "height",
    value: number | "fill" | "fit",
  ) => void;
  updateLayout: (id: string, mode: LayoutMode) => void;
  renameElement: (id: string, name: string) => void;
  deleteElement: (id: string) => void;
  setSelectedElementId: (id: string | null) => void;
  setActiveTool: (tool: EditorTool) => void;
  setTab: (tab: SidebarTab) => void;
  setPan: (pan: Point) => void;
  /** Zoom is a scale factor; an optional viewport-space anchor stays stationary. */
  setZoom: (zoom: number, anchor?: Point) => void;
}

function defaultElements(id: string): EditorElement[] {
  return [
    {
      id,
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
      effects: createDefaultEffects(),
      animations: {},
    },
  ];
}

function pagePath(value: string): string | null {
  const path = value.trim().toLowerCase();
  if (!path) return null;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ||
    /^\/[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(normalized)
    ? normalized
    : null;
}
const pageName = (path: string) => (path === "/" ? "Home" : path.slice(1));
const initialElements = defaultElements("desktop");
const initialCamera: CanvasConfig = { zoom: 1, pan: { x: 0, y: 0 } };

export const useEditorStore = create<EditorState>((rawSet, get) => {
  // Keep the active-tree compatibility API, page snapshots, and masters atomic.
  const set = (
    patch:
      Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
  ) =>
    rawSet((state) => {
      const update = typeof patch === "function" ? patch(state) : patch;
      if (update === state) return state;
      const next = { ...state, ...update };
      let pages = next.pages.map((page) =>
        page.id === next.activePageId &&
        (page.elements !== next.elements ||
          (!next.isPreviewMode && page.canvasConfig !== next.canvasConfig))
          ? {
              ...page,
              elements: next.elements,
              canvasConfig: next.isPreviewMode
                ? page.canvasConfig
                : next.canvasConfig,
            }
          : page,
      );
      const changed: MasterComponent[] = [];
      const components = next.components.map((component) => {
        const master = pages
          .map((page) => findElementById(page.elements, component.element.id))
          .find(
            (element) =>
              element?.componentRole === "master" &&
              element.componentId === component.id,
          );
        if (!master || master === component.element) return component;
        const current = { ...component, name: master.name, element: master };
        changed.push(current);
        return current;
      });
      if (changed.length)
        pages = pages.map((page) => ({
          ...page,
          elements: syncInstances(page.elements, changed),
        }));
      const elements = pages.find(
        (page) => page.id === next.activePageId,
      )!.elements;
      return {
        ...next,
        pages,
        components,
        elements,
        selectedElementId:
          next.selectedElementId &&
          findElementById(elements, next.selectedElementId)
            ? next.selectedElementId
            : null,
      };
    });
  return {
    elements: initialElements,
    pages: [
      {
        id: "home",
        name: "Home",
        path: "/",
        elements: initialElements,
        canvasConfig: initialCamera,
      },
    ],
    activePageId: "home",
    components: [],
    addPage: (value) => {
      const state = get(),
        path = pagePath(value);
      if (
        state.isPreviewMode ||
        !path ||
        state.pages.some((page) => page.path === path)
      )
        return null;
      const id = crypto.randomUUID();
      const page: EditorPage = {
        id,
        name: pageName(path),
        path,
        elements: defaultElements(crypto.randomUUID()),
        canvasConfig: { zoom: 1, pan: { x: 0, y: 0 } },
      };
      set({
        pages: [...state.pages, page],
        activePageId: id,
        elements: page.elements,
        canvasConfig: page.canvasConfig,
        selectedElementId: null,
        animationReplay: null,
        activeTool: "select",
      });
      return id;
    },
    renamePage: (id, value) => {
      const state = get(),
        path = pagePath(value);
      if (
        state.isPreviewMode ||
        !path ||
        !state.pages.some((page) => page.id === id) ||
        state.pages.some((page) => page.id !== id && page.path === path)
      )
        return false;
      set({
        pages: state.pages.map((page) =>
          page.id === id ? { ...page, path, name: pageName(path) } : page,
        ),
      });
      return true;
    },
    switchPage: (id) => {
      const state = get(),
        page = state.pages.find((page) => page.id === id);
      if (state.isPreviewMode || !page || id === state.activePageId) return;
      set({
        activePageId: id,
        elements: page.elements,
        canvasConfig: page.canvasConfig,
        selectedElementId: null,
        animationReplay: null,
        activeTool: "select",
      });
    },
    deletePage: (id) => {
      const state = get();
      if (
        state.isPreviewMode ||
        state.pages.length === 1 ||
        !state.pages.some((page) => page.id === id)
      )
        return;
      const pages = state.pages.filter((page) => page.id !== id);
      const page =
        pages.find((page) => page.id === state.activePageId) ?? pages[0];
      set({
        pages,
        activePageId: page.id,
        elements: page.elements,
        canvasConfig: page.canvasConfig,
        selectedElementId:
          page.id === state.activePageId ? state.selectedElementId : null,
        animationReplay: null,
      });
    },
    createComponent: (id) => {
      const state = get(),
        element = findElementById(state.elements, id);
      if (
        state.isPreviewMode ||
        !element ||
        !canCreateComponent(state.elements, id)
      )
        return null;
      const componentId = crypto.randomUUID();
      const master: EditorElement = {
        ...element,
        componentId,
        componentRole: "master",
      };
      set({
        elements: updateElement(state.elements, id, () => master),
        components: [
          ...state.components,
          { id: componentId, name: master.name, element: master },
        ],
        tab: "assets",
        activeTool: "select",
      });
      return componentId;
    },
    insertComponent: (componentId) => {
      const state = get(),
        component = state.components.find((item) => item.id === componentId);
      if (state.isPreviewMode || !component) return null;
      const selected = state.selectedElementId
        ? findElementById(state.elements, state.selectedElementId)
        : undefined;
      const parent =
        selected?.type === "frame" &&
        !componentOwner(state.elements, selected.id)
          ? selected
          : state.elements.find(
              (element) => element.type === "frame" && !element.componentId,
            );
      const instance = instantiateComponent(component);
      const count = parent ? parent.children.length : state.elements.length;
      instance.styles = {
        ...instance.styles,
        position:
          parent && getLayoutMode(parent.styles) !== "free"
            ? "relative"
            : "absolute",
        left:
          parent && getLayoutMode(parent.styles) !== "free"
            ? 0
            : 40 + count * 24,
        top:
          parent && getLayoutMode(parent.styles) !== "free"
            ? 0
            : 40 + count * 24,
      };
      set({
        elements: parent
          ? updateElement(state.elements, parent.id, (element) => ({
              ...element,
              children: [...element.children, instance],
            }))
          : [...state.elements, instance],
        selectedElementId: instance.id,
        activeTool: "select",
      });
      return instance.id;
    },
    detachInstance: (id) => {
      const state = get(),
        owner = componentOwner(state.elements, id);
      if (state.isPreviewMode || owner?.componentRole !== "instance") return;
      set({
        elements: updateElement(state.elements, owner.id, detachComponent),
      });
    },
    editMaster: (componentId) => {
      const state = get(),
        component = state.components.find((item) => item.id === componentId);
      if (state.isPreviewMode || !component) return;
      const page = state.pages.find(
        (page) =>
          findElementById(page.elements, component.element.id)
            ?.componentRole === "master",
      );
      if (!page) return;
      get().switchPage(page.id);
      set({ selectedElementId: component.element.id, tab: "layers" });
    },
    isPreviewMode: false,
    previewCanvasConfig: null,
    animationReplay: null,
    setPreviewMode: (enabled) =>
      set((state) => {
        if (state.isPreviewMode === enabled) return state;
        return enabled
          ? {
              isPreviewMode: true,
              previewCanvasConfig: {
                zoom: state.canvasConfig.zoom,
                pan: { ...state.canvasConfig.pan },
              },
            }
          : {
              isPreviewMode: false,
              canvasConfig: state.previewCanvasConfig ?? state.canvasConfig,
              previewCanvasConfig: null,
            };
      }),
    replayAnimation: (id) =>
      set((state) => {
        const element = findElementById(state.elements, id);
        if (!element?.effects?.appear.enabled) return state;
        return {
          animationReplay: {
            elementId: id,
            sequence: (state.animationReplay?.sequence ?? 0) + 1,
          },
        };
      }),
    updateEffects: (id, patch) =>
      set((state) => {
        const element = findElementById(state.elements, id);
        if (!element) return state;
        const effects = mergeEffects(element.effects, patch);
        if (!effects) return state;
        return {
          elements: updateElement(state.elements, id, (element) => ({
            ...element,
            effects,
          })),
        };
      }),
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
            position:
              parent && getLayoutMode(parent.styles) !== "free"
                ? "relative"
                : "absolute",
            left:
              parent && getLayoutMode(parent.styles) !== "free"
                ? 0
                : parentId === null
                  ? position.x
                  : Math.max(0, position.x),
            top:
              parent && getLayoutMode(parent.styles) !== "free"
                ? 0
                : parentId === null
                  ? position.y
                  : Math.max(0, position.y),
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
          effects: createDefaultEffects(),
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
        if (element?.type !== "text" || element.content === content)
          return state;
        return {
          elements: updateElement(state.elements, id, (text) => ({
            ...text,
            content,
          })),
        };
      }),
    updateStyles: (id, styles) =>
      set((state) => {
        const element = findElementById(state.elements, id);
        if (!element) return state;
        const nonnegative = new Set([
          "width",
          "height",
          "minWidth",
          "minHeight",
          "gap",
          "padding",
          "borderRadius",
          "borderWidth",
          "fontSize",
        ]);
        if (
          Object.entries(styles).some(
            ([key, value]) =>
              typeof value === "number" &&
              (!Number.isFinite(value) || (nonnegative.has(key) && value < 0)),
          )
        )
          return state;
        if (
          styles.opacity !== undefined &&
          (Number(styles.opacity) < 0 || Number(styles.opacity) > 1)
        )
          return state;
        if (
          Object.entries(styles).every(
            ([key, value]) =>
              element.styles[key as keyof CSSProperties] === value,
          )
        )
          return state;
        return {
          elements: updateElement(state.elements, id, (element) => ({
            ...element,
            styles: { ...element.styles, ...styles },
          })),
        };
      }),
    updatePosition: (id, position) => get().updateStyles(id, position),
    updateSize: (id, axis, value) =>
      get().updateStyles(id, {
        [axis]:
          value === "fill" ? "100%" : value === "fit" ? "fit-content" : value,
        // Explicit sizing must not be constrained by a text node's initial minimum height.
        ...(axis === "height" ? { minHeight: 0 } : { minWidth: 0 }),
        flexShrink: 0,
      }),
    updateLayout: (id, mode) =>
      set((state) => {
        const element = findElementById(state.elements, id);
        if (!element || getLayoutMode(element.styles) === mode) return state;
        return {
          elements: updateElement(state.elements, id, (element) => ({
            ...element,
            styles: {
              ...element.styles,
              display:
                mode === "stack" ? "flex" : mode === "grid" ? "grid" : "block",
              ...(mode === "stack"
                ? { flexDirection: element.styles.flexDirection ?? "column" }
                : {}),
              ...(mode === "grid"
                ? {
                    gridTemplateColumns:
                      element.styles.gridTemplateColumns ??
                      "repeat(2, minmax(0, 1fr))",
                  }
                : {}),
            },
            children: element.children.map((child) => ({
              ...child,
              freePosition:
                mode === "free"
                  ? undefined
                  : (child.freePosition ??
                    (getLayoutMode(element.styles) === "free"
                      ? {
                          position: child.styles.position,
                          left: child.styles.left,
                          top: child.styles.top,
                        }
                      : undefined)),
              styles: {
                ...child.styles,
                position: mode === "free" ? "absolute" : "relative",
                left: 0,
                top: 0,
                ...(mode === "free" ? child.freePosition : {}),
                flexShrink: 0,
              },
            })),
          })),
        };
      }),
    renameElement: (id, name) =>
      set((state) => {
        const trimmed = name.trim();
        const element = findElementById(state.elements, id);
        if (!trimmed || !element || element.name === trimmed) return state;
        return {
          elements: updateElement(state.elements, id, (element) => ({
            ...element,
            name: trimmed,
          })),
        };
      }),
    deleteElement: (id) =>
      set((state) => {
        const element = findElementById(state.elements, id);
        if (!element) return state;
        const removesSelection =
          state.selectedElementId !== null &&
          (state.selectedElementId === id ||
            !!findElementById(element.children, state.selectedElementId));
        return {
          elements: removeElement(state.elements, id),
          selectedElementId: removesSelection ? null : state.selectedElementId,
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
  };
});
