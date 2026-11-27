import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createDefaultEffects } from "../src/lib/element-effects";
import {
  findElementById,
  useEditorStore,
  type EditorElement,
} from "../src/store/useEditorStore";

afterEach(() =>
  useEditorStore.setState(useEditorStore.getInitialState(), true),
);

test("editor starts with a white 1200 × 800 Desktop frame and independent UI state", () => {
  const state = useEditorStore.getState();
  assert.equal(state.activeTool, "select");
  assert.equal(state.selectedElementId, null);
  assert.equal(state.tab, "pages");
  assert.deepEqual(state.canvasConfig, { zoom: 1, pan: { x: 0, y: 0 } });
  assert.equal(state.elements.length, 1);
  assert.deepEqual(state.elements[0], {
    id: "desktop",
    breakpoint: "desktop",
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
  });
});

test("tool, panel, and element selections do not change canvas coordinates", () => {
  const state = useEditorStore.getState();
  state.setActiveTool("frame");
  state.setTab("assets");
  state.setSelectedElementId("desktop");
  assert.equal(useEditorStore.getState().activeTool, "frame");
  assert.equal(useEditorStore.getState().tab, "assets");
  assert.equal(useEditorStore.getState().selectedElementId, "desktop");
  assert.deepEqual(useEditorStore.getState().canvasConfig, {
    zoom: 1,
    pan: { x: 0, y: 0 },
  });
});

test("selection resolves nested children and clears if the element disappears", () => {
  const child: EditorElement = {
    id: "title",
    name: "Heading",
    type: "text",
    styles: { fontSize: 24 },
    children: [],
    animations: {},
  };
  const root = { ...useEditorStore.getState().elements[0], children: [child] };
  const state = useEditorStore.getState();
  state.setElements([root]);
  state.setSelectedElementId("title");
  assert.equal(findElementById([root], "title"), child);
  assert.equal(findElementById([root], "missing"), undefined);
  assert.equal(useEditorStore.getState().selectedElementId, "title");
  state.setElements([]);
  assert.equal(useEditorStore.getState().selectedElementId, null);
  state.setSelectedElementId("missing");
  assert.equal(useEditorStore.getState().selectedElementId, null);
});

test("zoom uses scale factors, clamps to 25–200%, and preserves pan without an anchor", () => {
  useEditorStore.getState().setPan({ x: -50, y: 75 });
  for (const [input, expected] of [
    [1.25, 1.25],
    [0, 0.25],
    [900, 2],
    [-1, 0.25],
  ]) {
    useEditorStore.getState().setZoom(input);
    assert.equal(useEditorStore.getState().canvasConfig.zoom, expected);
    assert.deepEqual(useEditorStore.getState().canvasConfig.pan, {
      x: -50,
      y: 75,
    });
  }
});

test("pointer-anchored zoom keeps the same world point under the pointer", () => {
  const state = useEditorStore.getState();
  state.setPan({ x: 40, y: -80 });
  const anchor = { x: 250, y: 175 };
  const worldPoint = { x: 210, y: 255 };
  for (const zoom of [1.5, 100, -1, 1]) {
    state.setZoom(zoom, anchor);
    const config = useEditorStore.getState().canvasConfig;
    assert.ok(
      Math.abs(config.pan.x + worldPoint.x * config.zoom - anchor.x) < 1e-9,
    );
    assert.ok(
      Math.abs(config.pan.y + worldPoint.y * config.zoom - anchor.y) < 1e-9,
    );
  }
});

test("invalid zoom, anchor, and pan values cannot corrupt the viewport", () => {
  const state = useEditorStore.getState();
  const initial = state.canvasConfig;
  for (const input of [NaN, Infinity, -Infinity]) {
    state.setZoom(input);
    state.setPan({ x: input, y: 10 });
    state.setPan({ x: 10, y: input });
    state.setZoom(1.5, { x: input, y: 10 });
    state.setZoom(1.5, { x: 10, y: input });
    assert.deepEqual(useEditorStore.getState().canvasConfig, initial);
  }
});

test("pan accepts unbounded positive and negative finite canvas coordinates", () => {
  const pan = { x: -20000, y: 30000 };
  useEditorStore.getState().setPan(pan);
  pan.x = 99;
  assert.deepEqual(useEditorStore.getState().canvasConfig.pan, {
    x: -20000,
    y: 30000,
  });
  assert.equal(useEditorStore.getState().canvasConfig.zoom, 1);
});

