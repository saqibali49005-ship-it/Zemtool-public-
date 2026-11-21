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
async function fresh(viewport = { width: 1365, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto('http://127.0.0.1:4173/math-science/', { waitUntil: 'domcontentloaded' });
  await page.locator('main.wrap h1').waitFor();
  await page.waitForFunction(() => {
    const header = document.querySelector('header.site-header');
    return Boolean(header && header.dataset.zemUnified === '1' &&
      header.querySelector('#toolHeaderSearch') && header.querySelector('#toolHeaderMenu'));
  });
}

try {
  await fresh();
  await check('Category page loads with canonical URL and search-focused metadata', async () => {
    assert.equal(await page.title(), 'Math & Science Tools | ZemTools');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/math-science/');
    assert.match(await page.locator('meta[name="description"]').getAttribute('content'), /numerical precision.*everyday calculations.*work scheduling.*production-yield/i);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    assert.equal(await page.locator('meta[property="og:description"]').getAttribute('content'), description);
    assert.equal(await page.locator('meta[name="twitter:description"]').getAttribute('content'), description);
    assert.equal(await page.locator('main.wrap h1').innerText(), 'Math & Science Tools');
  });

  await check('All five category cards link to their matching calculators', async () => {
    const cards = page.locator('main.wrap > .grid > .card');
    assert.equal(await cards.count(), 5);
    const targets = await cards.evaluateAll(nodes => nodes.map(node => {
      const href = node.querySelector('a.button').getAttribute('href');
      return new URL(href, 'https://zemtools.com/math-science/').pathname;
    }));
    assert.deepEqual(targets, ['/calculator/', '/time-calculator/', '/business-hours-calculator/', '/tea-outturn-calculator/', '/sourdough-calculator/']);
    assert.match(await cards.nth(1).innerText(), /clock-time arithmetic and duration planning/i);
    assert.match(await cards.nth(4).innerText(), /true hydration.*starter-aware ingredient totals/i);
  });

  await check('Category overview stays broad and leaves detailed tool guidance to the individual pages', async () => {
    const guide = await page.locator('.category-guide').innerText();
    assert.match(guide, /focused tools.*numerical precision.*work scheduling.*production-yield planning/i);
    assert.doesNotMatch(guide, /Time Calculator|Business Hours Calculator|Significant Figures Calculator|Sourdough Calculator|sourdough hydration|starter feeding|time difference/i);
    assert.equal(await page.locator('.category-faq').count(), 0);
    assert.equal(await page.locator('#time-math-title').count(), 0);
  });

  await check('Broad category overview remains readable without mobile horizontal overflow', async () => {
    for (const width of [390, 689, 768]) {
      await fresh({ width, height: 900 });
      const guide = page.locator('.category-guide > p');
      assert.equal(await guide.evaluate(el => getComputedStyle(el).display), 'block');
      assert.equal(await guide.locator('a').count(), 0);
      const dimensions = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth
      }));
      assert.ok(dimensions.scroll <= dimensions.client + 1,
        `category overview causes horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
    }
  });

  await check('CollectionPage structured data lists all five calculator URLs', async () => {
    const json = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(json);
    assert.equal(data['@type'], 'CollectionPage');
    assert.equal(data.name, 'Math & Science Tools | ZemTools');
    assert.match(data.description, /numerical precision.*everyday calculations.*work scheduling.*production-yield/i);
    const urls = data.mainEntity.itemListElement.map(item => item.url);
    assert.deepEqual(urls, [
      'https://zemtools.com/calculator/',
      'https://zemtools.com/time-calculator/',
      'https://zemtools.com/business-hours-calculator/',
      'https://zemtools.com/tea-outturn-calculator/',
      'https://zemtools.com/sourdough-calculator/'
    ]);
  });

  await check('Mobile shared-header search filters the current tool catalog', async () => {
    await fresh({ width: 390, height: 844 });
    await page.locator('#toolHeaderSearch').click();
    assert.equal(await page.locator('#toolHeaderSearchPanel').evaluate(el => el.classList.contains('open')), true);
    const searchInput = page.locator('#toolHeaderSearchInput');
    const results = page.locator('#toolHeaderSearchResults a');

    await searchInput.fill('time');
    assert.ok(await results.count() >= 1);
    assert.match(await page.locator('#toolHeaderSearchResults').innerText(), /Time Calculator/);

    await searchInput.fill('business');
    assert.match(await page.locator('#toolHeaderSearchResults').innerText(), /Business Hours Calculator/);

    await searchInput.fill('significant');
    assert.equal(await results.count(), 1);
    assert.match(await page.locator('#toolHeaderSearchResults').innerText(), /Significant Figures Calculator/);
  });

  await check('Mobile shared menu opens and page has no horizontal overflow', async () => {
    await fresh({ width: 390, height: 844 });
    await page.locator('#toolHeaderMenu').click();
    assert.equal(await page.locator('#toolHeaderMenuPanel').isVisible(), true);
    const dimensions = await page.evaluate(() => {
      const offenders = [...document.querySelectorAll('body *')].map(el => {
        const r = el.getBoundingClientRect();
        const css = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: typeof el.className === 'string' ? el.className : '',
          left: Math.round(r.left * 10) / 10,
          right: Math.round(r.right * 10) / 10,
          width: Math.round(r.width * 10) / 10,
          position: css.position,
          overflowX: css.overflowX
        };
      }).filter(x => x.right > innerWidth + 1 || x.left < -1)
        .sort((a,b) => b.right - a.right)
        .slice(0,20);
      return { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, offenders };
    });
    assert.ok(dimensions.scroll <= dimensions.client + 1,
      `horizontal overflow: ${dimensions.scroll}px > ${dimensions.client}px; offenders: ${JSON.stringify(dimensions.offenders)}`);
  });
} finally {
  await browser.close();
}
console.log('Math & Science category browser checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exitCode = 1;
