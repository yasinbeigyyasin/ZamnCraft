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
async function point(page: Page, x: number, y: number) {
  const box = (await node(page, "desktop").boundingBox())!;
  return {
    x: box.x + (x * box.width) / 1920,
    y: box.y + (y * box.width) / 1920,
  };
}
async function marquee(
  page: Page,
  x: number,
  y: number,
  endX: number,
  endY: number,
  release = true,
) {
  const a = await point(page, x, y),
    b = await point(page, endX, endY);
  await page.keyboard.down("Control");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  if (release) {
    await page.mouse.up();
    await page.keyboard.up("Control");
  }
}
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
});
test("Ctrl+left-drag selects enclosed layers without moving them; Ctrl+click toggles individual selections", async ({
  page,
}) => {
  const before = await node(page, "desktop").getAttribute("style"),
    camera = await page.locator(".canvas-world").getAttribute("style");
  await marquee(page, 180, 180, 700, 340);
  expect(await ids(page)).toEqual(["a", "b"]);
  await expect(page.locator("[data-selection-marquee]")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "2 layers selected", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-resize-handle]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Component (C)", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await expect(node(page, "desktop")).toHaveAttribute("style", before!);
  await expect(page.locator(".canvas-world")).toHaveAttribute("style", camera!);
  await node(page, "a").click({ modifiers: ["Control"] });
  expect(await ids(page)).toEqual(["b"]);
  await node(page, "b").click({ modifiers: ["Control"] });
  expect(await ids(page)).toEqual([]);
  await node(page, "a").click({ modifiers: ["Control"] });
  await node(page, "c").click({ modifiers: ["Control"] });
  expect(await ids(page)).toEqual(["a", "c"]);
  await marquee(page, 700, 340, 180, 180);
  expect(await ids(page)).toEqual(["a", "b"]);
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  await expect(layer(page, "a")).toHaveAttribute("aria-pressed", "true");
  await expect(layer(page, "b")).toHaveAttribute("aria-pressed", "true");
});
test("Layers Shift+click selects contiguous ranges in both directions, Ctrl deselects, and collapsed descendants are skipped", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  await layer(page, "a").click();
  await layer(page, "c").click({ modifiers: ["Shift"] });
  expect(await ids(page)).toEqual(["a", "b", "c"]);
  await layer(page, "b").click({ modifiers: ["Control"] });
  expect(await ids(page)).toEqual(["a", "c"]);
  await layer(page, "a").click({ modifiers: ["Control"] });
  expect(await ids(page)).toEqual(["c"]);
  await layer(page, "c").click();
  await layer(page, "a").click({ modifiers: ["Shift"] });
  expect(await ids(page)).toEqual(["a", "b", "c"]);
  await layer(page, "b").click({ modifiers: ["Shift"] });
  expect(await ids(page)).toEqual(["b", "c"]);
  await page
    .getByRole("button", { name: "Collapse GROUP", exact: true })
    .click();
  await layer(page, "c").click();
  await layer(page, "group").click({ modifiers: ["Shift"] });
  expect(await ids(page)).toEqual(["c", "group"]);
  await layer(page, "group").click({ modifiers: ["Control"] });
  expect(await ids(page)).toEqual(["c"]);
});
test("moving and deleting a multi-selection is atomic in undo/redo, and Escape cancels the whole move", async ({
  page,
}) => {
  await marquee(page, 180, 180, 700, 340);
  const a = await geometry(page, "a"),
    b = await geometry(page, "b");
  let box = (await node(page, "a").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 40,
    box.y + box.height / 2 + 20,
    { steps: 6 },
  );
  await page.mouse.up();
  const afterA = await geometry(page, "a"),
    afterB = await geometry(page, "b");
  expect(afterA.left - a.left).toBeCloseTo(afterB.left - b.left, 2);
  expect(afterA.left).toBeGreaterThan(a.left);
  expect(afterA.top - a.top).toBeCloseTo(afterB.top - b.top, 2);
  expect(await ids(page)).toEqual(["a", "b"]);
  await page.keyboard.press("Control+z");
  expect(await geometry(page, "a")).toEqual(a);
  expect(await geometry(page, "b")).toEqual(b);
  expect(await ids(page)).toEqual(["a", "b"]);
  await page.keyboard.press("Control+Shift+z");
  expect(await geometry(page, "b")).toEqual(afterB);
  box = (await node(page, "a").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 25,
    box.y + box.height / 2 + 25,
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await geometry(page, "a")).toEqual(afterA);
  expect(await geometry(page, "b")).toEqual(afterB);
  await page.keyboard.press("Delete");
  await expect(node(page, "a")).toHaveCount(0);
  await expect(node(page, "b")).toHaveCount(0);
  await expect(node(page, "c")).toHaveCount(1);
  await page.keyboard.press("Control+z");
  expect(await geometry(page, "a")).toEqual(afterA);
  expect(await ids(page)).toEqual(["a", "b"]);
});
test("parent/child range selections move the parent only, with child-local positions unchanged", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  await layer(page, "group").click();
  await layer(page, "e").click({ modifiers: ["Shift"] });
  expect(await ids(page)).toEqual(["group", "d", "e"]);
  const child = await geometry(page, "d"),
    otherChild = await geometry(page, "e"),
    group = await geometry(page, "group");
  const box = (await node(page, "d").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 25,
    box.y + box.height / 2 + 10,
    { steps: 5 },
  );
  await page.mouse.up();
  expect((await geometry(page, "group")).left).toBeGreaterThan(group.left);
  expect(await geometry(page, "d")).toEqual(child);
  expect(await geometry(page, "e")).toEqual(otherChild);
  await page.keyboard.press("Control+z");
  expect(await geometry(page, "group")).toEqual(group);
});
test("Escape, pointer cancellation and blur restore pre-marquee selection, and Preview cannot change it", async ({
  page,
}) => {
  await node(page, "c").click();
  for (const cancel of ["escape", "pointer", "blur"]) {
    await marquee(page, 180, 180, 700, 340, false);
    expect(await ids(page)).toEqual(["a", "b"]);
    if (cancel === "escape") await page.keyboard.press("Escape");
    else if (cancel === "pointer")
      await canvas(page).dispatchEvent("pointercancel", { pointerId: 1 });
    else await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.mouse.up();
    await page.keyboard.up("Control");
    await expect(page.locator("[data-selection-marquee]")).toHaveCount(0);
    expect(await ids(page)).toEqual(["c"]);
  }
  await marquee(page, 180, 180, 700, 340);
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  await node(page, "a").click({ modifiers: ["Control"] });
  await page.keyboard.press("Delete");
  await expect(node(page, "a")).toHaveCount(1);
  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
  expect(await ids(page)).toEqual(["a", "b"]);
});

test("range selection in the narrow navigation dialog uses only its visible rows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open project navigation", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "layers", exact: true }).click();
  await dialog.locator('[data-layer-id="a"] .layer-name').click();
  await dialog
    .locator('[data-layer-id="c"] .layer-name')
    .click({ modifiers: ["Shift"] });
  expect(await ids(page)).toEqual(["a", "b", "c"]);
  await dialog
    .locator('[data-layer-id="b"] .layer-name')
    .click({ modifiers: ["Control"] });
  expect(await ids(page)).toEqual(["a", "c"]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await ids(page)).toEqual(["a", "c"]);
});
