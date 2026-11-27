import { expect, test, type Page } from "@playwright/test";

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector", exact: true });
const root = (page: Page) => page.locator('[data-editor-element="desktop"]');
async function field(page: Page, label: string, value: number) {
  const input = panel(page).getByRole("spinbutton", {
    name: label,
    exact: true,
  });
  await input.fill(String(value));
  await input.blur();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await root(page).click();
});

test("shadow offset, hardness, spread, type and color edit independently and survive reload", async ({
  page,
}) => {
  await panel(page)
    .getByRole("button", { name: "Add shadow", exact: true })
    .click();
  await expect(
    panel(page).getByRole("textbox", { name: "Shadow", exact: true }),
  ).toHaveCount(0);
  await field(page, "Shadow X", -10);
  await field(page, "Shadow Y", 16);
  await field(page, "Shadow blur", 4);
  await field(page, "Shadow spread", -2);
  await panel(page)
    .getByRole("group", { name: "Shadow type", exact: true })
    .getByRole("button", { name: "Inner", exact: true })
    .click();
  await panel(page)
    .getByRole("textbox", { name: "Shadow color hex", exact: true })
    .fill("#33669980");
  await panel(page)
    .getByRole("textbox", { name: "Shadow color hex", exact: true })
    .blur();
  await expect(root(page)).toHaveCSS(
    "box-shadow",
    "rgba(51, 102, 153, 0.5) -10px 16px 4px -2px inset",
  );
  await page.locator("#editor-canvas").focus();
  await page.keyboard.press("Control+z");
  await expect(root(page)).toHaveCSS(
    "box-shadow",
    "rgba(0, 0, 0, 0.15) -10px 16px 4px -2px inset",
  );
  await page.keyboard.press("Control+Shift+z");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("zamncraft.workspace.v1")),
    )
    .toContain("#33669980");
  await page.reload();
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await page
    .getByRole("button", { name: "Focus Desktop breakpoint", exact: true })
    .click();
  await expect(
    panel(page).getByRole("spinbutton", { name: "Shadow X", exact: true }),
  ).toHaveValue("-10");
  await expect(
    panel(page).getByRole("spinbutton", { name: "Shadow blur", exact: true }),
  ).toHaveValue("4");
  await expect(root(page)).toHaveCSS(
    "box-shadow",
    "rgba(51, 102, 153, 0.5) -10px 16px 4px -2px inset",
  );
});

test("custom color studio supports color area, hue, alpha, keyboard and invalid hex", async ({
  page,
}) => {
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
  const trigger = panel(page).getByRole("button", {
    name: "Fill color picker",
    exact: true,
  });
  await trigger.click();
  const picker = page.getByRole("dialog", { name: "Fill color", exact: true });
  await expect(picker).toBeVisible();
  await picker
    .getByRole("button", { name: "Use #0099ff", exact: true })
    .click();
  await expect(root(page)).toHaveCSS("background-color", "rgb(0, 153, 255)");
  const hue = picker.getByRole("slider", { name: "Fill hue", exact: true });
  await hue.focus();
  await hue.press("Home");
  await hue.blur();
  await expect(root(page)).toHaveCSS("background-color", "rgb(255, 0, 0)");
  const alpha = picker.getByRole("spinbutton", {
    name: "Fill alpha",
    exact: true,
  });
  await alpha.fill("50");
  await alpha.blur();
  await expect(root(page)).toHaveCSS(
    "background-color",
    "rgba(255, 0, 0, 0.5)",
  );
  const hex = picker.getByRole("textbox", {
    name: "Fill picker hex",
    exact: true,
  });
  await hex.fill("not hex");
  await hex.blur();
  await expect(hex).toHaveValue("#FF0000");
  const area = picker.getByRole("group", {
    name: "Fill saturation and brightness",
    exact: true,
  });
  await area.focus();
  await area.press("Shift+ArrowLeft");
  await expect(root(page)).toHaveCSS(
    "background-color",
    "rgba(255, 26, 26, 0.5)",
  );
  const before = await root(page).getAttribute("style");
  const bounds = (await area.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 40);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 20, bounds.y + 70);
  await expect(root(page)).not.toHaveAttribute("style", before!);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(root(page)).toHaveAttribute("style", before!);
  await expect(picker).toBeVisible();
  await page.mouse.move(bounds.x + 50, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 80, bounds.y + 60);
  await page.mouse.up();
  await expect(root(page)).not.toHaveAttribute("style", before!);
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.locator("#editor-canvas").focus();
  await page.keyboard.press("Control+z");
  await expect(root(page)).toHaveAttribute("style", before!);
});

test("custom picker stays inside mobile Inspector, dismisses independently and has no overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open inspector", exact: true })
    .click();
  const inspector = page.getByRole("dialog", {
    name: "Inspector properties",
    exact: true,
  });
  await inspector
    .getByRole("button", { name: "Fill color picker", exact: true })
    .click();
  const picker = page.getByRole("dialog", { name: "Fill color", exact: true });
  await expect(picker).toBeVisible();
  const bounds = (await picker.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await picker
    .getByRole("button", { name: "Use #ff8800", exact: true })
    .click();
  await expect(root(page)).toHaveCSS("background-color", "rgb(255, 136, 0)");
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(inspector).toBeVisible();
  await inspector
    .getByRole("button", { name: "Fill color picker", exact: true })
    .click();
  await inspector.getByRole("heading", { name: "Design", exact: true }).click();
  await expect(picker).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
