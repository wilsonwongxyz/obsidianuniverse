import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("produces a portable static application", async () => {
  const [html, packageJson, mapStats] = await Promise.all([
    readFile(new URL("dist/index.html", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    stat(new URL("dist/map-v1.json", root)),
  ]);

  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /Obsidian Universe/);
  assert.match(html, /assets\/[^"']+\.js/);
  assert.match(html, /assets\/[^"']+\.css/);
  assert.ok(mapStats.size > 3_000_000, "the generated plugin map should be included");
  assert.doesNotMatch(packageJson, /cloudflare|vinext|openai\/sites|next"|drizzle/i);
});

test("ships valid map data and the favicon", async () => {
  const map = JSON.parse(await readFile(new URL("dist/map-v1.json", root), "utf8"));

  assert.ok(map.count >= 7_000);
  assert.equal(map.plugins.length, map.count);
  assert.ok(map.clusters.length >= 10);
  await access(new URL("dist/favicon.svg", root));
});
