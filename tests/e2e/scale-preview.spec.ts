import { expect, test, type Page, type Locator } from "@playwright/test";
import { choose } from "./control-helpers";
const root = (page: Page) => page.locator('[data-editor-element="desktop"]');
const canvas = (page: Page) =>
  page.getByRole("region", { name: "Design canvas", exact: true });
async function insert(
  page: Page,
  parent: Locator,
  type: "Frame" | "Text",
  x: number,
  y: number,
) {
  await page
    .getByRole("button", {
      name: type === "Frame" ? "Frame (F)" : "Text (T)",
      exact: true,
    })
    .click();
  const box = (await parent.boundingBox())!;
  const width = await parent.evaluate((n) => (n as HTMLElement).offsetWidth);
  await page.mouse.click(
    box.x + (x * box.width) / width,
    box.y + (y * box.width) / width,
  );
  const id = await parent
    .locator(`:scope > [data-element-type="${type.toLowerCase()}"]`)
    .last()
    .getAttribute("data-editor-element");
  return page.locator(`[data-editor-element="${id}"]`);
}
async function select(page: Page, node: Locator) {
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  await page
    .locator(
      `[data-layer-id="${await node.getAttribute("data-editor-element")}"] .layer-name`,
    )
    .click();
  await canvas(page).focus();
}
async function dragScale(
  page: Page,
  node: Locator,
  factor: number,
  handle = "se",
) {
  const box = (await node.boundingBox())!;
  const point = (await node
    .locator(
      `:scope > .canvas-selection-box > [data-resize-handle="${handle}"]`,
    )
    .boundingBox())!;
  const x = point.x + point.width / 2,
    y = point.y + point.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    x + box.width * (factor - 1),
    y + (handle === "e" ? 0 : box.height * (factor - 1)),
    { steps: 6 },
  );
}

async function near(node: Locator, property: string, value: number) {
  await expect
    .poll(() =>
      node.evaluate(
        (n, p) => parseFloat(getComputedStyle(n).getPropertyValue(p)),
        property,
      ),
    )
    .toBeCloseTo(value, 0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("Scale is beside Select; K uniformly scales contents, undo/redo and Escape restore the tree, and reload preserves edits", async ({
  page,
}) => {
  const tools = page.getByRole("navigation", { name: "Editor tools" });
  await expect(tools.getByRole("button").nth(1)).toHaveAccessibleName(
    "Scale (K)",
  );
  const frame = await insert(page, root(page), "Frame", 300, 250);
  const text = await insert(page, frame, "Text", 20, 50);
  for (const [name, value] of [
    ["X", "20"],
    ["Y", "50"],
  ]) {
    const input = page
      .getByRole("complementary", { name: "Inspector", exact: true })
      .getByRole("spinbutton", { name, exact: true });
    await input.fill(value);
    await input.blur();
  }
  const frameId = await frame.getAttribute("data-editor-element");
  await select(page, frame);
  await page.keyboard.press("k");
  await expect(
    page.getByRole("button", { name: "Scale (K)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dragScale(page, frame, 2);
  await page.mouse.up();
  await near(frame, "width", 400);
  await near(frame, "height", 400);
  await near(text, "font-size", 32);
  await near(text, "left", 40);
  await near(text, "top", 100);
  await canvas(page).focus();
  await page.keyboard.press("Control+z");
  await near(frame, "width", 200);
  await near(text, "font-size", 16);
  await page.keyboard.press("Control+Shift+z");
  await near(text, "font-size", 32);
  await page.keyboard.press("k");
  await dragScale(page, frame, 0.5, "e");
  await near(frame, "width", 200);
  await near(frame, "height", 200);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await near(frame, "width", 400);
  await near(text, "font-size", 32);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("zamncraft.workspace.v1")),
    )
    .toMatch(/"width":(?:399\.|400)/);
  await page.reload();
  await near(page.locator(`[data-editor-element="${frameId}"]`), "width", 400);
  await near(text, "font-size", 32);
  await select(page, text);
  await page.keyboard.press("k");
  await text.dblclick();
  await expect(
    page.getByRole("textbox", { name: "Text content on canvas" }),
  ).toHaveCount(0);
  await page.keyboard.press("v");
  await text.dblclick();
  await expect(
    page.getByRole("textbox", { name: "Text content on canvas" }),
  ).toBeFocused();
});

test("Preview frame picker includes custom desktop sizes and renders only the chosen frame, including after reload", async ({
  page,
}) => {
  await expect(root(page)).toHaveCSS("width", "1920px");
  await expect(root(page)).toHaveCSS("height", "1080px");
  await page.getByRole("button", { name: "Text (T)", exact: true }).click();
  await page.mouse.click(280, 80);
  await page.getByRole("button", { name: "New desktop", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New desktop", exact: true });
  await dialog
    .getByRole("spinbutton", { name: "Desktop width", exact: true })
    .fill("1366");
  await dialog
    .getByRole("spinbutton", { name: "Desktop height", exact: true })
    .fill("768");
  await dialog
    .getByRole("button", { name: "Create desktop", exact: true })
    .click();
  const custom = page.locator(
    '[data-editor-element][aria-label="Desktop 1366 × 768"]',
  );
  const customId = await custom.getAttribute("data-editor-element");
  const camera = await page.locator(".canvas-world").getAttribute("style");
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  await expect(custom).toBeVisible();
  await expect(root(page)).toHaveCount(0);
  await expect(page.locator('[data-element-type="text"]')).toHaveCount(0);
  const picker = page.getByRole("combobox", {
    name: "Preview frame",
    exact: true,
  });
  await choose(picker, "desktop");
  await expect(root(page)).toBeVisible();
  await expect(custom).toHaveCount(0);
  await choose(picker, customId!);
  await expect(custom).toBeVisible();
  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
  await expect(page.locator(".canvas-world")).toHaveAttribute("style", camera!);
  await expect(root(page)).toHaveCSS("width", "1920px");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("zamncraft.workspace.v1")),
    )
    .toContain("Desktop 1366 × 768");
  await page.reload();
  await expect(custom).toBeVisible();
  await select(page, custom);
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  await expect(custom).toBeVisible();
  await expect(root(page)).toHaveCount(0);
  await choose(
    page.getByRole("combobox", { name: "Preview frame", exact: true }),
    "desktop",
  );
  await expect(root(page)).toBeVisible();
});

test("the extra Scale tool keeps all toolbar actions inside small screens", async ({
  page,
}) => {
  for (const width of [320, 375, 390, 400, 480, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await page
      .locator(".top-bar button:visible")
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            name: node.getAttribute("aria-label"),
            left: rect.left,
            right: rect.right,
          };
        }),
      );
    for (const rect of bounds) {
      expect(rect.left, String(rect.name)).toBeGreaterThanOrEqual(0);
      expect(rect.right, String(rect.name)).toBeLessThanOrEqual(width);
    }
    await expect(
      page.getByRole("button", { name: "Scale (K)", exact: true }),
    ).toBeVisible();
  }
});
