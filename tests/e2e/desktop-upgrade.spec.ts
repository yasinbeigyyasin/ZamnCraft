import { expect, test } from "@playwright/test";
import { createWorkspace, WORKSPACE_KEY } from "../../src/lib/workspace";

test("existing browser workspaces upgrade the original Desktop without resetting content and save the upgrade once", async ({
  page,
}) => {
  const legacy = { version: 1, ...createWorkspace() };
  const desktop = legacy.pages[0].elements[0];
  desktop.styles.width = 1200;
  desktop.styles.height = 800;
  desktop.children.push({
    id: "saved-title",
    name: "Saved title",
    type: "text",
    content: "My existing project",
    children: [],
    animations: {},
    styles: {
      position: "absolute",
      left: 40,
      top: 60,
      width: 200,
      fontSize: 24,
    },
  });
  await page.addInitScript(
    ({ key, data }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, data);
    },
    { key: WORKSPACE_KEY, data: JSON.stringify(legacy) },
  );
  await page.goto("/");
  const root = page.locator('[data-editor-element="desktop"]');
  const title = page.locator('[data-editor-element="saved-title"]');
  await expect(root).toHaveCSS("width", "1920px");
  await expect(root).toHaveCSS("height", "1080px");
  await expect(title.locator(".canvas-text-content")).toHaveText(
    "My existing project",
  );
  await expect(title).toHaveCSS("left", "40px");
  await expect(title).toHaveCSS("font-size", "24px");
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).desktopSizeVersion,
        WORKSPACE_KEY,
      ),
    )
    .toBe(1);
  await page.reload();
  await expect(root).toHaveCSS("width", "1920px");
  await expect(title.locator(".canvas-text-content")).toHaveText(
    "My existing project",
  );
  await root.click({ position: { x: 200, y: 200 } });
  const panel = page.getByRole("complementary", {
    name: "Inspector",
    exact: true,
  });
  for (const [name, value] of [
    ["Width", "1200"],
    ["Height", "800"],
  ]) {
    const input = panel.getByRole("spinbutton", { name, exact: true });
    await input.fill(value);
    await input.blur();
  }
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).pages[0].elements[0].styles
            .width,
        WORKSPACE_KEY,
      ),
    )
    .toBe(1200);
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).pages[0].elements[0].styles
            .height,
        WORKSPACE_KEY,
      ),
    )
    .toBe(800);
  await page.reload();
  await expect(root).toHaveCSS("width", "1200px");
  await expect(root).toHaveCSS("height", "800px");
});
