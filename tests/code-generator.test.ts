import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { resolve } from "node:path";
import {
  compileScript,
  compileStyle,
  compileTemplate,
  parse,
} from "@vue/compiler-sfc";
import { compile } from "svelte/compiler";
import { generateCode, EXPORT_TARGETS } from "../src/lib/code-generator";
import { createDefaultEffects } from "../src/lib/element-effects";
import type { EditorElement } from "../src/types/editor";

function text(id: string, content = "Hello world"): EditorElement {
  return {
    id,
    name: "Heading",
    type: "text",
    content,
    children: [],
    styles: {
      position: "relative",
      width: "100%",
      minHeight: 24,
      fontSize: 24,
      fontWeight: 700,
      lineHeight: 1.5,
      color: "#123456",
      whiteSpace: "pre-wrap",
    },
    effects: createDefaultEffects(),
    animations: {},
  };
}
function fixture(): EditorElement[] {
  const card: EditorElement = {
    id: "master-id",
    name: "Card",
    type: "frame",
    componentId: "card",
    componentRole: "master",
    children: [text("heading")],
    styles: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      padding: 16,
      width: 240,
      height: "fit-content",
      backgroundColor: "#ffffff",
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "#999999",
    },
    effects: createDefaultEffects(),
    animations: {},
  };
  card.effects!.appear = {
    enabled: true,
    opacity: 0.2,
    offsetX: -10,
    offsetY: 24,
    scale: 0.8,
  };
  card.effects!.hover = {
    enabled: true,
    scale: 1.1,
    rotate: 8,
    fill: "#0088ff",
    opacity: 0.8,
  };
  card.effects!.press = { enabled: true, scale: 0.9 };
  card.effects!.transition = {
    type: "spring",
    duration: 0.4,
    stiffness: 120,
    damping: 14,
  };
  card.effects!.blur = 2;
  card.effects!.shadow = "0 4px 12px #00000040";
  const instance = structuredClone(card);
  instance.id = "instance-id";
  instance.componentRole = "instance";
  instance.styles = {
    ...instance.styles,
    position: "absolute",
    left: 400,
    top: 120,
  };
  instance.children[0].id = "instance-heading";
  return [
    {
      id: "desktop-id",
      name: "Desktop",
      type: "frame",
      children: [
        card,
        instance,
        {
          ...text("button", "Submit"),
          type: "button",
          styles: {
            position: "absolute",
            left: 20,
            top: 500,
            width: 120,
            height: 40,
            backgroundColor: "#0099ff",
          },
        },
      ],
      styles: {
        width: 1200,
        height: 800,
        left: -50,
        top: 30,
        backgroundColor: "#ffffff",
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 24,
      },
      animations: {},
    },
  ];
}

