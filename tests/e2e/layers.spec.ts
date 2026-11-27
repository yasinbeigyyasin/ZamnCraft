import { expect, test, type Locator, type Page } from "@playwright/test";

async function insert(
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
  await page.mouse.click(
    Math.round(rect.x + (x * rect.width) / width),
    Math.round(rect.y + (y * rect.width) / width),
  );
  return parent
    .locator(`:scope > [data-element-type="${type.toLowerCase()}"]`)
    .last();
}

async function setup(page: Page) {
  await page.goto("/");
  const desktop = page.locator('[data-editor-element="desktop"]');
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  const frame = await insert(page, desktop, "Frame", 100, 100);
  const text = await insert(page, frame, "Text", 20, 30);
  const frameId = (await frame.getAttribute("data-editor-element"))!;
  const textId = (await text.getAttribute("data-editor-element"))!;
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  return {
    desktop,
    frame,
    text,
    frameId,
    textId,
    panel: page.getByRole("tabpanel", { name: "layers", exact: true }),
  };
}

function layer(page: Page, id: string) {
  return page.locator(`[data-layer-id="${id}"]`);
}

test("recursive layers indent, show type icons, collapse without hiding canvas content, and share blue selection", async ({
  page,
}) => {
  const { panel, desktop, text, frameId, textId } = await setup(page);
  const rootRow = layer(page, "desktop");
  const frameRow = layer(page, frameId);
  const textRow = layer(page, textId);
  await expect(rootRow).toHaveCSS("padding-left", "4px");
  await expect(frameRow).toHaveCSS("padding-left", "20px");
  await expect(textRow).toHaveCSS("padding-left", "36px");
  await expect(rootRow.locator(".lucide-frame")).toHaveCount(1);
  await expect(textRow.locator(".lucide-type")).toHaveCount(1);
  await expect(
    textRow.getByRole("button", { name: /Collapse|Expand/ }),
  ).toHaveCount(0);
  await expect(textRow).toHaveCSS("background-color", "rgb(0, 153, 255)");
  await panel
    .getByRole("button", { name: "Collapse Frame", exact: true })
    .click();
  await expect(textRow).toBeHidden();
  await expect(text).toBeVisible();
  await expect(text).toHaveAttribute("data-selected", "true");
  await panel
    .getByRole("button", { name: "Expand Frame", exact: true })
    .click();
  await textRow.getByRole("button", { name: "Text", exact: true }).click();
  await expect(text).toHaveAttribute("data-selected", "true");
  await rootRow.getByRole("button", { name: "Desktop", exact: true }).click();
  await expect(desktop).toHaveAttribute("data-selected", "true");
  await expect(textRow).toHaveAttribute("data-selected", "false");
  await text.click();
  await expect(textRow).toHaveAttribute("data-selected", "true");
  await expect(rootRow).toHaveAttribute("data-selected", "false");
});

test("double-click and F2 rename layers, save on Enter or blur, cancel on Escape, and reject blank names", async ({
  page,
}) => {
  const { text, frameId, textId } = await setup(page);
  const row = layer(page, textId);
  await row.getByRole("button", { name: "Text", exact: true }).dblclick();
  const input = row.getByRole("textbox", { name: "Rename Text", exact: true });
  await expect(input).toBeFocused();
  await input.fill("  Heading  ");
  await input.press("Enter");
  const name = row.getByRole("button", { name: "Heading", exact: true });
  await expect(name).toBeFocused();
  await expect(text.locator(".canvas-selection-label")).toContainText(
    "Heading",
  );
  await expect(text.locator(".canvas-text-content")).toHaveText(
    "Double click to edit",
  );
  await name.press("F2");
  await row.getByRole("textbox").fill("Discarded");
  await row.getByRole("textbox").press("Escape");
  await expect(name).toBeVisible();
  await name.dblclick();
  await row.getByRole("textbox").fill("   ");
  await row.getByRole("textbox").press("Enter");
  await expect(name).toBeVisible();
  const frameRow = layer(page, frameId);
  await frameRow.getByRole("button", { name: "Frame", exact: true }).dblclick();
  await frameRow.getByRole("textbox").fill("Hero");
  await page.getByRole("tab", { name: "pages", exact: true }).click();
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  await expect(
    frameRow.getByRole("button", { name: "Hero", exact: true }),
  ).toBeVisible();
  await expect(
    frameRow.getByRole("button", { name: "Collapse Hero", exact: true }),
  ).toBeVisible();
});

