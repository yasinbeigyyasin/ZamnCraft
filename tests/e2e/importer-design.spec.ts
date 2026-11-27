import { expect, test } from "@playwright/test";

test("editor chrome follows the approved importer tokens without changing authored canvas fonts", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".brand-mark")).toHaveText("Z");
  await expect(page.locator(".top-bar")).toHaveCSS(
    "border-bottom-color",
    "rgb(41, 41, 41)",
  );
  const font = await page
    .locator("body")
    .evaluate((node) =>
      getComputedStyle(node).getPropertyValue("--font-editor"),
    );
  expect(font).not.toBe("");
  await expect(page.locator(".canvas-world")).toHaveCSS(
    "font-family",
    "Arial, Helvetica, sans-serif",
  );
  await page.locator('[data-editor-element="desktop"]').click();
  const inspector = page.getByRole("complementary", {
    name: "Inspector",
    exact: true,
  });
  await expect(
    inspector.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveCSS("color", "rgb(238, 238, 238)");
  await expect(
    inspector
      .getByRole("spinbutton", { name: "Width", exact: true })
      .locator(".."),
  ).toHaveCSS("height", "30px");
  const slider = inspector.getByRole("slider", {
    name: "Opacity slider",
    exact: true,
  });
  await slider.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await slider.blur();
  await expect(page.locator('[data-editor-element="desktop"]')).toHaveCSS(
    "opacity",
    "0.01",
  );
  await page.locator("#editor-canvas").focus();
  await page.keyboard.press("Control+z");
  await expect(page.locator('[data-editor-element="desktop"]')).toHaveCSS(
    "opacity",
    "1",
  );
  const toggle = inspector.getByRole("checkbox", {
    name: "Appear enabled",
    exact: true,
  });
  await toggle.check();
  await expect(toggle).toHaveCSS("background-color", "rgb(0, 153, 255)");
  await expect(toggle).toHaveCSS("width", "28px");
  await page.getByRole("button", { name: "Export Code", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export Code", exact: true });
  await expect(dialog).toHaveCSS("width", "800px");
  await expect(
    dialog.getByRole("tab", { name: "React", exact: true }),
  ).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});
