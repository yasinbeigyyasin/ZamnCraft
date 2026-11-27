import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  findElementById,
  getLayoutMode,
  getSizingMode,
  useEditorStore,
} from "../src/store/editor-store";
import { useEditorStore as legacyStore } from "../src/store/useEditorStore";

afterEach(() =>
  useEditorStore.setState(useEditorStore.getInitialState(), true),
);

function element(id: string) {
  return findElementById(useEditorStore.getState().elements, id)!;
}

test("new and legacy store imports share one instance", () =>
  assert.equal(useEditorStore, legacyStore));

test("property patches update only the nested target and preserve selection, content, and sibling references", () => {
  const state = useEditorStore.getState();
  const frame = state.addElement("desktop", "frame", { x: 10, y: 20 })!;
  const text = state.addElement(frame, "text", { x: 5, y: 6 })!;
  const sibling = state.addElement("desktop", "frame", { x: 300, y: 0 })!;
  state.setSelectedElementId(text);
  const previous = useEditorStore.getState();
  const previousSibling = element(sibling);
  state.updatePosition(text, { position: "relative", left: -42.5, top: 18 });
  state.updateStyles(text, {
    backgroundColor: "#ffcc00",
    opacity: 0.55,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#111111",
    borderStyle: "solid",
    fontSize: 24,
    fontWeight: 700,
    color: "#0099ff",
    textAlign: "center",
  });
  assert.equal(element(text).styles.left, -42.5);
  assert.equal(element(text).styles.position, "relative");
  assert.equal(element(text).styles.opacity, 0.55);
  assert.equal(element(text).styles.fontSize, 24);
  assert.equal(element(text).content, "Double click to edit");
  assert.equal(findElementById(previous.elements, text)!.styles.left, 5);
  assert.equal(element(sibling), previousSibling);
  assert.equal(useEditorStore.getState().selectedElementId, text);
});

test("sizing modes map to CSS and explicit height overrides the initial text minimum", () => {
  const state = useEditorStore.getState();
  const id = state.addElement("desktop", "text", { x: 0, y: 0 })!;
  state.updateSize(id, "height", 10);
  assert.equal(element(id).styles.height, 10);
  assert.equal(element(id).styles.minHeight, 0);
  for (const axis of ["width", "height"] as const) {
    state.updateSize(id, axis, "fill");
    assert.equal(element(id).styles[axis], "100%");
    assert.equal(getSizingMode(element(id).styles[axis]), "fill");
    state.updateSize(id, axis, "fit");
    assert.equal(element(id).styles[axis], "fit-content");
    assert.equal(getSizingMode(element(id).styles[axis]), "fit");
    state.updateSize(id, axis, 0);
    assert.equal(element(id).styles[axis], 0);
    assert.equal(getSizingMode(element(id).styles[axis]), "fixed");
  }
});

test("layout switching arranges children in flow and restores free coordinates", () => {
  const state = useEditorStore.getState();
  const child = state.addElement("desktop", "frame", { x: 45, y: 80 })!;
  const previous = element(child);
  state.updateLayout("desktop", "stack");
  assert.equal(getLayoutMode(element("desktop").styles), "stack");
  assert.equal(element("desktop").styles.flexDirection, "column");
  assert.equal(element(child).styles.position, "relative");
  assert.equal(element(child).styles.left, 0);
  assert.equal(previous.styles.left, 45);
  state.updateStyles("desktop", {
    gap: 16,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  });
  const newChild = state.addElement("desktop", "text", { x: 300, y: 200 })!;
  assert.equal(element(newChild).styles.position, "relative");
  assert.equal(element(newChild).styles.left, 0);
  state.updateLayout("desktop", "grid");
  assert.equal(
    element("desktop").styles.gridTemplateColumns,
    "repeat(2, minmax(0, 1fr))",
  );
  assert.equal(element("desktop").styles.gap, 16);
  state.updateLayout("desktop", "free");
  assert.equal(getLayoutMode(element("desktop").styles), "free");
  assert.equal(element(child).styles.left, 45);
  assert.equal(element(child).styles.top, 80);
  assert.equal(element(child).styles.position, "absolute");
  assert.equal(element(newChild).styles.position, "absolute");
});

test("invalid numeric patches and unknown IDs are no-ops", () => {
  const state = useEditorStore.getState();
  const previous = useEditorStore.getState();
  for (const invalid of [NaN, Infinity, -Infinity]) {
    state.updatePosition("desktop", { left: invalid });
    state.updateSize("desktop", "width", invalid);
    state.updateStyles("desktop", { gap: invalid });
  }
  for (const styles of [
    { width: -1 },
    { height: -1 },
    { borderWidth: -1 },
    { fontSize: -1 },
    { opacity: 1.1 },
    { opacity: -0.1 },
  ])
    state.updateStyles("desktop", styles);
  state.updateStyles("missing", { width: 100 });
  state.updateLayout("missing", "grid");
  state.updatePosition("missing", { left: 20 });
  state.updateSize("missing", "height", "fill");
  state.updateStyles("desktop", { width: 1920 });
  state.updateLayout("desktop", "free");
  assert.equal(useEditorStore.getState(), previous);
});
