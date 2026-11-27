import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
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
