import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await expect(
    page.getByRole("button", { name: "Select (V)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("desktop keeps the specified panel dimensions and theme", async ({
  page,
}) => {
  await expect(page.locator(".top-bar")).toHaveCSS("height", "48px");
  await expect(
    page.getByRole("complementary", { name: "Project navigation" }),
  ).toHaveCSS("width", "256px");
  await expect(
    page.getByRole("complementary", { name: "Inspector", exact: true }),
  ).toHaveCSS("width", "288px");
  await expect(page.locator(".top-bar")).toHaveCSS(
    "background-color",
    "rgb(17, 17, 17)",
  );
  await expect(page.getByRole("region", { name: "Design canvas" })).toHaveCSS(
    "background-color",
    "rgb(10, 10, 10)",
  );
  const desktop = page.locator('[data-editor-element="desktop"]');
  await expect(desktop).toHaveCSS("width", "1200px");
  await expect(desktop).toHaveCSS("height", "800px");
  await expect(desktop).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(
    page.getByRole("button", { name: "About ZamnCraft" }),
  ).toBeVisible();
  await expect(page.locator(".page-row")).toHaveCSS(
    "background-color",
    "rgb(20, 36, 50)",
  );
  await expect(page.locator(".export-button")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
});

test("tool shortcuts ignore composition, handled events, modifiers, and text fields", async ({
  page,
}) => {
  const frame = page.getByRole("button", { name: "Frame (F)", exact: true });
  await page.keyboard.press("f");
  await expect(frame).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    for (const options of [
      { isComposing: true },
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { repeat: true },
    ]) {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "t", bubbles: true, ...options }),
      );
    }
    const handled = new KeyboardEvent("keydown", {
      key: "t",
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
  });
  await expect(frame).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", "Shortcut test input");
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.type("t");
  await expect(frame).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("textbox", { name: "Shortcut test input" }),
  ).toHaveValue("t");
  await page.evaluate(() =>
    document.querySelector("input[aria-label='Shortcut test input']")?.remove(),
  );
  await page.getByRole("button", { name: "Text (T)", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Text selected");
});

test("tabs support arrow wrapping, Home, End, and valid ARIA panel references", async ({
  page,
}) => {
  const pages = page.getByRole("tab", { name: "pages", exact: true });
  const layers = page.getByRole("tab", { name: "layers", exact: true });
  const assets = page.getByRole("tab", { name: "assets", exact: true });
  await pages.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(assets).toBeFocused();
  await expect(assets).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "assets" })).toContainText(
    "A home for your assets",
  );
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(layers).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "layers" })).toContainText(
    "Desktop",
  );
  await page.keyboard.press("End");
  await expect(assets).toBeFocused();
  const validReferences = await page
    .getByRole("tab")
    .evaluateAll((tabs) =>
      tabs.every((tab) =>
        document.getElementById(tab.getAttribute("aria-controls") ?? ""),
      ),
    );
  expect(validReferences).toBe(true);
});

test("dialogs keep the page inert, suspend shortcuts, close with Escape, and restore the trigger", async ({
  page,
}) => {
  const exportButton = page.getByRole("button", {
    name: "Export Code",
    exact: true,
  });
  await exportButton.click();
  const dialog = page.getByRole("dialog", { name: "Export Code", exact: true });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close dialog" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Back to editor" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.locator(".export-button").evaluate((button) => button.focus());
  await expect(close).toBeFocused();
  await page.keyboard.press("t");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(exportButton).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Select (V)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Preview site" }).click();
  await expect(
    page.getByRole("dialog", { name: "Site preview" }),
  ).toContainText("Your Desktop frame is ready.");
  await page.getByRole("button", { name: "Back to editor" }).click();
  await expect(
    page.getByRole("button", { name: "Preview site" }),
  ).toBeFocused();
});

test("zoom stops at its limits and resets without changing tools", async ({
  page,
}) => {
  const zoomIn = page.getByRole("button", { name: "Zoom in", exact: true });
  const zoomOut = page.getByRole("button", { name: "Zoom out", exact: true });
  for (let i = 0; i < 8 && !(await zoomIn.isDisabled()); i++)
    await zoomIn.click();
  await expect(zoomIn).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Canvas zoom 200%, reset to 100%",
      exact: true,
    }),
  ).toBeVisible();
  for (let i = 0; i < 7; i++) await zoomOut.click();
  await expect(zoomOut).toBeDisabled();
  await expect(page.locator(".canvas")).toHaveCSS("background-size", "5px 5px");
  await page
    .getByRole("button", {
      name: "Canvas zoom 25%, reset to 100%",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Canvas zoom 100%, reset to 100%",
      exact: true,
    }),
  ).toBeVisible();
  await expect(zoomOut).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Select (V)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("mobile retains navigation and inspector access without overflow or duplicate IDs", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const canvas = await page
      .getByRole("region", { name: "Design canvas" })
      .boundingBox();
    expect(canvas?.width).toBeGreaterThan(200);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open project navigation" }).click();
  const navigation = page.getByRole("dialog", { name: "Project navigation" });
  await navigation.getByRole("tab", { name: "layers", exact: true }).click();
  await expect(
    navigation.getByRole("tabpanel", { name: "layers" }),
  ).toContainText("Desktop");
  expect(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
      return ids.length === new Set(ids).size;
    }),
  ).toBe(true);
  await navigation.getByRole("button", { name: "Editor help" }).click();
  await expect(
    page.getByRole("dialog", { name: "Editor shortcuts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open project navigation" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open inspector" }).click();
  const inspector = page.getByRole("dialog", { name: "Inspector properties" });
  await expect(
    inspector.getByRole("heading", { name: "Position", exact: true }),
  ).toBeVisible();
  await expect(
    inspector.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open inspector" }),
  ).toBeFocused();
});

test("page loads without browser errors or hydration failures", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.reload();
  await page.getByRole("button", { name: "Frame (F)", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Frame selected");
  expect(errors).toEqual([]);
});
