import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const pages = [
  { path: '/aspect-ratio-calculator/', expected: ['/tools/'] },
  { path: '/business-hours-calculator/', expected: ['/tools/', '/math-science/', '/about/', '/privacy/'] },
  { path: '/deck-joist-blocking-calculator/', expected: ['/tools/'] },
  { path: '/wire-size-calculator/', expected: ['/tools/'] }
];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const item of pages) {
    await page.goto(base + item.path, { waitUntil: 'networkidle' });
    const links = await page.locator('header.site-header a[href], footer a[href], nav.crumbs a[href]').evaluateAll(anchors =>
      anchors.map(anchor => ({
        label: (anchor.textContent || '').trim(),
        raw: anchor.getAttribute('href'),
        resolved: new URL(anchor.getAttribute('href'), document.baseURI).pathname
      }))
    );
    for (const link of links) {
      assert.ok(link.raw.startsWith('/') || /^https?:\/\//i.test(link.raw),
        `Non-root-relative site navigation link on ${item.path}: "${link.raw}" (${link.label})`);
      assert.ok(!link.resolved.startsWith(item.path + item.path.slice(1, -1)),
        `Nested path unexpectedly resolved on ${item.path}: ${link.resolved}`);
    }
    for (const expectedPath of item.expected) {
      assert.ok(links.some(link => link.resolved === expectedPath),
        `Expected navigation destination ${expectedPath} missing on ${item.path}`);
    }
    console.log(`PASS root-relative navigation links: ${item.path}`);
  }
} finally {
  await browser.close();
}
console.log('Root-relative navigation regression tests passed.');
