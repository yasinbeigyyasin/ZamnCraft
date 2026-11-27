import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { useEditorStore } from "../src/store/editor-store";

afterEach(() =>
  useEditorStore.setState({ tool: "select", tab: "pages", zoom: 100 }),
);

test("editor starts with the selection tool, pages panel, and 100% zoom", () => {
  const { tool, tab, zoom } = useEditorStore.getState();
  assert.deepEqual(
    { tool, tab, zoom },
    { tool: "select", tab: "pages", zoom: 100 },
  );
});

test("tool and tab selections are independent", () => {
  useEditorStore.getState().setTool("frame");
  useEditorStore.getState().setTab("assets");
  assert.equal(useEditorStore.getState().tool, "frame");
  assert.equal(useEditorStore.getState().tab, "assets");
  assert.equal(useEditorStore.getState().zoom, 100);
});

test("zoom accepts normal values and clamps to safe canvas limits", () => {
  for (const [input, expected] of [
    [125, 125],
    [0, 25],
    [900, 200],
    [-25, 25],
  ]) {
    useEditorStore.getState().setZoom(input);
    assert.equal(useEditorStore.getState().zoom, expected);
  }
});

test("invalid zoom values do not corrupt the canvas state", () => {
  for (const input of [NaN, Infinity, -Infinity]) {
    useEditorStore.getState().setZoom(input);
    assert.equal(useEditorStore.getState().zoom, 100);
  }
});