test("adding a frame selects it, returns to Select, and leaves the old tree untouched", () => {
  const state = useEditorStore.getState();
  const previousRoot = state.elements[0];
  state.setActiveTool("frame");
  const id = state.addElement("desktop", "frame", { x: 35, y: 60 });
  assert.ok(id);
  const current = useEditorStore.getState();
  const frame = findElementById(current.elements, id)!;
  assert.equal(frame.name, "Frame");
  assert.equal(frame.type, "frame");
  assert.deepEqual(frame.styles, {
    position: "absolute",
    left: 35,
    top: 60,
    width: 200,
    height: 200,
    backgroundColor: "#e5e5e5",
  });
  assert.deepEqual(frame.children, []);
  assert.equal(current.selectedElementId, id);
  assert.equal(current.activeTool, "select");
  assert.notEqual(current.elements[0], previousRoot);
  assert.equal(previousRoot.children.length, 0);
});

test("nested additions preserve unrelated branches and use unique IDs", () => {
  const state = useEditorStore.getState();
  const frameId = state.addElement("desktop", "frame", { x: 0, y: 0 })!;
  const siblingId = state.addElement("desktop", "frame", { x: 250, y: 0 })!;
  const previous = useEditorStore.getState().elements;
  const textId = state.addElement(frameId, "text", { x: 20, y: 25 })!;
  const current = useEditorStore.getState().elements;
  assert.equal(new Set([frameId, siblingId, textId]).size, 3);
  assert.equal(findElementById(previous, frameId)!.children.length, 0);
  assert.equal(findElementById(current, frameId)!.children[0].id, textId);
  assert.equal(
    findElementById(previous, siblingId),
    findElementById(current, siblingId),
  );
  assert.equal(
    findElementById(current, textId)!.content,
    "Double click to edit",
  );
  assert.equal(findElementById(current, textId)!.name, "Text");
});

test("insertion rejects missing or non-frame parents and invalid coordinates", () => {
  const state = useEditorStore.getState();
  const textId = state.addElement("desktop", "text", { x: 10, y: 10 })!;
  const previous = useEditorStore.getState();
  for (const parent of ["missing", textId]) {
    assert.equal(state.addElement(parent, "frame", { x: 0, y: 0 }), null);
    assert.equal(useEditorStore.getState(), previous);
  }
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.equal(
      state.addElement("desktop", "text", { x: invalid, y: 10 }),
      null,
    );
    assert.equal(
      state.addElement("desktop", "text", { x: 10, y: invalid }),
      null,
    );
    assert.equal(useEditorStore.getState(), previous);
  }
});

test("text editing preserves names, siblings, whitespace, empty strings, and markup as text", () => {
  const state = useEditorStore.getState();
  const id = state.addElement("desktop", "text", { x: -10, y: -10 })!;
  const element = findElementById(useEditorStore.getState().elements, id)!;
  assert.equal(element.styles.left, 0);
  assert.equal(element.styles.top, 0);
  for (const content of [
    "Edited text",
    "First\nSecond\n",
    "",
    '<img src="x" onerror="alert(1)">',
  ]) {
    state.updateText(id, content);
    const current = findElementById(useEditorStore.getState().elements, id)!;
    assert.equal(current.content, content);
    assert.equal(current.name, "Text");
    assert.equal(element.content, "Double click to edit");
  }
  const previous = useEditorStore.getState();
  state.updateText("desktop", "Not a text element");
  state.updateText("missing", "Not found");
  assert.equal(useEditorStore.getState(), previous);
});

test("root insertion preserves negative world positions without modifying existing frames", () => {
  const state = useEditorStore.getState();
  const desktop = state.elements[0];
  for (const type of ["frame", "text"] as const) {
    const id = state.addElement(null, type, { x: -250, y: -75 })!;
    const current = useEditorStore.getState();
    const element = current.elements.at(-1)!;
    assert.equal(element.id, id);
    assert.equal(element.styles.left, -250);
    assert.equal(element.styles.top, -75);
    assert.equal(current.elements[0], desktop);
    assert.equal(desktop.children.length, 0);
    assert.equal(current.selectedElementId, id);
    if (type === "text") {
      assert.equal(element.styles.color, "#ffffff");
      state.updateText(id, "Outside the frame");
      assert.equal(
        findElementById(useEditorStore.getState().elements, id)!.content,
        "Outside the frame",
      );
    }
  }
  const previous = useEditorStore.getState();
  assert.equal(state.addElement(null, "text", { x: NaN, y: 0 }), null);
  assert.equal(useEditorStore.getState(), previous);
});

