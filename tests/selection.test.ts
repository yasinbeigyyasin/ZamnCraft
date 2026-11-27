import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { useEditorStore, findElementById } from "../src/store/editor-store";
import { selectedRoots, selectionRange } from "../src/lib/selection";
import { serializeWorkspace, parseWorkspace } from "../src/lib/workspace";
const store = useEditorStore.getState;
afterEach(() =>
  useEditorStore.setState(useEditorStore.getInitialState(), true),
);
function fixture() {
  const a = store().addElement("desktop", "frame", { x: 10, y: 20 })!;
  const b = store().addElement("desktop", "frame", { x: 300, y: 20 })!;
  const c = store().addElement(a, "text", { x: 20, y: 30 })!;
  store().setSelectedElementId(null);
  useEditorStore.setState({ historyPast: [], historyFuture: [] });
  return { a, b, c };
}
test("single selection, toggling and range selection stay synchronized without adding history", () => {
  const { a, b, c } = fixture();
  store().setSelectedElementId(a);
  assert.deepEqual(store().selectedElementIds, [a]);
  store().toggleSelection(b);
  assert.deepEqual(store().selectedElementIds, [a, b]);
  store().toggleSelection(a);
  assert.deepEqual(store().selectedElementIds, [b]);
  assert.equal(store().selectedElementId, b);
  store().toggleSelection(b);
  assert.deepEqual(store().selectedElementIds, []);
  assert.equal(store().selectedElementId, null);
  store().setSelectedElementId(a);
  store().selectRange(b, [a, c, b]);
  assert.deepEqual(store().selectedElementIds, [a, c, b]);
  assert.equal(store().selectionAnchorId, a);
  store().selectRange(c, [a, c, b]);
  assert.deepEqual(store().selectedElementIds, [a, c]);
  store().setSelectedElementIds([b, b, "missing", a]);
  assert.deepEqual(store().selectedElementIds, [b, a]);
  store().setSelectedElementId("missing");
  assert.deepEqual(store().selectedElementIds, []);
  assert.equal(store().historyPast.length, 0);
  assert.deepEqual(selectionRange([a, b, c], c, a), [a, b, c]);
  assert.deepEqual(selectionRange([a, b], c, a), [a]);
  assert.deepEqual(selectionRange([a, b], a, "missing"), []);
});
test("selected roots exclude descendants while retaining independent selections", () => {
  const { a, b, c } = fixture();
  assert.deepEqual(
    selectedRoots(store().elements, [c, a, b]).map((node) => node.id),
    [a, b],
  );
  assert.deepEqual(
    selectedRoots(store().elements, [c, b]).map((node) => node.id),
    [c, b],
  );
});
test("multi-layer movement and deletion undo/redo atomically with the entire selection", () => {
  const { a, b } = fixture();
  store().setSelectedElementIds([a, b]);
  store().beginHistory();
  store().moveElements([
    { id: a, left: 30, top: 40 },
    { id: b, left: 320, top: 40 },
  ]);
  store().moveElements([
    { id: a, left: 50, top: 60 },
    { id: b, left: 340, top: 60 },
  ]);
  store().endHistory();
  assert.equal(store().historyPast.length, 1);
  store().undo();
  assert.equal(findElementById(store().elements, a)!.styles.left, 10);
  assert.equal(findElementById(store().elements, b)!.styles.left, 300);
  assert.deepEqual(store().selectedElementIds, [a, b]);
  store().redo();
  assert.equal(findElementById(store().elements, b)!.styles.left, 340);
  store().deleteSelectedElements();
  assert.equal(store().elements[0].children.length, 0);
  assert.deepEqual(store().selectedElementIds, []);
  store().undo();
  assert.equal(store().elements[0].children.length, 2);
  assert.deepEqual(store().selectedElementIds, [a, b]);
  store().redo();
  assert.deepEqual(store().selectedElementIds, []);
});
test("removed IDs are pruned without clearing other selected layers; page changes and hydration clear selection", () => {
  const { a, b, c } = fixture();
  store().setSelectedElementIds([a, b, c]);
  store().deleteElement(a);
  assert.deepEqual(store().selectedElementIds, [b]);
  assert.equal(store().selectedElementId, b);
  store().setElements(
    store().elements.map((root) => ({ ...root, children: [] })),
  );
  assert.deepEqual(store().selectedElementIds, []);
  const id = store().addElement("desktop", "frame", { x: 10, y: 10 })!;
  const document = parseWorkspace(serializeWorkspace(store()));
  assert.ok(!serializeWorkspace(store()).includes("selectedElementIds"));
  store().hydrateWorkspace(document);
  assert.deepEqual(store().selectedElementIds, []);
  store().setSelectedElementId(id);
  const home = store().activePageId;
  store().addPage("/other");
  assert.deepEqual(store().selectedElementIds, []);
  store().switchPage(home);
  assert.deepEqual(store().selectedElementIds, []);
});
test("cancelled group movements restore every node and invalid or preview actions cannot mutate the tree", () => {
  const { a, b } = fixture();
  store().setSelectedElementIds([a, b]);
  const before = store().elements;
  store().beginHistory();
  store().moveElements([
    { id: a, left: 90, top: 20 },
    { id: b, left: 380, top: 20 },
  ]);
  store().endHistory(true);
  assert.deepEqual(store().elements, before);
  assert.deepEqual(store().selectedElementIds, [a, b]);
  assert.equal(store().historyPast.length, 0);
  for (const left of [NaN, Infinity, 10000001])
    store().moveElements([{ id: a, left, top: 0 }]);
  store().moveElements([{ id: "missing", left: 0, top: 0 }]);
  assert.deepEqual(store().elements, before);
  store().setPreviewMode(true);
  store().setSelectedElementIds([]);
  store().toggleSelection(a);
  store().deleteSelectedElements();
  store().moveElements([{ id: a, left: 999, top: 999 }]);
  assert.deepEqual(store().elements, before);
  assert.deepEqual(store().selectedElementIds, [a, b]);
});
