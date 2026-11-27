import { expect, test, type Page } from "@playwright/test";
import {
  createWorkspace,
  serializeWorkspace,
  WORKSPACE_KEY,
} from "../../src/lib/workspace";
import type { EditorElement } from "../../src/types/editor";
const canvas = (page: Page) =>
  page.getByRole("region", { name: "Design canvas", exact: true });
const node = (page: Page, id: string) =>
  page.locator(`[data-editor-element="${id}"]`);
const selected = (page: Page) =>
  page.locator('[data-editor-element][data-selected="true"]');
const layer = (page: Page, id: string) =>
  page.locator(`[data-layer-id="${id}"] .layer-name`);
async function ids(page: Page) {
  return selected(page).evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("data-editor-element")),
  );
}
async function geometry(page: Page, id: string) {
  return node(page, id).evaluate((n) => ({
    left: parseFloat((n as HTMLElement).style.left),
    top: parseFloat((n as HTMLElement).style.top),
  }));
}
test.beforeEach(async ({ page }) => {
  const workspace = createWorkspace();
  const frame = (
    id: string,
    left: number,
    top: number,
    width = 160,
    height = 100,
  ): EditorElement => ({
    id,
    name: id.toUpperCase(),
    type: "frame",
    children: [],
    animations: {},
    styles: {
      position: "absolute",
      left,
      top,
      width,
      height,
      backgroundColor: "#d9d9d9",
    },
  });
  const group = frame("group", 200, 500, 500, 300);
  group.children = [frame("d", 30, 30, 100, 60), frame("e", 220, 150, 100, 60)];
  workspace.pages[0].elements[0].children = [
    frame("a", 200, 200),
    frame("b", 500, 200),
    frame("c", 800, 200),
    group,
  ];
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: WORKSPACE_KEY, value: serializeWorkspace(workspace) },
  );
  await page.goto("/");
  await expect(node(page, "a")).toHaveCount(1);
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await page.getByRole("tab", { name: "layers", exact: true }).click();
});

test("Layers drag moves a subtree into another frame, expands its destination, persists, and undoes atomically", async ({
  page,
}) => {
  await layer(page, "d").click();
  await page
    .getByRole("button", { name: "Collapse GROUP", exact: true })
    .click();
  await layer(page, "a").dragTo(layer(page, "group"));
  await expect(
    node(page, "group").locator('[data-editor-element="a"]'),
  ).toHaveCount(1);
  await expect(layer(page, "a")).toBeVisible();
  expect(await ids(page)).toEqual(["a"]);
  await canvas(page).focus();
  await page.keyboard.press("Control+z");
  await expect(
    node(page, "group").locator('[data-editor-element="a"]'),
  ).toHaveCount(0);
  await expect(node(page, "a")).toHaveCount(1);
  await page.keyboard.press("Control+Shift+z");
  await expect(
    node(page, "group").locator('[data-editor-element="a"]'),
  ).toHaveCount(1);
  await page.waitForTimeout(500);
  await page.reload();
  await expect(
    node(page, "group").locator('[data-editor-element="a"]'),
  ).toHaveCount(1);
});

test("Layers multi-drag preserves descendants and rejects cycles", async ({
  page,
}) => {
  await layer(page, "a").click();
  await layer(page, "b").click({ modifiers: ["Control"] });
  await layer(page, "a").dragTo(layer(page, "group"));
  await expect(
    node(page, "group").locator('[data-editor-element="a"]'),
  ).toHaveCount(1);
  await expect(
    node(page, "group").locator('[data-editor-element="b"]'),
  ).toHaveCount(1);
  await layer(page, "group").dragTo(layer(page, "d"));
  await expect(
    node(page, "group").locator('[data-editor-element="d"]'),
  ).toHaveCount(1);
  await expect(
    node(page, "d").locator('[data-editor-element="group"]'),
  ).toHaveCount(0);
});

test("wheel pans while an item remains held and keeps it under the pointer; the entire move undoes once", async ({
  page,
}) => {
  const before = await geometry(page, "a");
  const box = (await node(page, "a").boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 15, { steps: 4 });
  const moved = (await node(page, "a").boundingBox())!;
  const worldBefore = await page.locator(".canvas-world").getAttribute("style");
  await page.mouse.wheel(140, 180);
  await expect(page.locator(".canvas-world")).not.toHaveAttribute(
    "style",
    worldBefore!,
  );
  const after = (await node(page, "a").boundingBox())!;
  expect(Math.abs(after.x - moved.x)).toBeLessThan(7);
  // Snapping may adjust the pointer offset by up to six screen pixels.
  expect(Math.abs(after.y - moved.y)).toBeLessThan(7);
  await page.mouse.move(x + 35, y + 25, { steps: 3 });
  await page.mouse.up();
  expect((await geometry(page, "a")).left).toBeGreaterThan(before.left + 100);
  await page.keyboard.press("Control+z");
  expect(await geometry(page, "a")).toEqual(before);
});

test("Space temporarily pans without dropping or moving the item locally, then the held drag resumes", async ({
  page,
}) => {
  const before = await geometry(page, "a");
  const box = (await node(page, "a").boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 10, { steps: 3 });
  const moved = await geometry(page, "a");
  await page.keyboard.down("Space");
  await page.mouse.move(x + 100, y + 60, { steps: 4 });
  expect(await geometry(page, "a")).toEqual(moved);
  await page.keyboard.up("Space");
  const atResume = (await node(page, "a").boundingBox())!;
  await page.mouse.move(x + 120, y + 70, { steps: 3 });
  const resumed = (await node(page, "a").boundingBox())!;
  expect(Math.abs(resumed.x - atResume.x - 20)).toBeLessThan(3);
  expect(Math.abs(resumed.y - atResume.y - 10)).toBeLessThan(3);
  await page.mouse.up();
  await page.keyboard.press("Control+z");
  expect(await geometry(page, "a")).toEqual(before);
});

test("Escape cancels an item move after panning and does not leave capture or history stuck", async ({
  page,
}) => {
  const before = await geometry(page, "a");
  const box = (await node(page, "a").boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 45, box.y + 30, { steps: 3 });
  await page.mouse.wheel(80, 90);
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await geometry(page, "a")).toEqual(before);
  await layer(page, "b").click();
  expect(await ids(page)).toEqual(["b"]);
});

test("multi-selection remains held while scrolling horizontally and vertically", async ({
  page,
}) => {
  await layer(page, "a").click();
  await layer(page, "b").click({ modifiers: ["Control"] });
  const aBefore = await geometry(page, "a"),
    bBefore = await geometry(page, "b");
  const box = (await node(page, "a").boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 30, { steps: 3 });
  const held = (await node(page, "a").boundingBox())!;
  await page.mouse.wheel(70, 90);
  await expect
    .poll(async () => (await geometry(page, "a")).left)
    .toBeGreaterThan(aBefore.left + 100);
  const after = (await node(page, "a").boundingBox())!;
  expect(Math.abs(after.x - held.x)).toBeLessThan(2);
  expect(Math.abs(after.y - held.y)).toBeLessThan(2);
  const a = await geometry(page, "a"),
    b = await geometry(page, "b");
  expect(
    Math.abs(a.left - aBefore.left - (b.left - bBefore.left)),
  ).toBeLessThan(0.1);
  expect(Math.abs(a.top - aBefore.top - (b.top - bBefore.top))).toBeLessThan(
    0.1,
  );
  await page.mouse.up();
  await page.keyboard.press("Control+z");
  expect(await geometry(page, "a")).toEqual(aBefore);
  expect(await geometry(page, "b")).toEqual(bBefore);
});
