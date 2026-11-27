import assert from "node:assert/strict";
import { test } from "node:test";
import nextConfig from "../next.config";

test("production builds export static files without an image server", () => {
  assert.equal(nextConfig.output, "export");
  assert.equal(nextConfig.images?.unoptimized, true);
});

test("the base path follows the build environment and defaults to the site root", () => {
  assert.equal(nextConfig.basePath, process.env.NEXT_PUBLIC_BASE_PATH || "");
});
