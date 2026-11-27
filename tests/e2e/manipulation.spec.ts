import { choose, expectChoice } from "./control-helpers";
import { expect, test, type Locator, type Page } from "@playwright/test";

const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
const root = (page: Page) => page.locator('[data-editor-element="desktop"]');
const field = (page: Page, name: string) =>
  page
    .getByRole("complementary", { name: "Inspector", exact: true })
    .getByRole("spinbutton", { name, exact: true });

async function setNumber(page: Page, name: string, value: number) {
  await field(page, name).fill(String(value));
  await field(page, name).blur();
}

async function add(
  page: Page,
  parent: Locator,
  type: "Frame" | "Text",
  x: number,
  y: number,
) {
  await page
    .getByRole("button", {
      name: `${type} (${type === "Frame" ? "F" : "T"})`,
      exact: true,
    })
    .click();
  const box = (await parent.boundingBox())!;
  const width = await parent.evaluate(
    (node) => (node as HTMLElement).offsetWidth,
  );
  await page.mouse.click(
    Math.round(box.x + (x * box.width) / width),
    Math.round(box.y + (y * box.width) / width),
  );
  const child = parent
    .locator(`:scope > [data-element-type="${type.toLowerCase()}"]`)
    .last();
  const id = await child.getAttribute("data-editor-element");
  return page.locator(`[data-editor-element="${id}"]`);
}

async function select(page: Page, node: Locator) {
  const id = await node.getAttribute("data-editor-element");
  await page.getByRole("tab", { name: "layers", exact: true }).click();
  await page.locator(`[data-layer-id="${id}"] .layer-name`).click();
}

async function geometry(node: Locator) {
  return node.evaluate((node) => {
    const style = (node as HTMLElement).style;
    return {
      x: parseFloat(style.left),
      y: parseFloat(style.top),
      width: (node as HTMLElement).offsetWidth,
      height: (node as HTMLElement).offsetHeight,
    };
  });
}

