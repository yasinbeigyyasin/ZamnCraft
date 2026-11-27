import { create } from "zustand";
import { BREAKPOINTS, createDesktop, createWorkspace } from "@/lib/workspace";
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
  HistorySnapshot,
  WorkspaceDocument,
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
  projectTitle: string;
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  historyTransaction: HistorySnapshot | null;
  workspaceRevision: number;
  hasHydrated: boolean;
  persistenceError: string | null;
  persistenceBlocked: boolean;
  previewRootId: string | null;
  beginHistory: () => void;
  endHistory: (cancel?: boolean) => void;
  undo: () => void;
  redo: () => void;
  renameProject: (title: string) => boolean;
  replaceWorkspace: (starter?: boolean) => void;
  hydrateWorkspace: (
    document: WorkspaceDocument | null,
    error?: string,
  ) => void;
  addBreakpoint: (breakpoint: "tablet" | "mobile") => string | null;
  addDesktop: (width: number, height: number) => string | null;
  setPreviewRoot: (id: string) => void;
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
  canvasBackground: string;
  setCanvasBackground: (color: string) => void;
  isPreviewMode: boolean;
  previewCanvasConfig: CanvasConfig | null;
  animationReplay: { elementId: string; sequence: number } | null;
  setPreviewMode: (enabled: boolean) => void;
  replayAnimation: (id: string) => void;
  updateEffects: (id: string, patch: EffectsPatch) => void;
  setElements: (elements: EditorElement[]) => void;
  addElement: (
    parentId: string | null,
    type: "frame" | "text" | "stack",
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
  return [createDesktop(id)];
}

