import { test } from "node:test";
import assert from "node:assert/strict";
import { hexToHsva, hsvaToHex, normalizeHex } from "../src/lib/color";
import {
  formatShadow,
  parseShadow,
  shadowLayers,
  updateShadowLayer,
} from "../src/lib/shadow";

test("hex normalization supports alpha without accepting partial or invalid values", () => {
  assert.equal(normalizeHex("#ABC"), "#aabbcc");
  assert.equal(normalizeHex("#1234"), "#11223344");
  assert.equal(normalizeHex("#AA00ff80"), "#aa00ff80");
  for (const value of [
    "#12",
    "#12345",
    "#1234567",
    "red",
    "#ggg",
    "#123456 extra",
  ])
    assert.equal(normalizeHex(value), null);
});

test("HSV conversion round-trips primaries, gray, black and alpha", () => {
  for (const hex of [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffffff",
    "#000000",
    "#777777",
    "#336699",
    "#ff880080",
    "#12345600",
  ])
    assert.equal(hsvaToHex(hexToHsva(hex)), hex);
  assert.deepEqual(hexToHsva("#ff000080"), { h: 0, s: 1, v: 1, a: 128 / 255 });
  assert.equal(hsvaToHex({ h: 420, s: 1, v: 1, a: 1 }), "#ffff00");
  assert.equal(hsvaToHex({ h: -120, s: 1, v: 1, a: 1 }), "#0000ff");
});

test("shadow parts handle colors on either side, inset, decimals and optional lengths", () => {
  assert.deepEqual(
    parseShadow("inset rgba(10, 20, 30, 0.5) -2.5px 4px 12px -3px"),
    {
      x: -2.5,
      y: 4,
      blur: 12,
      spread: -3,
      color: "rgba(10, 20, 30, 0.5)",
      inset: true,
    },
  );
  assert.deepEqual(parseShadow("0 4px 12px #00000026"), {
    x: 0,
    y: 4,
    blur: 12,
    spread: 0,
    color: "#00000026",
    inset: false,
  });
  assert.deepEqual(parseShadow("0 2px"), {
    x: 0,
    y: 2,
    blur: 0,
    spread: 0,
    color: "currentColor",
    inset: false,
  });
  const parts = parseShadow("#fff 1px 2px 3px 4px inset")!;
  assert.deepEqual(parseShadow(formatShadow(parts)), parts);
});

test("editing one shadow part preserves all other parts and comma-separated layers", () => {
  const value = "0 8px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 #fff";
  assert.equal(shadowLayers(value).length, 2);
  const changed = updateShadowLayer(value, 0, { blur: 6 });
  assert.equal(
    changed,
    "0px 8px 6px 0px rgba(0, 0, 0, 0.25), inset 0 1px 0 #fff",
  );
  assert.equal(
    updateShadowLayer(changed, 1, { spread: -2 }),
    "0px 8px 6px 0px rgba(0, 0, 0, 0.25), inset 0px 1px 0px -2px #fff",
  );
  assert.deepEqual(shadowLayers("none"), []);
});

test("relative-unit and expression shadows are preserved rather than silently reset", () => {
  for (const value of [
    "0 1em 2em red",
    "0 0 calc(2px + 1em) #000",
    "garbage",
    "0 0 -2px black",
  ]) {
    assert.equal(parseShadow(value), null);
    assert.equal(updateShadowLayer(value, 0, { x: 10 }), value);
  }
});
