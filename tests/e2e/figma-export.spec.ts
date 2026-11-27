import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openKit(page: Page, mobile = false) {
  await page.goto("/");
  if (mobile)
    await page
      .getByRole("button", { name: "Open project navigation", exact: true })
      .click();
  await page.getByRole("button", { name: "Editor help", exact: true }).click();
  await page
    .getByRole("button", { name: "Copy UI to Figma", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Copy UI to Figma", exact: true });
}

test("Figma kit copies and downloads identical well-formed editable SVG, and the modal layer is optional", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (svg: string) => {
          document.documentElement.dataset.copiedSvg = svg;
        },
      },
    }),
  );
  const dialog = await openKit(page);
  const preview = dialog.getByRole("img", {
    name: "1440 by 900 editable editor UI kit preview",
  });
  await expect(preview.locator("svg")).toHaveAttribute(
    "viewBox",
    "0 0 1440 900",
  );
  await expect(preview.locator('[id^="Export-Code-Modal-"]')).toHaveCount(1);
  await dialog
    .getByRole("button", { name: "Copy UI for Figma", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("SVG copied");
  const copied = (await page.evaluate(
    () => document.documentElement.dataset.copiedSvg,
  ))!;
  expect(
    await page.evaluate((svg) => {
      const xml = new DOMParser().parseFromString(svg, "image/svg+xml");
      return {
        errors: xml.querySelectorAll("parsererror").length,
        texts: xml.querySelectorAll("text").length,
        images: xml.querySelectorAll("image,foreignObject,script").length,
      };
    }, copied),
  ).toEqual({
    errors: 0,
    texts: await preview.locator("text").count(),
    images: 0,
  });
  const pending = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Download .svg for Figma", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("ZamnCraft-Editor-UI-Kit.svg");
  expect(await readFile((await download.path())!, "utf8")).toBe(copied);
  await dialog.getByRole("checkbox").uncheck();
  await expect(preview.locator('[id^="Export-Code-Modal-"]')).toHaveCount(0);
  await expect(preview.locator('[id^="Selection-Box-"]')).toHaveCount(1);
  await page.keyboard.press("t");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select (V)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-editor-element]")).toHaveCount(1);
});

test("clipboard failures offer SVG download instead and the dialog works on mobile without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  const dialog = await openKit(page, true);
  await dialog
    .getByRole("button", { name: "Copy UI for Figma", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Clipboard unavailable",
  );
  await expect(
    dialog.getByRole("button", {
      name: "Download .svg for Figma",
      exact: true,
    }),
  ).toBeInViewport();
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open project navigation", exact: true }),
  ).toBeFocused();
});