async function begin(page: Page, node: Locator) {
  const box = (await node.boundingBox())!;
  const point = {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  return point;
}

async function beginHandle(page: Page, node: Locator, handle: string) {
  return begin(
    page,
    node.locator(
      `:scope > .canvas-selection-box > [data-resize-handle="${handle}"]`,
    ),
  );
}

async function scale(page: Page) {
  return (await root(page).boundingBox())!.width / 1200;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("nested children drag in parent-local coordinates at 25%, 100% and 200% zoom with live Inspector updates", async ({
  page,
}) => {
  const parent = await add(page, root(page), "Frame", 400, 300);
  await setNumber(page, "X", 400);
  await setNumber(page, "Y", 300);
  await setNumber(page, "Width", 500);
  await setNumber(page, "Height", 400);
  const child = await add(page, parent, "Frame", 40, 50);
  for (const zoom of [0.25, 1, 2]) {
    await setNumber(page, "X", 40);
    await setNumber(page, "Y", 50);
    await page
      .getByRole("button", { name: /Canvas zoom .*reset to 100%/ })
      .click();
    for (let i = 0; i < Math.abs(zoom - 1) / 0.25; i++)
      await page
        .getByRole("button", {
          name: zoom > 1 ? "Zoom in" : "Zoom out",
          exact: true,
        })
        .click();
    const transform = await page.locator(".canvas-world").getAttribute("style");
    const z = await scale(page);
    await expect(child.locator("[data-resize-handle]")).toHaveCount(8);
    const handleSize = (await child
      .locator('[data-resize-handle="se"]')
      .boundingBox())!;
    expect(handleSize.width).toBeCloseTo(8, 2);
    expect(handleSize.height).toBeCloseTo(8, 2);
    await page.keyboard.down("Alt");
    const point = await begin(page, child);
    await page.mouse.move(point.x + 20, point.y + 12, { steps: 6 });
    expect(Number(await field(page, "X").inputValue())).toBeCloseTo(
      40 + 20 / z,
      1,
    );
    expect(Number(await field(page, "Y").inputValue())).toBeCloseTo(
      50 + 12 / z,
      1,
    );
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await expect(child).toHaveAttribute("data-selected", "true");
    await expect(parent).toHaveAttribute("data-selected", "false");
    await expect(page.locator(".canvas-world")).toHaveAttribute(
      "style",
      transform!,
    );
    await expect(parent).toHaveCSS("left", "400px");
  }
});

test("all eight resize handles update live sizes, offsets and badge while anchoring the opposite edge", async ({
  page,
}) => {
  const child = await add(page, root(page), "Frame", 160, 170);
  const z = await scale(page);
  await page.keyboard.down("Alt");
  for (const handle of handles) {
    for (const [name, value] of [
      ["X", 160],
      ["Y", 170],
      ["Width", 200],
      ["Height", 160],
    ] as const)
      await setNumber(page, name, value);
    const point = await beginHandle(page, child, handle);
    await page.mouse.move(point.x + 24, point.y + 18, { steps: 5 });
    await expect(child).toHaveCSS("cursor", `${handle}-resize`);
    const expected = {
      x: 160 + (handle.includes("w") ? 24 / z : 0),
      y: 170 + (handle.includes("n") ? 18 / z : 0),
      width:
        200 +
        (handle.includes("w") ? -24 / z : handle.includes("e") ? 24 / z : 0),
      height:
        160 +
        (handle.includes("n") ? -18 / z : handle.includes("s") ? 18 / z : 0),
    };
    for (const [name, value] of [
      ["X", expected.x],
      ["Y", expected.y],
      ["Width", expected.width],
      ["Height", expected.height],
    ] as const)
      expect(Number(await field(page, name).inputValue())).toBeCloseTo(
        value,
        1,
      );
    await expect(child.locator(".canvas-selection-label")).toHaveText(
      `Frame${Math.round(expected.width)} × ${Math.round(expected.height)}`,
    );
    await page.mouse.up();
    const after = await geometry(child);
    await page.mouse.move(point.x + 50, point.y + 40);
    expect(await geometry(child)).toEqual(after);
    await expect(child).toHaveAttribute("data-selected", "true");
  }
  await page.keyboard.up("Alt");
});

test("resize cannot flip or create negative dimensions and Escape restores Fill/Fit sizing", async ({
  page,
}) => {
  const parent = await add(page, root(page), "Frame", 100, 100);
  await setNumber(page, "Width", 400);
  await setNumber(page, "Height", 300);
  const text = await add(page, parent, "Text", 10, 50);
  const panel = page.getByRole("complementary", {
    name: "Inspector",
    exact: true,
  });
  await choose(
    panel.getByRole("group", { name: "Width sizing", exact: true }),
    "fill",
  );
  const before = await geometry(text);
  await page.keyboard.down("Alt");
  let point = await beginHandle(page, text, "e");
  await page.mouse.move(point.x - 50, point.y);
  await expectChoice(
    panel.getByRole("group", { name: "Width sizing", exact: true }),
    "fixed",
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expectChoice(
    panel.getByRole("group", { name: "Width sizing", exact: true }),
    "fill",
  );
  await expectChoice(
    panel.getByRole("group", { name: "Height sizing", exact: true }),
    "fit",
  );
  expect(await geometry(text)).toEqual(before);
  point = await beginHandle(page, text, "nw");
  await page.mouse.move(point.x + 500, point.y + 300, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  const after = await geometry(text);
  expect(after.width).toBe(8);
  expect(after.height).toBe(8);
  expect(after.x + after.width).toBeCloseTo(before.x + before.width, 1);
  expect(after.y + after.height).toBeCloseTo(before.y + before.height, 1);
});

test("parent centers, parent edges and sibling edges snap with guides during moves and resizes", async ({
  page,
}) => {
  const child = await add(page, root(page), "Frame", 110, 120);
  const sibling = await add(page, root(page), "Frame", 350, 340);
  await setNumber(page, "X", 350);
  await setNumber(page, "Y", 340);
  await select(page, child);
  await setNumber(page, "X", 110);
  await setNumber(page, "Y", 120);
  const z = await scale(page);
  let before = await geometry(child);
  let point = await begin(page, child);
  await page.mouse.move(point.x + (497 - before.x) * z, point.y, { steps: 5 });
  await expect(field(page, "X")).toHaveValue("500");
  await expect(page.locator('[data-guide-axis="x"]')).toHaveCSS(
    "left",
    "600px",
  );
  await page.mouse.up();
  await expect(page.locator(".canvas-alignment-guide")).toHaveCount(0);
  before = await geometry(child);
  point = await begin(page, child);
  await page.mouse.move(point.x + (3 - before.x) * z, point.y);
  await expect(field(page, "X")).toHaveValue("0");
  await page.mouse.up();
  point = await begin(page, child);
  await page.mouse.move(point.x + 347 * z, point.y);
  await expect(field(page, "X")).toHaveValue("350");
  await expect(page.locator('[data-guide-axis="x"]')).toHaveCSS(
    "left",
    "350px",
  );
  await page.mouse.up();
  await setNumber(page, "X", 110);
  point = await beginHandle(page, child, "e");
  await page.mouse.move(point.x + 38 * z, point.y);
  await expect(field(page, "Width")).toHaveValue("240");
  await expect(page.locator('[data-guide-axis="x"]')).toHaveCSS(
    "left",
    "350px",
  );
  await page.mouse.up();
  await expect(sibling).toHaveCSS("left", /350/);
  // Alt bypasses snapping even while still within the screen-space threshold.
  await setNumber(page, "Width", 200);
  await page.keyboard.down("Alt");
  point = await beginHandle(page, child, "e");
  await page.mouse.move(point.x + 38 * z, point.y);
  expect(Number(await field(page, "Width").inputValue())).toBeLessThan(240);
  await expect(page.locator(".canvas-alignment-guide")).toHaveCount(0);
  await page.mouse.up();
  await page.keyboard.up("Alt");
});

test("cancel, capture loss, blur, tool changes and dialogs end gestures without leaving mutations or guides", async ({
  page,
}) => {
  const child = await add(page, root(page), "Frame", 110, 120);
  for (const reason of ["cancel", "capture", "blur", "tool", "dialog"]) {
    const before = await geometry(child);
    const point = await begin(page, child);
    await page.mouse.move(point.x + 30, point.y + 20, { steps: 3 });
    expect((await geometry(child)).x).not.toBe(before.x);
    if (reason === "cancel")
      await child.dispatchEvent("pointercancel", { pointerId: 1 });
    if (reason === "capture")
      await child.evaluate((node) =>
        (node as HTMLElement).releasePointerCapture(1),
      );
    if (reason === "blur")
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    if (reason === "tool") await page.keyboard.press("f");
    if (reason === "dialog")
      await page
        .getByRole("button", { name: "Export Code", exact: true })
        .evaluate((node) => (node as HTMLButtonElement).click());
    await page.mouse.up();
    if (reason === "dialog") await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Select (V)", exact: true }).click();
    expect(await geometry(child)).toEqual(before);
    await expect(page.locator(".canvas-alignment-guide")).toHaveCount(0);
    await page.mouse.move(point.x + 90, point.y + 90);
    expect(await geometry(child)).toEqual(before);
  }
});

test("pointer capture commits release outside the canvas, ignores wheel zoom mid-gesture, and keeps Space panning separate", async ({
  page,
}) => {
  const child = await add(page, root(page), "Frame", 110, 120);
  const initial = await geometry(child);
  const z = await scale(page);
  const point = await begin(page, child);
  await page.mouse.move(point.x + 30, point.y + 20);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -120);
  await page.keyboard.up("Control");
  expect(await scale(page)).toBeCloseTo(z, 3);
  await page.mouse.move(1300, 500, { steps: 5 });
  const live = await geometry(child);
  expect(live.x).toBeGreaterThan(initial.x);
  await page.mouse.up();
  await page.mouse.move(600, 600);
  expect(await geometry(child)).toEqual(live);
  await setNumber(page, "X", 110);
  await setNumber(page, "Y", 120);
  const beforePan = await geometry(child);
  await page.locator("#editor-canvas").focus();
  await page.keyboard.down("Space");
  const panPoint = await begin(page, child);
  await page.mouse.move(panPoint.x + 30, panPoint.y + 20);
  await page.mouse.up();
  await page.keyboard.up("Space");
  expect(await geometry(child)).toEqual(beforePan);
  await expect(page.locator(".canvas-alignment-guide")).toHaveCount(0);
});

test.describe("touch manipulation", () => {
  test.use({ hasTouch: true });
  test("primary touch drags and resizes an element, and cancellation restores its position", async ({
    page,
  }) => {
    const child = await add(page, root(page), "Frame", 110, 120);
    const before = await geometry(child);
    const box = (await child.boundingBox())!;
    const x = Math.round(box.x + 30),
      y = Math.round(box.y + 30);
    const z = await scale(page);
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 30, y: y + 24 }],
    });
    await expect
      .poll(async () => (await geometry(child)).x)
      .toBeCloseTo(before.x + 30 / z, 1);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await expect.poll(() => geometry(child)).toEqual(before);
    const handle = (await child
      .locator('[data-resize-handle="se"]')
      .boundingBox())!;
    const handlePoint = {
      x: Math.round(handle.x + handle.width / 2),
      y: Math.round(handle.y + handle.height / 2),
    };
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [handlePoint],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: handlePoint.x + 24, y: handlePoint.y + 18 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect((await geometry(child)).width).toBeCloseTo(before.width + 24 / z, 0);
    expect((await geometry(child)).height).toBeCloseTo(
      before.height + 18 / z,
      0,
    );
    await session.detach();
  });
});

