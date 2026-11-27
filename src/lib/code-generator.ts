import type { CSSProperties } from "react";
import type { EditorElement, ElementEffects } from "@/types/editor";
import { DEFAULT_EFFECTS, springTransition } from "./element-effects";

export type ExportFramework = "react" | "vue" | "svelte" | "html";
export const EXPORT_TARGETS = [
  {
    id: "react",
    label: "React",
    filename: "Page.tsx",
    mime: "text/plain",
    note: "React / Next.js · Tailwind CSS + framer-motion required.",
  },
  {
    id: "vue",
    label: "Vue",
    filename: "Page.vue",
    mime: "text/plain",
    note: "Vue 3 Single File Component · native CSS effects, no motion dependency.",
  },
  {
    id: "svelte",
    label: "Svelte",
    filename: "Page.svelte",
    mime: "text/plain",
    note: "Svelte 5 component with reusable snippets · native CSS effects.",
  },
  {
    id: "html",
    label: "HTML/CSS",
    filename: "index.html",
    mime: "text/html",
    note: "Standalone HTML with embedded CSS · no dependencies.",
  },
] as const;

const unitless = new Set(
  "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth columnCount columns fillOpacity flex flexGrow flexShrink fontWeight gridArea gridColumn gridColumnEnd gridColumnStart gridRow gridRowEnd gridRowStart lineClamp lineHeight opacity order orphans scale strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth tabSize widows zIndex zoom WebkitLineClamp".split(
    " ",
  ),
);
const json = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
const templateLiteral = (value: string) =>
  "`" +
  value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") +
  "`";
const escapeText = (value: string) =>
  value.replace(
    /[&<>"'{}]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "{": "&#123;",
        "}": "&#125;",
      })[char]!,
  );
const cssValue = (value: string) =>
  value.replace(
    /[\\;{}<>\r\n\u0000]/g,
    (char) => `\\${char.charCodeAt(0).toString(16)} `,
  );
function declarations(styles: CSSProperties): string {
  return Object.entries(styles)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap(([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        typeof value === "boolean" ||
        (typeof value === "number" && !Number.isFinite(value))
      )
        return [];
      if (!/^(?:--[\w-]+|[a-zA-Z][a-zA-Z0-9]*)$/.test(key)) return [];
      const property = key.startsWith("--")
        ? key
        : key
            .replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
            .replace(/^ms-/, "-ms-");
      const rendered =
        typeof value === "number" &&
        value !== 0 &&
        !unitless.has(key) &&
        !key.startsWith("--")
          ? `${value}px`
          : String(value);
      return [`  ${property}: ${cssValue(rendered)};`];
    })
    .join("\n");
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${json(k)}:${canonical(v)}`)
      .join(",")}}`;
  return json(value);
}
interface Node {
  tag: "div" | "button";
  className: string;
  name: string;
  text?: string;
  children: Node[];
  effects: ElementEffects;
  styles: CSSProperties;
  reference?: string;
}
interface Definition {
  name: string;
  node: Node;
}
const hasMotion = (node: Node): boolean =>
  !node.reference &&
  (node.effects.appear.enabled ||
    node.effects.hover.enabled ||
    node.effects.press.enabled ||
    node.children.some(hasMotion));
const indent = (text: string, spaces: number) =>
  text
    .split("\n")
    .map((line) => (line ? " ".repeat(spaces) + line : line))
    .join("\n");

