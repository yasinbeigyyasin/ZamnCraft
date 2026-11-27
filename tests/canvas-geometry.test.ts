import { test } from "node:test";
import assert from "node:assert/strict";
import {
  manipulateRect,
  RESIZE_HANDLES,
  type CanvasRect,
} from "../src/lib/canvas-geometry";

const initial: CanvasRect = { x: 100, y: 80, width: 200, height: 120 };

test("moving preserves dimensions, supports negative positions, and leaves inputs untouched", () => {
  const { rect, guides } = manipulateRect(
    initial,
    { x: -150, y: 35 },
    null,
    [],
    6,
  );
  assert.deepEqual(rect, { x: -50, y: 115, width: 200, height: 120 });
  assert.deepEqual(initial, { x: 100, y: 80, width: 200, height: 120 });
  assert.deepEqual(guides, []);
});

test("all eight handles update only their axes and keep the opposite edge anchored", () => {
  for (const handle of RESIZE_HANDLES) {
    const { rect } = manipulateRect(initial, { x: 25, y: 15 }, handle, [], 6);
    assert.equal(
      rect.width,
      initial.width +
        (handle.includes("w") ? -25 : handle.includes("e") ? 25 : 0),
    );
    assert.equal(
      rect.height,
      initial.height +
        (handle.includes("n") ? -15 : handle.includes("s") ? 15 : 0),
    );
    assert.equal(rect.x, initial.x + (handle.includes("w") ? 25 : 0));
    assert.equal(rect.y, initial.y + (handle.includes("n") ? 15 : 0));
    if (handle.includes("w"))
      assert.equal(rect.x + rect.width, initial.x + initial.width);
    if (handle.includes("n"))
      assert.equal(rect.y + rect.height, initial.y + initial.height);
  }
});

test("crossing an opposite edge clamps instead of flipping and honors border minimums", () => {
  const { rect } = manipulateRect(initial, { x: 1000, y: 1000 }, "nw", [], 6, {
    width: 20,
    height: 16,
  });
  assert.deepEqual(rect, { x: 280, y: 184, width: 20, height: 16 });
  const southeast = manipulateRect(
    initial,
    { x: -1000, y: -1000 },
    "se",
    [],
    6,
  ).rect;
  assert.deepEqual(southeast, { x: 100, y: 80, width: 8, height: 8 });
});

test("moving snaps edges and centers to parent or sibling targets on both axes", () => {
  const targets = [{ x: 0, y: 0, width: 1000, height: 600 }];
  const { rect, guides } = manipulateRect(
    initial,
    { x: 297, y: 159 },
    null,
    targets,
    6,
  );
  assert.equal(rect.x + rect.width / 2, 500);
  assert.equal(rect.y + rect.height / 2, 300);
  assert.equal(guides.length, 2);
  assert.deepEqual(
    guides.map((guide) => [guide.axis, guide.value]),
    [
      ["x", 500],
      ["y", 300],
    ],
  );
  const sibling = { x: 350, y: 220, width: 100, height: 80 };
  const snapped = manipulateRect(initial, { x: 54, y: 19 }, null, [sibling], 6);
  assert.equal(snapped.rect.x + snapped.rect.width, sibling.x);
  assert.equal(snapped.rect.y + snapped.rect.height, sibling.y);
});

test("resize snapping adjusts the active edge, never the opposite edge or untouched axis", () => {
  const target = { x: 0, y: 0, width: 800, height: 600 };
  const result = manipulateRect(initial, { x: 97, y: 101 }, "e", [target], 6);
  assert.equal(result.rect.x, 100);
  assert.equal(result.rect.width, 300);
  assert.equal(result.rect.height, 120);
  assert.equal(result.rect.y, 80);
  assert.deepEqual(
    result.guides.map((guide) => [guide.axis, guide.value]),
    [["x", 400]],
  );
  const northwest = manipulateRect(
    initial,
    { x: -98, y: -77 },
    "nw",
    [target],
    6,
  ).rect;
  assert.deepEqual(northwest, { x: 0, y: 0, width: 300, height: 200 });
});

test("snap threshold is zoom-independent when supplied in world pixels and the closest target wins", () => {
  const targets = [
    { x: 400, y: 400, width: 100, height: 100 },
    { x: 403, y: 401, width: 100, height: 100 },
  ];
  const result = manipulateRect(
    initial,
    { x: 102, y: 10 },
    null,
    targets,
    6 / 2,
  );
  assert.equal(result.rect.x + result.rect.width, 403);
  const noSnap = manipulateRect(
    initial,
    { x: 108, y: 10 },
    null,
    targets,
    6 / 2,
  );
  assert.equal(noSnap.rect.x, 208);
  assert.deepEqual(noSnap.guides, []);
});

test("a tempting snap cannot violate the minimum size", () => {
  const { rect, guides } = manipulateRect(
    initial,
    { x: -199, y: 0 },
    "e",
    [{ x: 103, y: 500, width: 0, height: 0 }],
    6,
  );
  assert.equal(rect.width, 8);
  assert.deepEqual(guides, []);
});

test("equal-distance guides stay stable across fractional DOM measurements", () => {
  const { guides } = manipulateRect(
    { x: 0, y: 100, width: 200.0001, height: 100 },
    { x: 347, y: 0 },
    null,
    [{ x: 350, y: 400, width: 200, height: 100 }],
    6,
  );
  assert.equal(guides[0].value, 350);
});
