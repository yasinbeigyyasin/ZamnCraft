import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  pathGeometry,
  lineGeometry,
  penPath,
  shapeGeometry,
  validVector,
  vectorPresentation,
} from "../src/lib/vector";
import { findElementById, useEditorStore } from "../src/store/editor-store";
import { parseWorkspace, serializeWorkspace } from "../src/lib/workspace";
import { generateCode } from "../src/lib/code-generator";

const store = useEditorStore.getState;
afterEach(() =>
  useEditorStore.setState(useEditorStore.getInitialState(), true),
);
test("all built-in shapes have safe, bounded paths and reversed line direction is preserved", () => {
  for (const kind of [
    "rectangle",
    "ellipse",
    "line",
    "arrow",
    "triangle",
    "polygon",
    "star",
  ] as const) {
    assert.ok(validVector(shapeGeometry(kind)), kind);
  }
  assert.match(shapeGeometry("line", true, false).path, /^M 100 0 L 0 100$/);
  assert.match(shapeGeometry("arrow").path, /M.*L.*M.*L.*L/);
});
test("Pen tangents produce cubic curves; normalized paths preserve negative coordinates and controls", () => {
  const points = [
    { x: -20, y: 30, dx: 10, dy: -50 },
    { x: 100, y: 80 },
    { x: 30, y: 100 },
  ];
  const result = pathGeometry("pen", points, true);
  assert.equal(result.left, -30);
  assert.equal(result.top, -20);
  assert.equal(result.width, 130);
  assert.equal(result.height, 120);
  assert.ok(validVector(result.vector));
  assert.match(result.vector.path, /C/);
  assert.ok(result.vector.path.endsWith(" Z"));
  assert.equal(
    penPath([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]),
    "M 1 2 L 3 4",
  );
});
test("vector creation is atomic, persistent, scalable and supports linked components", () => {
  const geometry = shapeGeometry("star");
  const id = store().addVector("desktop", geometry, {
    left: 30,
    top: 40,
    width: 160,
    height: 100,
  })!;
  assert.ok(id);
  assert.equal(store().historyPast.length, 1);
  assert.equal(findElementById(store().elements, id)!.type, "shape");
  assert.equal(store().selectedElementId, id);
  store().undo();
  assert.equal(findElementById(store().elements, id), undefined);
  store().redo();
  const component = store().createComponent(id)!;
  const instance = store().insertComponent(component)!;
  store().scaleElement(findElementById(store().elements, id)!, 2);
  const scaled = findElementById(store().elements, instance)!;
  assert.equal(scaled.styles.width, 320);
  assert.deepEqual(scaled.vector, geometry);
  assert.deepEqual(
    parseWorkspace(serializeWorkspace(store())).pages[0].elements,
    JSON.parse(JSON.stringify(store().elements)),
  );
  const image = vectorPresentation(scaled);
  assert.match(image.backgroundImage!, /data:image\/svg\+xml/);
  assert.equal(image.backgroundColor, "transparent");
  for (const framework of ["react", "vue", "svelte", "html"] as const) {
    const code = generateCode(store().elements, framework);
    assert.match(code, /data:image\/svg\+xml/);
    assert.doesNotMatch(code, />Star</);
  }
});
test("unsafe geometry and malformed saved shapes are rejected without changing documents", () => {
  const before = store();
  const base = shapeGeometry("rectangle");
  for (const vector of [
    { ...base, path: 'M 0 0 L 1 1" onload="bad' },
    { ...base, path: "M 0 0 L 1" },
    { ...base, path: "M 0 0 L 10000000000 2" },
    { ...base, width: NaN },
    { ...base, height: 0 },
    { ...base, path: "M 0 0 " + "L 1 1 ".repeat(40000) },
  ]) {
    assert.equal(validVector(vector), false);
    assert.equal(
      store().addVector("desktop", vector, {
        left: 0,
        top: 0,
        width: 100,
        height: 100,
      }),
      null,
    );
  }
  assert.equal(store(), before);
  store().addVector("desktop", base, {
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  });
  const saved = JSON.parse(serializeWorkspace(store()));
  saved.pages[0].elements[0].children[0].vector.path = "<script>bad</script>";
  assert.throws(() => parseWorkspace(JSON.stringify(saved)));
  store().setPreviewMode(true);
  assert.equal(
    store().addVector(null, base, { left: 0, top: 0, width: 100, height: 100 }),
    null,
  );
});

test("horizontal, vertical and reversed arrows keep visible arrowheads inside their bounds", () => {
  for (const end of [
    { x: 200, y: 0 },
    { x: 0, y: 200 },
    { x: -200, y: -100 },
  ]) {
    const line = lineGeometry("arrow", { x: 0, y: 0 }, end);
    assert.ok(validVector(line.vector));
    assert.ok(line.width > 10 && line.height > 10);
    assert.ok(line.left <= 0 && line.top <= 0);
    assert.ok(
      line.left + line.width >= end.x && line.top + line.height >= end.y,
    );
  }
  const horizontal = lineGeometry("line", { x: 0, y: 0 }, { x: 200, y: 0 });
  assert.equal(horizontal.height, 2);
  assert.equal(horizontal.vector.path, "M 1 1 L 201 1");
});
