import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const source = readFileSync("figma/zamncraft-figma-import/code.js", "utf8");

type Font = { family: string; style: string };
function mockFigma(failure = "") {
  let currentPage: Node;
  const loaded = new Set<string>();
  let pagesCreated = 0;
  let framesCreated = 0;
  class Node {
    type: string;
    name = "";
    parent: Node | null = null;
    children: Node[] = [];
    removed = false;
    width = 100;
    height = 100;
    x = 0;
    y = 0;
    fontName?: Font;
    selection: Node[] = [];
    private content = "";
    constructor(type: string) {
      this.type = type;
    }
    appendChild(node: Node) {
      if (node.parent)
        node.parent.children = node.parent.children.filter(
          (child) => child !== node,
        );
      node.parent = this;
      this.children.push(node);
    }
    resize(width: number, height: number) {
      assert.ok(Number.isFinite(width) && width > 0, `invalid width ${width}`);
      assert.ok(
        Number.isFinite(height) && height > 0,
        `invalid height ${height}`,
      );
      this.width = width;
      this.height = height;
    }
    rescale(scale: number) {
      assert.ok(scale > 0);
      const visit = (node: Node) => {
        node.x *= scale;
        node.y *= scale;
        node.width *= scale;
        node.height *= scale;
        node.children.forEach(visit);
      };
      this.width *= scale;
      this.height *= scale;
      this.children.forEach(visit);
    }
    get characters() {
      return this.content;
    }
    set characters(value: string) {
      assert.ok(
        this.fontName && loaded.has(JSON.stringify(this.fontName)),
        "text written before font loaded",
      );
      assert.equal(typeof value, "string");
      this.content = value;
    }
    remove() {
      if (failure === "cleanup") throw new Error("cleanup denied");
      assert.notEqual(this, currentPage, "cannot remove the active page");
      this.removed = true;
      if (this.parent)
        this.parent.children = this.parent.children.filter(
          (child) => child !== this,
        );
    }
  }
  const root = new Node("DOCUMENT");
  const original = new Node("PAGE");
  original.name = "Existing user page";
  root.appendChild(original);
  currentPage = original;
  const existing = new Node("FRAME");
  existing.name = "Do not touch";
  original.appendChild(existing);
  const create = (type: string) => {
    const node = new Node(type);
    currentPage.appendChild(node);
    return node;
  };
  const api = {
    root,
    get currentPage() {
      return currentPage;
    },
    listAvailableFontsAsync: async () =>
      failure === "no-fonts"
        ? []
        : [
            {
              fontName: {
                family: failure === "fallback" ? "Roboto" : "Inter",
                style: "Regular",
              },
            },
            { fontName: { family: "Inter", style: "Bold" } },
          ],
    loadFontAsync: async (font: Font) => {
      if (failure === "font-load") throw new Error("font load denied");
      loaded.add(JSON.stringify(font));
    },
    createPage: () => {
      if (failure === "page-limit" && pagesCreated === 1)
        throw new Error("page limit reached");
      pagesCreated++;
      const page = new Node("PAGE");
      root.appendChild(page);
      return page;
    },
    setCurrentPageAsync: async (page: Node) => {
      assert.equal(page.type, "PAGE");
      assert.equal(page.removed, false);
      currentPage = page;
    },
    createFrame: () => {
      if (["mid-import", "cleanup"].includes(failure) && ++framesCreated === 30)
        throw new Error("frame creation failed");
      return create("FRAME");
    },
    createRectangle: () => create("RECTANGLE"),
    createText: () => create("TEXT"),
    createNodeFromSvg: (svg: string) => {
      assert.match(svg, /<path d="/);
      assert.ok(!svg.includes("<text") && !svg.includes("<image"));
      const node = create("FRAME");
      node.width = 24;
      node.height = 24;
      node.appendChild(new Node("VECTOR"));
      return node;
    },
    notify: (_message: string) => {},
    closePlugin: (message: string) => {
      result.message = message;
    },
    viewport: {
      scrollAndZoomIntoView: (nodes: Node[]) => {
        assert.equal(nodes.length, 1);
        assert.equal(nodes[0].name, "01 / Desktop · Pages");
      },
    },
  };
  const result = { api, original, existing, message: "" };
  return result;
}

async function run(failure = "") {
  const result = mockFigma(failure);
  await new Script(source, { filename: "code.js" }).runInNewContext(
    { figma: result.api },
    { timeout: 5000 },
  );
  return result;
}

test("local importer manifest targets Figma Design and denies all network access", () => {
  const manifest = JSON.parse(
    readFileSync("figma/zamncraft-figma-import/manifest.json", "utf8"),
  );
  assert.equal(manifest.main, "code.js");
  assert.equal(manifest.name, "ZamnCraft editable screen importer");
  assert.equal(manifest.api, "1.0.0");
  assert.equal(manifest.documentAccess, "dynamic-page");
  assert.deepEqual(manifest.editorType, ["figma"]);
  assert.deepEqual(manifest.networkAccess.allowedDomains, ["none"]);
  assert.ok(
    !/\bfetch\s*\(|XMLHttpRequest|WebSocket|\brequire\s*\(|\bimport\s*\(/.test(
      source,
    ),
  );
});

test("native importer creates two pages, 12 screens, all editable UI parts and preserves existing content", async () => {
  const result = await run();
  assert.match(result.message, /Created 2 ZamnCraft pages/);
  assert.equal(result.api.root.children.length, 3);
  assert.equal(result.original.children.length, 1);
  assert.equal(result.original.children[0], result.existing);
  const screens = result.api.root.children[1],
    parts = result.api.root.children[2];
  assert.equal(screens.name, "ZamnCraft · 01 Screens");
  assert.equal(parts.name, "ZamnCraft · 02 UI Parts");
  assert.equal(screens.children.length, 12);
  assert.equal(screens.children[0].width, 1440);
  assert.equal(screens.children[0].height, 900);
  assert.equal(screens.children[8].width, 390);
  assert.equal(screens.children[8].height, 844);
  assert.equal(result.api.currentPage, screens);
  const flatten = (node: typeof screens): (typeof screens)[] => [
    node,
    ...node.children.flatMap(flatten),
  ];
  const nodes = flatten(result.api.root);
  assert.ok(nodes.filter((node) => node.type === "TEXT").length > 500);
  assert.ok(nodes.filter((node) => node.type === "VECTOR").length > 100);
  for (const section of [
    "Position",
    "Size",
    "Layout",
    "Styles",
    "Typography",
    "Effects & Animations",
  ])
    assert.ok(
      nodes.some(
        (node) =>
          node.name === "Inspector section / " + section ||
          node.name.endsWith(" / " + section),
      ),
      section,
    );
  const full = parts.children.find((node) =>
    node.name.startsWith("05 / Full Inspector"),
  )!;
  assert.ok(full.height > 1500);
  assert.ok(nodes.some((node) => node.name === "Input / Shadow CSS"));
  assert.ok(nodes.some((node) => node.name === "Slider / Opacity"));
  assert.ok(nodes.some((node) => node.name === "Toggle / Fill override"));
});

for (const failure of ["page-limit", "mid-import", "font-load", "no-fonts"]) {
  test(`importer handles ${failure} without deleting existing content or leaving partial pages`, async () => {
    const result = await run(failure);
    assert.match(result.message, /ZamnCraft import failed:/);
    assert.equal(result.api.root.children.length, 1);
    assert.equal(result.api.currentPage, result.original);
    assert.equal(result.original.children.length, 1);
    assert.equal(result.original.children[0], result.existing);
  });
}

test("Roboto Regular fallback works without requiring a missing Bold font", async () => {
  assert.match((await run("fallback")).message, /Created 2 ZamnCraft pages/);
});

test("a repeated import adds new pages without replacing earlier imports", async () => {
  const result = await run();
  const previousScreens = result.api.root.children[1];
  await new Script(source).runInNewContext(
    { figma: result.api },
    { timeout: 5000 },
  );
  assert.equal(result.api.root.children.length, 5);
  assert.equal(result.api.root.children[1], previousScreens);
  assert.equal(previousScreens.children.length, 12);
  assert.equal(result.original.children[0], result.existing);
});

test("cleanup failures warn about partial generated pages and keep existing content", async () => {
  const result = await run("cleanup");
  assert.match(result.message, /Some generated pages may remain/);
  assert.equal(result.api.currentPage, result.original);
  assert.equal(result.original.children[0], result.existing);
});