test("bordered elements keep constant-size handles on their actual outer corners", async ({
  page,
}) => {
  const child = await add(page, root(page), "Frame", 200, 200);
  await page.getByRole("button", { name: "Add border", exact: true }).click();
  await setNumber(page, "Border width", 6);
  for (const count of [0, 1, 2]) {
    if (count)
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    const box = (await child.boundingBox())!;
    for (const handle of ["nw", "se"]) {
      const corner = (await child
        .locator(`[data-resize-handle="${handle}"]`)
        .boundingBox())!;
      expect(corner.width).toBeCloseTo(8, 2);
      expect(corner.x + corner.width / 2).toBeCloseTo(
        handle === "nw" ? box.x : box.x + box.width,
        1,
      );
      expect(corner.y + corner.height / 2).toBeCloseTo(
        handle === "nw" ? box.y : box.y + box.height,
        1,
      );
    }
  }
});

test("direct manipulation keeps Stack children in relative flow rather than detaching or reparenting them", async ({
  page,
}) => {
  const parent = await add(page, root(page), "Frame", 100, 100);
  await setNumber(page, "Width", 500);
  await setNumber(page, "Height", 400);
  const child = await add(page, parent, "Frame", 20, 20);
  await select(page, parent);
  await page
    .getByRole("complementary", { name: "Inspector", exact: true })
    .getByRole("button", { name: "Stack", exact: true })
    .click();
  await select(page, child);
  const before = await geometry(child);
  const z = await scale(page);
  await page.keyboard.down("Alt");
  const point = await begin(page, child);
  await page.mouse.move(point.x + 20, point.y + 30);
  await page.mouse.up();
  await page.keyboard.up("Alt");
  expect((await geometry(child)).x).toBeCloseTo(before.x + 20 / z, 1);
  expect((await geometry(child)).y).toBeCloseTo(before.y + 30 / z, 1);
  await expect(child).toHaveCSS("position", "relative");
  await expect(parent.locator(":scope > [data-editor-element]")).toHaveCount(1);
});
