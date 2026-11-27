import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { findElementById, useEditorStore } from "../src/store/editor-store";

const store = () => useEditorStore.getState();
const element = (id: string) => findElementById(store().elements, id)!;
afterEach(() =>
  useEditorStore.setState(useEditorStore.getInitialState(), true),
);

function master() {
  const frame = store().addElement("desktop", "frame", { x: 80, y: 100 })!;
  const text = store().addElement(frame, "text", { x: 10, y: 20 })!;
  store().renameElement(frame, "Card");
  return { frame, text, component: store().createComponent(frame)! };
}

test("pages own independent trees and cameras; switching clears stale selection and replay", () => {
  const text = store().addElement("desktop", "text", { x: 5, y: 6 })!;
  store().updateText(text, "Home title");
  store().setZoom(1.5);
  store().setPan({ x: -100, y: 200 });
  const home = store().elements,
    camera = store().canvasConfig;
  const about = store().addPage(" /About ")!;
  assert.equal(store().pages[1].path, "/about");
  assert.equal(store().selectedElementId, null);
  assert.equal(store().elements.length, 1);
  assert.notEqual(store().elements[0].id, "desktop");
  store().updateStyles(store().elements[0].id, { width: 800 });
  const aboutTree = store().elements;
  store().switchPage("home");
  assert.equal(store().elements, home);
  assert.equal(store().canvasConfig, camera);
  assert.equal(element(text).content, "Home title");
  store().switchPage(about);
  assert.equal(store().elements, aboutTree);
  assert.equal(store().elements[0].styles.width, 800);
  assert.equal(store().pages[1].elements, store().elements);
});

test("page paths are validated, normalized and unique; deleting keeps a valid active page and at least one page", () => {
  for (const path of [
    "/bad path",
    "/../x",
    "/bad?x",
    "/bad#x",
    "//bad",
    "/about/",
    "💥",
  ])
    assert.equal(store().addPage(path), null);
  const about = store().addPage("about")!;
  assert.equal(store().addPage("/ABOUT"), null);
  assert.equal(store().renamePage(about, "/"), false);
  assert.equal(store().renamePage("missing", "/new"), false);
  assert.equal(store().renamePage(about, "/contact"), true);
  assert.equal(store().pages[1].name, "contact");
  store().deletePage("home");
  assert.equal(store().activePageId, about);
  store().deletePage(about);
  assert.equal(store().pages.length, 1);
  assert.equal(store().activePageId, about);
  store().switchPage("missing");
  assert.equal(store().activePageId, about);
});

test("master style, effects, text, layout and structural changes propagate across pages while preserving instance placement and IDs", () => {
  const { frame, text, component } = master();
  store().setSelectedElementId("desktop");
  const first = store().insertComponent(component)!;
  store().updatePosition(first, { left: 440, top: 300 });
  const firstText = element(first).children[0].id;
  const about = store().addPage("/about")!;
  const second = store().insertComponent(component)!;
  const secondText = element(second).children[0].id;
  const snapshot = store().pages;
  store().editMaster(component);
  assert.equal(store().activePageId, "home");
  assert.equal(store().selectedElementId, frame);
  store().updateStyles(frame, { width: 320, backgroundColor: "#123456" });
  store().updateText(text, "Updated title");
  store().updateEffects(text, { hover: { enabled: true } });
  store().updateLayout(frame, "stack");
  const added = store().addElement(frame, "frame", { x: 0, y: 0 })!;
  assert.equal(element(first).styles.width, 320);
  assert.equal(element(first).styles.left, 440);
  assert.equal(element(first).styles.top, 300);
  assert.equal(element(first).styles.display, "flex");
  assert.equal(element(first).children[0].id, firstText);
  assert.equal(element(first).children[0].content, "Updated title");
  assert.equal(element(first).children[0].effects!.hover.enabled, true);
  assert.equal(element(first).children.length, 2);
  assert.notEqual(element(first).children[1].id, added);
  assert.equal(
    findElementById(snapshot[1].elements, second)!.styles.width,
    200,
  );
  store().switchPage(about);
  assert.equal(element(second).children[0].id, secondText);
  assert.equal(element(second).children[0].content, "Updated title");
  store().editMaster(component);
  store().deleteElement(text);
  assert.equal(element(first).children.length, 1);
  assert.equal(store().components[0].element.children.length, 1);
});

test("instances have independent IDs and effects; detaching descendants unlinks the whole instance and freezes future master updates", () => {
  const { frame, component } = master();
  store().setSelectedElementId("desktop");
  const id = store().insertComponent(component)!;
  assert.notEqual(element(id).effects, element(frame).effects);
  assert.notEqual(element(id).children[0].id, element(frame).children[0].id);
  const child = element(id).children[0].id;
  store().detachInstance(child);
  assert.equal(element(id).componentId, undefined);
  assert.equal(element(child).componentSourceId, undefined);
  store().updateStyles(frame, { width: 500 });
  assert.equal(element(id).styles.width, 200);
  assert.ok(store().createComponent(id));
});

test("text masters work; duplicate/nested component conversion is rejected and saved assets survive master deletion", () => {
  const text = store().addElement("desktop", "text", { x: 0, y: 0 })!;
  const component = store().createComponent(text)!;
  assert.ok(component);
  assert.equal(store().createComponent(text), null);
  assert.equal(store().createComponent("desktop"), null);
  store().deleteElement(text);
  const instance = store().insertComponent(component)!;
  assert.equal(element(instance).type, "text");
  assert.equal(element(instance).content, "Double click to edit");
  store().editMaster(component);
  assert.equal(store().selectedElementId, instance);
  assert.equal(store().insertComponent("missing"), null);
});

test("preview keeps editing camera and rejects page and component actions", () => {
  const { component, frame } = master();
  const about = store().addPage("/about")!;
  const camera = store().canvasConfig;
  store().setPreviewMode(true);
  store().setPan({ x: 99, y: 200 });
  store().switchPage("home");
  store().deletePage(about);
  assert.equal(store().addPage("/contact"), null);
  assert.equal(store().renamePage(about, "/contact"), false);
  assert.equal(store().insertComponent(component), null);
  assert.equal(store().createComponent(frame), null);
  assert.equal(store().activePageId, about);
  assert.deepEqual(store().pages[1].canvasConfig, camera);
  store().setPreviewMode(false);
  assert.deepEqual(store().canvasConfig, camera);
});

test("deleting the active page falls back safely and preserves its saved component snapshot", () => {
  const { component } = master();
  const about = store().addPage("/about")!;
  store().switchPage("home");
  store().deletePage("home");
  assert.equal(store().activePageId, about);
  assert.equal(store().elements, store().pages[0].elements);
  assert.equal(store().selectedElementId, null);
  assert.ok(store().insertComponent(component));
});

test("Stack masters insert in flow into Stack parents and maintain their layout when updated", () => {
  const stack = store().addElement("desktop", "frame", { x: 20, y: 20 })!;
  store().updateLayout(stack, "stack");
  const component = store().createComponent(stack)!;
  const parent = store().addElement("desktop", "frame", { x: 400, y: 20 })!;
  store().updateLayout(parent, "stack");
  const instance = store().insertComponent(component)!;
  assert.ok(element(parent).children.some((child) => child.id === instance));
  assert.equal(element(instance).styles.position, "relative");
  assert.equal(element(instance).styles.display, "flex");
  store().updateStyles(stack, { gap: 24 });
  assert.equal(element(instance).styles.gap, 24);
  assert.equal(element(instance).styles.position, "relative");
});
