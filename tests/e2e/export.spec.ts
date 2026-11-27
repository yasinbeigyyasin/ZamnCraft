import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openExport(page: Page) {
  await page.getByRole("button", { name: "Export Code", exact: true }).click();
  return page.getByRole("dialog", { name: "Export Code", exact: true });
}
async function addText(page: Page, value: string) {
  await page.getByRole("button", { name: "Text (T)", exact: true }).click();
  const root = (await page
    .locator('[data-editor-element="desktop"]')
    .boundingBox())!;
  await page.mouse.click(root.x + 80, root.y + 80);
  const text = page.locator('[data-element-type="text"]');
  await text.dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(value);
  await page.keyboard.press("Enter");
  return text;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("framework tabs show read-only syntax-styled output, copy exact code and download each correct file", async ({
  page,
}) => {
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copied = text;
        },
      },
    }),
  );
  const dialog = await openExport(page);
  const viewer = dialog.getByRole("textbox", {
    name: "Generated code",
    exact: true,
  });
  await expect(viewer).toHaveAttribute("aria-readonly", "true");
  for (const [name, filename, marker] of [
    ["React", "Page.tsx", "export default function Page"],
    ["Vue", "Page.vue", '<script setup lang="ts">'],
    ["Svelte", "Page.svelte", '<script lang="ts">'],
    ["HTML/CSS", "index.html", "<!doctype html>"],
  ]) {
    await dialog.getByRole("tab", { name, exact: true }).click();
    await expect(viewer).toContainText(marker);
    const code = (await viewer.textContent())!;
    expect(await viewer.locator("span").count()).toBeGreaterThan(0);
    await dialog
      .getByRole("button", { name: "Copy Code", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toHaveText("Copied!");
    expect(
      await page.evaluate(() => document.documentElement.dataset.copied),
    ).toBe(code);
    const pending = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: "Download File", exact: true })
      .click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(filename);
    expect(await readFile((await download.path())!, "utf8")).toBe(code);
  }
});

