import { expect, test } from "@playwright/test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { compile } from "svelte/compiler";
import { compileScript, parse } from "@vue/compiler-sfc";
import {
  generateCode,
  type ExportFramework,
} from "../../src/lib/code-generator";
import { shapeGeometry } from "../../src/lib/vector";
import { createDefaultEffects } from "../../src/lib/element-effects";
import type { EditorElement } from "../../src/types/editor";

const literal = '<script>bad()</script> {{ safe }} {safe} & "quotes"';
function design(): EditorElement[] {
  const effects = createDefaultEffects();
  effects.appear.enabled = true;
  effects.hover = { enabled: true, scale: 1.2, rotate: 0, fill: "#0099ff" };
  effects.press = { enabled: true, scale: 0.8 };
  effects.transition.duration = 0.05;
  const master: EditorElement = {
    id: "master",
    name: "Card",
    type: "frame",
    componentId: "card",
    componentRole: "master",
    styles: {
      position: "absolute",
      left: 50,
      top: 80,
      width: 200,
      height: 160,
      backgroundColor: "#e5e5e5",
    },
    effects,
    animations: {},
    children: [
      {
        id: "text",
        name: "Caption",
        type: "text",
        content: literal,
        styles: {
          fontSize: 16,
          lineHeight: 1.5,
          fontWeight: 600,
          whiteSpace: "pre-wrap",
          color: "#111111",
        },
        children: [],
        animations: {},
      },
    ],
  };
  master.children.push({
    id: "star",
    name: "Exported star",
    type: "shape",
    vector: shapeGeometry("star"),
    effects: {
      ...createDefaultEffects(),
      hover: { enabled: true, scale: 1, rotate: 0, fill: "#ff5500" },
      transition: { ...createDefaultEffects().transition, duration: 0.05 },
    },
    children: [],
    animations: {},
    styles: {
      position: "absolute",
      left: 100,
      top: 60,
      width: 60,
      height: 60,
      backgroundColor: "#0088ff",
      borderWidth: 2,
      borderStyle: "solid",
      borderColor: "#111111",
    },
  });
  const instance = structuredClone(master);
  instance.id = "instance";
  instance.componentRole = "instance";
  instance.styles.left = 400;
  return [
    {
      id: "desktop",
      name: "Desktop",
      type: "frame",
      styles: { width: 1200, height: 800, backgroundColor: "#ffffff" },
      children: [master, instance],
      animations: {},
    },
  ];
}
let directory: string;
const outputs = new Map<string, { js: string; css: string }>();
test.beforeAll(async () => {
  await mkdir(".cache", { recursive: true });
  directory = await mkdtemp(resolve(".cache/export-runtime-"));
  for (const framework of ["react", "vue", "svelte"] as ExportFramework[]) {
    const code = generateCode(design(), framework);
    let source = code,
      css = "",
      filename = `${framework}.tsx`,
      entry = "";
    if (framework === "react")
      entry = `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import Page from "./react.tsx"; createRoot(document.getElementById("app")).render(createElement(Page));`;
    if (framework === "vue") {
      const { descriptor } = parse(code);
      source = compileScript(descriptor, {
        id: "design",
        inlineTemplate: true,
      }).content;
      css = descriptor.styles[0].content;
      filename = "vue.ts";
      entry = `import { createApp } from "vue"; import Page from "./vue.ts"; createApp(Page).mount("#app");`;
    }
    if (framework === "svelte") {
      const result = compile(code, {
        filename: "Page.svelte",
        generate: "client",
      });
      source = result.js.code;
      css = result.css?.code ?? "";
      filename = "svelte.js";
      entry = `import { mount } from "svelte"; import Page from "./svelte.js"; mount(Page, { target: document.getElementById("app") });`;
    }
    await writeFile(resolve(directory, filename), source);
    const bundle = await build({
      stdin: { contents: entry, resolveDir: directory, loader: "ts" },
      write: false,
      bundle: true,
      format: "iife",
      platform: "browser",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      minify: true,
    });
    outputs.set(framework, { js: bundle.outputFiles[0].text, css });
  }
});
test.afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

for (const framework of ["react", "vue", "svelte"]) {
  test(`${framework} export mounts with reusable components, safe text, exact placement and interactive motion`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const output = outputs.get(framework)!;
    await page.setContent(
      `<style>body { margin: 0; } ${output.css}</style><div id="app"></div>`,
    );
    await page.addScriptTag({ content: output.js });
    const cards = page.getByLabel("Card", { exact: true });
    await expect(cards).toHaveCount(2);
    const stars = page.getByLabel("Exported star", { exact: true });
    await expect(stars).toHaveCount(2);
    await expect(stars.first()).toHaveText("");
    await expect(stars.first()).toHaveCSS(
      "background-image",
      /data:image\/svg\+xml/,
    );
    await expect(
      page.getByLabel("Caption", { exact: true }).first(),
    ).toHaveText(literal);
    await expect(cards.first()).toHaveCSS("width", "200px");
    await expect
      .poll(() =>
        cards
          .first()
          .evaluate((node) => Math.round(node.getBoundingClientRect().x)),
      )
      .toBe(50);
    await expect
      .poll(() =>
        cards
          .nth(1)
          .evaluate((node) => Math.round(node.getBoundingClientRect().x)),
      )
      .toBe(400);
    await expect(cards.first()).toHaveCSS("opacity", "1");
    await cards.first().hover();
    await expect(cards.first()).toHaveCSS(
      "background-color",
      "rgb(0, 153, 255)",
    );
    const scale = () =>
      cards
        .first()
        .evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).a);
    await expect.poll(scale).toBeCloseTo(1.2, 2);
    await page.mouse.down();
    await expect.poll(scale).toBeCloseTo(0.8, 2);
    await page.mouse.up();
    await expect.poll(scale).toBeCloseTo(1.2, 2);
    await page.mouse.move(0, 0);
    await expect.poll(scale).toBeCloseTo(1, 2);
    const beforeStar = await stars
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundImage);
    await stars.first().hover();
    await expect(stars.first()).toHaveCSS("background-image", /%23ff5500/);
    await expect(stars.first()).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await page.mouse.move(0, 0);
    await expect(stars.first()).toHaveCSS("background-image", beforeStar);
    expect(errors).toEqual([]);
  });
}
