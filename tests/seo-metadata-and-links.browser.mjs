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
    { route: '/sourdough-calculator/', expected: /Sourdough Calculator/i }
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

  await page.goto('http://127.0.0.1:4173/privacy/', { waitUntil: 'domcontentloaded' });
  await check('/privacy/ correctly describes Cloudflare Pages hosting and aligned metadata', async () => {
    const metadata = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
      twitterDescription: document.querySelector('meta[name="twitter:description"]')?.content || '',
      body: document.querySelector('main.info-page')?.innerText || '',
      cloudflarePolicy: document.querySelector('main.info-page a[href="https://www.cloudflare.com/privacypolicy/"]')?.href || ''
    }));
    assert.equal(metadata.title, 'Privacy Policy | ZemTools');
    assert.ok(metadata.description.length >= 100 && metadata.description.length <= 180,
      'Privacy meta description should be a concise search snippet');
    assert.ok(metadata.ogDescription.length >= 100 && metadata.ogDescription.length <= 180,
      'Privacy social descriptions should be concise search snippets');
    assert.equal(metadata.twitterDescription, metadata.ogDescription);
    assert.match(metadata.body, /hosted on Cloudflare Pages/i);
    assert.match(metadata.body, /rather than GitHub Pages/i);
    assert.doesNotMatch(metadata.body, /GitHub Pages origin|hosted using GitHub Pages/i);
    assert.ok(metadata.cloudflarePolicy, 'Cloudflare Privacy Policy link should remain available');
  });

} finally {
  await browser.close();
}

console.log('SEO metadata and internal-link checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exitCode = 1;
