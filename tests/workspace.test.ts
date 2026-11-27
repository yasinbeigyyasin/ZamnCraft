import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { findElementById, useEditorStore } from "../src/store/editor-store";
import {
  createWorkspace,
  parseWorkspace,
  serializeWorkspace,
  WORKSPACE_KEY,
} from "../src/lib/workspace";
import { startWorkspacePersistence } from "../src/lib/workspace-persistence";
import type { EditorElement } from "../src/types/editor";

const store = () => useEditorStore.getState();
const node = (id: string) => findElementById(store().elements, id)!;
afterEach(() =>
  useEditorStore.setState(useEditorStore.getInitialState(), true),
);

function ids(nodes: EditorElement[]): string[] {
  return nodes.flatMap((node) => [node.id, ...ids(node.children)]);
}

test("breakpoints clone Desktop with independent IDs/effects, fixed widths and side-by-side positions; duplicates are no-ops", () => {
  const child = store().addElement("desktop", "text", { x: 20, y: 40 })!;
  store().updateText(child, "Shared starting content");
  const tablet = store().addBreakpoint("tablet")!,
    mobile = store().addBreakpoint("mobile")!;
  assert.equal(node(tablet).styles.width, 810);
  assert.equal(node(mobile).styles.width, 390);
  assert.equal(node(tablet).styles.left, 1280);
  assert.equal(node(mobile).styles.left, 2170);
  assert.equal(node(tablet).children[0].content, "Shared starting content");
  assert.notEqual(node(tablet).effects, node("desktop").effects);
  const allIds = ids(store().elements);
  assert.equal(new Set(allIds).size, allIds.length);
  store().updateText(node(tablet).children[0].id, "Tablet only");
  assert.equal(node(child).content, "Shared starting content");
  assert.equal(store().addBreakpoint("tablet"), null);
  assert.equal(store().elements.length, 3);
  store().undo(); // tablet text edit
  store().undo(); // mobile
  assert.equal(store().elements.length, 2);
  store().redo();
  assert.equal(node(mobile).styles.width, 390);
});

test("creation, style, movement, resize and deletion undo/redo atomically, while camera and selection are excluded", () => {
  const id = store().addElement("desktop", "frame", { x: 10, y: 20 })!;
  store().updateStyles(id, { backgroundColor: "#123456" });
  store().beginHistory();
  for (let index = 0; index < 20; index++)
    store().updatePosition(id, { left: index * 10 });
  store().endHistory();
  store().updateSize(id, "width", 300);
  store().deleteElement(id);
  assert.equal(store().historyPast.length, 5);
  store().setZoom(0.5);
  store().setPan({ x: 80, y: -20 });
  store().setSelectedElementId("desktop");
  assert.equal(store().historyPast.length, 5);
  store().undo();
  assert.equal(node(id).styles.width, 300);
  store().undo();
  assert.equal(node(id).styles.width, 200);
  store().undo();
  assert.equal(node(id).styles.left, 10);
  store().undo();
  assert.equal(node(id).styles.backgroundColor, "#e5e5e5");
  store().undo();
  assert.equal(findElementById(store().elements, id), undefined);
  for (let index = 0; index < 5; index++) store().redo();
  assert.equal(findElementById(store().elements, id), undefined);
  assert.equal(store().historyPast.length, 5);
});

test("cancelling or empty transactions create no undo entry and new edits invalidate redo; history is bounded", () => {
  const id = store().addElement("desktop", "frame", { x: 10, y: 20 })!;
  const before = store().elements;
  store().beginHistory();
  store().updateStyles(id, { width: 500 });
  store().endHistory(true);
  assert.equal(store().elements, before);
  assert.equal(store().historyPast.length, 1);
  store().beginHistory();
  store().endHistory();
  assert.equal(store().historyPast.length, 1);
  store().undo();
  assert.equal(store().historyFuture.length, 1);
  store().addElement("desktop", "text", { x: 0, y: 0 });
  assert.equal(store().historyFuture.length, 0);
  for (let index = 0; index < 110; index++)
    store().renameProject(`Project ${index}`);
  assert.equal(store().historyPast.length, 100);
});

