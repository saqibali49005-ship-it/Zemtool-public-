import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);
const catalogSource = readFileSync(path.join(root, "tools-data.js"), "utf8");
// tools-data.js also installs the AdSense loader, so provide only the DOM
// surface that loader touches while this validator reads the catalog in Node.
const sandboxAdScripts = [];
const catalogSandbox = {
  window: { location: { hostname: "localhost" } },
  document: {
    getElementsByTagName: () => [],
    createElement: tagName => ({ tagName }),
    head: { appendChild: script => sandboxAdScripts.push(script) }
  }
};
vm.runInNewContext(catalogSource, catalogSandbox, { filename: "tools-data.js" });
assert.deepEqual(
  sandboxAdScripts,
  [],
  "A non-canonical local/preview host must not inject the production AdSense script."
);
const catalog = catalogSandbox.window.UTILITY_TOOLS;
const manifest = JSON.parse(readFileSync(path.join(root, "tool-engine-manifest.json"), "utf8"));

assert.equal(manifest.schemaVersion, 1, "Engine manifest schemaVersion must be 1");
assert.equal(manifest.runtime, "browser", "Current tool execution must remain browser-based");
assert.equal(manifest.authorization, "none", "Manifest must not be used for authorization");
assert.ok(Array.isArray(catalog), "Tool catalog must be available");
assert.ok(Array.isArray(manifest.tools), "Engine manifest tools must be an array");
assert.equal(manifest.tools.length, catalog.length, "Manifest must cover every catalog tool");

const catalogSlugs = new Set(catalog.map(tool => tool.slug));
const manifestSlugs = new Set();
const modulePaths = new Set();

for (const entry of manifest.tools) {
  assert.ok(catalogSlugs.has(entry.slug), `Manifest contains unknown tool slug: ${entry.slug}`);
  assert.ok(!manifestSlugs.has(entry.slug), `Duplicate manifest tool slug: ${entry.slug}`);
  manifestSlugs.add(entry.slug);

  assert.ok(
    entry.implementation === "shared-module" || entry.implementation === "page-adapter",
    `${entry.slug} has an unsupported implementation status`
  );

  if (entry.implementation === "shared-module") {
    assert.match(entry.modulePath, /^\/[a-z0-9-]+-engine\.js$/, `${entry.slug} must reference a root engine module`);
    assert.match(entry.browserGlobal, /^ZemTools[A-Za-z0-9]+Engine$/, `${entry.slug} must name its browser engine global`);
    assert.equal(entry.contractVersion, 1, `${entry.slug} must declare shared engine contract version 1`);
    assert.ok(!modulePaths.has(entry.modulePath), `Duplicate engine module path: ${entry.modulePath}`);
    modulePaths.add(entry.modulePath);
    const resolvedModule = path.join(root, entry.modulePath.slice(1));
    assert.ok(existsSync(resolvedModule), `Missing engine module: ${entry.modulePath}`);
    const engine = require(resolvedModule);
    assert.equal(engine.contractVersion, 1, `${entry.slug} engine must export contract version 1`);
    assert.equal(typeof engine.execute, "function", `${entry.slug} engine must implement execute(request)`);
  } else {
    assert.ok(!entry.modulePath && !entry.browserGlobal, `${entry.slug} page adapter must not claim an extracted module`);
  }
}

for (const tool of catalog) {
  assert.ok(manifestSlugs.has(tool.slug), `Catalog tool missing from engine manifest: ${tool.slug}`);
}
assert.equal(modulePaths.size, 7, "Expected seven completed reusable calculation modules");

console.log(`PASS: engine manifest covers all ${catalog.length} catalog tools.`);
console.log(`PASS: ${modulePaths.size} shared calculation modules exist; remaining tools are explicitly marked page-adapter.`);
console.log("PASS: manifest is descriptive only and does not enable authentication, billing, subscriptions, or API access.");

// Catalog integrity: the static fallbacks and structured data must stay in sync
// with the central public-tool registry. This protects users and crawlers when
// JavaScript is delayed, unavailable, or not executed.
const homepageHtml = readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(
  homepageHtml.includes('if (host !== "zemtools.com" && host !== "www.zemtools.com") return;'),
  "Homepage AdSense loader must only run on canonical production hosts"
);
const directoryHtml = readFileSync(path.join(root, "tools", "index.html"), "utf8");
const sitemapXml = readFileSync(path.join(root, "sitemap.xml"), "utf8");
const publicTools = catalog.filter(tool => tool.access === "public");
const expectedCategoryCounts = new Map();
for (const tool of publicTools) {
  expectedCategoryCounts.set(tool.category, (expectedCategoryCounts.get(tool.category) || 0) + 1);
}

