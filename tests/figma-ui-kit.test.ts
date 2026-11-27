import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeSvg, generateFigmaUiKit } from "../src/lib/figma-ui-kit";

test("Figma kit is a deterministic 1440x900 vector artboard with unique named editable layers", () => {
  const svg = generateFigmaUiKit();
  assert.equal(svg, generateFigmaUiKit());
  assert.match(svg, /width="1440" height="900" viewBox="0 0 1440 900"/);
  for (const name of [
    "Top-Toolbar",
    "Left-Navigation-Panel",
    "Pages-panel",
    "Layers-panel",
    "Assets-panel",
    "Center-Canvas-with-Selection-Box",
    "Selection-Box",
    "Right-Inspector-Panel",
    "Export-Code-Modal",
    "Position-section",
    "Size-section",
    "Layout-section",
    "Styles-section",
    "Typography-section",
    "Effects-Animations-section",
    "Opacity-slider",
    "Fill-override-toggle",
    "Opacity-override-toggle",
    "Shadow-CSS-input",
  ])
    assert.ok(svg.includes(`id="${name}-`), name);
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok((svg.match(/<text /g) ?? []).length > 100);
  assert.ok((svg.match(/<rect /g) ?? []).length > 70);
  assert.ok((svg.match(/<path /g) ?? []).length > 40);
  assert.ok(
    !/<(?:image|foreignObject|script|use|style)\b|data:|https?:\/\//.test(
      svg.replace('xmlns="http://www.w3.org/2000/svg"', ""),
    ),
  );
  assert.equal(
    (svg.match(/<g\b/g) ?? []).length,
    (svg.match(/<\/g>/g) ?? []).length,
  );
});

test("modal can be omitted without losing the editor panels", () => {
  const svg = generateFigmaUiKit({ includeModal: false });
  assert.ok(!svg.includes('id="Export-Code-Modal-'));
  assert.ok(svg.includes('id="Selection-Box-'));
  assert.ok(svg.includes('id="Right-Inspector-Panel-'));
});

test("project titles are escaped as XML text, never markup or attributes", () => {
  const svg = generateFigmaUiKit({
    projectTitle: '</text><script>evil</script>"&\u0001',
  });
  assert.ok(!svg.includes("<script>"));
  assert.ok(!svg.includes("\u0001"));
  assert.ok(svg.includes("&lt;/text&gt;"));
  assert.equal(escapeSvg(`<&"'>`), "&lt;&amp;&quot;&apos;&gt;");
});