test("every target is deterministic, immutable and excludes editor-only IDs", () => {
  const elements = fixture(),
    before = structuredClone(elements);
  for (const target of EXPORT_TARGETS) {
    const code = generateCode(elements, target.id);
    assert.equal(code, generateCode(elements, target.id));
    assert.ok(code.endsWith("\n"));
    assert.ok(
      !code.includes("master-id") &&
        !code.includes("instance-id") &&
        !code.includes("desktop-id"),
    );
    assert.ok(
      !code.includes("data-selected") && !code.includes("canvasConfig"),
    );
    assert.match(code, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(code, /left: -50px/);
    assert.match(code, /font-weight: 700/);
    assert.match(code, /line-height: 1.5/);
    assert.match(code, /filter: blur\(2px\)/);
    assert.match(code, /box-shadow: 0 4px 12px #00000040/);
  }
  assert.deepEqual(elements, before);
});

test("all generated React, Vue and Svelte components parse and compile with real framework tooling", () => {
  const elements = fixture();
  const react = generateCode(elements, "react");
  const result = ts.transpileModule(react, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
    reportDiagnostics: true,
    fileName: "Page.tsx",
  });
  assert.deepEqual(result.diagnostics, []);
  const filename = resolve("tests/__generated_export__.tsx");
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const host = ts.createCompilerHost(options);
  const source = host.getSourceFile.bind(host);
  host.getSourceFile = (
    file,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) =>
    file === filename
      ? ts.createSourceFile(
          filename,
          react,
          ts.ScriptTarget.ES2022,
          true,
          ts.ScriptKind.TSX,
        )
      : source(file, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([filename], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(
    diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    ),
    [],
  );
  const { descriptor, errors } = parse(generateCode(elements, "vue"));
  assert.deepEqual(errors, []);
  const script = compileScript(descriptor, { id: "design" });
  assert.match(script.content, /defineComponent/);
  const template = compileTemplate({
    source: descriptor.template!.content,
    filename: "Page.vue",
    id: "design",
    compilerOptions: { bindingMetadata: script.bindings },
  });
  assert.deepEqual(template.errors, []);
  assert.deepEqual(
    compileStyle({
      source: descriptor.styles[0].content,
      filename: "Page.vue",
      id: "design",
    }).errors,
    [],
  );
  const svelte = compile(generateCode(elements, "svelte"), {
    filename: "Page.svelte",
    generate: "client",
  });
  assert.ok(svelte.js.code);
  assert.deepEqual(svelte.warnings, []);
});

test("reusable component definitions are shared but local instance overrides are not lost", () => {
  const elements = fixture();
  for (const target of ["react", "vue", "svelte"] as const) {
    const code = generateCode(elements, target);
    assert.ok(code.includes("DesignComponent1"));
    assert.ok(!code.includes("DesignComponent2"));
    assert.match(code, /left: 400px/);
    assert.match(code, /top: 120px/);
  }
  elements[0].children[1].children[0].content = "Instance override";
  for (const target of ["react", "vue", "svelte"] as const) {
    const code = generateCode(elements, target);
    assert.ok(code.includes("DesignComponent2"));
    assert.ok(code.includes("Instance override"));
  }
  assert.equal(
    (generateCode(elements, "html").match(/Hello world/g) ?? []).length,
    1,
  );
});

test("Framer Motion uses appear, hover, press and spring settings; other targets retain CSS interactions and reduced motion", () => {
  const react = generateCode(fixture(), "react");
  for (const text of [
    'from "framer-motion"',
    "initial={reducedMotion ? false",
    "whileHover={reducedMotion",
    "whileTap={reducedMotion",
    '"stiffness":120',
    '"damping":14',
    '"opacity":0.2',
    '"x":-10',
  ])
    assert.ok(react.includes(text), text);
  for (const target of ["vue", "svelte", "html"] as const) {
    const code = generateCode(fixture(), target);
    assert.match(code, /@keyframes/);
    assert.match(code, /linear\(0,/);
    assert.match(code, /:hover/);
    assert.match(code, /:active/);
    assert.match(code, /prefers-reduced-motion: reduce/);
    assert.match(code, /--zc-opacity: 0.8/);
    assert.match(code, /--zc-scale: 0.9/);
  }
});

test("dangerous text, template expressions, component names and CSS cannot break out of the generated source", () => {
  const hostile =
    '</style></script></template><script>alert("x")</script>{{ injected }} {value} ` ${danger} &\nnext';
  const node = text("unsafe", hostile);
  node.name = '"</div><script>injected</script>';
  node.styles.fontFamily =
    "</style><script>alert(1)</script>; } body { color:red";
  for (const target of EXPORT_TARGETS) {
    const code = generateCode([node], target.id);
    assert.ok(!code.includes("<script>alert("));
    assert.ok(!code.includes("{{ injected }}") || target.id === "react");
    if (target.id === "react")
      assert.deepEqual(
        ts.transpileModule(code, {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
          reportDiagnostics: true,
        }).diagnostics,
        [],
      );
    if (target.id === "vue") {
      const { descriptor, errors } = parse(code);
      assert.deepEqual(errors, []);
      assert.deepEqual(
        compileTemplate({
          source: descriptor.template!.content,
          filename: "Page.vue",
          id: "safe",
        }).errors,
        [],
      );
    }
    if (target.id === "svelte")
      assert.ok(compile(code, { filename: "Page.svelte" }).js.code);
  }
});

test("property insertion order and document UUIDs do not change the output", () => {
  const original = fixture(),
    copy = structuredClone(original);
  const reorder = (nodes: EditorElement[]) =>
    nodes.forEach((node) => {
      node.id += "changed";
      node.styles = Object.fromEntries(Object.entries(node.styles).reverse());
      node.effects = node.effects
        ? (Object.fromEntries(
            Object.entries(node.effects).reverse(),
          ) as typeof node.effects)
        : undefined;
      reorder(node.children);
    });
  reorder(copy);
  for (const target of EXPORT_TARGETS)
    assert.equal(
      generateCode(original, target.id),
      generateCode(copy, target.id),
    );
});

test("empty pages export valid target shells without motion imports or fake elements", () => {
  for (const target of EXPORT_TARGETS) {
    const code = generateCode([], target.id);
    assert.ok(code.includes("zc-design"));
    assert.ok(!code.includes("framer-motion"));
    assert.ok(!code.includes("zc-node-"));
  }
});

test("responsive exports compile in each framework and contain ordered breakpoint rules", () => {
  const elements: EditorElement[] = (
    ["desktop", "tablet", "mobile"] as const
  ).map((breakpoint, index) => ({
    ...fixture()[0],
    id: breakpoint,
    name: breakpoint,
    breakpoint,
    children: [text(`${breakpoint}-text`, `${breakpoint} variant`)],
    styles: {
      width: [1200, 810, 390][index],
      height: 800,
      left: index * 1280,
      top: 0,
    },
  }));
  for (const target of EXPORT_TARGETS) {
    const code = generateCode(elements, target.id);
    assert.match(code, /@media \(max-width: 1199px\)/);
    assert.match(code, /@media \(max-width: 809px\)/);
    assert.ok(code.indexOf("1199px") < code.indexOf("809px"));
    assert.ok(!code.includes("left: 1280px"));
    if (target.id === "react")
      assert.deepEqual(
        ts.transpileModule(code, {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
          reportDiagnostics: true,
        }).diagnostics,
        [],
      );
    if (target.id === "vue") {
      const { descriptor, errors } = parse(code);
      assert.deepEqual(errors, []);
      const script = compileScript(descriptor, { id: "responsive" });
      assert.deepEqual(
        compileTemplate({
          source: descriptor.template!.content,
          filename: "Page.vue",
          id: "responsive",
          compilerOptions: { bindingMetadata: script.bindings },
        }).errors,
        [],
      );
      assert.deepEqual(
        compileStyle({
          source: descriptor.styles[0].content,
          filename: "Page.vue",
          id: "responsive",
        }).errors,
        [],
      );
    }
    if (target.id === "svelte")
      assert.ok(compile(code, { filename: "Page.svelte" }).js.code);
  }
});
