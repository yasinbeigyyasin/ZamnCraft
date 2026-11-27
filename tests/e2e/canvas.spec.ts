import { expect, test, type Page } from "@playwright/test";

const desktopSelector = '[data-editor-element="desktop"]';

async function frameBox(page: Page) {
  const box = await page.locator(desktopSelector).boundingBox();
  if (!box) throw new Error("Desktop frame is not visible");
  return box;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("Desktop starts fitted to the canvas and selection is shared with Layers", async ({
  page,
}) => {
  const canvas = (await page
    .getByRole("region", { name: "Design canvas" })
    .boundingBox())!;
  const frame = await frameBox(page);
  expect(frame.x).toBeGreaterThan(canvas.x);
  expect(frame.y).toBeGreaterThan(canvas.y);
  expect(frame.x + frame.width).toBeLessThan(canvas.x + canvas.width);
  expect(frame.y + frame.height).toBeLessThan(canvas.y + canvas.height);
  await page.locator(desktopSelector).click({ position: { x: 50, y: 50 } });
  await expect(page.locator(desktopSelector)).toHaveAttribute(
    "data-selected",
    "true",
  );
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Desktop", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("region", { name: "Design canvas" })
    .click({ position: { x: 10, y: 100 } });
  await expect(page.locator(desktopSelector)).toHaveAttribute(
    "data-selected",
    "false",
  );
  await page.getByRole("button", { name: "Desktop", exact: true }).click();
  await expect(page.locator(desktopSelector)).toHaveAttribute(
    "data-selected",
    "true",
  );
});

test("Space + left drag pans in screen pixels and does not select the frame", async ({
  page,
}) => {
  const canvas = page.getByRole("region", { name: "Design canvas" });
  const before = await frameBox(page);
  await canvas.focus();
  await page.mouse.move(before.x + 100, before.y + 100);
  await page.keyboard.down("Space");
  await expect(canvas).toHaveCSS("cursor", "grab");
  await page.mouse.down();
  await expect(canvas).toHaveCSS("cursor", "grabbing");
  await page.mouse.move(before.x + 180, before.y + 140, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  const after = await frameBox(page);
  expect(after.x - before.x).toBeCloseTo(80, 2);
  expect(after.y - before.y).toBeCloseTo(40, 2);
  expect(after.width).toBeCloseTo(before.width, 2);
  await expect(page.locator(desktopSelector)).toHaveAttribute(
    "data-selected",
    "false",
  );
  await expect(canvas).toHaveCSS("cursor", "auto");
});

test("middle drag works with the Text tool and releases outside the canvas", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Text (T)", exact: true }).click();
  const before = await frameBox(page);
  await page.mouse.move(before.x + 100, before.y + 100);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(1300, before.y + 70, { steps: 5 });
  await page.mouse.up({ button: "middle" });
  const after = await frameBox(page);
  expect(after.x - before.x).toBeCloseTo(1300 - before.x - 100, 2);
  expect(after.y - before.y).toBeCloseTo(-30, 2);
  await page.mouse.move(700, 500);
  expect((await frameBox(page)).x).toBeCloseTo(after.x, 2);
  await expect(page.locator(desktopSelector)).toHaveAttribute(
    "data-selected",
    "false",
  );
  await expect(page.getByRole("region", { name: "Design canvas" })).toHaveCSS(
    "cursor",
    "text",
  );
});

test("Ctrl and Cmd wheel zoom are pointer anchored and unmodified scrolling does not zoom", async ({
  page,
}) => {
  let before = await frameBox(page);
  const pointer = {
    x: Math.round(before.x + before.width * 0.3),
    y: Math.round(before.y + before.height * 0.4),
  };
  await page.mouse.move(pointer.x, pointer.y);
  await page.mouse.wheel(0, -100);
  expect((await frameBox(page)).width).toBeCloseTo(before.width, 2);
  for (const modifier of ["Control", "Meta"]) {
    before = await frameBox(page);
    const worldRatio = {
      x: (pointer.x - before.x) / before.width,
      y: (pointer.y - before.y) / before.height,
    };
    await page.keyboard.down(modifier);
    await page.mouse.wheel(0, -120);
    await page.keyboard.up(modifier);
    await expect
      .poll(async () => (await frameBox(page)).width)
      .toBeGreaterThan(before.width);
    const after = await frameBox(page);
    expect(after.x + after.width * worldRatio.x).toBeCloseTo(pointer.x, 2);
    expect(after.y + after.height * worldRatio.y).toBeCloseTo(pointer.y, 2);
  }
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
});

test("modifier wheel cancels browser zoom and supports line and page deltas", async ({
  page,
}) => {
  for (const deltaMode of [1, 2]) {
    const before = await frameBox(page);
    const prevented = await page
      .getByRole("region", { name: "Design canvas" })
      .evaluate((canvas, mode) => {
        const box = canvas.getBoundingClientRect();
        const event = new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -1,
          deltaMode: mode,
          clientX: box.left + 200,
          clientY: box.top + 200,
        });
        canvas.dispatchEvent(event);
        return event.defaultPrevented;
      }, deltaMode);
    expect(prevented).toBe(true);
    await expect
      .poll(async () => (await frameBox(page)).width)
      .toBeGreaterThan(before.width);
  }
});

test("blur cancels a drag and modal input cannot change the canvas", async ({
  page,
}) => {
  const canvas = page.getByRole("region", { name: "Design canvas" });
  const before = await frameBox(page);
  await canvas.focus();
  await page.keyboard.down("Space");
  await page.mouse.move(before.x + 100, before.y + 100);
  await page.mouse.down();
  await page.mouse.move(before.x + 130, before.y + 100);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const afterBlur = await frameBox(page);
  await page.mouse.move(before.x + 230, before.y + 100);
  await page.mouse.up();
  await page.keyboard.up("Space");
  expect((await frameBox(page)).x).toBeCloseTo(afterBlur.x, 2);
  await expect(canvas).toHaveCSS("cursor", "auto");
  await page.getByRole("button", { name: "Export Code", exact: true }).click();
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  const afterModal = await frameBox(page);
  expect(afterModal.x).toBeCloseTo(afterBlur.x, 2);
  expect(afterModal.width).toBeCloseTo(afterBlur.width, 2);
});

test("fit view restores the initial position and zoom is anchored to the bottom-right", async ({
  page,
}) => {
  const initial = await frameBox(page);
  await page
    .getByRole("button", { name: /Canvas zoom .*reset to 100%/ })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Canvas zoom 100%, reset to 100%",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset canvas view" }).click();
  const fitted = await frameBox(page);
  expect(fitted.x).toBeCloseTo(initial.x, 2);
  expect(fitted.y).toBeCloseTo(initial.y, 2);
  expect(fitted.width).toBeCloseTo(initial.width, 2);
  const controls = (await page
    .getByRole("group", { name: "Canvas zoom" })
    .boundingBox())!;
  const canvas = (await page
    .getByRole("region", { name: "Design canvas" })
    .boundingBox())!;
  expect(canvas.x + canvas.width - controls.x - controls.width).toBeCloseTo(
    20,
    2,
  );
  expect(canvas.y + canvas.height - controls.y - controls.height).toBeCloseTo(
    20,
    2,
  );
});