test("history restores cross-page master propagation, registry creation, page deletion and project replacement", () => {
  const frame = store().addElement("desktop", "frame", { x: 10, y: 20 })!;
  const component = store().createComponent(frame)!;
  const about = store().addPage("/about")!;
  const instance = store().insertComponent(component)!;
  store().editMaster(component);
  store().updateStyles(frame, { width: 420 });
  const instanceOnPage = () =>
    findElementById(
      store().pages.find((page) => page.id === about)!.elements,
      instance,
    )!;
  assert.equal(instanceOnPage().styles.width, 420);
  store().undo();
  assert.equal(node(frame).styles.width, 200);
  assert.equal(instanceOnPage().styles.width, 200);
  store().redo();
  assert.equal(instanceOnPage().styles.width, 420);
  store().deletePage(about);
  store().undo();
  assert.equal(instanceOnPage().styles.width, 420);
  const pages = store().pages,
    components = store().components;
  store().replaceWorkspace(true);
  assert.equal(store().projectTitle, "Landing Page Starter");
  store().undo();
  assert.equal(store().pages, pages);
  assert.equal(store().components, components);
  store().redo();
  assert.equal(store().projectTitle, "Landing Page Starter");
  store().replaceWorkspace();
  assert.equal(store().elements[0].children.length, 0);
});

test("starter includes editable Navbar, Hero, CTA and feature cards, and round-trips through the persistence schema", () => {
  const workspace = createWorkspace(true);
  const flattened = (nodes: EditorElement[]): EditorElement[] =>
    nodes.flatMap((node) => [node, ...flattened(node.children)]);
  const nodes = flattened(workspace.pages[0].elements);
  assert.ok(nodes.some((node) => node.name === "Navbar"));
  assert.ok(nodes.some((node) => node.name === "Hero"));
  assert.ok(
    nodes.some((node) => node.type === "button" && node.name === "CTA button"),
  );
  assert.equal(
    nodes.filter((node) => node.name.startsWith("Feature:")).length,
    3,
  );
  assert.deepEqual(parseWorkspace(serializeWorkspace(workspace)), workspace);
});

test("persistence restores all pages, components, title, active tree and camera without history or preview UI", () => {
  const component = store().createComponent("desktop")!;
  const about = store().addPage("/about")!;
  store().insertComponent(component);
  store().renameProject("My workspace");
  store().setZoom(0.5);
  store().setPan({ x: -90, y: 100 });
  const saved = serializeWorkspace(store());
  const document = parseWorkspace(saved);
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  store().hydrateWorkspace(document);
  assert.equal(store().projectTitle, "My workspace");
  assert.equal(store().activePageId, about);
  assert.equal(store().pages.length, 2);
  assert.equal(store().components.length, 1);
  assert.equal(store().elements, store().pages[1].elements);
  assert.deepEqual(store().canvasConfig, {
    zoom: 0.5,
    pan: { x: -90, y: 100 },
  });
  assert.equal(store().historyPast.length, 0);
  assert.equal(store().selectedElementId, null);
  assert.equal(store().isPreviewMode, false);
  assert.ok(!saved.includes("historyPast") && !saved.includes("isPreviewMode"));
});

