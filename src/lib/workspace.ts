import type { CSSProperties } from "react";
import type {
  CanvasConfig,
  EditorElement,
  EditorPage,
  WorkspaceDocument,
} from "@/types/editor";
import { createDefaultEffects, mergeEffects } from "./element-effects";

export const WORKSPACE_KEY = "zamncraft.workspace.v1";
export const BREAKPOINTS = [
  { id: "desktop", name: "Desktop", width: 1200 },
  { id: "tablet", name: "Tablet", width: 810 },
  { id: "mobile", name: "Mobile", width: 390 },
] as const;

export function createDesktop(id = "desktop"): EditorElement {
  return {
    id,
    name: "Desktop",
    type: "frame",
    breakpoint: "desktop",
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
  };
}
export function createWorkspace(starter = false): WorkspaceDocument {
  const desktop = createDesktop();
  if (starter) {
    const text = (
      name: string,
      content: string,
      styles: CSSProperties,
    ): EditorElement => ({
      id: crypto.randomUUID(),
      name,
      content,
      type: "text",
      children: [],
      styles: {
        position: "relative",
        whiteSpace: "pre-wrap",
        fontSize: 16,
        lineHeight: 1.5,
        ...styles,
      },
      effects: createDefaultEffects(),
      animations: {},
    });
    const frame = (
      name: string,
      styles: CSSProperties,
      children: EditorElement[],
    ): EditorElement => ({
      id: crypto.randomUUID(),
      name,
      type: "frame",
      children,
      styles: { position: "relative", ...styles },
      effects: createDefaultEffects(),
      animations: {},
    });
    const cta: EditorElement = {
      ...text("CTA button", "Start building →", {
        width: 170,
        height: 48,
        backgroundColor: "#0099ff",
        color: "#ffffff",
        borderRadius: 8,
        fontWeight: 600,
        textAlign: "center",
      }),
      type: "button",
    };
    cta.effects!.hover = { enabled: true, scale: 1.04, rotate: 0 };
    cta.effects!.press = { enabled: true, scale: 0.96 };
    const hero = frame(
      "Hero",
      {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 24,
        padding: 64,
        width: "100%",
        height: "fit-content",
      },
      [
        text("Eyebrow", "YOUR NEXT IDEA STARTS HERE", {
          color: "#0077cc",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 2,
        }),
        text("Hero heading", "Make room for\nyour next big idea.", {
          width: "100%",
          fontSize: 64,
          lineHeight: 1.08,
          fontWeight: 700,
          letterSpacing: -2,
        }),
        text(
          "Hero description",
          "Design, refine, and ship something worth sharing.\nA flexible starting point, built for your next chapter.",
          { width: "100%", fontSize: 18, color: "#64748b" },
        ),
        cta,
      ],
    );
    hero.effects!.appear = {
      enabled: true,
      opacity: 0,
      offsetX: 0,
      offsetY: 20,
      scale: 1,
    };
    const cards = [
      [
        "01",
        "Start with structure",
        "Arrange sections with Stack and Grid. Make every detail your own.",
      ],
      [
        "02",
        "Design for every screen",
        "Add Tablet and Mobile frames and refine each layout side by side.",
      ],
      [
        "03",
        "Bring it to life",
        "Explore hover effects, preview your work, and export real code.",
      ],
    ].map(([number, title, description]) =>
      frame(
        `Feature: ${title}`,
        {
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 28,
          backgroundColor: "#f5f8fb",
          borderRadius: 12,
          minWidth: 0,
        },
        [
          text("Feature number", number, {
            color: "#0077cc",
            fontSize: 13,
            fontWeight: 600,
          }),
          text("Feature heading", title, { fontSize: 20, fontWeight: 600 }),
          text("Feature description", description, {
            color: "#64748b",
            fontSize: 15,
          }),
        ],
      ),
    );
    desktop.styles = {
      ...desktop.styles,
      display: "flex",
      flexDirection: "column",
      height: 1100,
      backgroundColor: "#ffffff",
      color: "#142132",
    };
    desktop.children = [
      frame(
        "Navbar",
        {
          width: "100%",
          height: 88,
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 32,
          borderBottom: "1px solid #e7edf3",
          flexShrink: 0,
        },
        [
          text("Brand", "Forma", { fontWeight: 700, fontSize: 24 }),
          text("Navigation links", "Product     About     Get in touch", {
            fontSize: 14,
            color: "#64748b",
          }),
        ],
      ),
      hero,
      frame(
        "Feature cards",
        {
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 20,
          padding: 48,
        },
        cards,
      ),
    ];
  }
  const page: EditorPage = {
    id: "home",
    name: "Home",
    path: "/",
    elements: [desktop],
    canvasConfig: { zoom: 1, pan: { x: 0, y: 0 } },
  };
  return {
    canvasBackground: "#0a0a0a",
    projectTitle: starter ? "Landing Page Starter" : "Untitled",
    pages: [page],
    activePageId: page.id,
    components: [],
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const string = (value: unknown, max = 200): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const finite = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= 10000000;
function camera(value: unknown): value is CanvasConfig {
  return (
    record(value) &&
    finite(value.zoom) &&
    value.zoom >= 0.25 &&
    value.zoom <= 2 &&
    record(value.pan) &&
    finite(value.pan.x) &&
    finite(value.pan.y)
  );
}

/** Validate localStorage as untrusted input before it reaches rendering or history. */
export function parseWorkspace(serialized: string): WorkspaceDocument {
  if (serialized.length > 8_000_000)
    throw new Error("Workspace is too large to load safely.");
  const data: unknown = JSON.parse(serialized);
  if (
    !record(data) ||
    data.version !== 1 ||
    (data.canvasBackground !== undefined &&
      (typeof data.canvasBackground !== "string" ||
        !/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(
          data.canvasBackground,
        ))) ||
    !string(data.projectTitle, 80) ||
    !data.projectTitle.trim() ||
    !Array.isArray(data.pages) ||
    !data.pages.length ||
    data.pages.length > 100 ||
    !Array.isArray(data.components) ||
    data.components.length > 500
  )
    throw new Error("Unsupported or invalid workspace.");
  let count = 0;
  const styles = (value: unknown): value is CSSProperties =>
    record(value) &&
    Object.entries(value).every(
      ([key, entry]) =>
        !["__proto__", "constructor", "prototype"].includes(key) &&
        /^(?:--[\w-]+|[a-zA-Z][a-zA-Z0-9]*)$/.test(key) &&
        ((typeof entry === "string" && entry.length <= 2000) || finite(entry)),
    );
  const element = (
    value: unknown,
    ids: Set<string>,
    depth = 0,
  ): EditorElement => {
    if (
      ++count > 20000 ||
      depth > 40 ||
      !record(value) ||
      !string(value.id) ||
      ids.has(value.id) ||
      !string(value.name) ||
      !["frame", "text", "button"].includes(String(value.type)) ||
      !Array.isArray(value.children) ||
      !styles(value.styles) ||
      (value.content !== undefined &&
        (typeof value.content !== "string" || value.content.length > 200000)) ||
      (value.breakpoint !== undefined &&
        (depth !== 0 ||
          value.type !== "frame" ||
          !BREAKPOINTS.some((item) => item.id === value.breakpoint))) ||
      (value.componentId !== undefined && !string(value.componentId)) ||
      (value.componentRole !== undefined &&
        !["master", "instance"].includes(String(value.componentRole))) ||
      Boolean(value.componentId) !== Boolean(value.componentRole) ||
      (value.componentSourceId !== undefined &&
        !string(value.componentSourceId)) ||
      (value.freePosition !== undefined && !styles(value.freePosition))
    )
      throw new Error("Invalid element tree.");
    ids.add(value.id);
    if (
      value.effects !== undefined &&
      (!record(value.effects) ||
        ["appear", "hover", "press", "transition"].some(
          (key) => !record((value.effects as Record<string, unknown>)[key]),
        ))
    )
      throw new Error("Invalid effects.");
    const effects =
      value.effects === undefined
        ? createDefaultEffects()
        : mergeEffects(undefined, value.effects);
    if (!effects) throw new Error("Invalid effects.");
    return {
      id: value.id,
      name: value.name,
      type: value.type as EditorElement["type"],
      children: value.children.map((child) => element(child, ids, depth + 1)),
      styles: value.styles,
      effects,
      animations: {},
      ...(value.content !== undefined
        ? { content: value.content as string }
        : {}),
      ...(value.breakpoint
        ? { breakpoint: value.breakpoint as EditorElement["breakpoint"] }
        : {}),
      ...(value.componentId
        ? {
            componentId: value.componentId as string,
            componentRole:
              value.componentRole as EditorElement["componentRole"],
          }
        : {}),
      ...(value.componentSourceId
        ? { componentSourceId: value.componentSourceId as string }
        : {}),
      ...(value.freePosition
        ? { freePosition: value.freePosition as EditorElement["freePosition"] }
        : {}),
    };
  };
  const pageIds = new Set<string>(),
    paths = new Set<string>(),
    elementIds = new Set<string>();
  const pages: EditorPage[] = data.pages.map((value) => {
    if (
      !record(value) ||
      !string(value.id) ||
      pageIds.has(value.id) ||
      !string(value.name) ||
      !string(value.path) ||
      !/^\/(?:[a-z0-9]+(?:[-/][a-z0-9]+)*)?$/.test(value.path) ||
      paths.has(value.path) ||
      !Array.isArray(value.elements) ||
      !camera(value.canvasConfig)
    )
      throw new Error("Invalid pages.");
    pageIds.add(value.id);
    paths.add(value.path);
    const elements = value.elements.map((item) => element(item, elementIds));
    const breakpoints = elements.flatMap((item) =>
      item.breakpoint ? [item.breakpoint] : [],
    );
    if (new Set(breakpoints).size !== breakpoints.length)
      throw new Error("Duplicate breakpoints.");
    return {
      id: value.id,
      name: value.name,
      path: value.path,
      canvasConfig: value.canvasConfig,
      elements,
    };
  });
  const componentIds = new Set<string>();
  const components = data.components.map((value) => {
    if (
      !record(value) ||
      !string(value.id) ||
      componentIds.has(value.id) ||
      !string(value.name)
    )
      throw new Error("Invalid components.");
    componentIds.add(value.id);
    const master = element(value.element, new Set());
    if (master.componentId !== value.id || master.componentRole !== "master")
      throw new Error("Invalid master component.");
    return { id: value.id, name: value.name, element: master };
  });
  const checkLinks = (nodes: EditorElement[]) =>
    nodes.forEach((node) => {
      if (node.componentId && !componentIds.has(node.componentId))
        throw new Error("Missing component definition.");
      checkLinks(node.children);
    });
  pages.forEach((page) => checkLinks(page.elements));
  components.forEach((component) => checkLinks([component.element]));
  if (!string(data.activePageId) || !pageIds.has(data.activePageId))
    throw new Error("Invalid active page.");
  return {
    ...(data.canvasBackground !== undefined
      ? { canvasBackground: data.canvasBackground as string }
      : {}),
    projectTitle: data.projectTitle,
    pages,
    components,
    activePageId: data.activePageId,
  };
}

export function serializeWorkspace(document: WorkspaceDocument): string {
  return JSON.stringify({
    version: 1,
    canvasBackground: document.canvasBackground,
    projectTitle: document.projectTitle,
    pages: document.pages,
    components: document.components,
    activePageId: document.activePageId,
  });
}
