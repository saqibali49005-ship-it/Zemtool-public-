import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const failures = [];
let passed = 0;

async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (error) { failures.push({ name, error: error.message }); console.error('FAIL', name, error.message); }
}

try {
  for (const route of ['/calculator/', '/math-science/', '/pilot-hole-calculator/', '/tea-outturn-calculator/', '/sourdough-calculator/']) {
    await page.goto('http://127.0.0.1:4173' + route, { waitUntil: 'domcontentloaded' });
    await check(route + ' header, breadcrumb, footer and related links are root-relative', async () => {
      const selectors = 'header.site-header a[href], nav.crumbs a[href], footer a[href], .related-tools a[href]';
      const hrefs = await page.locator(selectors).evaluateAll(nodes => nodes.map(node => node.getAttribute('href')).filter(Boolean));
      assert.ok(hrefs.length > 0, 'Expected internal navigation links');
      const invalid = hrefs.filter(href =>
        !href.startsWith('/') &&
        !href.startsWith('http://') &&
        !href.startsWith('https://') &&
        !href.startsWith('#') &&
        !href.startsWith('mailto:') &&
        !href.startsWith('tel:')
      );
      assert.deepEqual(invalid, [], 'Relative internal links should not depend on the base element');
    });
  }

  const seoPages = [
    { route: '/fence-calculator/', expected: /Fence Material Calculator/i },
    { route: '/gravel-calculator/', expected: /Gravel Calculator/i },
    { route: '/deck-joist-blocking-calculator/', expected: /Deck Joist Blocking Calculator/i },
    { route: '/sod-staple-calculator/', expected: /Sod Staple Calculator/i },
    { route: '/tea-outturn-calculator/', expected: /Tea Outturn Calculator/i },
    { route: '/sourdough-calculator/', expected: /Sourdough Calculator/i },
    { route: '/wire-size-calculator/', expected: /^Wire Size Calculator \| Voltage Drop & Wire Gauge$/i }
  ];

  for (const item of seoPages) {
    await page.goto('http://127.0.0.1:4173' + item.route, { waitUntil: 'domcontentloaded' });
    await check(item.route + ' title, description and social snippets are present and aligned', async () => {
      const metadata = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
        ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
        twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content || '',
        twitterDescription: document.querySelector('meta[name="twitter:description"]')?.content || '',
        canonical: document.querySelector('link[rel="canonical"]')?.href || ''
      }));
      assert.match(metadata.title, item.expected);
      assert.ok(metadata.description.length >= 100 && metadata.description.length <= 180, 'Meta description should be a concise search snippet');
      assert.equal(metadata.ogTitle, metadata.title);
      assert.equal(metadata.twitterTitle, metadata.title);
      assert.equal(metadata.ogDescription, metadata.description);
      assert.equal(metadata.twitterDescription, metadata.description);
      assert.equal(metadata.canonical, 'https://zemtools.com' + item.route);
    });
  }

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await check('Homepage keeps broad search intent and links directly to the Wire Size Calculator', async () => {
    assert.equal(await page.title(), 'ZemTools | Practical Online Tools & Calculators');
    assert.equal((await page.locator('main h1').innerText()).trim(), 'Useful answers for everyday problems.');
    const toolLink = page.locator('a.home-tool-quick-link[href="/wire-size-calculator/"]');
    assert.equal(await toolLink.count(), 1);
    assert.equal((await toolLink.innerText()).trim(), 'Wire Size Calculator');
    const ctaLabels = await page.locator('.latest-card a.card-action').allTextContents();
    assert.ok(ctaLabels.length > 0);
    assert.ok(ctaLabels.every(label => label.trim() === 'Open tool'), 'Homepage tool-card CTAs should retain the shared Open tool label');
  });

  await page.goto('http://127.0.0.1:4173/tools/', { waitUntil: 'domcontentloaded' });
  const directoryWireCard = page.locator('.dir-card').filter({ hasText: 'Wire Size & Voltage Drop Calculator' });
  await directoryWireCard.waitFor();
  await check('All Tools card has a descriptive title link and the generic Open tool CTA', async () => {
    assert.equal(await page.title(), 'All Tools | ZEMTOOLS');
    assert.equal((await page.locator('main h1').innerText()).trim(), 'All Tools');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/tools/');
    assert.equal(await directoryWireCard.count(), 1);
    assert.equal(new URL(await directoryWireCard.locator('h2 a.dir-card-title-link').evaluate(anchor => anchor.href)).pathname, '/wire-size-calculator/');
    const action = directoryWireCard.locator(':scope > a');
    assert.equal((await action.innerText()).trim(), 'Open tool');
    assert.equal(new URL(await action.evaluate(anchor => anchor.href)).pathname, '/wire-size-calculator/');
    assert.equal(await action.getAttribute('aria-label'), 'Open Wire Size Calculator');
  });

  await page.goto('http://127.0.0.1:4173/energy-electrical/', { waitUntil: 'domcontentloaded' });
  const categoryWireCard = page.locator('article.card').filter({ hasText: 'Wire Size & Voltage Drop Calculator' });
  await categoryWireCard.waitFor();
  await check('Energy category retains its broad intent and links the Wire Size title and CTA to the calculator', async () => {
    assert.equal(await page.title(), 'Energy & Electrical Tools | ZemTools');
    assert.equal((await page.locator('main h1').innerText()).trim(), 'Energy & Electrical Tools');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/energy-electrical/');
    assert.equal(await categoryWireCard.locator('h2 a').getAttribute('href'), '/wire-size-calculator/');
    const action = categoryWireCard.locator('a.button');
    assert.equal((await action.innerText()).trim(), 'Open tool');
    assert.equal(new URL(await action.evaluate(anchor => anchor.href)).pathname, '/wire-size-calculator/');
    assert.equal(await action.getAttribute('aria-label'), 'Open Wire Size Calculator');
    assert.equal((await page.locator('a.button').allTextContents()).every(label => label.trim() === 'Open tool'), true);
  });

  await page.goto('http://127.0.0.1:4173/wire-size-calculator/', { waitUntil: 'domcontentloaded' });
  await check('Wire Size Calculator is the page-level primary search target', async () => {
    assert.equal((await page.locator('h1').innerText()).trim(), 'Wire Size Calculator');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/wire-size-calculator/');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index,follow');
    const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.map(node => JSON.parse(node.textContent)));
    const app = schemas.find(item => item['@type'] === 'WebApplication');
    const breadcrumb = schemas.find(item => item['@type'] === 'BreadcrumbList');
    assert.ok(app, 'Wire Size Calculator WebApplication schema should be present');
    assert.equal(app.name, 'Wire Size Calculator');
    assert.equal(app.url, 'https://zemtools.com/wire-size-calculator/');
    assert.ok(breadcrumb, 'Wire Size Calculator breadcrumb schema should be present');
    assert.equal(breadcrumb.itemListElement[2].name, 'Wire Size Calculator');
    assert.equal(breadcrumb.itemListElement[2].item, 'https://zemtools.com/wire-size-calculator/');
  });

} finally {
  await browser.close();
}

console.log('SEO metadata and internal-link checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exitCode = 1;
