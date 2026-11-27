import { expect, test, type Page } from "@playwright/test";
import { choose } from "./control-helpers";
const root = (page: Page) => page.locator('[data-editor-element="desktop"]');
const shapes = (page: Page) => page.locator('[data-element-type="shape"]');
async function point(page: Page, x: number, y: number) {
  const box = (await root(page).boundingBox())!;
  return {
    x: box.x + (x * box.width) / 1920,
    y: box.y + (y * box.width) / 1920,
  };
}
async function click(page: Page, x: number, y: number) {
  const p = await point(page, x, y);
  await page.mouse.click(p.x, p.y);
}
async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  const a = await point(page, x, y),
    b = await point(page, x + dx, y + dy);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}
async function saved(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("zamncraft.workspace.v1") ?? "null"),
  );
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".canvas-world")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});
test("dock is bottom-centered inside the canvas, with a single movement dropdown and accessible upward menus", async ({
  page,
}) => {
  const dock = page.getByRole("navigation", {
    name: "Editor tools",
    exact: true,
  });
  const viewport = page.getByRole("region", {
    name: "Design canvas",
    exact: true,
  });
  const canvasBox = (await viewport.boundingBox())!,
    box = (await dock.boundingBox())!;
  expect(box.x + box.width / 2).toBeCloseTo(
    canvasBox.x + canvasBox.width / 2,
    0,
  );
  expect(canvasBox.y + canvasBox.height - box.y - box.height).toBeCloseTo(
    18,
    0,
  );
  await expect(
    page
      .locator(".top-bar")
      .getByRole("button", { name: "Move (V)", exact: true }),
  ).toHaveCount(0);
  const movement = dock.getByRole("combobox", {
    name: "Choose movement tool",
    exact: true,
  });
  await movement.click();
  const menu = page.getByRole("listbox", {
    name: "Choose movement tool",
    exact: true,
  });
  await expect(menu.getByRole("option")).toHaveCount(3);
  expect(
    (await menu.boundingBox())!.y + (await menu.boundingBox())!.height,
  ).toBeLessThan(box.y);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    dock.getByRole("button", { name: "Hand (H)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("k");
  await expect(
    dock.getByRole("button", { name: "Scale (K)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await choose(movement, "select");
  await expect(
    dock.getByRole("button", { name: "Move (V)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    const rect = (await dock.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    const controls = (await page
      .getByRole("group", { name: "Canvas zoom", exact: true })
      .boundingBox())!;
    expect(controls.y + controls.height).toBeLessThan(rect.y);
  }
  await dock
    .getByRole("combobox", { name: "Choose shape tool", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    dock.getByRole("combobox", { name: "Choose shape tool", exact: true }),
  ).toBeFocused();
});
test("all seven shape tools draw editable SVG geometry, survive reload, and export without spurious labels", async ({
  page,
}) => {
  const kinds = [
    "rectangle",
    "ellipse",
    "line",
    "arrow",
    "triangle",
    "polygon",
    "star",
  ];
  for (let i = 0; i < kinds.length; i++) {
    await choose(
      page.getByRole("combobox", { name: "Choose shape tool", exact: true }),
      kinds[i],
    );
    await drag(
      page,
      200 + (i % 4) * 350,
      180 + Math.floor(i / 4) * 350,
      200,
      150,
    );
    const shape = shapes(page).last();
    await expect(shape).toHaveAttribute("data-shape-kind", kinds[i]);
    expect(
      Math.abs((await shape.evaluate((n) => n.clientWidth)) - 200),
    ).toBeLessThanOrEqual(3);
    await expect(shape).toHaveCSS("background-image", /data:image\/svg\+xml/);
  }
  await expect(
    root(page).locator(':scope > [data-element-type="shape"]'),
  ).toHaveCount(7);
  await page.keyboard.press("Control+z");
  await expect(shapes(page)).toHaveCount(6);
  await page.keyboard.press("Control+Shift+z");
  await expect(shapes(page)).toHaveCount(7);
  const ellipse = page.locator('[data-shape-kind="ellipse"]');
  const alpha = await ellipse.evaluate(async (n) => {
    const url = getComputedStyle(n).backgroundImage.slice(5, -2);
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 150;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0, 200, 150);
    return [
      context.getImageData(0, 0, 1, 1).data[3],
      context.getImageData(100, 75, 1, 1).data[3],
    ];
  });
  expect(alpha).toEqual([0, 255]);
  await expect
    .poll(async () => (await saved(page))?.pages[0].elements[0].children.length)
    .toBe(7);
  await page.reload();
  await expect(shapes(page)).toHaveCount(7);
  await page.getByRole("button", { name: "Export Code", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export Code", exact: true });
  for (const target of ["React", "Vue", "Svelte", "HTML/CSS"]) {
    await dialog.getByRole("tab", { name: target, exact: true }).click();
    const code = await dialog
      .getByRole("textbox", { name: "Generated code", exact: true })
      .textContent();
    expect(code).toContain("data:image/svg+xml");
    expect(code).not.toMatch(/>Rectangle</);
  }
});
test("Pen supports curves, closing and double-click finish; unfinished paths cancel without deleting selected layers", async ({
  page,
}) => {
  await page.keyboard.press("p");
  await drag(page, 200, 200, 50, -50);
  await click(page, 600, 250);
  await click(page, 450, 600);
  await expect(page.locator('[data-vector-draft="pen"]')).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(shapes(page)).toHaveCount(1);
  await expect
    .poll(
      async () =>
        (await saved(page))?.pages[0].elements[0].children[0]?.vector.path,
    )
    .toContain("C");
  await page.keyboard.press("p");
  await click(page, 800, 200);
  await click(page, 1100, 200);
  await click(page, 1100, 500);
  await click(page, 800, 200);
  await expect(shapes(page)).toHaveCount(2);
  await expect
    .poll(async () =>
      (
        await saved(page)
      )?.pages[0].elements[0].children[1]?.vector.path.endsWith("Z"),
    )
    .toBe(true);
  await page.keyboard.press("p");
  await click(page, 1300, 200);
  await click(page, 1500, 250);
  const end = await point(page, 1600, 500);
  await page.mouse.dblclick(end.x, end.y);
  await expect(shapes(page)).toHaveCount(3);
  await page.keyboard.press("p");
  await click(page, 200, 700);
  await click(page, 400, 700);
  await page.keyboard.press("Backspace");
  await expect(page.locator("[data-vector-draft]")).toHaveCount(0);
  await expect(shapes(page)).toHaveCount(3);
  await page.keyboard.press("p");
  await click(page, 200, 700);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-vector-draft]")).toHaveCount(0);
  await expect(shapes(page)).toHaveCount(3);
});
test("Pencil draws multiple freehand strokes, cancels drafts, and Shift constrains shape proportions", async ({
  page,
}) => {
  await page.keyboard.press("Shift+p");
  await expect(
    page.getByRole("button", { name: "Pencil (Shift+P)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const start = await point(page, 300, 300);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [x, y] of [
    [350, 200],
    [450, 400],
    [550, 250],
    [650, 300],
  ]) {
    const p = await point(page, x, y);
    await page.mouse.move(p.x, p.y, { steps: 5 });
  }
  await page.mouse.up();
  await expect(shapes(page)).toHaveCount(1);
  await drag(page, 700, 300, 150, 200);
  await expect(shapes(page)).toHaveCount(2);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 50, start.y + 40);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(shapes(page)).toHaveCount(2);
  await page.keyboard.press("r");
  await page.keyboard.down("Shift");
  await drag(page, 1100, 250, 200, 100);
  await page.keyboard.up("Shift");
  const square = shapes(page).last();
  expect(await square.evaluate((n) => n.clientWidth)).toBe(
    await square.evaluate((n) => n.clientHeight),
  );
  await page.keyboard.press("Control+z");
  await expect(shapes(page)).toHaveCount(2);
});