test("invalid/future/corrupt storage is rejected before hydration, including duplicate IDs, invalid effects and missing links", () => {
  const valid = JSON.parse(serializeWorkspace(createWorkspace()));
  const mutations = [
    (data: typeof valid) => {
      data.version = 99;
    },
    (data: typeof valid) => {
      data.pages = [];
    },
    (data: typeof valid) => {
      data.activePageId = "missing";
    },
    (data: typeof valid) => {
      data.pages[0].elements.push(data.pages[0].elements[0]);
    },
    (data: typeof valid) => {
      data.pages[0].elements[0].effects.appear.opacity = 2;
    },
    (data: typeof valid) => {
      data.pages[0].elements[0].styles.width = null;
    },
    (data: typeof valid) => {
      data.pages[0].canvasConfig.zoom = 0;
    },
    (data: typeof valid) => {
      data.pages[0].elements[0].componentId = "missing";
      data.pages[0].elements[0].componentRole = "instance";
    },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(valid);
    mutate(value);
    assert.throws(() => parseWorkspace(JSON.stringify(value)));
  }
  assert.throws(() => parseWorkspace("{broken"));
  assert.throws(() => parseWorkspace("x".repeat(8_000_001)));
});

test("automatic persistence preserves corrupt original data until explicit reset and reports quota errors without crashing", () => {
  const writes: string[] = [];
  const storage = {
    getItem: () => "{invalid",
    setItem: (_key: string, value: string) => {
      writes.push(value);
    },
  };
  const stop = startWorkspacePersistence(storage);
  store().renameProject("Do not overwrite the old save");
  stop();
  assert.equal(writes.length, 0);
  assert.equal(store().persistenceBlocked, true);
  store().replaceWorkspace();
  const stopAgain = startWorkspacePersistence(storage);
  stopAgain();
  assert.equal(writes.length, 1);
  assert.equal(parseWorkspace(writes[0]).projectTitle, "Untitled");
  const fail = startWorkspacePersistence({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  });
  fail();
  assert.match(store().persistenceError!, /Local save failed/);
});

test("automatic persistence debounces and flushes committed edits, not an in-flight gesture", async () => {
  const writes: string[] = [];
  const stop = startWorkspacePersistence({
    getItem: () => null,
    setItem: (key, value) => {
      assert.equal(key, WORKSPACE_KEY);
      writes.push(value);
    },
  });
  const id = store().addElement("desktop", "frame", { x: 20, y: 30 })!;
  store().beginHistory();
  store().updateStyles(id, { width: 350 });
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(
    findElementById(parseWorkspace(writes.at(-1)!).pages[0].elements, id)!
      .styles.width,
    200,
  );
  store().endHistory();
  stop();
  assert.equal(
    findElementById(parseWorkspace(writes.at(-1)!).pages[0].elements, id)!
      .styles.width,
    350,
  );
});

test("canvas background is validated, undoable, persisted and backward compatible", () => {
  store().setCanvasBackground("#123456");
  assert.equal(store().canvasBackground, "#123456");
  const saved = serializeWorkspace(store());
  assert.equal(parseWorkspace(saved).canvasBackground, "#123456");
  store().setCanvasBackground("url(javascript:alert(1))");
  assert.equal(store().canvasBackground, "#123456");
  store().undo();
  assert.equal(store().canvasBackground, "#0a0a0a");
  store().redo();
  assert.equal(store().canvasBackground, "#123456");
  const old = JSON.parse(saved);
  delete old.canvasBackground;
  store().hydrateWorkspace(parseWorkspace(JSON.stringify(old)));
  assert.equal(store().canvasBackground, "#0a0a0a");
  old.canvasBackground = "red; background: url(untrusted)";
  assert.throws(() => parseWorkspace(JSON.stringify(old)));
});

test("multiple custom-size desktops persist without duplicate responsive breakpoints", () => {
  const first = store().addDesktop(1440, 900)!;
  const second = store().addDesktop(1920, 1080)!;
  const saved = serializeWorkspace(store());
  const parsed = parseWorkspace(saved);
  store().hydrateWorkspace(parsed);
  assert.equal(node(first).styles.width, 1440);
  assert.equal(node(second).styles.height, 1080);
  assert.equal(
    store().elements.filter((element) => element.breakpoint === "desktop")
      .length,
    1,
  );
  assert.equal(store().elements[0].styles.width, 1200);
  assert.equal(store().elements[0].children.length, 0);
});
