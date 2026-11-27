import { expect, test, type Page } from "@playwright/test";

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector", exact: true });
const number = (page: Page, name: string) =>
  panel(page).getByRole("spinbutton", { name, exact: true });
const root = (page: Page) => page.locator('[data-editor-element="desktop"]');
async function insertStack(page: Page) {
  await page.locator("#editor-canvas").focus();
  await page.keyboard.press("s");
  await expect(
    page.getByRole("button", { name: "Stack (S)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await root(page).click({ position: { x: 90, y: 90 } });
  return root(page).locator(':scope > [data-element-type="frame"]').last();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("Canvas Settings edits persist and optional sections are genuinely progressive", async ({
  page,
}) => {
  await expect(
    panel(page).getByRole("heading", { name: "Canvas Settings", exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("heading", { name: "Typography", exact: true }),
  ).toHaveCount(0);
  const bg = panel(page).getByRole("textbox", {
    name: "Background hex",
    exact: true,
  });
  await bg.fill("#232323");
  await bg.blur();
  await expect(page.locator("#editor-canvas")).toHaveCSS(
    "background-color",
    "rgb(35, 35, 35)",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("zamncraft.workspace.v1")!)
            .canvasBackground,
      ),
    )
    .toBe("#232323");
  await page.reload();
  await expect(bg).toHaveValue("#232323");
  await root(page).click();
  await expect(panel(page).locator("select")).toHaveCount(0);
  await expect(
    panel(page).getByRole("combobox", { name: "Border", exact: true }),
  ).toHaveCount(0);
  await panel(page)
    .getByRole("button", { name: "Add border", exact: true })
    .click();
  await expect(
    panel(page).getByRole("combobox", { name: "Border", exact: true }),
  ).toBeVisible();
  await panel(page)
    .getByRole("button", { name: "Remove border", exact: true })
    .click();
  await expect(number(page, "Border width")).toHaveCount(0);
  await panel(page)
    .getByRole("checkbox", { name: "Hover enabled", exact: true })
    .check();
  await expect(number(page, "Hover scale")).toBeVisible();
  await panel(page)
    .getByRole("checkbox", { name: "Hover enabled", exact: true })
    .uncheck();
  await expect(number(page, "Hover scale")).toHaveCount(0);
});

test("numeric arrows retain focus; scrubbing is live, accelerated, cancellable and one undo step", async ({
  page,
}) => {
  await root(page).click();
  const width = number(page, "Width");
  await width.focus();
  await width.press("ArrowUp");
  await expect(width).toHaveValue("1921");
  await width.press("Shift+ArrowUp");
  await expect(width).toHaveValue("1931");
  await width.press("Shift+ArrowDown");
  await expect(width).toHaveValue("1921");
  await expect(width).toBeFocused();
  await width.blur();
  await page.locator("#editor-canvas").focus();
  await page.keyboard.press("Control+z");
  await expect(width).toHaveValue("1920");
  const prefix = panel(page).getByRole("button", {
    name: "Scrub Width",
    exact: true,
  });
  const bounds = (await prefix.boundingBox())!;
  const x = bounds.x + bounds.width / 2,
    y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y);
  await expect(width).toHaveValue("1932");
  await expect(root(page)).toHaveCSS("width", "1932px");
  await page.mouse.up();
  await page.locator("#editor-canvas").focus();
  await page.keyboard.press("Control+z");
  await expect(width).toHaveValue("1920");
  await page.mouse.move(x, y);
  await page.keyboard.down("Shift");
  await page.mouse.down();
  await page.mouse.move(x + 5, y);
  await expect(width).toHaveValue("1970");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(width).toHaveValue("1920");
  await width.fill("1450");
  await width.press("Escape");
  await expect(width).toHaveValue("1920");
});

test("custom menus support checkmarks, arrows, typeahead, dismissal and top-layer dialogs", async ({
  page,
}) => {
  await root(page).click();
  await panel(page)
    .getByRole("button", { name: "Add border", exact: true })
    .click();
  const trigger = panel(page).getByRole("combobox", {
    name: "Border",
    exact: true,
  });
  await trigger.focus();
  await trigger.press("ArrowDown");
  const list = page.getByRole("listbox", { name: "Border", exact: true });
  await expect(
    list.getByRole("option", { name: "Solid", exact: true }),
  ).toBeFocused();
  await expect(
    list.getByRole("option", { name: "Solid", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("Dashed");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("d");
  await page.keyboard.press("o");
  await page.keyboard.press("Enter");
  await expect(root(page)).toHaveCSS("border-top-style", "dotted");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await panel(page)
    .getByRole("heading", { name: "Design", exact: true })
    .click();
  await expect(list).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open inspector", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Inspector properties",
    exact: true,
  });
  await dialog.getByRole("combobox", { name: "Border", exact: true }).click();
  await expect(list).toBeVisible();
  const box = (await list.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await list.getByRole("option", { name: "Solid", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(root(page)).toHaveCSS("border-top-style", "solid");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Stack shortcut inserts a frame; Hand pans without moving elements; rename and alignment work", async ({
  page,
}) => {
  const stack = await insertStack(page);
  await expect(stack).toHaveCSS("display", "flex");
  await expect(stack).toHaveCSS("flex-direction", "column");
  await expect(
    page.getByRole("button", { name: "Select (V)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const name = panel(page).getByRole("textbox", {
    name: "Layer name",
    exact: true,
  });
  await name.fill("Card stack");
  await name.press("Enter");
  await expect(stack).toHaveAttribute("aria-label", "Card stack");
  await name.fill("Discard me");
  await name.press("Escape");
  await expect(name).toHaveValue("Card stack");
  await panel(page)
    .getByRole("button", { name: "Align Center", exact: true })
    .click();
  await expect(stack).toHaveCSS("left", "860px");
  await panel(page)
    .getByRole("button", { name: "Align Bottom", exact: true })
    .click();
  await expect(stack).toHaveCSS("top", "880px");
  const style = await stack.getAttribute("style");
  const before = await page.locator(".canvas-world").getAttribute("style");
  await page.locator("#editor-canvas").focus();
  await page.keyboard.press("h");
  const box = (await stack.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 50);
  await page.mouse.up();
  await expect(page.locator(".canvas-world")).not.toHaveAttribute(
    "style",
    before!,
  );
  await expect(stack).toHaveAttribute("style", style!);
  await expect(
    root(page).locator(':scope > [data-element-type="frame"]'),
  ).toHaveCount(1);
});
