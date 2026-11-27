import { expect, test, type Locator, type Page } from "@playwright/test";

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector", exact: true });
const effects = (page: Page) =>
  panel(page).getByRole("region", {
    name: "Effects & Animations",
    exact: true,
  });
async function number(page: Page, name: string, value: number) {
  const input = effects(page).getByRole("spinbutton", { name, exact: true });
  await input.fill(String(value));
  await input.blur();
}
async function setup(page: Page) {
  const root = page.locator('[data-editor-element="desktop"]');
  await page.getByRole("button", { name: "Frame (F)", exact: true }).click();
  const box = (await root.boundingBox())!;
  await page.mouse.click(
    Math.round(box.x + (120 * box.width) / 1200),
    Math.round(box.y + (130 * box.width) / 1200),
  );
  const node = root.locator(':scope > [data-element-type="frame"]');
  return { node, root };
}
async function appear(page: Page) {
  await effects(page)
    .getByRole("checkbox", { name: "Appear enabled", exact: true })
    .check();
  await number(page, "Appear opacity", 10);
  await number(page, "Appear scale", 0.8);
  await number(page, "Appear X offset", 40);
  await number(page, "Appear Y offset", -20);
  await number(page, "Transition duration", 1);
}
async function state(node: Locator) {
  return node.evaluate((node) => {
    const css = getComputedStyle(node);
    const matrix = new DOMMatrix(css.transform);
    return {
      scale: Math.hypot(matrix.a, matrix.b),
      rotate: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
      opacity: Number(css.opacity),
      fill: css.backgroundColor,
      x: matrix.e,
      y: matrix.f,
    };
  });
}
async function hoverAndPress(page: Page) {
  await effects(page)
    .getByRole("checkbox", { name: "Hover enabled", exact: true })
    .check();
  await number(page, "Hover scale", 1.2);
  await number(page, "Hover rotate", 12);
  await effects(page)
    .getByRole("checkbox", { name: "Hover fill override", exact: true })
    .check();
  await effects(page)
    .getByRole("textbox", { name: "Hover fill hex", exact: true })
    .fill("#ff8800");
  await effects(page)
    .getByRole("checkbox", { name: "Hover opacity override", exact: true })
    .check();
  await number(page, "Hover opacity", 60);
  await effects(page)
    .getByRole("checkbox", { name: "Press enabled", exact: true })
    .check();
  await number(page, "Press scale", 0.8);
  await number(page, "Transition duration", 0.1);
}
async function center(node: Locator) {
  const box = (await node.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("Inspector effects are selection-bound; replay uses configured appear keyframes without changing document geometry", async ({
  page,
}) => {
  await expect(
    effects(page).getByRole("checkbox", {
      name: "Appear enabled",
      exact: true,
    }),
  ).toBeDisabled();
  const { node } = await setup(page);
  const before = await node.getAttribute("style");
  await appear(page);
  await expect(node).toHaveCSS("transform", "none");
  await effects(page)
    .getByRole("button", { name: "Replay animation", exact: true })
    .click();
  const start = await node.evaluate((node) => {
    const animation = node.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    const frames = (animation.effect as KeyframeEffect).getKeyframes();
    return {
      frames,
      opacity: getComputedStyle(node).opacity,
      transform: getComputedStyle(node).transform,
    };
  });
  expect(Number(start.opacity)).toBeCloseTo(0.1, 2);
  expect(start.transform).toContain("0.8");
  expect(start.frames[0].transform).toContain("translate(40px, -20px)");
  await node.evaluate((node) => node.getAnimations()[0].finish());
  await expect
    .poll(() => node.evaluate((node) => node.getAnimations().length))
    .toBe(0);
  await expect(node).toHaveCSS("transform", "none");
  await expect(node).toHaveAttribute("style", before!);
  // A second replay restarts instead of leaving an accumulated transform behind.
  await effects(page)
    .getByRole("button", { name: "Replay animation", exact: true })
    .click();
  await expect
    .poll(() => node.evaluate((node) => node.getAnimations().length))
    .toBe(1);
  const box = (await node.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(node).toHaveCSS("transform", "none");
  await expect(node).toHaveAttribute("style", before!);
});

test("preview runs appear recursively, hides editing chrome, blocks mutation shortcuts, and restores selection and camera", async ({
  page,
}) => {
  const { node } = await setup(page);
  await appear(page);
  const camera = await page.locator(".canvas-world").getAttribute("style");
  const geometry = await node.getAttribute("style");
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Live preview", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".canvas-selection-box")).toHaveCount(0);
  await expect(page.locator("[data-resize-handle]")).toHaveCount(0);
  await expect(page.locator(".canvas-frame-label")).toHaveCount(0);
  await expect(panel(page)).toBeHidden();
  await expect(
    page.getByRole("navigation", { name: "Editor tools", exact: true }),
  ).toBeHidden();
  await node.evaluate((node) => {
    const animation = node.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
  });
  expect((await state(node)).opacity).toBeCloseTo(0.1, 2);
  await node.evaluate((node) => node.getAnimations()[0].finish());
  await expect.poll(async () => (await state(node)).opacity).toBe(1);
  await page.locator("#editor-canvas").focus();
  await page.keyboard.press("Delete");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("f");
  await page.keyboard.press("t");
  const point = await center(node);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 50, point.y + 30);
  await page.mouse.up();
  await node.dblclick();
  await expect(page.locator('[contenteditable="plaintext-only"]')).toHaveCount(
    0,
  );
  await expect(node).toHaveAttribute("style", geometry!);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Preview site", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".canvas-world")).toHaveAttribute("style", camera!);
  await expect(node).toHaveAttribute("data-selected", "true");
  await expect(node.locator("[data-resize-handle]")).toHaveCount(8);
  await expect(node).toHaveCSS("transform", "none");
});

test("hover and press animate scale, rotation, fill and opacity, then restore the correct resting state", async ({
  page,
}) => {
  const { node } = await setup(page);
  await hoverAndPress(page);
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  const point = await center(node);
  await page.mouse.move(point.x, point.y);
  await expect.poll(async () => (await state(node)).scale).toBeCloseTo(1.2, 2);
  await expect.poll(async () => (await state(node)).rotate).toBeCloseTo(12, 1);
  await expect(node).toHaveCSS("background-color", "rgb(255, 136, 0)");
  await expect(node).toHaveCSS("opacity", "0.6");
  await page.mouse.down();
  await expect.poll(async () => (await state(node)).scale).toBeCloseTo(0.8, 2);
  await page.mouse.up();
  await expect.poll(async () => (await state(node)).scale).toBeCloseTo(1.2, 2);
  await page.mouse.move(20, 100);
  await expect.poll(async () => (await state(node)).scale).toBeCloseTo(1, 2);
  await expect(node).toHaveCSS("opacity", "1");
  await expect(node).toHaveCSS("background-color", "rgb(229, 229, 229)");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect.poll(async () => (await state(node)).scale).toBeCloseTo(0.8, 2);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  await expect.poll(async () => (await state(node)).scale).toBeCloseTo(1, 2);
  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
  await expect(node).toHaveCSS("transform", "none");
  await expect(node).toHaveCSS("opacity", "1");
  expect(await node.evaluate((node) => node.getAnimations().length)).toBe(0);
  await expect(
    effects(page).getByRole("spinbutton", { name: "Hover scale", exact: true }),
  ).toHaveValue("1.2");
});

test("spring stiffness and damping produce a native spring curve with visible overshoot", async ({
  page,
}) => {
  const { node } = await setup(page);
  await effects(page)
    .getByRole("checkbox", { name: "Hover enabled", exact: true })
    .check();
  await number(page, "Hover scale", 1.3);
  await effects(page)
    .getByRole("combobox", { name: "Transition", exact: true })
    .selectOption("spring");
  await number(page, "Spring stiffness", 100);
  await number(page, "Spring damping", 5);
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  await page.mouse.move(20, 100);
  await node.evaluate((node) =>
    node.getAnimations().forEach((animation) => animation.finish()),
  );
  const point = await center(node);
  await page.mouse.move(point.x, point.y);
  await expect
    .poll(() =>
      node.evaluate(
        (node) =>
          (node.getAnimations()[0]?.effect as KeyframeEffect | undefined)
            ?.getKeyframes()
            .at(-1)?.transform,
      ),
    )
    .toContain("scale(1.3)");
  const timing = await node.evaluate((node) => {
    const animation = node.getAnimations()[0];
    animation.pause();
    const timing = animation.effect!.getTiming();
    const values = timing.easing!
      .slice(7, -1)
      .split(",")
      .map((value) => parseFloat(value));
    const peak = values.indexOf(Math.max(...values));
    animation.currentTime =
      (Number(timing.duration) * peak) / (values.length - 1);
    return {
      easing: timing.easing,
      scale: new DOMMatrix(getComputedStyle(node).transform).a,
    };
  });
  expect(timing.easing).toMatch(/^linear\(/);
  expect(timing.scale).toBeGreaterThan(1.3);
  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
});

test("blur and shadow bind in both modes while invalid shadow drafts revert safely", async ({
  page,
}) => {
  const { node } = await setup(page);
  await number(page, "Blur", 2);
  await effects(page)
    .getByRole("combobox", { name: "Shadow preset", exact: true })
    .selectOption("0 8px 24px #00000040");
  await expect(node).toHaveCSS("filter", "blur(2px)");
  await expect(node).toHaveCSS(
    "box-shadow",
    "rgba(0, 0, 0, 0.25) 0px 8px 24px 0px",
  );
  const shadow = effects(page).getByRole("textbox", {
    name: "Shadow",
    exact: true,
  });
  await shadow.fill("not a shadow");
  await shadow.blur();
  await expect(shadow).toHaveValue("0 8px 24px #00000040");
  await shadow.fill("0 2px 6px #123456");
  await shadow.blur();
  await expect(node).toHaveCSS("box-shadow", "rgb(18, 52, 86) 0px 2px 6px 0px");
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  await expect(node).toHaveCSS("filter", "blur(2px)");
  await expect(node).toHaveCSS("box-shadow", "rgb(18, 52, 86) 0px 2px 6px 0px");
  await page.keyboard.press("Escape");
  await number(page, "Blur", 0);
  await effects(page)
    .getByRole("combobox", { name: "Shadow preset", exact: true })
    .selectOption("none");
  await expect(node).toHaveCSS("filter", "none");
  await expect(node).toHaveCSS("box-shadow", "none");
});

test("reduced-motion preference suppresses appear and transform motion without losing hover color feedback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { node } = await setup(page);
  await appear(page);
  await hoverAndPress(page);
  await effects(page)
    .getByRole("button", { name: "Replay animation", exact: true })
    .click();
  await expect(node).toHaveCSS("opacity", "1");
  await expect(node).toHaveCSS("transform", "none");
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  const point = await center(node);
  await page.mouse.move(point.x, point.y);
  await expect(node).toHaveCSS("background-color", "rgb(255, 136, 0)");
  expect((await state(node)).scale).toBeCloseTo(1, 3);
  expect((await state(node)).rotate).toBeCloseTo(0, 3);
  expect(
    await node.evaluate(
      (node) =>
        node
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
});

test("narrow screens can configure effects and enter/exit a full-width live preview", async ({
  page,
}) => {
  const { node } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open inspector", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Inspector properties",
    exact: true,
  });
  await dialog
    .getByRole("checkbox", { name: "Appear enabled", exact: true })
    .check();
  await dialog
    .getByRole("spinbutton", { name: "Appear Y offset", exact: true })
    .fill("12");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Preview site", exact: true }).click();
  const preview = page.getByRole("region", {
    name: "Live preview",
    exact: true,
  });
  expect((await preview.boundingBox())!.width).toBe(390);
  await expect(node).toBeVisible();
  await expect(page.locator("[data-resize-handle]")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
  await expect(node).toHaveAttribute("data-selected", "true");
  await expect(node.locator("[data-resize-handle]")).toHaveCount(8);
});
