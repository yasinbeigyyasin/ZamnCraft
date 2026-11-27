import { expect, test, type Locator, type Page } from "@playwright/test";

const desktopSelector = '[data-editor-element="desktop"]';

async function addInside(
  page: Page,
  parent: Locator,
  type: "Frame" | "Text",
  x: number,
  y: number,
) {
  await page
    .getByRole("button", {
      name: `${type} (${type === "Frame" ? "F" : "T"})`,
      exact: true,
    })
    .click();
  const rect = (await parent.boundingBox())!;
  const width = await parent.evaluate(
    (node) => (node as HTMLElement).offsetWidth,
  );
  const scale = rect.width / width;
  const pointer = {
    x: Math.round(rect.x + x * scale),
    y: Math.round(rect.y + y * scale),
  };
  await page.mouse.click(pointer.x, pointer.y);
  const child = parent
    .locator(`:scope > [data-element-type="${type.toLowerCase()}"]`)
    .last();
  await expect(child).toBeVisible();
  return { child, pointer };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("Frame insertion uses zoom-correct parent coordinates and selects the new 200 × 200 frame", async ({
  page,
}) => {
  const desktop = page.locator(desktopSelector);
  const { child, pointer } = await addInside(page, desktop, "Frame", 100, 100);
  await expect(child).toHaveCSS("width", "200px");
  await expect(child).toHaveCSS("height", "200px");
  await expect(child).toHaveCSS("background-color", "rgb(229, 229, 229)");
  await expect(child).toHaveAttribute("data-selected", "true");
  await expect(desktop).toHaveAttribute("data-selected", "false");
  await expect(
    page.getByRole("button", { name: "Move (V)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const box = (await child.boundingBox())!;
  expect(box.x).toBeCloseTo(pointer.x, 1);
  expect(box.y).toBeCloseTo(pointer.y, 1);
  await expect(child.locator(".canvas-selection-label")).toHaveText(
    "Frame200 × 200",
  );
  await expect(page.locator(".canvas-selection-box")).toHaveCount(1);
});

test("nested children render recursively and selection never bubbles to parent frames", async ({
  page,
}) => {
  const desktop = page.locator(desktopSelector);
  const { child: frame } = await addInside(page, desktop, "Frame", 90, 100);
  const { child: nested } = await addInside(page, frame, "Frame", 20, 30);
  const nestedId = await nested.getAttribute("data-editor-element");
  await frame.click({ position: { x: 3, y: 3 } });
  await expect(frame).toHaveAttribute("data-selected", "true");
  await nested.click({ position: { x: 10, y: 10 } });
  await expect(nested).toHaveAttribute("data-selected", "true");
  await expect(frame).toHaveAttribute("data-selected", "false");
  await expect(desktop).toHaveAttribute("data-selected", "false");
  await expect(page.locator(".canvas-selection-box")).toHaveCount(1);
  await expect(
    page.locator("[data-editor-element][data-selected='true']"),
  ).toHaveAttribute("data-editor-element", nestedId!);
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "layers" }).locator(".section-label"),
  ).toHaveText("Page layers3");
});

test("selection border and label stay screen-sized at different zoom levels", async ({
  page,
}) => {
  const { child } = await addInside(
    page,
    page.locator(desktopSelector),
    "Frame",
    100,
    100,
  );
  const label = child.locator(".canvas-selection-label");
  const initialHeight = (await label.boundingBox())!.height;
  for (let i = 0; i < 4; i++) {
    const frame = (await child.boundingBox())!;
    const outline = (await child
      .locator(".canvas-selection-box")
      .boundingBox())!;
    expect(outline.width).toBeCloseTo(frame.width, 1);
    expect(outline.height).toBeCloseTo(frame.height, 1);
    await expect(child.locator(".canvas-selection-box")).toHaveCSS(
      "border-left-width",
      "2px",
    );
    await expect(child.locator(".canvas-selection-box")).toHaveCSS(
      "border-left-color",
      "rgb(0, 153, 255)",
    );
    expect((await label.boundingBox())!.height).toBeCloseTo(initialHeight, 1);
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  }
});

test("Text inserts into the innermost frame, edits inline, saves, and cancels", async ({
  page,
}) => {
  const { child: frame } = await addInside(
    page,
    page.locator(desktopSelector),
    "Frame",
    120,
    100,
  );
  const { child: text } = await addInside(page, frame, "Text", 15, 20);
  await expect(text.locator(".canvas-text-content")).toHaveText(
    "Double click to edit",
  );
  await text.dblclick();
  const editor = page.getByRole("textbox", {
    name: "Text content on canvas",
    exact: true,
  });
  await expect(editor).toBeFocused();
  await editor.fill("A working editor");
  await editor.press("Enter");
  await expect(editor).toHaveCount(0);
  await expect(text.locator(".canvas-text-content")).toHaveText(
    "A working editor",
  );
  await text.dblclick();
  await editor.fill("Discard this draft");
  await editor.press("Escape");
  await expect(text.locator(".canvas-text-content")).toHaveText(
    "A working editor",
  );
  await text.dblclick();
  await editor.fill("Saved by blur");
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  await expect(text.locator(".canvas-text-content")).toHaveText(
    "Saved by blur",
  );
  await expect(
    page.getByRole("button", { name: "Text", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(frame).toHaveAttribute("data-selected", "false");
  await expect(text).toHaveAttribute("data-selected", "true");
});

test("editing accepts shortcuts and multiline text without activating tools or panning", async ({
  page,
}) => {
  const { child: text } = await addInside(
    page,
    page.locator(desktopSelector),
    "Text",
    100,
    120,
  );
  await text.dblclick();
  const editor = page.getByRole("textbox", {
    name: "Text content on canvas",
    exact: true,
  });
  await editor.fill("Draft");
  await editor.press("End");
  await editor.pressSequentially(" vft");
  await editor.press("Space");
  await editor.press("Shift+Enter");
  await editor.pressSequentially("Second line");
  const before = await text.boundingBox();
  await editor.press("Enter");
  await expect(text.locator(".canvas-text-content")).toContainText(
    "Second line",
  );
  await expect(
    page.getByRole("button", { name: "Move (V)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const after = (await text.boundingBox())!;
  expect(after.x).toBeCloseTo(before!.x, 2);
  expect(after.y).toBeCloseTo(before!.y, 2);
  await text.dblclick();
  await editor.fill("");
  await editor.press("Enter");
  await expect(text.locator(".canvas-text-content")).toHaveText("");
  expect((await text.boundingBox())!.height).toBeGreaterThan(0);
});

test("pasted markup is stored and rendered as plain text", async ({ page }) => {
  const { child: text } = await addInside(
    page,
    page.locator(desktopSelector),
    "Text",
    100,
    100,
  );
  await text.dblclick();
  const editor = page.getByRole("textbox", {
    name: "Text content on canvas",
    exact: true,
  });
  await editor.evaluate((node) => {
    const data = new DataTransfer();
    data.setData(
      "text/html",
      '<img src="invalid" onerror="window.injected = true">',
    );
    data.setData("text/plain", '<img src="invalid">');
    node.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await editor.press("Enter");
  await expect(text.locator(".canvas-text-content")).toHaveText(
    '<img src="invalid">',
  );
  await expect(text.locator("img")).toHaveCount(0);
  await text.dblclick();
  await editor.fill("Uncommitted");
  await editor.press("Escape");
  await expect(text.locator(".canvas-text-content")).toHaveText(
    '<img src="invalid">',
  );
});

test("Space drag after choosing an insertion tool pans without adding a child", async ({
  page,
}) => {
  const desktop = page.locator(desktopSelector);
  await page.getByRole("button", { name: "Frame (F)", exact: true }).click();
  const box = (await desktop.boundingBox())!;
  await page.keyboard.down("Space");
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 140, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect(page.locator("[data-editor-element]")).toHaveCount(1);
  expect((await desktop.boundingBox())!.x - box.x).toBeCloseTo(60, 2);
  await expect(
    page.getByRole("button", { name: "Frame (F)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("clicking Text with a drawing tool targets its parent frame, not the text node", async ({
  page,
}) => {
  const desktop = page.locator(desktopSelector);
  const { child: text } = await addInside(page, desktop, "Text", 100, 100);
  await page.getByRole("button", { name: "Frame (F)", exact: true }).click();
  await text.click({ position: { x: 10, y: 5 } });
  await expect(
    desktop.locator(':scope > [data-element-type="frame"]'),
  ).toHaveCount(1);
  await expect(text.locator('[data-element-type="frame"]')).toHaveCount(0);
});

test("blank-canvas text and frames insert at the pointer after pan and zoom, including negative world positions", async ({
  page,
}) => {
  const canvas = page.getByRole("region", {
    name: "Design canvas",
    exact: true,
  });
  const viewport = (await canvas.boundingBox())!;
  const pointer = {
    x: Math.round(viewport.x + 18),
    y: Math.round(viewport.y + 55),
  };
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await canvas.focus();
  await page.keyboard.down("Space");
  await page.mouse.move(pointer.x + 100, pointer.y + 50);
  await page.mouse.down();
  await page.mouse.move(pointer.x + 500, pointer.y + 300);
  await page.mouse.up();
  await page.keyboard.up("Space");
  await page.getByRole("button", { name: "Text (T)", exact: true }).click();
  await page.mouse.click(pointer.x, pointer.y);
  const text = page.locator(
    '.canvas-world > .canvas-root > [data-element-type="text"]',
  );
  await expect(text).toBeVisible();
  await expect(text).toHaveCSS("color", "rgb(255, 255, 255)");
  const box = (await text.boundingBox())!;
  expect(box.x).toBeCloseTo(pointer.x, 1);
  expect(box.y).toBeCloseTo(pointer.y, 1);
  const worldPosition = await text.evaluate((node) => ({
    x: parseFloat((node.parentElement as HTMLElement).style.left),
    y: parseFloat((node.parentElement as HTMLElement).style.top),
  }));
  expect(worldPosition.x).toBeLessThan(0);
  expect(worldPosition.y).toBeLessThan(0);
  await text.dblclick();
  const editor = page.getByRole("textbox", {
    name: "Text content on canvas",
    exact: true,
  });
  await editor.fill("Outside text works");
  await editor.press("Enter");
  await expect(text.locator(".canvas-text-content")).toHaveText(
    "Outside text works",
  );
  await page.getByRole("button", { name: "Frame (F)", exact: true }).click();
  await page.mouse.click(pointer.x, pointer.y + 55);
  const frame = page
    .locator('.canvas-world > .canvas-artboard > [data-element-type="frame"]')
    .last();
  await expect(frame).toHaveAttribute("data-selected", "true");
  const frameBox = (await frame.boundingBox())!;
  expect(frameBox.x).toBeCloseTo(pointer.x, 1);
  expect(frameBox.y).toBeCloseTo(pointer.y + 55, 1);
  await expect(frame).toHaveCSS("width", "200px");
  await addInside(page, frame, "Text", 15, 20);
  await expect(
    frame.locator(':scope > [data-element-type="text"]'),
  ).toHaveCount(1);
  await expect(
    page.locator(`${desktopSelector} > [data-editor-element]`),
  ).toHaveCount(0);
});