function snapshot(state: EditorState): HistorySnapshot {
  return {
    canvasBackground: state.canvasBackground,
    projectTitle: state.projectTitle,
    pages: state.pages,
    components: state.components,
    activePageId: state.activePageId,
    selectedElementId: state.selectedElementId,
  };
}
function documentChanged(
  before: WorkspaceDocument,
  after: WorkspaceDocument,
): boolean {
  return (
    before.canvasBackground !== after.canvasBackground ||
    before.projectTitle !== after.projectTitle ||
    before.pages.length !== after.pages.length ||
    before.pages.some((page, index) => {
      const next = after.pages[index];
      return (
        page.id !== next.id ||
        page.name !== next.name ||
        page.path !== next.path ||
        page.elements !== next.elements
      );
    }) ||
    before.components.length !== after.components.length ||
    before.components.some(
      (component, index) => component !== after.components[index],
    )
  );
}
function restore(
  document: HistorySnapshot | WorkspaceDocument,
): Partial<EditorState> {
  const page = document.pages.find(
    (page) => page.id === document.activePageId,
  )!;
  const selected =
    "selectedElementId" in document ? document.selectedElementId : null;
  return {
    ...document,
    canvasBackground: document.canvasBackground ?? "#0a0a0a",
    elements: page.elements,
    canvasConfig: page.canvasConfig,
    selectedElementId:
      selected && findElementById(page.elements, selected) ? selected : null,
    isPreviewMode: false,
    previewCanvasConfig: null,
    previewRootId: null,
    animationReplay: null,
    activeTool: "select",
  };
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
      const document = { ...next, pages, components, elements };
      const changedDocument = documentChanged(state, document);
      return {
        ...document,
        ...(changedDocument && !state.historyTransaction
          ? {
              historyPast: [...state.historyPast, snapshot(state)].slice(-100),
              historyFuture: [],
            }
          : {}),
        selectedElementId:
          next.selectedElementId &&
          findElementById(elements, next.selectedElementId)
            ? next.selectedElementId
            : null,
      };
    });
  return {
    projectTitle: "Untitled",
    historyPast: [],
    historyFuture: [],
    historyTransaction: null,
    workspaceRevision: 0,
    hasHydrated: false,
    persistenceError: null,
    persistenceBlocked: false,
    previewRootId: null,
    beginHistory: () => {
      const state = get();
      if (!state.historyTransaction && !state.isPreviewMode)
        rawSet({ historyTransaction: snapshot(state) });
    },
    endHistory: (cancel = false) => {
      const state = get(),
        before = state.historyTransaction;
      if (!before) return;
      const changed = documentChanged(before, state);
      const page =
        before.pages.find((page) => page.id === state.activePageId) ??
        before.pages.find((page) => page.id === before.activePageId)!;
      rawSet({
        historyTransaction: null,
        ...(cancel && changed
          ? {
              canvasBackground: before.canvasBackground ?? "#0a0a0a",
              projectTitle: before.projectTitle,
              pages: before.pages,
              components: before.components,
              activePageId: page.id,
              elements: page.elements,
              selectedElementId:
                state.selectedElementId &&
                findElementById(page.elements, state.selectedElementId)
                  ? state.selectedElementId
                  : null,
            }
          : changed
            ? {
                historyPast: [...state.historyPast, before].slice(-100),
                historyFuture: [],
              }
            : {}),
      });
    },
    undo: () => {
      if (get().isPreviewMode) return;
      get().endHistory();
      const state = get(),
        previous = state.historyPast.at(-1);
      if (!previous) return;
      rawSet({
        ...restore(previous),
        historyPast: state.historyPast.slice(0, -1),
        historyFuture: [...state.historyFuture, snapshot(state)],
      });
    },
    redo: () => {
      if (get().isPreviewMode) return;
      get().endHistory();
      const state = get(),
        next = state.historyFuture.at(-1);
      if (!next) return;
      rawSet({
        ...restore(next),
        historyPast: [...state.historyPast, snapshot(state)].slice(-100),
        historyFuture: state.historyFuture.slice(0, -1),
      });
    },
    renameProject: (value) => {
      const projectTitle = value.trim();
      if (!projectTitle || projectTitle.length > 80 || get().isPreviewMode)
        return false;
      if (projectTitle !== get().projectTitle) set({ projectTitle });
      return true;
    },
    replaceWorkspace: (starter = false) => {
      if (get().isPreviewMode) return;
      get().endHistory();
      set({
        ...restore(createWorkspace(starter)),
        persistenceBlocked: false,
        persistenceError: null,
        workspaceRevision: get().workspaceRevision + 1,
      });
    },
    hydrateWorkspace: (document, error) => {
      rawSet({
        ...(document ? restore(document) : {}),
        hasHydrated: true,
        persistenceBlocked: Boolean(error),
        persistenceError: error ?? null,
        historyPast: [],
        historyFuture: [],
        historyTransaction: null,
        workspaceRevision: get().workspaceRevision + 1,
      });
    },
    addBreakpoint: (breakpoint) => {
      const state = get(),
        config = BREAKPOINTS.find((item) => item.id === breakpoint);
      if (
        state.isPreviewMode ||
        !config ||
        state.elements.some((element) => element.breakpoint === breakpoint)
      )
        return null;
      const desktop =
        state.elements.find((element) => element.breakpoint === "desktop") ??
        state.elements.find((element) => element.type === "frame");
      if (!desktop) return null;
      const copy = (source: EditorElement): EditorElement => {
        if (source.componentId) {
          const definition = state.components.find(
            (component) => component.id === source.componentId,
          );
          if (definition)
            return instantiateComponent({ ...definition, element: source });
        }
        return {
          ...structuredClone(source),
          id: crypto.randomUUID(),
          children: source.children.map(copy),
        };
      };
      const frame = copy({
        ...desktop,
        componentId: undefined,
        componentRole: undefined,
        componentSourceId: undefined,
      });
      frame.name = config.name;
      frame.breakpoint = breakpoint;
      const right = Math.max(
        ...state.elements.map(
          (element) =>
            (typeof element.styles.left === "number"
              ? element.styles.left
              : 0) +
            (typeof element.styles.width === "number"
              ? element.styles.width
              : 1200),
        ),
      );
      frame.styles = {
        ...frame.styles,
        width: config.width,
        left: right + 80,
        top: desktop.styles.top ?? 0,
      };
      set({
        elements: [...state.elements, frame],
        selectedElementId: frame.id,
        activeTool: "select",
      });
      return frame.id;
    },
    addDesktop: (width, height) => {
      const state = get();
      if (
        state.isPreviewMode ||
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 ||
        height < 1 ||
        width > 10000 ||
        height > 10000
      )
        return null;
      const frame = createDesktop(crypto.randomUUID());
      frame.name = `Desktop ${width} × ${height}`;
      // Extra desktops are independent artboards, not duplicate responsive breakpoints.
      if (state.elements.some((element) => element.breakpoint === "desktop"))
        delete frame.breakpoint;
      const right = Math.max(
        0,
        ...state.elements.map(
          (element) =>
            (typeof element.styles.left === "number"
              ? element.styles.left
              : 0) +
            (typeof element.styles.width === "number"
              ? element.styles.width
              : 1200),
        ),
      );
      frame.styles = {
        ...frame.styles,
        width,
        height,
        left: state.elements.length ? right + 80 : 0,
        top: 0,
      };
      set({
        elements: [...state.elements, frame],
        selectedElementId: frame.id,
        activeTool: "select",
        tab: "layers",
      });
      return frame.id;
    },
    setPreviewRoot: (id) => {
      if (
        get().isPreviewMode &&
        get().elements.some(
          (element) => element.id === id && element.breakpoint,
        )
      )
        set({ previewRootId: id });
    },
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
              previewRootId:
                state.elements.find(
                  (element) =>
                    element.id === state.previewRootId && element.breakpoint,
                )?.id ??
                state.elements.find((element) => element.breakpoint)?.id ??
                null,
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
    canvasBackground: "#0a0a0a",
    setCanvasBackground: (color) => {
      if (/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(color))
        set({ canvasBackground: color });
    },
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
          name:
            type === "frame" ? "Frame" : type === "stack" ? "Stack" : "Text",
          type: type === "stack" ? "frame" : type,
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
            ...(type === "stack"
              ? {
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  padding: 16,
                }
              : {}),
            ...(type !== "text"
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
