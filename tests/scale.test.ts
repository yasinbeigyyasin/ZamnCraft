import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { scaleStyles, scaleElementTree } from "../src/lib/scale-element";
import { scaleRect, RESIZE_HANDLES } from "../src/lib/canvas-geometry";
import {
  createDesktop,
  parseWorkspace,
  serializeWorkspace,
} from "../src/lib/workspace";
import { findElementById, useEditorStore } from "../src/store/editor-store";
import { generateCode } from "../src/lib/code-generator";

const store = useEditorStore.getState;
afterEach(() =>
  useEditorStore.setState(useEditorStore.getInitialState(), true),
);

test("all scale handles maintain aspect ratio and opposite anchors, including shrink limits", () => {
  const initial = { x: 20, y: 30, width: 200, height: 100 };
  for (const handle of RESIZE_HANDLES) {
    const { rect, factor } = scaleRect(
      initial,
      {
        x: handle.includes("w") ? -200 : 200,
        y: handle.includes("n") ? -100 : 100,
      },
      handle,
    );
    assert.equal(factor, 2);
    assert.equal(rect.width / rect.height, 2);
    assert.equal(
      rect.x,
      handle.includes("w") ? -180 : handle.includes("e") ? 20 : -80,
    );
    assert.equal(
      rect.y,
      handle.includes("n") ? -70 : handle.includes("s") ? 30 : -20,
    );
    const shrunk = scaleRect(
      initial,
      {
        x: handle.includes("w") ? 10000 : -10000,
        y: handle.includes("n") ? 10000 : -10000,
      },
      handle,
    );
    assert.ok(shrunk.rect.width >= 1 && shrunk.rect.height >= 1);
    assert.equal(shrunk.rect.width / shrunk.rect.height, 2);
  }
});

test("scale bakes pixel geometry, text, spacing and effects while preserving responsive ratios and source data", () => {
  assert.deepEqual(
    scaleStyles(
      {
        width: "100%",
        padding: "10px 20px",
        border: "2px solid #123",
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1.5,
        opacity: 0.5,
        gridTemplateColumns: "20px 1fr",
        textShadow: "1px 2px 3px red",
      },
      2,
    ),
    {
      width: "100%",
      padding: "20px 40px",
      border: "4px solid #123",
      fontSize: 32,
      fontWeight: 600,
      lineHeight: 1.5,
      opacity: 0.5,
      gridTemplateColumns: "40px 1fr",
      textShadow: "2px 4px 6px red",
    },
  );
  const source = createDesktop();
  source.children = [
    {
      ...createDesktop("child"),
      breakpoint: undefined,
      freePosition: { left: 10, top: 20 },
      styles: {
        left: 10,
        top: 20,
        width: 100,
        height: 50,
        borderWidth: 2,
        borderRadius: 4,
        fontSize: 16,
      },
    },
  ];
  source.effects!.blur = 4;
  source.effects!.shadow = "2px 4px 6px 1px #000";
  const before = structuredClone(source);
  const scaled = scaleElementTree(source, 2, { left: 50 });
  assert.deepEqual(source, before);
  assert.equal(scaled.styles.left, 50);
  assert.equal(scaled.children[0].styles.fontSize, 32);
  assert.equal(scaled.children[0].styles.borderWidth, 4);
  assert.equal(scaled.children[0].freePosition!.top, 40);
  assert.equal(scaled.effects!.blur, 8);
  assert.equal(scaled.effects!.appear.offsetY, 48);
  assert.match(scaled.effects!.shadow, /4px 8px 12px 2px/);
  assert.deepEqual(scaled.effects!.hover, before.effects!.hover);
});

test("scaling is absolute per gesture, atomic in undo/redo, cancellable, persistent and guarded in preview", () => {
  const child = store().addElement("desktop", "text", { x: 10, y: 20 })!;
  const source = store().elements[0];
  const history = store().historyPast.length;
  store().beginHistory();
  store().scaleElement(source, 1.5);
  store().scaleElement(source, 2);
  store().endHistory();
  assert.equal(store().historyPast.length, history + 1);
  assert.equal(findElementById(store().elements, child)!.styles.fontSize, 32);
  assert.equal(store().elements[0].styles.width, 3840);
  assert.deepEqual(
    parseWorkspace(serializeWorkspace(store())).pages[0].elements,
    store().elements,
  );
  store().undo();
  assert.deepEqual(store().elements[0], source);
  store().redo();
  assert.equal(store().elements[0].styles.width, 3840);
  const current = store().elements;
  store().beginHistory();
  store().scaleElement(current[0], 0.5);
  store().endHistory(true);
  assert.deepEqual(store().elements, current);
  for (const factor of [NaN, Infinity, -1, 0, 101])
    store().scaleElement(current[0], factor);
  store().scaleElement(current[0], 2, { width: Infinity });
  assert.deepEqual(store().elements, current);
  store().setPreviewMode(true);
  store().scaleElement(current[0], 2);
  assert.deepEqual(store().elements, current);
});

test("scaling masters propagates editable content to linked instances", () => {
  const text = store().addElement("desktop", "text", { x: 10, y: 20 })!;
  const component = store().createComponent(text)!;
  const instance = store().insertComponent(component)!;
  store().scaleElement(findElementById(store().elements, text)!, 2);
  assert.equal(
    findElementById(store().elements, instance)!.styles.fontSize,
    32,
  );
  store().undo();
  assert.equal(
    findElementById(store().elements, instance)!.styles.fontSize,
    16,
  );
});

test("preview accepts every top-level frame, opens selected ancestors and preserves camera; legacy sizes survive", () => {
  const custom = store().addDesktop(1440, 900)!;
  const nested = store().addElement(custom, "text", { x: 30, y: 30 })!;
  store().setSelectedElementId(nested);
  store().setPan({ x: -300, y: 50 });
  const camera = store().canvasConfig;
  store().setPreviewMode(true);
  assert.equal(store().previewRootId, custom);
  store().setPreviewRoot(nested);
  assert.equal(store().previewRootId, custom);
  store().setPreviewRoot("desktop");
  assert.equal(store().previewRootId, "desktop");
  store().setPreviewMode(false);
  assert.deepEqual(store().canvasConfig, camera);
  store().updateStyles("desktop", { width: 1200, height: 800 });
  const saved = parseWorkspace(serializeWorkspace(store()));
  assert.equal(saved.pages[0].elements[0].styles.width, 1200);
  assert.equal(saved.pages[0].elements[0].styles.height, 800);
  assert.match(
    generateCode(saved.pages[0].elements, "html"),
    /width: 1200px; height: 800px/,
  );
  assert.match(
    generateCode([createDesktop()], "html"),
    /width: 1920px; height: 1080px/,
  );
});