/** Compiles only the supplied page tree; editor IDs, camera and UI never enter output. */
export function generateCode(
  elements: EditorElement[],
  framework: ExportFramework,
): string {
  const responsive =
    elements.filter((element) => element.breakpoint).length > 1;
  const css = [
    `.zc-design, .zc-design * { box-sizing: border-box; }`,
    `.zc-design { position: relative; width: 1200px; height: 800px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.5; color: #fff; isolation: isolate; }`,
    `.zc-design button { font: inherit; color: inherit; border: 0; padding: 0; background: transparent; text-align: inherit; cursor: pointer; }`,
  ];
  const definitions: Definition[] = [];
  const components = new Map<string, string>();
  let serial = 0;
  const rule = (styles: CSSProperties, prefix = "node") => {
    const className = `zc-${prefix}-${++serial}`;
    css.push(`.zc-design .${className} {\n${declarations(styles)}\n}`);
    return className;
  };
  const shape = (
    element: EditorElement,
    styles: CSSProperties,
    root = true,
  ): unknown => ({
    name: element.name,
    type: element.type,
    text: element.content,
    styles: root
      ? { ...styles, position: undefined, left: undefined, top: undefined }
      : styles,
    effects: element.effects,
    children: element.children.map((child) =>
      shape(child, child.styles, false),
    ),
  });
  function build(
    element: EditorElement,
    parent?: CSSProperties,
    root = false,
    definition = false,
  ): Node {
    const effects = element.effects ?? DEFAULT_EFFECTS;
    const styles: CSSProperties = {
      ...element.styles,
      position: element.styles.position || "relative",
      ...(root
        ? {
            position: "relative",
            left: 0,
            top: 0,
            ...(responsive && element.breakpoint ? { maxWidth: "100%" } : {}),
          }
        : {}),
      ...(parent?.display === "flex" &&
      (parent.flexDirection?.startsWith("column")
        ? element.styles.height === "100%"
        : element.styles.width === "100%") &&
      element.styles.position !== "absolute"
        ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 }
        : {}),
      ...(effects.blur
        ? {
            filter:
              `${element.styles.filter && element.styles.filter !== "none" ? element.styles.filter : ""} blur(${effects.blur}px)`.trim(),
          }
        : {}),
      ...(effects.shadow !== "none" ? { boxShadow: effects.shadow } : {}),
    };
    if (element.componentId && !definition && framework !== "html") {
      const signature = `${element.componentId}:${canonical(shape(element, styles))}`;
      let name = components.get(signature);
      if (!name) {
        // Numeric names avoid user-name collisions, reserved words and invalid identifiers.
        name = `DesignComponent${definitions.length + 1}`;
        components.set(signature, name);
        const entry: Definition = { name, node: null! };
        definitions.push(entry);
        entry.node = build(
          {
            ...element,
            styles: {
              ...element.styles,
              position: undefined,
              left: undefined,
              top: undefined,
            },
          },
          parent,
          false,
          true,
        );
      }
      return {
        tag: "div",
        className: rule(
          { position: styles.position, left: styles.left, top: styles.top },
          "placement",
        ),
        name: element.name,
        reference: name,
        children: [],
        effects,
        styles,
      };
    }
    if (definition) {
      delete styles.position;
      delete styles.left;
      delete styles.top;
    }
    const className = rule(styles);
    const node: Node = {
      tag: element.type === "button" ? "button" : "div",
      className,
      name: element.name,
      text:
        element.type === "frame"
          ? undefined
          : (element.content ?? element.name),
      children: element.children.map((child) => build(child, styles)),
      effects,
      styles,
    };
    if (framework !== "react") addEffects(node);
    return node;
  }
  function addEffects(node: Node) {
    const { effects: e, styles: s, className: c } = node;
    if (!e.appear.enabled && !e.hover.enabled && !e.press.enabled) return;
    const selector = `.zc-design .${c}`;
    const spring =
      e.transition.type === "spring"
        ? springTransition(e.transition.stiffness, e.transition.damping)
        : null;
    const duration = spring ? spring.duration / 1000 : e.transition.duration;
    const easing = spring?.easing ?? "cubic-bezier(0.22, 1, 0.36, 1)";
    const base = s.transform && s.transform !== "none" ? `${s.transform} ` : "";
    const transform = `${base}translate(var(--zc-x, 0px), var(--zc-y, 0px)) scale(var(--zc-scale, 1)) rotate(var(--zc-rotate, 0deg))`;
    const opacity = Number(s.opacity ?? 1);
    css.push(
      `${selector} {\n  --zc-scale: 1;\n  --zc-rotate: 0deg;\n  --zc-opacity: ${opacity};\n  transform: ${cssValue(transform)};\n  opacity: var(--zc-opacity, ${opacity});\n  transition: transform ${duration}s ease-out, opacity ${duration}s ease-out, background-color ${duration}s ease-out;\n  transition-timing-function: ${easing};\n${e.appear.enabled ? `  animation: ${c}-appear ${duration}s ease-out backwards;\n  animation-timing-function: ${easing};\n` : ""}}`,
    );
    if (e.appear.enabled)
      css.push(
        `@keyframes ${c}-appear {\n  from { transform: ${cssValue(`${base}translate(${e.appear.offsetX}px, ${e.appear.offsetY}px) scale(${e.appear.scale})`)}; opacity: ${e.appear.opacity * opacity}; }\n  to { transform: ${cssValue(transform)}; opacity: var(--zc-opacity, ${opacity}); }\n}`,
      );
    if (e.hover.enabled)
      css.push(
        `@media (hover: hover) {\n  ${selector}:hover {\n    --zc-scale: ${e.hover.scale};\n    --zc-rotate: ${e.hover.rotate}deg;${e.hover.opacity !== undefined ? `\n    --zc-opacity: ${e.hover.opacity};` : ""}${e.hover.fill ? `\n    background-color: ${cssValue(e.hover.fill)};` : ""}\n  }\n}`,
      );
    if (e.press.enabled)
      css.push(`${selector}:active { --zc-scale: ${e.press.scale}; }`);
    css.push(
      `@media (prefers-reduced-motion: reduce) {\n  ${selector} { animation: none; transition: none; transform: ${cssValue(s.transform ?? "none")}; }\n}`,
    );
  }
  const roots = elements.map((element) => ({
    node: build(element, undefined, true),
    breakpoint: element.breakpoint,
    height:
      typeof element.styles.height === "number" ? element.styles.height : 800,
    wrapper: rule(
      {
        position: "absolute",
        left: responsive && element.breakpoint ? 0 : (element.styles.left ?? 0),
        top: responsive && element.breakpoint ? 0 : (element.styles.top ?? 0),
        width:
          (responsive && element.breakpoint) || element.styles.width === "100%"
            ? "100%"
            : "max-content",
        ...(element.styles.height === "100%" ? { height: "100%" } : {}),
      },
      "root",
    ),
  }));
  if (responsive) {
    const variants = ["desktop", "tablet", "mobile"].flatMap((breakpoint) =>
      roots.filter((root) => root.breakpoint === breakpoint),
    );
    css.push(
      `.zc-design { width: 100%; max-width: 1200px; height: ${variants[0].height}px; }`,
    );
    for (const root of variants)
      css.push(
        `.zc-design .${root.wrapper} { display: ${root === variants[0] ? "block" : "none"}; }`,
      );
    for (const root of variants.slice(1)) {
      const maxWidth = root.breakpoint === "tablet" ? 1199 : 809;
      css.push(
        `@media (max-width: ${maxWidth}px) {\n  .zc-design { height: ${root.height}px; }\n${variants.map((variant) => `  .zc-design .${variant.wrapper} { display: ${variant === root ? "block" : "none"}; }`).join("\n")}\n}`,
      );
    }
  }
  const utilities = (node: Node) =>
    [
      "box-border",
      node.styles.position,
      node.styles.display === "flex"
        ? "flex"
        : node.styles.display === "grid"
          ? "grid"
          : "",
      node.styles.flexDirection === "column" ? "flex-col" : "",
    ]
      .filter(Boolean)
      .join(" ");
  function react(node: Node, extra = false): string {
    if (node.reference)
      return `<${node.reference} className=${json(node.className)} />`;
    const motion = hasMotion({ ...node, children: [] });
    const tag = motion ? `motion.${node.tag}` : node.tag;
    const e = node.effects;
    const target = {
      opacity: Number(node.styles.opacity ?? 1),
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
    };
    const hover = {
      ...(e.hover.opacity !== undefined ? { opacity: e.hover.opacity } : {}),
      ...(e.hover.fill ? { backgroundColor: e.hover.fill } : {}),
    };
    const attributes = [
      `className=${extra ? `{${json(`${node.className} ${utilities(node)} `)} + className}` : json(`${node.className} ${utilities(node)}`)}`,
      `aria-label={${json(node.name)}}`,
      ...(node.tag === "button" ? ['type="button"'] : []),
    ];
    if (motion) {
      attributes.push(
        `initial={${e.appear.enabled ? `reducedMotion ? false : ${json({ opacity: e.appear.opacity * target.opacity, x: e.appear.offsetX, y: e.appear.offsetY, scale: e.appear.scale })}` : "false"}}`,
        `animate={${json(target)}}`,
      );
      if (e.hover.enabled)
        attributes.push(
          `whileHover={reducedMotion ? ${json(hover)} : ${json({ ...hover, scale: e.hover.scale, rotate: e.hover.rotate })}}`,
        );
      if (e.press.enabled)
        attributes.push(
          `whileTap={reducedMotion ? undefined : ${json({ scale: e.press.scale })}}`,
        );
      attributes.push(
        `transition={reducedMotion ? { duration: 0 } : ${json(e.transition.type === "spring" ? { type: "spring", stiffness: e.transition.stiffness, damping: e.transition.damping } : { type: "tween", duration: e.transition.duration, ease: [0.22, 1, 0.36, 1] })}}`,
      );
      if (node.styles.transform && node.styles.transform !== "none")
        attributes.push(
          `transformTemplate={(_, generated) => ${json(`${node.styles.transform} `)} + (generated === "none" ? "" : generated)}`,
        );
    }
    const children = [
      ...(node.text !== undefined ? [`{${json(node.text)}}`] : []),
      ...node.children.map((child) => react(child)),
    ];
    return `<${tag}\n${attributes.map((attr) => `  ${attr}`).join("\n")}\n>${children.length ? `\n${indent(children.join("\n"), 2)}\n` : ""}</${tag}>`;
  }
  function markup(node: Node, extra = false): string {
    if (node.reference)
      return framework === "svelte"
        ? `{@render ${node.reference}(${json(node.className)})}`
        : `<${node.reference} class-name="${node.className}" />`;
    const attributes = `class=${extra ? `{${json(`${node.className} `)} + className}` : `"${node.className}"`} aria-label="${escapeText(node.name)}"${node.tag === "button" ? ' type="button"' : ""}`;
    const children = [
      ...(node.text !== undefined ? [escapeText(node.text)] : []),
      ...node.children.map((child) => markup(child)),
    ];
    if (node.text !== undefined)
      return `<${node.tag} ${attributes}>${escapeText(node.text)}${node.children.map((child) => markup(child)).join("")}</${node.tag}>`;
    return `<${node.tag} ${attributes}>${children.length ? `\n${indent(children.join("\n"), 2)}\n` : ""}</${node.tag}>`;
  }
  const baseCss = css.join("\n\n");
  let hash = 2166136261;
  for (const char of baseCss)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const scope = `zc-design-${(hash >>> 0).toString(36)}`;
  const stylesheet = baseCss.replaceAll(".zc-design", `.${scope}`);
  if (framework === "react") {
    const anyMotion = [
      ...roots.map((root) => root.node),
      ...definitions.map((def) => def.node),
    ].some(hasMotion);
    const functions = definitions.map(
      (def) =>
        `function ${def.name}({ className = "" }: { className?: string }) {\n${hasMotion(def.node) ? "  const reducedMotion = useReducedMotion();\n" : ""}  return (\n${indent(react(def.node, true), 4)}\n  );\n}`,
    );
    return `"use client";\n\n// Requires Tailwind CSS${anyMotion ? " and npm install framer-motion" : ""}.\n${anyMotion ? 'import { motion, useReducedMotion } from "framer-motion";\n\n' : ""}${functions.length ? functions.join("\n\n") + "\n\n" : ""}const styles = ${templateLiteral(stylesheet)};\n\nexport default function Page() {\n${roots.some((root) => hasMotion(root.node)) ? "  const reducedMotion = useReducedMotion();\n" : ""}  return (\n    <div className="${scope} relative">\n      <style>{styles}</style>\n${roots.map((root) => `      <div className="${root.wrapper}">\n${indent(react(root.node), 8)}\n      </div>`).join("\n")}\n    </div>\n  );\n}\n`;
  }
  const body = `<div class="${scope}">\n${roots.map((root) => `  <div class="${root.wrapper}">\n${indent(markup(root.node), 4)}\n  </div>`).join("\n")}\n</div>`;
  if (framework === "vue") {
    const h = (node: Node, extra = false): string => {
      const props = `{ class: ${extra ? `[${json(node.className)}, props.className]` : json(node.className)}, "aria-label": ${json(node.name)}${node.tag === "button" ? ', type: "button"' : ""} }`;
      return node.reference
        ? `h(${node.reference}, { className: ${json(node.className)} })`
        : `h(${json(node.tag)}, ${props}, [${[...(node.text !== undefined ? [json(node.text)] : []), ...node.children.map((child) => h(child))].join(", ")}])`;
    };
    return `<template>\n${indent(body, 2)}\n</template>\n\n<script setup lang="ts">\n${
      definitions.length
        ? `import { defineComponent, h } from "vue";\n\n${[...definitions]
            .reverse()
            .map(
              (def) =>
                `const ${def.name} = defineComponent({\n  name: ${json(def.name)},\n  inheritAttrs: false,\n  props: { className: { type: String, default: "" } },\n  setup(props) {\n    return () => ${h(def.node, true)};\n  },\n});`,
            )
            .join("\n\n")}`
        : "// No runtime dependencies beyond Vue 3."
    }\n</script>\n\n<style>\n${stylesheet}\n</style>\n`;
  }
  if (framework === "svelte")
    return `<script lang="ts">\n  // Svelte 5 snippets share reusable component markup.\n</script>\n\n${definitions.map((def) => `{#snippet ${def.name}(className: string)}\n${indent(markup(def.node, true), 2)}\n{/snippet}\n\n`).join("")}${body}\n\n<style>\n :global {\n${indent(stylesheet, 2)}\n}\n</style>\n`;
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Exported design</title>\n  <style>\n    body { margin: 0; }\n${indent(stylesheet, 4)}\n  </style>\n</head>\n<body>\n${indent(body, 2)}\n</body>\n</html>\n`;
}