test("renaming nested layers trims names without changing text content or unrelated branches", () => {
  const state = useEditorStore.getState();
  const frameId = state.addElement("desktop", "frame", { x: 0, y: 0 })!;
  const textId = state.addElement(frameId, "text", { x: 10, y: 10 })!;
  const siblingId = state.addElement("desktop", "frame", { x: 250, y: 0 })!;
  state.setSelectedElementId(textId);
  const previous = useEditorStore.getState();
  state.renameElement(textId, "  Heading  ");
  const current = useEditorStore.getState();
  assert.equal(findElementById(current.elements, textId)!.name, "Heading");
  assert.equal(
    findElementById(current.elements, textId)!.content,
    "Double click to edit",
  );
  assert.equal(findElementById(previous.elements, textId)!.name, "Text");
  assert.equal(
    findElementById(current.elements, siblingId),
    findElementById(previous.elements, siblingId),
  );
  assert.equal(current.selectedElementId, textId);
  for (const name of ["", "  \n\t", "Heading"])
    state.renameElement(textId, name);
  state.renameElement("missing", "Ignored");
  assert.equal(useEditorStore.getState(), current);
  state.renameElement("desktop", "Page");
  assert.equal(useEditorStore.getState().elements[0].name, "Page");
});

test("deleting nested subtrees clears descendant selections and preserves siblings immutably", () => {
  const state = useEditorStore.getState();
  const frameId = state.addElement("desktop", "frame", { x: 0, y: 0 })!;
  const textId = state.addElement(frameId, "text", { x: 10, y: 10 })!;
  const siblingId = state.addElement("desktop", "frame", { x: 250, y: 0 })!;
  state.setSelectedElementId(textId);
  const previous = useEditorStore.getState();
  state.deleteElement(frameId);
  const current = useEditorStore.getState();
  assert.equal(current.selectedElementId, null);
  assert.equal(findElementById(current.elements, frameId), undefined);
  assert.equal(findElementById(current.elements, textId), undefined);
  assert.ok(findElementById(previous.elements, textId));
  assert.equal(
    findElementById(current.elements, siblingId),
    findElementById(previous.elements, siblingId),
  );
  state.deleteElement("missing");
  assert.equal(useEditorStore.getState(), current);
});

test("deleting unrelated layers keeps selection and deleting the last root leaves a valid empty page", () => {
  const state = useEditorStore.getState();
  const textId = state.addElement("desktop", "text", { x: 0, y: 0 })!;
  const rootId = state.addElement(null, "frame", { x: -250, y: 0 })!;
  state.setSelectedElementId(textId);
  state.deleteElement(rootId);
  assert.equal(useEditorStore.getState().selectedElementId, textId);
  state.deleteElement(textId);
  assert.equal(useEditorStore.getState().selectedElementId, null);
  state.setSelectedElementId("desktop");
  state.deleteElement("desktop");
  assert.deepEqual(useEditorStore.getState().elements, []);
  assert.equal(useEditorStore.getState().selectedElementId, null);
  assert.ok(state.addElement(null, "text", { x: 0, y: 0 }));
});

test("Stack tool creates an ordinary editable flex frame in one undo step", () => {
  const state = useEditorStore.getState();
  state.setActiveTool("stack");
  const id = state.addElement("desktop", "stack", { x: 30, y: 40 })!;
  const stack = findElementById(useEditorStore.getState().elements, id)!;
  assert.equal(stack.type, "frame");
  assert.equal(stack.name, "Stack");
  assert.equal(stack.styles.display, "flex");
  assert.equal(stack.styles.flexDirection, "column");
  assert.equal(stack.styles.gap, 16);
  assert.equal(useEditorStore.getState().activeTool, "select");
  state.undo();
  assert.equal(
    findElementById(useEditorStore.getState().elements, id),
    undefined,
  );
  state.redo();
  assert.equal(
    findElementById(useEditorStore.getState().elements, id)?.styles.display,
    "flex",
  );
});
