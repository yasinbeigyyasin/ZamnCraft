import { choose } from "./control-helpers";
import { expect, test, type Page } from "@playwright/test";
import { WORKSPACE_KEY } from "../../src/lib/workspace";

const inspector = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector", exact: true });
const navigation = (page: Page) =>
  page.getByRole("complementary", { name: "Project navigation", exact: true });
async function settings(page: Page) {
  await page
    .getByRole("button", { name: "Project overview", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Local workspace", exact: true });
}
async function addFrame(page: Page) {
  const root = page.locator('[data-editor-element="desktop"]');
  const box = (await root.boundingBox())!;
  await page.getByRole("button", { name: "Frame (F)", exact: true }).click();
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.25);
  return root.locator(':scope > [data-element-type="frame"]').last();
}
async function persisted(page: Page) {
  return page.evaluate((key) => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      return null;
    }
  }, WORKSPACE_KEY);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("Tablet and Mobile copy the Desktop tree at 810/390px side by side and preview switches variants without mutating the editor", async ({
  page,
}) => {
  await addFrame(page);
  await page
    .getByRole("button", { name: "Add Tablet breakpoint", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Mobile breakpoint", exact: true })
    .click();
  const desktop = page.locator('[data-breakpoint="desktop"]'),
    tablet = page.locator('[data-breakpoint="tablet"]'),
    mobile = page.locator('[data-breakpoint="mobile"]');
  await expect(desktop).toHaveCSS("width", "1200px");
  await expect(tablet).toHaveCSS("width", "810px");
  await expect(mobile).toHaveCSS("width", "390px");
  await expect(tablet.locator('[data-element-type="frame"]')).toHaveCount(1);
  const boxes = await Promise.all(
    [desktop, tablet, mobile].map((node) => node.boundingBox()),
  );
  expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.width);
  expect(boxes[2]!.x).toBeGreaterThan(boxes[1]!.x + boxes[1]!.width);
  const allIds = await page
    .locator("[data-editor-element]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-editor-element")),
    );
  expect(new Set(allIds).size).toBe(allIds.length);
  const camera = await page.locator(".canvas-world").getAttribute("style");
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  await expect(desktop).toBeVisible();
  await choose(
    page.getByRole("combobox", { name: "Preview breakpoint", exact: true }),
    { label: "Mobile · 390px" },
  );
  await expect(mobile).toBeVisible();
  await expect(desktop).toHaveCount(0);
  await choose(
    page.getByRole("combobox", { name: "Preview breakpoint", exact: true }),
    { label: "Desktop · 1200px" },
  );
  await expect(desktop).toBeVisible();
  await expect(mobile).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(mobile).toBeVisible();
  await expect(tablet).toBeVisible();
  await expect(page.locator(".canvas-world")).toHaveAttribute("style", camera!);
});

test("undo/redo groups multi-step drag, resize and Inspector edits and restores deleted elements", async ({
  page,
}) => {
  const frame = await addFrame(page);
  const initial = await frame.getAttribute("style");
  let box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 70,
    box.y + box.height / 2 + 40,
    { steps: 12 },
  );
  await page.mouse.up();
  expect(await frame.getAttribute("style")).not.toBe(initial);
  await page.keyboard.press("Control+z");
  await expect(frame).toHaveAttribute("style", initial!);
  await page.keyboard.press("Control+y");
  expect(await frame.getAttribute("style")).not.toBe(initial);
  const moved = await frame.getAttribute("style");
  const handle = frame.locator('[data-resize-handle="se"]');
  box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 60, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.press("Meta+z");
  await expect(frame).toHaveAttribute("style", moved!);
  await page.keyboard.press("Meta+Shift+z");
  const resized = await frame.getAttribute("style");
  const width = inspector(page).getByRole("spinbutton", {
    name: "Width",
    exact: true,
  });
  await width.fill("310");
  await width.fill("330");
  await width.fill("360");
  await width.blur();
  await page.locator("#editor-canvas").focus();
  await page.keyboard.press("Control+z");
  await expect(frame).toHaveAttribute("style", resized!);
  await page.keyboard.press("Control+Shift+z");
  await expect(frame).toHaveCSS("width", "360px");
  await page.keyboard.press("Delete");
  await expect(frame).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(frame).toHaveCSS("width", "360px");
});

test("local workspace survives refresh with title, multiple pages, components, breakpoints and no stale undo history", async ({
  page,
}) => {
  await addFrame(page);
  await page
    .getByRole("button", { name: "Component (C)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Tablet breakpoint", exact: true })
    .click();
  const dialog = await settings(page);
  await dialog
    .getByRole("textbox", { name: "Project title", exact: true })
    .fill("A saved workspace");
  await dialog
    .getByRole("button", { name: "Rename project", exact: true })
    .click();
  await navigation(page)
    .getByRole("tab", { name: "pages", exact: true })
    .click();
  await navigation(page)
    .getByRole("button", { name: "Add page", exact: true })
    .click();
  await navigation(page)
    .getByRole("textbox", { name: "Page path", exact: true })
    .fill("/about");
  await navigation(page)
    .getByRole("button", { name: "Save page", exact: true })
    .click();
  await navigation(page)
    .getByRole("tab", { name: "assets", exact: true })
    .click();
  await navigation(page)
    .getByRole("button", { name: "Insert Frame instance", exact: true })
    .click();
  await expect.poll(async () => (await persisted(page))?.pages.length).toBe(2);
  await expect
    .poll(async () => (await persisted(page))?.projectTitle)
    .toBe("A saved workspace");
  await page.reload();
  await expect(page.locator(".project-name")).toContainText(
    "A saved workspace",
  );
  await expect(page).toHaveTitle("A saved workspace — ZamnCraft");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await expect(page.locator('[data-component-role="instance"]')).toHaveCount(1);
  await navigation(page)
    .getByRole("button", { name: "Open page /", exact: true })
    .click();
  await expect(page.locator('[data-breakpoint="tablet"]')).toBeVisible();
  await navigation(page)
    .getByRole("tab", { name: "assets", exact: true })
    .click();
  await expect(
    navigation(page).getByRole("button", {
      name: "Insert Frame instance",
      exact: true,
    }),
  ).toBeVisible();
});

