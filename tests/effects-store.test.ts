import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { findElementById, useEditorStore } from "../src/store/editor-store";
import {
  createDefaultEffects,
  DEFAULT_EFFECTS,
  mergeEffects,
  springTransition,
} from "../src/lib/element-effects";

afterEach(() =>
  useEditorStore.setState(useEditorStore.getInitialState(), true),
);

const element = (id: string) =>
  findElementById(useEditorStore.getState().elements, id)!;

test("new elements own independent, disabled effect defaults and legacy elements gain them on update", () => {
  const state = useEditorStore.getState();
  const id = state.addElement("desktop", "text", { x: 20, y: 30 })!;
  assert.deepEqual(element(id).effects, createDefaultEffects());
  assert.notEqual(element(id).effects, element("desktop").effects);
  assert.notEqual(
    element(id).effects!.hover,
    element("desktop").effects!.hover,
  );
  state.setElements([{ ...element(id), effects: undefined }]);
  state.updateEffects(id, { hover: { enabled: true } });
  assert.equal(element(id).effects!.hover.enabled, true);
  assert.equal(element(id).effects!.hover.scale, 1.05);
  assert.equal(element(id).effects!.appear.enabled, false);
  assert.equal(DEFAULT_EFFECTS.hover.enabled, false);
});

test("effect patches deep-merge a nested element immutably without changing geometry, text, or siblings", () => {
  const state = useEditorStore.getState();
  const parent = state.addElement("desktop", "frame", { x: 100, y: 100 })!;
  const id = state.addElement(parent, "text", { x: 10, y: 20 })!;
  const sibling = state.addElement("desktop", "frame", { x: 400, y: 100 })!;
  state.setSelectedElementId(id);
  const before = element(id),
    other = element(sibling);
  state.updateEffects(id, {
    appear: { enabled: true, opacity: 0.25, offsetX: -40 },
    hover: { enabled: true, fill: "#0099ff", opacity: 0.8 },
    blur: 3,
    shadow: "0 4px 12px #00000040",
  });
  state.updateEffects(id, {
    hover: { scale: 1.2, rotate: 12 },
    press: { enabled: true, scale: 0.9 },
    transition: { type: "spring", stiffness: 220 },
  });
  const current = element(id);
  assert.equal(current.styles, before.styles);
  assert.equal(current.content, before.content);
  assert.equal(current.effects!.hover.fill, "#0099ff");
  assert.equal(current.effects!.hover.opacity, 0.8);
  assert.equal(current.effects!.hover.scale, 1.2);
  assert.equal(current.effects!.transition.damping, 26);
  assert.equal(before.effects!.appear.enabled, false);
  assert.equal(element(sibling), other);
  assert.equal(useEditorStore.getState().selectedElementId, id);
  state.updateEffects(id, { hover: { fill: undefined, opacity: undefined } });
  assert.equal(element(id).effects!.hover.fill, undefined);
  assert.equal(element(id).effects!.hover.opacity, undefined);
});

test("invalid effects and missing IDs cannot corrupt the document", () => {
  const state = useEditorStore.getState();
  const previous = useEditorStore.getState();
  for (const number of [NaN, Infinity, -Infinity]) {
    state.updateEffects("desktop", { appear: { offsetX: number } });
    state.updateEffects("desktop", { hover: { rotate: number } });
    state.updateEffects("desktop", { blur: number });
  }
  for (const patch of [
    { appear: { opacity: -1 } },
    { hover: { opacity: 2 } },
    { hover: { fill: "bad color" } },
    { press: { scale: -1 } },
    { transition: { duration: 11 } },
    { transition: { stiffness: 0 } },
    { transition: { damping: 0 } },
    { blur: -1 },
  ])
    state.updateEffects("desktop", patch);
  state.updateEffects("missing", { blur: 10 });
  assert.equal(useEditorStore.getState(), previous);
  assert.equal(mergeEffects(undefined, { shadow: "x".repeat(501) }), null);
});

test("preview preserves document, tool and selection and restores the exact editor camera", () => {
  const state = useEditorStore.getState();
  state.setPan({ x: -123.5, y: 87 });
  state.setZoom(1.5);
  state.setSelectedElementId("desktop");
  state.setActiveTool("text");
  const previous = useEditorStore.getState();
  state.setPreviewMode(true);
  const entered = useEditorStore.getState();
  state.setPreviewMode(true);
  assert.equal(useEditorStore.getState(), entered);
  state.setZoom(0.5);
  state.setPan({ x: 100, y: 100 });
  state.setPreviewMode(false);
  const current = useEditorStore.getState();
  assert.deepEqual(current.canvasConfig, previous.canvasConfig);
  assert.equal(current.elements, previous.elements);
  assert.equal(current.selectedElementId, "desktop");
  assert.equal(current.activeTool, "text");
  assert.equal(current.previewCanvasConfig, null);
});

test("replay requests are repeatable, targeted, transient and only valid for enabled appear effects", () => {
  const state = useEditorStore.getState();
  state.replayAnimation("missing");
  state.replayAnimation("desktop");
  assert.equal(useEditorStore.getState().animationReplay, null);
  state.updateEffects("desktop", { appear: { enabled: true } });
  const elements = useEditorStore.getState().elements;
  state.replayAnimation("desktop");
  assert.deepEqual(useEditorStore.getState().animationReplay, {
    elementId: "desktop",
    sequence: 1,
  });
  state.replayAnimation("desktop");
  assert.equal(useEditorStore.getState().animationReplay!.sequence, 2);
  assert.equal(useEditorStore.getState().elements, elements);
});

test("spring physics handle underdamped, critical and overdamped systems with finite endpoints and distinct curves", () => {
  const curves = new Set<string>();
  for (const [stiffness, damping] of [
    [100, 5],
    [100, 20],
    [100, 50],
    [1, 100],
    [1000, 1],
  ]) {
    const options = springTransition(stiffness, damping);
    assert.ok(options.duration > 0 && options.duration <= 10000);
    assert.match(options.easing, /^linear\(0, /);
    assert.match(options.easing, /, 1\)$/);
    const samples = options.easing.slice(7, -1).split(",").map(Number);
    assert.equal(samples.length, 121);
    assert.ok(samples.every(Number.isFinite));
    curves.add(options.easing);
  }
  assert.equal(curves.size, 5);
  assert.ok(
    springTransition(100, 5)
      .easing.slice(7, -1)
      .split(",")
      .map(Number)
      .some((value) => value > 1),
  );
});