const categoryNames = {
  "Math & Science": "math-science",
  "Home & Construction": "home-construction",
  "Digital & Developer": "digital-developer",
  "Energy & Electrical": "energy-electrical"
};
const homepageGridMatch = homepageHtml.match(/<div class="category-grid" id="category-grid">([\s\S]*?)<\/div>\s*<\/section>/);
assert.ok(homepageGridMatch, "Homepage must provide a crawlable static category-grid fallback");
const homepageCategoryCards = [...homepageGridMatch[1].matchAll(/<a class="category-card"([\s\S]*?)<\/a>/g)];
assert.equal(homepageCategoryCards.length, expectedCategoryCounts.size, "Homepage static category fallback must list every active catalog category exactly once");
const seenHomepageCategories = new Set();
for (const match of homepageCategoryCards) {
  const card = match[0];
  const label = (card.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1]?.replace(/&amp;/g, "&").trim();
  const countText = (card.match(/<div class="category-meta">([\s\S]*?)<\/div>/) || [])[1] || "";
  const count = Number((countText.match(/(\d+)\s+tools?/) || [])[1]);
  const category = categoryNames[label];
  assert.ok(category, "Unknown homepage category fallback: " + label);
  assert.ok(!seenHomepageCategories.has(category), "Duplicate homepage category fallback: " + category);
  seenHomepageCategories.add(category);
  assert.equal(count, expectedCategoryCounts.get(category), "Homepage fallback count for " + label + " must match tools-data.js");
}
for (const category of expectedCategoryCounts.keys()) {
  assert.ok(seenHomepageCategories.has(category), "Homepage static fallback is missing active category: " + category);
}

const directoryGridMatch = directoryHtml.match(/<section class="directory-grid" id="directory-grid"[^>]*>([\s\S]*?)<\/section>/);
assert.ok(directoryGridMatch, "All Tools must provide a crawlable static directory fallback");
const fallbackCards = [...directoryGridMatch[1].matchAll(/<article class="dir-card"([\s\S]*?)<\/article>/g)];
assert.equal(fallbackCards.length, publicTools.length, "All Tools static fallback must contain one card per public catalog tool");
const expectedToolHrefs = new Set(publicTools.map(tool => "/" + tool.href));
const actualToolHrefs = new Set();
for (const match of fallbackCards) {
  const hrefs = [...match[0].matchAll(/href="([^"]+)"/g)].map(link => link[1]);
  const catalogHrefs = [...new Set(hrefs.filter(href => expectedToolHrefs.has(href)))];
  assert.equal(catalogHrefs.length, 1, "Each static directory card must point to exactly one public catalog tool");
  const href = catalogHrefs[0];
  assert.ok(!actualToolHrefs.has(href), "Duplicate static directory card: " + href);
  actualToolHrefs.add(href);
}
for (const href of expectedToolHrefs) {
  assert.ok(actualToolHrefs.has(href), "All Tools static fallback is missing catalog route: " + href);
}
assert.match(directoryHtml, new RegExp("All " + publicTools.length + " tools are linked directly above\\."), "All Tools fallback note must match the public catalog count");

const collectionPageRaw = [...directoryHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .find(raw => {
    try { return JSON.parse(raw)["@type"] === "CollectionPage"; }
    catch { return false; }
  });
assert.ok(collectionPageRaw, "All Tools must expose CollectionPage structured data");
const collectionPage = JSON.parse(collectionPageRaw);
const schemaItems = collectionPage.mainEntity?.itemListElement || [];
assert.equal(collectionPage.mainEntity?.numberOfItems, publicTools.length, "CollectionPage numberOfItems must match the public catalog");
assert.equal(schemaItems.length, publicTools.length, "CollectionPage ItemList must contain every public catalog tool");
assert.deepEqual(
  new Set(schemaItems.map(item => item.url)),
  new Set(publicTools.map(tool => "https://zemtools.com/" + tool.href)),
  "CollectionPage ItemList URLs must match the public catalog exactly"
);
assert.deepEqual(
  schemaItems.map(item => item.position),
  schemaItems.map((item, index) => index + 1),
  "CollectionPage ItemList positions must be sequential"
);

const sitemapRoutes = new Set([...sitemapXml.matchAll(/<loc>https:\/\/zemtools\.com([^<]*)<\/loc>/g)].map(match => match[1]));
for (const tool of publicTools) {
  assert.ok(sitemapRoutes.has("/" + tool.href), "Sitemap is missing public catalog route: /" + tool.href);
}

console.log("PASS: homepage category fallback counts match the " + publicTools.length + "-tool central catalog.");
console.log("PASS: All Tools fallback and CollectionPage schema contain all " + publicTools.length + " public tools.");
console.log("PASS: every public catalog URL appears in the sitemap.");