test("starter and reset require confirmation, are undoable and persist a rich editable template", async ({
  page,
}) => {
  await addFrame(page);
  let dialog = await settings(page);
  await dialog
    .getByRole("button", { name: "Load Landing Page Starter", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    dialog.getByRole("group", {
      name: "Replace workspace confirmation",
      exact: true,
    }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Load Landing Page Starter", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Confirm replacement", exact: true })
    .click();
  await expect(
    page.locator('[data-editor-element][aria-label="Hero"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-element-type="button"][aria-label="CTA button"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-editor-element][aria-label^="Feature:"]'),
  ).toHaveCount(3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.locator('[data-editor-element][aria-label="Hero"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    page.locator('[data-editor-element][aria-label="Hero"]'),
  ).toBeVisible();
  dialog = await settings(page);
  await dialog
    .getByRole("button", { name: "Reset to clean canvas", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Confirm replacement", exact: true })
    .click();
  await expect(page.locator("[data-editor-element]")).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(
    page.locator('[data-editor-element][aria-label="Hero"]'),
  ).toBeVisible();
  await expect
    .poll(async () => (await persisted(page))?.projectTitle)
    .toBe("Landing Page Starter");
  await page.reload();
  await expect(
    page.locator('[data-editor-element][aria-label="Hero"]'),
  ).toBeVisible();
});

test("corrupt saved data is retained until explicit reset, and storage quota failures are visible without losing the in-memory canvas", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "{broken"),
    WORKSPACE_KEY,
  );
  await page.reload();
  let dialog = await settings(page);
  await expect(dialog.getByRole("status")).toContainText(
    "Saved data was kept untouched",
  );
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), WORKSPACE_KEY),
    )
    .toBe("{broken");
  await dialog
    .getByRole("button", { name: "Reset to clean canvas", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Confirm replacement", exact: true })
    .click();
  await expect
    .poll(async () => (await persisted(page))?.projectTitle)
    .toBe("Untitled");
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new Error("Quota exceeded");
      original.call(this, name, value);
    };
  }, WORKSPACE_KEY);
  await addFrame(page);
  await expect(
    page.getByRole("button", { name: "Local workspace", exact: true }),
  ).toHaveAttribute("title", /Local save failed/);
  dialog = await settings(page);
  await expect(dialog.getByRole("status")).toContainText("Local save failed");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-element-type="frame"]')).toHaveCount(2);
});

test("history shortcuts cancel an active gesture once and never change the document in dialogs or preview", async ({
  page,
}) => {
  const frame = await addFrame(page);
  const before = await frame.getAttribute("style");
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 70, { steps: 5 });
  await page.keyboard.press("Control+z");
  await page.mouse.up();
  await expect(frame).toHaveAttribute("style", before!);
  await settings(page);
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Escape");
  await expect(frame).toHaveCount(1);
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Escape");
  await expect(frame).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(frame).toHaveCount(0);
});

test("mobile workspace menu supports starter loading and adding responsive frames without toolbar overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await settings(page);
  await dialog
    .getByRole("button", { name: "Load Landing Page Starter", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Confirm replacement", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Mobile breakpoint", exact: true })
    .click();
  await expect(page.locator('[data-breakpoint="mobile"]')).toHaveCSS(
    "width",
    "390px",
  );
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("responsive HTML export switches exactly one variant at desktop, tablet and mobile boundaries", async ({
  page,
}) => {
  const { generateCode } = await import("../../src/lib/code-generator");
  const { createDesktop } = await import("../../src/lib/workspace");
  const variants = (["desktop", "tablet", "mobile"] as const).map(
    (breakpoint, index) => {
      const root = createDesktop(breakpoint);
      root.breakpoint = breakpoint;
      root.styles.width = [1200, 810, 390][index];
      root.styles.left = index * 1280;
      root.children = [
        {
          ...createDesktop(`${breakpoint}-text`),
          breakpoint: undefined,
          type: "text" as const,
          content: `${breakpoint} variant`,
          styles: { width: "100%", height: 40 },
        },
      ];
      return root;
    },
  );
  await page.setContent(generateCode(variants, "html"));
  for (const [width, active] of [
    [1440, "desktop"],
    [1200, "desktop"],
    [1199, "tablet"],
    [810, "tablet"],
    [809, "mobile"],
    [390, "mobile"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    for (const breakpoint of ["desktop", "tablet", "mobile"]) {
      const text = page.getByText(`${breakpoint} variant`, { exact: true });
      if (breakpoint === active) await expect(text).toBeVisible();
      else await expect(text).toBeHidden();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
