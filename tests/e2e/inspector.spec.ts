import { choose, expectChoice } from "./control-helpers";
import { expect, test, type Page, type Locator } from "@playwright/test";

const rootSelector = '[data-editor-element="desktop"]';
const inspector = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector", exact: true });
const field = (page: Page, name: string) =>
  inspector(page).getByRole("spinbutton", { name, exact: true });

async function insert(
  page: Page,
  parent: Locator,
  type: "Frame" | "Text",
  x = 100,
  y = 100,
) {
  await page
    .getByRole("button", {
      name: `${type} (${type === "Frame" ? "F" : "T"})`,
      exact: true,
    })
    .click();
  const bounds = (await parent.boundingBox())!;
  const width = await parent.evaluate(
    (node) => (node as HTMLElement).offsetWidth,
  );
  await page.mouse.click(
    Math.round(bounds.x + (x * bounds.width) / width),
    Math.round(bounds.y + (y * bounds.width) / width),
  );
  return parent
    .locator(`:scope > [data-element-type="${type.toLowerCase()}"]`)
    .last();
}

async function selectLayer(page: Page, node: Locator) {
  const id = await node.getAttribute("data-editor-element");
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  await page.locator(`[data-layer-id="${id}"] .layer-name`).click();
}

async function setNumber(page: Page, name: string, value: number) {
  await field(page, name).fill(String(value));
  await field(page, name).blur();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("selection enables properties, position and size move the canvas, and switching selection reads the right values", async ({
  page,
}) => {
  await expect(field(page, "Width")).toHaveCount(0);
  const root = page.locator(rootSelector);
  await root.click({ position: { x: 10, y: 10 } });
  await expect(field(page, "Width")).toBeEnabled();
  await expect(field(page, "Width")).toHaveValue("1920");
  const frame = await insert(page, root, "Frame");
  await setNumber(page, "X", -20.5);
  await setNumber(page, "Y", 45);
  await setNumber(page, "Width", 320);
  await setNumber(page, "Height", 150);
  await expect(frame).toHaveCSS("left", "-20.5px");
  await expect(frame).toHaveCSS("top", "45px");
  await expect(frame).toHaveCSS("width", "320px");
  await expect(frame).toHaveCSS("height", "150px");
  await expect(frame.locator(".canvas-selection-label")).toHaveText(
    "Frame320 × 150",
  );
  const rootBox = (await root.boundingBox())!;
  const box = (await frame.boundingBox())!;
  expect(box.x).toBeCloseTo(rootBox.x - (20.5 * rootBox.width) / 1920, 1);
  await choose(
    inspector(page).getByRole("group", { name: "Position type", exact: true }),
    "relative",
  );
  await expect(frame).toHaveCSS("position", "relative");
  await field(page, "Width").fill("-5");
  await field(page, "Width").blur();
  await expect(field(page, "Width")).toHaveValue("320");
  await field(page, "Y").fill("");
  await selectLayer(page, root);
  await expect(field(page, "Y")).toHaveValue("0");
  await selectLayer(page, frame);
  await expect(field(page, "Y")).toHaveValue("45");
  await expect(field(page, "Width")).toHaveValue("320");
  await page.mouse.click(270, 100);
  await expect(field(page, "Width")).toHaveCount(0);
});

test("Fixed, Fill and Fit sizing update real geometry and the inspector reports measured sizes", async ({
  page,
}) => {
  const root = page.locator(rootSelector);
  const frame = await insert(page, root, "Frame", 0, 0);
  const widthMode = inspector(page).getByRole("group", {
    name: "Width sizing",
    exact: true,
  });
  const heightMode = inspector(page).getByRole("group", {
    name: "Height sizing",
    exact: true,
  });
  await choose(widthMode, "fill");
  await choose(heightMode, "fill");
  await expect(frame).toHaveCSS("width", "1920px");
  await expect(frame).toHaveCSS("height", "1080px");
  await expect(field(page, "Width")).toHaveValue("1920");
  await choose(widthMode, "fixed");
  await expect(field(page, "Width")).toHaveValue("1920");
  await setNumber(page, "Width", 400);
  await setNumber(page, "Height", 250);
  await choose(widthMode, "fill");
  await setNumber(page, "Width", 400);
  await expectChoice(widthMode, "fixed");
  const text = await insert(page, frame, "Text", 20, 20);
  await choose(widthMode, "fit");
  await choose(heightMode, "fit");
  expect(
    await text.evaluate((node) => (node as HTMLElement).offsetWidth),
  ).toBeLessThan(200);
  await expectChoice(heightMode, "fit");
  await inspector(page)
    .getByRole("textbox", { name: "Text content", exact: true })
    .fill("Fit");
  const measured = await text.evaluate(
    (node) => (node as HTMLElement).offsetWidth,
  );
  await expect(field(page, "Width")).toHaveValue(String(measured));
  await choose(widthMode, "fixed");
  await inspector(page)
    .getByRole("textbox", { name: "Text content", exact: true })
    .fill("A much longer sentence");
  await expect(text).toHaveCSS("width", `${measured}px`);
  await selectLayer(page, root);
  await setNumber(page, "X", -50);
  await expect(root.locator("..")).toHaveCSS("left", "-50px");
  await choose(widthMode, "fill");
  await expect(root).toHaveCSS("width", "1920px");
});

test("fill, custom color picker, opacity, radius and border are live and invalid drafts do not corrupt styles", async ({
  page,
}) => {
  const frame = await insert(page, page.locator(rootSelector), "Frame");
  const panel = inspector(page);
  const hex = panel.getByRole("textbox", { name: "Fill hex", exact: true });
  await hex.fill("#336699");
  await hex.blur();
  await expect(frame).toHaveCSS("background-color", "rgb(51, 102, 153)");
  await hex.fill("not a color");
  await hex.blur();
  await expect(hex).toHaveValue("#336699");
  await panel
    .getByRole("button", { name: "Fill color picker", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Fill color", exact: true })
    .getByRole("button", { name: "Use #ff8800", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(hex).toHaveValue("#ff8800");
  await expect(frame).toHaveCSS("background-color", "rgb(255, 136, 0)");
  await setNumber(page, "Opacity", 55.5);
  await expect(frame).toHaveCSS("opacity", "0.555");
  await expect(field(page, "Opacity")).toHaveValue("55.5");
  await setNumber(page, "Radius", 16);
  await expect(frame).toHaveCSS("border-radius", "16px");
  await panel.getByRole("button", { name: "Add border", exact: true }).click();
  await choose(
    panel.getByRole("combobox", { name: "Border", exact: true }),
    "dashed",
  );
  await setNumber(page, "Border width", 3);
  await panel
    .getByRole("textbox", { name: "Border color hex", exact: true })
    .fill("#112233");
  await expect(frame).toHaveCSS("border-top-width", "3px");
  await expect(frame).toHaveCSS("border-top-style", "dashed");
  await expect(frame).toHaveCSS("border-top-color", "rgb(17, 34, 51)");
  await panel.getByRole("button", { name: "Remove fill", exact: true }).click();
  await expect(frame).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("Stack and Grid arrange existing children with direction, gap, padding, alignment and restore Free offsets", async ({
  page,
}) => {
  const parent = await insert(
    page,
    page.locator(rootSelector),
    "Frame",
    50,
    50,
  );
  await setNumber(page, "Width", 600);
  await setNumber(page, "Height", 450);
  const first = await insert(page, parent, "Frame", 10, 10);
  const firstId = await first.getAttribute("data-editor-element");
  const firstNode = page.locator(`[data-editor-element="${firstId}"]`);
  const second = await insert(page, parent, "Frame", 250, 10);
  const oldLeft = await firstNode.evaluate(
    (node) => (node as HTMLElement).style.left,
  );
  await selectLayer(page, parent);
  const panel = inspector(page);
  await panel.getByRole("button", { name: "Stack", exact: true }).click();
  await expect(parent).toHaveCSS("display", "flex");
  await expect(firstNode).toHaveCSS("position", "relative");
  await setNumber(page, "Gap", 16);
  await setNumber(page, "Padding", 20);
  await expect(parent).toHaveCSS("gap", "16px");
  const verticalFirst = (await firstNode.boundingBox())!;
  const verticalSecond = (await second.boundingBox())!;
  expect(verticalSecond.y).toBeGreaterThan(
    verticalFirst.y + verticalFirst.height,
  );
  await choose(
    panel.getByRole("group", { name: "Direction", exact: true }),
    "row",
  );
  const horizontalFirst = (await firstNode.boundingBox())!;
  const horizontalSecond = (await second.boundingBox())!;
  expect(horizontalSecond.x).toBeGreaterThan(
    horizontalFirst.x + horizontalFirst.width,
  );
  expect(horizontalSecond.y).toBeCloseTo(horizontalFirst.y, 1);
  await selectLayer(page, second);
  await choose(
    panel.getByRole("group", { name: "Width sizing", exact: true }),
    "fill",
  );
  await expect(second).toHaveCSS("width", "344px");
  await expect(field(page, "Width")).toHaveValue("344");
  await setNumber(page, "Width", 200);
  await selectLayer(page, parent);
  await panel.getByRole("button", { name: "Main center", exact: true }).click();
  await panel
    .getByRole("button", { name: "Cross center", exact: true })
    .click();
  await expect(parent).toHaveCSS("justify-content", "center");
  await expect(parent).toHaveCSS("align-items", "center");
  await panel.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(parent).toHaveCSS("display", "grid");
  await setNumber(page, "Columns", 1);
  const gridFirst = (await firstNode.boundingBox())!;
  const gridSecond = (await second.boundingBox())!;
  expect(gridSecond.y).toBeGreaterThan(gridFirst.y);
  await panel.getByRole("button", { name: "Free", exact: true }).click();
  await expect(parent).toHaveCSS("display", "block");
  await expect(firstNode).toHaveCSS("position", "absolute");
  await expect(firstNode).toHaveCSS("left", oldLeft);
});

test("Typography edits content and styles live; inline editing updates the Inspector without shortcuts deleting text", async ({
  page,
}) => {
  const text = await insert(page, page.locator(rootSelector), "Text");
  const panel = inspector(page);
  const content = panel.getByRole("textbox", {
    name: "Text content",
    exact: true,
  });
  await content.fill("Inspector text\nSecond line");
  await expect(text.locator(".canvas-text-content")).toHaveText(
    "Inspector text\nSecond line",
  );
  await content.press("End");
  await content.pressSequentially(" vft");
  await content.press("Backspace");
  await content.press("Delete");
  await expect(text).toHaveAttribute("data-selected", "true");
  await setNumber(page, "Font size", 28);
  await choose(
    panel.getByRole("combobox", { name: "Weight", exact: true }),
    "700",
  );
  await panel
    .getByRole("textbox", { name: "Text color hex", exact: true })
    .fill("#aabbcc");
  await choose(
    panel.getByRole("group", { name: "Text alignment", exact: true }),
    "center",
  );
  await expect(text).toHaveCSS("font-size", "28px");
  await expect(text).toHaveCSS("font-weight", "700");
  await expect(text).toHaveCSS("color", "rgb(170, 187, 204)");
  await expect(text).toHaveCSS("text-align", "center");
  expect(
    await panel
      .locator(".inspector-field > span")
      .evaluateAll((nodes) =>
        nodes.every((node) => node.getBoundingClientRect().height <= 16),
      ),
  ).toBe(true);
  await text.dblclick();
  const inline = page.getByRole("textbox", {
    name: "Text content on canvas",
    exact: true,
  });
  await inline.fill("Saved inline");
  await inline.press("Enter");
  await expect(content).toHaveValue("Saved inline");
  await content.fill('<img src="x" onerror="alert(1)">');
  await expect(text.locator("img")).toHaveCount(0);
  await expect(text.locator(".canvas-text-content")).toHaveText(
    '<img src="x" onerror="alert(1)">',
  );
  await content.fill("");
  await expect(text.locator(".canvas-text-content")).toHaveText("");
});

test("mobile inspector dialog edits the selected element and keeps property inputs within the panel", async ({
  page,
}) => {
  const root = page.locator(rootSelector);
  await root.click({ position: { x: 10, y: 10 } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open inspector", exact: true })
    .click();
  const panel = page.getByRole("dialog", {
    name: "Inspector properties",
    exact: true,
  });
  await panel
    .getByRole("spinbutton", { name: "Width", exact: true })
    .fill("900");
  await panel.getByRole("spinbutton", { name: "Width", exact: true }).blur();
  await expect(root).toHaveCSS("width", "900px");
  await panel
    .getByRole("textbox", { name: "Fill hex", exact: true })
    .fill("#334455");
  await expect(root).toHaveCSS("background-color", "rgb(51, 68, 85)");
  expect(
    await panel.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(root).toHaveAttribute("data-selected", "true");
});