test("hover trash deletes a subtree and clears a selected descendant; the last root can be deleted and recreated", async ({
  page,
}) => {
  const { panel, frameId, textId } = await setup(page);
  const row = layer(page, frameId);
  const trash = row.getByRole("button", { name: "Delete Frame", exact: true });
  await page.mouse.move(1400, 850);
  await expect(trash).toHaveCSS("opacity", "0");
  await row.hover();
  await expect(trash).toHaveCSS("opacity", "1");
  await trash.click();
  await expect(panel).toBeFocused();
  await expect(layer(page, frameId)).toHaveCount(0);
  await expect(page.locator(`[data-editor-element="${textId}"]`)).toHaveCount(
    0,
  );
  await expect(page.locator(".canvas-selection-box")).toHaveCount(0);
  await expect(panel.locator(".section-label")).toHaveText("Page layers1");
  await layer(page, "desktop")
    .getByRole("button", { name: "Delete Desktop", exact: true })
    .focus();
  await expect(
    layer(page, "desktop").getByRole("button", {
      name: "Delete Desktop",
      exact: true,
    }),
  ).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(panel.getByText("No layers yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Text (T)", exact: true }).click();
  await page.mouse.click(400, 300);
  await expect(
    panel.getByRole("button", { name: "Text", exact: true }),
  ).toBeVisible();
});

test("Delete and Backspace remove selected layers but ignore editing, composition, modifiers, and dialogs", async ({
  page,
}) => {
  const { desktop, text, frameId, textId } = await setup(page);
  const row = layer(page, textId);
  await row.getByRole("button", { name: "Text", exact: true }).dblclick();
  const input = row.getByRole("textbox");
  await input.fill("Draft");
  await input.press("End");
  await input.press("Backspace");
  await input.press("Delete");
  await expect(input).toHaveValue("Draf");
  await input.press("Escape");
  await text.dblclick();
  const editor = page.getByRole("textbox", {
    name: "Text content",
    exact: true,
  });
  await editor.fill("Test");
  await editor.press("End");
  await editor.press("Backspace");
  await editor.press("Delete");
  await editor.press("Enter");
  await expect(text.locator(".canvas-text-content")).toHaveText("Tes");
  await page.locator("#editor-canvas").focus();
  await page.keyboard.press("Control+Delete");
  await page.keyboard.press("Meta+Backspace");
  await page.evaluate(() => {
    for (const options of [{ isComposing: true }, { repeat: true }, {}]) {
      const event = new KeyboardEvent("keydown", {
        key: "Delete",
        bubbles: true,
        cancelable: true,
        ...options,
      });
      if (!Object.keys(options).length) event.preventDefault();
      window.dispatchEvent(event);
    }
  });
  await expect(text).toBeVisible();
  await page.getByRole("button", { name: "Export Code", exact: true }).click();
  await page.keyboard.press("Delete");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Escape");
  await expect(text).toBeVisible();
  await row.getByRole("button", { name: "Text", exact: true }).click();
  await page.keyboard.press("Delete");
  await expect(layer(page, textId)).toHaveCount(0);
  await expect(page.locator("#editor-canvas")).toBeFocused();
  await layer(page, frameId)
    .getByRole("button", { name: "Frame", exact: true })
    .click();
  await page.keyboard.press("Backspace");
  await expect(layer(page, frameId)).toHaveCount(0);
  await expect(desktop).toBeVisible();
});

test.describe("touch navigation", () => {
  test.use({ hasTouch: true });

  test("narrow navigation dialog supports renaming and touch-visible deletion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Open project navigation", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "layers", exact: true }).click();
    const row = dialog.locator('[data-layer-id="desktop"]');
    await expect(
      row.getByRole("button", { name: "Delete Desktop", exact: true }),
    ).toHaveCSS("opacity", "1");
    await row.getByRole("button", { name: "Desktop", exact: true }).dblclick();
    await row.getByRole("textbox").fill("Mobile page");
    await row.getByRole("textbox").press("Enter");
    await row
      .getByRole("button", { name: "Delete Mobile page", exact: true })
      .click();
    await expect(
      dialog.getByText("No layers yet", { exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-editor-element="desktop"]')).toHaveCount(
      0,
    );
  });
});