test("clipboard rejection gives useful feedback and framework keyboard tabs preserve dialog focus and editor state", async ({
  page,
}) => {
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Permission denied");
        },
      },
    }),
  );
  const dialog = await openExport(page);
  await dialog.getByRole("button", { name: "Copy Code", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Clipboard unavailable",
  );
  await dialog.getByRole("tab", { name: "React", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(
    dialog.getByRole("tab", { name: "HTML/CSS", exact: true }),
  ).toBeFocused();
  await expect(dialog.getByRole("status")).toBeEmpty();
  await page.keyboard.press("Home");
  await expect(
    dialog.getByRole("tab", { name: "React", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    dialog.getByRole("tab", { name: "HTML/CSS", exact: true }),
  ).toBeFocused();
  const before = await dialog
    .getByRole("textbox", { name: "Generated code", exact: true })
    .textContent();
  await dialog
    .getByRole("textbox", { name: "Generated code", exact: true })
    .focus();
  await page.keyboard.type("ftc");
  await page.keyboard.press("Delete");
  await expect(
    dialog.getByRole("textbox", { name: "Generated code", exact: true }),
  ).toHaveText(before!);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Export Code", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Move (V)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("exports refresh after editing and switching pages and never include inactive page content", async ({
  page,
}) => {
  await addText(page, "Home only content");
  let dialog = await openExport(page);
  await expect(
    dialog.getByRole("textbox", { name: "Generated code", exact: true }),
  ).toContainText("Home only content");
  await page.keyboard.press("Escape");
  const nav = page.getByRole("complementary", {
    name: "Project navigation",
    exact: true,
  });
  await nav.getByRole("tab", { name: "pages", exact: true }).click();
  await nav.getByRole("button", { name: "Add page", exact: true }).click();
  await nav
    .getByRole("textbox", { name: "Page path", exact: true })
    .fill("/about");
  await nav.getByRole("button", { name: "Save page", exact: true }).click();
  dialog = await openExport(page);
  await expect(dialog).toContainText("Current page: /about");
  await expect(
    dialog.getByRole("textbox", { name: "Generated code", exact: true }),
  ).not.toContainText("Home only content");
  await page.keyboard.press("Escape");
  await nav.getByRole("button", { name: "Open page /", exact: true }).click();
  await page.locator('[data-element-type="text"]').dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText("Updated home");
  await page.keyboard.press("Enter");
  dialog = await openExport(page);
  await expect(
    dialog.getByRole("textbox", { name: "Generated code", exact: true }),
  ).toContainText("Updated home");
  await expect(
    dialog.getByRole("textbox", { name: "Generated code", exact: true }),
  ).not.toContainText("Home only content");
});

test("standalone HTML preserves literal hostile text and geometry and runs hover/press effects safely", async ({
  page,
  context,
}) => {
  const hostile =
    "<script>window.compromised = true</script> {{ value }} & ` ${x}";
  await addText(page, hostile);
  const panel = page.getByRole("complementary", {
    name: "Inspector",
    exact: true,
  });
  const effects = panel.getByRole("region", {
    name: "Effects & Animations",
    exact: true,
  });
  await effects
    .getByRole("checkbox", { name: "Hover enabled", exact: true })
    .check();
  await effects
    .getByRole("spinbutton", { name: "Hover scale", exact: true })
    .fill("1.2");
  await effects
    .getByRole("checkbox", { name: "Hover fill override", exact: true })
    .check();
  await effects
    .getByRole("checkbox", { name: "Press enabled", exact: true })
    .check();
  await effects
    .getByRole("spinbutton", { name: "Press scale", exact: true })
    .fill("0.8");
  await effects
    .getByRole("spinbutton", { name: "Transition duration", exact: true })
    .fill("0.1");
  await effects
    .getByRole("spinbutton", { name: "Transition duration", exact: true })
    .blur();
  const dialog = await openExport(page);
  await dialog.getByRole("tab", { name: "HTML/CSS", exact: true }).click();
  const code = (await dialog
    .getByRole("textbox", { name: "Generated code", exact: true })
    .textContent())!;
  await expect(dialog.locator("script")).toHaveCount(0);
  const exported = await context.newPage();
  await exported.setContent(code);
  const text = exported.getByLabel("Text", { exact: true });
  await expect(text).toHaveText(hostile);
  await expect(text).toHaveCSS("width", "200px");
  expect(
    await text.evaluate((element) => element.getBoundingClientRect().x),
  ).toBeCloseTo(192 * Math.min(1, exported.viewportSize()!.width / 1920), 0);
  expect(await exported.locator("script").count()).toBe(1);
  expect(await exported.evaluate(() => "compromised" in window)).toBe(false);
  await text.hover();
  await expect(text).toHaveCSS("background-color", "rgb(0, 153, 255)");
  const scale = () =>
    text.evaluate(
      (element) => new DOMMatrix(getComputedStyle(element).transform).a,
    );
  await expect.poll(scale).toBeCloseTo(1.2, 2);
  await exported.mouse.down();
  await expect.poll(scale).toBeCloseTo(0.8, 2);
  await exported.mouse.up();
  await expect.poll(scale).toBeCloseTo(1.2, 2);
  await exported.mouse.move(0, 0);
  await expect.poll(scale).toBeCloseTo(1, 2);
  await exported.emulateMedia({ reducedMotion: "reduce" });
  await text.hover();
  await expect(text).toHaveCSS("transform", "none");
  await exported.close();
});

test("mobile export keeps tabs, code scrolling, copy and download within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await openExport(page);
  await dialog.getByRole("tab", { name: "HTML/CSS", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Copy Code", exact: true }),
  ).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "Download File", exact: true }),
  ).toBeInViewport();
  await expect(
    dialog.getByRole("textbox", { name: "Generated code", exact: true }),
  ).toBeInViewport();
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("downloaded HTML stays visible after all defaults are deleted except an offset custom 1920×1080 artboard", async ({
  page,
  context,
}) => {
  const { createWorkspace, createDesktop, serializeWorkspace, WORKSPACE_KEY } =
    await import("../../src/lib/workspace");
  const workspace = createWorkspace();
  const custom = createDesktop("custom-desktop");
  delete custom.breakpoint;
  custom.name = "My desktop";
  custom.styles = { ...custom.styles, left: 7280, top: -900 };
  custom.children = [
    {
      id: "my-content",
      name: "My content",
      type: "text",
      content: "My actual design",
      animations: {},
      children: [],
      styles: {
        position: "absolute",
        left: 1600,
        top: 900,
        width: 240,
        height: 80,
        fontSize: 24,
        color: "#111111",
      },
    },
  ];
  workspace.pages[0].elements = [custom];
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: WORKSPACE_KEY,
    value: serializeWorkspace(workspace),
  });
  await page.reload();
  await expect(
    page.locator('[data-editor-element="custom-desktop"]'),
  ).toHaveCount(1);
  const dialog = await openExport(page);
  await dialog.getByRole("tab", { name: "HTML/CSS", exact: true }).click();
  const pending = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Download File", exact: true })
    .click();
  const download = await pending;
  const code = await readFile((await download.path())!, "utf8");
  expect(code).not.toContain("7280px");
  const exported = await context.newPage();
  await exported.setViewportSize({ width: 1366, height: 768 });
  await exported.setContent(code);
  await expect(
    exported.getByText("My actual design", { exact: true }),
  ).toBeInViewport();
  const box = (await exported
    .getByLabel("My desktop", { exact: true })
    .boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  expect(box.width).toBeCloseTo(1366, 0);
  expect(box.height).toBeCloseTo((1080 * 1366) / 1920, 0);
  await expect(
    page.locator('[data-editor-element="custom-desktop"]'),
  ).toHaveCSS("width", "1920px");
  await exported.close();
});
