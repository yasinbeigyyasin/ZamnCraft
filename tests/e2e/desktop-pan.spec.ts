import { expect, test, type Page } from "@playwright/test";
const canvas = (page: Page) =>
  page.getByRole("region", { name: "Design canvas", exact: true });
const root = (page: Page) => page.locator('[data-editor-element="desktop"]');
async function matrix(page: Page) {
  return page.locator(".canvas-world").evaluate((node) => {
    const m = new DOMMatrix(getComputedStyle(node).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("new desktop presets and custom dimensions create independent, persistent artboards and undo once", async ({
  page,
}) => {
  const original = await root(page).getAttribute("style");
  await page.getByRole("button", { name: "New desktop", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "New desktop", exact: true });
  await dialog
    .getByRole("button", { name: "Full HD 1920 by 1080", exact: true })
    .click();
  await expect(
    dialog.getByRole("spinbutton", { name: "Desktop width", exact: true }),
  ).toHaveValue("1920");
  await dialog
    .getByRole("button", { name: "Create desktop", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const first = page.locator(
    '[data-element-type="frame"][aria-label="Desktop 1920 × 1080"]',
  );
  await expect(first).toHaveCSS("width", "1920px");
  await expect(first).toHaveCSS("height", "1080px");
  await expect(first).toHaveAttribute("data-selected", "true");
  await expect(root(page)).toHaveAttribute("style", original!);
  await page.getByRole("button", { name: "New desktop", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "New desktop", exact: true });
  const width = dialog.getByRole("spinbutton", {
    name: "Desktop width",
    exact: true,
  });
  await width.fill("1500");
  await width.press("Escape");
  await expect(width).toHaveValue("1440");
  await expect(dialog).toBeVisible();
  await width.fill("1366.5");
  await width.blur();
  await expect(
    dialog.getByRole("button", { name: "Create desktop", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("whole-pixel");
  await width.fill("1366");
  await width.blur();
  await dialog
    .getByRole("spinbutton", { name: "Desktop height", exact: true })
    .fill("768");
  await dialog
    .getByRole("button", { name: "Create desktop", exact: true })
    .click();
  const second = page.locator(
    '[data-element-type="frame"][aria-label="Desktop 1366 × 768"]',
  );
  await expect(second).toHaveCSS("width", "1366px");
  await expect(second).toHaveCSS("height", "768px");
  await canvas(page).focus();
  await page.keyboard.press("Control+z");
  await expect(second).toHaveCount(0);
  await expect(first).toHaveCount(1);
  await page.keyboard.press("Control+Shift+z");
  await expect(second).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("zamncraft.workspace.v1")),
    )
    .toContain("Desktop 1366 × 768");
  await page.reload();
  await expect(first).toHaveCount(1);
  await expect(second).toHaveCSS("height", "768px");
});

test("scroll, trackpad, Shift-scroll and arrows roam without changing zoom or layer geometry", async ({
  page,
}) => {
  await root(page).click();
  const style = await root(page).getAttribute("style");
  let before = await matrix(page);
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 180);
  await page.mouse.wheel(80, 120);
  await expect
    .poll(async () => (await matrix(page)).x)
    .toBeCloseTo(before.x - 80, 2);
  let after = await matrix(page);
  expect(after.y).toBeCloseTo(before.y - 120, 2);
  expect(after.zoom).toBe(before.zoom);
  before = after;
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 90);
  await page.keyboard.up("Shift");
  await expect
    .poll(async () => (await matrix(page)).x)
    .toBeCloseTo(before.x - 90, 2);
  after = await matrix(page);
  expect(after.y).toBeCloseTo(before.y, 2);
  await canvas(page).focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await matrix(page)).x)
    .toBeCloseTo(after.x - 40, 2);
  await page.keyboard.press("Shift+ArrowDown");
  await expect
    .poll(async () => (await matrix(page)).y)
    .toBeCloseTo(after.y - 160, 2);
  expect((await matrix(page)).zoom).toBe(before.zoom);
  await expect(root(page)).toHaveAttribute("style", style!);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Reset canvas view", exact: true })
    .click();
  await expect(root(page)).toBeInViewport();
});

test("empty-canvas drag pans in Select mode while a click deselects; Hand toggle pans over frames", async ({
  page,
}) => {
  await root(page).click();
  let before = await matrix(page);
  const style = await root(page).getAttribute("style");
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 130);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 180);
  const duringDrag = await matrix(page);
  await page.keyboard.press("ArrowRight");
  expect(await matrix(page)).toEqual(duringDrag);
  await page.mouse.up();
  let after = await matrix(page);
  expect(after.x - before.x).toBeCloseTo(120, 2);
  expect(after.y - before.y).toBeCloseTo(50, 2);
  expect(after.zoom).toBe(before.zoom);
  await expect(root(page)).toHaveAttribute("style", style!);
  await expect(root(page)).toHaveAttribute("data-selected", "true");
  await canvas(page).click({ position: { x: 20, y: 130 } });
  await expect(root(page)).toHaveAttribute("data-selected", "false");
  const hand = page.getByRole("button", {
    name: "Pan canvas (H)",
    exact: true,
  });
  await hand.click();
  await expect(hand).toHaveAttribute("aria-pressed", "true");
  before = await matrix(page);
  const frame = (await root(page).boundingBox())!;
  await page.mouse.move(frame.x + 30, frame.y + 30);
  await page.mouse.down();
  await page.mouse.move(frame.x + 80, frame.y + 60);
  await page.mouse.up();
  after = await matrix(page);
  expect(after.x - before.x).toBeCloseTo(50, 2);
  expect(after.y - before.y).toBeCloseTo(30, 2);
  await expect(root(page)).toHaveAttribute("style", style!);
  await hand.click();
  await expect(hand).toHaveAttribute("aria-pressed", "false");
});

test("new desktop dialog works on narrow screens, blocks camera shortcuts and restores focus on cancel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const trigger = page.getByRole("button", {
    name: "New desktop",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "New desktop", exact: true });
  await expect(dialog).toBeVisible();
  const before = await matrix(page);
  await page.keyboard.press("f");
  await page.keyboard.press("ArrowRight");
  expect(await matrix(page)).toEqual(before);
  await expect(
    page.getByRole("button", { name: "Select (V)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('[data-element-type="frame"]')).toHaveCount(1);
});

test.describe("touch roaming", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("a finger drag on empty canvas pans without changing zoom or elements", async ({
    page,
  }) => {
    const before = await matrix(page);
    const style = await root(page).getAttribute("style");
    const bounds = (await canvas(page).boundingBox())!;
    const x = Math.round(bounds.x + 20),
      y = Math.round(bounds.y + 150);
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 60, y: y + 40 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const after = await matrix(page);
    expect(after.x - before.x).toBeCloseTo(60, 1);
    expect(after.y - before.y).toBeCloseTo(40, 1);
    expect(after.zoom).toBe(before.zoom);
    await expect(root(page)).toHaveAttribute("style", style!);
    await session.detach();
  });
});
