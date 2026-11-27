import { expect, test, type Page } from "@playwright/test";

const navigation = (page: Page) =>
  page.getByRole("complementary", { name: "Project navigation", exact: true });
const inspector = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector", exact: true });
async function tab(page: Page, name: string) {
  await navigation(page)
    .getByRole("tab", { name: name.toLowerCase(), exact: true })
    .click();
}
async function addPage(page: Page, path: string) {
  await tab(page, "Pages");
  await navigation(page)
    .getByRole("button", { name: "Add page", exact: true })
    .click();
  await navigation(page)
    .getByRole("textbox", { name: "Page path", exact: true })
    .fill(path);
  await navigation(page)
    .getByRole("button", { name: "Save page", exact: true })
    .click();
}
async function selectLayer(page: Page, id: string) {
  await tab(page, "Layers");
  await navigation(page).locator(`[data-layer-id="${id}"] .layer-name`).click();
}
async function createCard(page: Page, withText = false) {
  const desktop = page.locator('[data-editor-element="desktop"]');
  const box = (await desktop.boundingBox())!;
  await page.getByRole("button", { name: "Frame (F)", exact: true }).click();
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
  const frame = desktop.locator(':scope > [data-element-type="frame"]');
  const id = (await frame.getAttribute("data-editor-element"))!;
  if (withText) {
    await page.getByRole("button", { name: "Text (T)", exact: true }).click();
    const childBox = (await frame.boundingBox())!;
    await page.mouse.click(childBox.x + 12, childBox.y + 14);
    await page.keyboard.press("Escape");
    await selectLayer(page, id);
  }
  return { frame, id };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("Component tool creates a reusable subtree; Assets inserts unique instances and component selections are purple", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", { name: "Component (C)", exact: true }),
  ).toBeDisabled();
  const { frame, id } = await createCard(page, true);
  const originalText = (await frame
    .locator('[data-element-type="text"]')
    .getAttribute("data-editor-element"))!;
  await page
    .getByRole("button", { name: "Component (C)", exact: true })
    .click();
  await expect(
    navigation(page).getByRole("tab", { name: "assets", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(frame).toHaveAttribute("data-component-role", "master");
  await expect(frame.locator(":scope > .canvas-selection-box")).toHaveCSS(
    "border-top-color",
    "rgb(139, 92, 246)",
  );
  await expect(
    frame
      .locator(":scope > .canvas-selection-box .canvas-resize-handle")
      .first(),
  ).toHaveCSS("border-top-color", "rgb(139, 92, 246)");
  await navigation(page)
    .getByRole("button", { name: "Insert Frame instance", exact: true })
    .click();
  const instance = page.locator('[data-component-role="instance"]');
  await expect(instance).toHaveCount(1);
  await expect(instance.locator('[data-element-type="text"]')).toHaveCount(1);
  expect(await instance.getAttribute("data-editor-element")).not.toBe(id);
  expect(
    await instance
      .locator('[data-element-type="text"]')
      .getAttribute("data-editor-element"),
  ).not.toBe(originalText);
  await tab(page, "Layers");
  const row = navigation(page).locator(`[data-layer-id="${id}"]`);
  await expect(row).toHaveCSS("color", "rgb(139, 92, 246)");
  await row.locator(".layer-name").click();
  await expect(row).toHaveCSS("background-color", "rgb(139, 92, 246)");
  await expect(
    page.getByRole("button", { name: "Component (C)", exact: true }),
  ).toBeDisabled();
});

test("master style and structure changes propagate across pages, while detached instances stay independent", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { frame, id } = await createCard(page, true);
  const textId = (await frame
    .locator('[data-element-type="text"]')
    .getAttribute("data-editor-element"))!;
  await page.keyboard.press("c");
  await expect(frame).toHaveAttribute("data-component-role", "master");
  await addPage(page, "/about");
  await tab(page, "Assets");
  await navigation(page)
    .getByRole("button", { name: "Insert Frame instance", exact: true })
    .click();
  const instance = page.locator('[data-component-role="instance"]');
  const instanceId = (await instance.getAttribute("data-editor-element"))!;
  const childId = (await instance
    .locator('[data-element-type="text"]')
    .getAttribute("data-editor-element"))!;
  await inspector(page)
    .getByRole("spinbutton", { name: "X", exact: true })
    .fill("420");
  await inspector(page)
    .getByRole("spinbutton", { name: "X", exact: true })
    .blur();
  await navigation(page)
    .getByRole("button", { name: "Edit Frame master", exact: true })
    .click();
  await expect(frame).toHaveAttribute("data-selected", "true");
  await inspector(page)
    .getByRole("spinbutton", { name: "Width", exact: true })
    .fill("320");
  await inspector(page)
    .getByRole("spinbutton", { name: "Width", exact: true })
    .blur();
  await navigation(page)
    .locator(`[data-layer-id="${textId}"]`)
    .getByRole("button", { name: "Delete Text", exact: true })
    .click();
  await tab(page, "Pages");
  await navigation(page)
    .getByRole("button", { name: "Open page /about", exact: true })
    .click();
  await expect(instance).toHaveCSS("width", "320px");
  await expect(instance).toHaveCSS("left", "420px");
  await expect(
    instance.locator(`[data-editor-element="${childId}"]`),
  ).toHaveCount(0);
  await selectLayer(page, instanceId);
  await tab(page, "Assets");
  await navigation(page)
    .getByRole("button", { name: "Detach instance", exact: true })
    .click();
  await expect(
    page.locator(`[data-editor-element="${instanceId}"]`),
  ).not.toHaveAttribute("data-component-role", "instance");
  await navigation(page)
    .getByRole("button", { name: "Edit Frame master", exact: true })
    .click();
  await inspector(page)
    .getByRole("spinbutton", { name: "Width", exact: true })
    .fill("500");
  await inspector(page)
    .getByRole("spinbutton", { name: "Width", exact: true })
    .blur();
  await tab(page, "Pages");
  await navigation(page)
    .getByRole("button", { name: "Open page /about", exact: true })
    .click();
  const detached = page.locator(`[data-editor-element="${instanceId}"]`);
  await expect(detached).toHaveCSS("width", "320px");
  await selectLayer(page, instanceId);
  await expect(detached.locator(".canvas-selection-box")).toHaveCSS(
    "border-top-color",
    "rgb(0, 153, 255)",
  );
  expect(errors).toEqual([]);
  expect(id).not.toBe(instanceId);
});

test("pages add, rename, switch and delete independent canvas trees with validation, confirmation and camera restoration", async ({
  page,
}) => {
  const { id } = await createCard(page);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const camera = await page.locator(".canvas-world").getAttribute("style");
  await addPage(page, "/about");
  await expect(page.locator(`[data-editor-element="${id}"]`)).toHaveCount(0);
  await expect(page.locator("[data-selected=true]")).toHaveCount(0);
  await navigation(page)
    .getByRole("button", { name: "Rename page /about", exact: true })
    .click();
  await navigation(page)
    .getByRole("textbox", { name: "Page path", exact: true })
    .fill("/");
  await navigation(page)
    .getByRole("button", { name: "Save page", exact: true })
    .click();
  await expect(navigation(page).getByRole("alert")).toContainText(
    "unique path",
  );
  await navigation(page)
    .getByRole("textbox", { name: "Page path", exact: true })
    .fill("/contact");
  await navigation(page)
    .getByRole("button", { name: "Save page", exact: true })
    .click();
  await expect(
    navigation(page).getByRole("button", {
      name: "Open page /contact",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
  await navigation(page)
    .getByRole("button", { name: "Open page /", exact: true })
    .click();
  await expect(page.locator(`[data-editor-element="${id}"]`)).toBeVisible();
  await expect(page.locator(".canvas-world")).toHaveAttribute("style", camera!);
  await navigation(page)
    .getByRole("button", { name: "Delete page /contact", exact: true })
    .click();
  await navigation(page)
    .getByRole("group", {
      name: "Delete page /contact confirmation",
      exact: true,
    })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    navigation(page).getByRole("button", {
      name: "Open page /contact",
      exact: true,
    }),
  ).toBeVisible();
  await navigation(page)
    .getByRole("button", { name: "Delete page /contact", exact: true })
    .click();
  await navigation(page)
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(
    navigation(page).getByRole("button", {
      name: "Open page /contact",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    navigation(page).getByRole("button", {
      name: "Delete page /",
      exact: true,
    }),
  ).toBeDisabled();
});

test("Create Component in Assets supports Text; typing C and modified shortcuts never create a component", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Text (T)", exact: true }).click();
  const desktop = (await page
    .locator('[data-editor-element="desktop"]')
    .boundingBox())!;
  await page.mouse.click(desktop.x + 100, desktop.y + 100);
  await page.locator('[data-element-type="text"]').dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("c");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+c");
  await tab(page, "Assets");
  await expect(
    navigation(page).getByRole("list", {
      name: "Saved components",
      exact: true,
    }),
  ).toHaveCount(0);
  await navigation(page)
    .getByRole("button", { name: "Create Component", exact: true })
    .click();
  await expect(
    page.locator('[data-component-role="master"][data-element-type="text"]'),
  ).toHaveCount(1);
  await navigation(page)
    .getByRole("button", { name: "Insert Text instance", exact: true })
    .click();
  await expect(
    page.locator('[data-component-role="instance"] .canvas-text-content'),
  ).toHaveText("c");
});

test("mobile navigation manages pages and inserts/detaches assets without overflow", async ({
  page,
}) => {
  await createCard(page);
  await page
    .getByRole("button", { name: "Component (C)", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open project navigation", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Project navigation",
    exact: true,
  });
  await dialog.getByRole("tab", { name: "pages", exact: true }).click();
  await dialog.getByRole("button", { name: "Add page", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "Page path", exact: true })
    .fill("/about");
  await dialog.getByRole("button", { name: "Save page", exact: true }).click();
  await dialog.getByRole("tab", { name: "assets", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Insert Frame instance", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Detach instance", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-element-type="frame"][data-selected="true"]'),
  ).toHaveCount(1);
  await expect(page.locator('[data-component-role="instance"]')).toHaveCount(0);
});
