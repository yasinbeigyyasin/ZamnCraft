import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  useEditorStore,
  findElementById,
  canReparentElements,
} from "../src/store/editor-store";
import { serializeWorkspace, parseWorkspace } from "../src/lib/workspace";
const state = useEditorStore.getState;
afterEach(() =>
  useEditorStore.setState(useEditorStore.getInitialState(), true),
);
function fixture() {
  const a = state().addElement("desktop", "frame", { x: 20, y: 30 })!;
  const b = state().addElement("desktop", "frame", { x: 400, y: 30 })!;
  const c = state().addElement(a, "frame", { x: 15, y: 25 })!;
  const d = state().addElement(c, "text", { x: 5, y: 6 })!;
  state().setSelectedElementIds([c, d]);
  useEditorStore.setState({ historyPast: [], historyFuture: [] });
  return { a, b, c, d };
}
test("moving selected subtrees between frames preserves IDs, content, selection and undo/redo", () => {
  const { a, b, c, d } = fixture();
  const original = findElementById(state().elements, c)!;
  assert.equal(state().reparentElements([c, d], b), true);
  assert.equal(findElementById(state().elements, a)!.children.length, 0);
  assert.equal(findElementById(state().elements, b)!.children.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(findElementById(state().elements, c))),
    JSON.parse(JSON.stringify(original)),
  );
  assert.deepEqual(state().selectedElementIds, [c, d]);
  assert.equal(state().historyPast.length, 1);
  state().undo();
  assert.equal(findElementById(state().elements, a)!.children[0].id, c);
  state().redo();
  assert.equal(
    findElementById(state().elements, b)!.children[0].children[0].id,
    d,
  );
  const parsed = parseWorkspace(serializeWorkspace(state()));
  assert.equal(findElementById(parsed.pages[0].elements, b)!.children[0].id, c);
});
test("invalid, cyclic, breakpoint, existing-parent and Preview drops leave history and tree unchanged", () => {
  const { a, b, c, d } = fixture();
  const before = state().elements;
  for (const [ids, target] of [
    [[], b],
    [["missing"], b],
    [[c], "missing"],
    [[c], a],
    [[c], c],
    [[a], c],
    [[c], d],
    [["desktop"], b],
  ] as [string[], string][]) {
    assert.equal(canReparentElements(state().elements, ids, target), false);
    assert.equal(state().reparentElements(ids, target), false);
  }
  state().setPreviewMode(true);
  assert.equal(state().reparentElements([c], b), false);
  assert.equal(state().elements, before);
  assert.equal(state().historyPast.length, 0);
});
test("stack and grid drops enter layout flow and restore free offsets on moving back", () => {
  const { a, b, c } = fixture();
  for (const mode of ["stack", "grid"] as const) {
    state().updateLayout(b, mode);
    assert.equal(state().reparentElements([c], b), true);
    let moved = findElementById(state().elements, c)!;
    assert.equal(moved.styles.position, "relative");
    assert.equal(moved.styles.left, 0);
    assert.equal(moved.freePosition!.left, 15);
    assert.equal(state().reparentElements([c], a), true);
    moved = findElementById(state().elements, c)!;
    assert.equal(moved.styles.position, "absolute");
    assert.equal(moved.styles.left, 15);
    assert.equal(moved.styles.top, 25);
    assert.equal(moved.freePosition, undefined);
  }
});
test("component-owned nodes cannot cross boundaries without detaching", () => {
  const { a, b, c } = fixture();
  state().createComponent(a);
  assert.equal(state().reparentElements([c], b), false);
  assert.equal(state().reparentElements([b], a), false);
});
