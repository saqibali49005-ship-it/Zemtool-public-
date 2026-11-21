import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
await page.addInitScript(() => {
  window.__zemLayoutShift = 0;
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__zemLayoutShift += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (_) {}
});
const failures = [];
let passed = 0;
page.on('pageerror', error => failures.push({ name: 'uncaught page error', error: error.message }));

async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (error) { failures.push({ name, error: error.message }); console.error('FAIL', name, error.message); }
}
async function fresh(viewport = { width: 1365, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto(baseUrl + '/sourdough-calculator/', { waitUntil: 'domcontentloaded' });
  await page.locator('#calculate-build').waitFor();
  await page.waitForFunction(() => {
    const header = document.querySelector('header.site-header');
    return Boolean(header && header.dataset.zemUnified === '1' &&
      header.querySelector('#toolHeaderSearch') && header.querySelector('#toolHeaderMenu'));
  });
}

try {
  await fresh();
  await check('Dedicated tool page owns its canonical query and has aligned SERP metadata', async () => {
    assert.match(await page.title(), /^Sourdough Calculator:/);
    assert.equal(await page.locator('h1').first().innerText(), 'Sourdough Calculator');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/sourdough-calculator/');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index,follow');
    const meta = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content,
      ogDescription: document.querySelector('meta[property="og:description"]')?.content,
      twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content,
      twitterDescription: document.querySelector('meta[name="twitter:description"]')?.content
    }));
    assert.ok(meta.description.length >= 100 && meta.description.length <= 180);
    assert.equal(meta.ogTitle, meta.title);
    assert.equal(meta.twitterTitle, meta.title);
    assert.equal(meta.ogDescription, meta.description);
    assert.equal(meta.twitterDescription, meta.description);
    const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.map(n => JSON.parse(n.textContent)));
    assert.ok(schemas.some(x => x['@type'] === 'WebApplication' && x.url === 'https://zemtools.com/sourdough-calculator/'));
    const deferredScripts = await page.locator('script[defer][src]').evaluateAll(nodes => nodes.map(n => new URL(n.src).pathname));
    assert.deepEqual(deferredScripts, ['/tools-data.js', '/sourdough-calculator-engine.js', '/master-ui.js', '/sourdough-calculator.js']);
    assert.equal(await page.locator('script:not([src]):not([type])').count(), 0, 'Calculator application JavaScript should not be inline or parser-blocking');
    const breadcrumb = schemas.find(x => x['@type'] === 'BreadcrumbList');
    assert.equal(breadcrumb.itemListElement[2].item, 'https://zemtools.com/sourdough-calculator/');
  });

  await check('Hero title, icon and description sit inside the matching bordered intro card on desktop and mobile', async () => {
    for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
      await fresh(viewport);
      const layout = await page.evaluate(() => {
        const shell = document.querySelector('.hero-shell');
        const crumb = shell?.querySelector('.crumbs');
        const hero = shell?.querySelector('.hero');
        if (!hero) return null;
        const css = getComputedStyle(hero);
        return {
          breadcrumbInsideShell: Boolean(crumb && shell.contains(crumb)),
          heroInsideShell: Boolean(shell.contains(hero)),
          display: css.display,
          borderTopWidth: css.borderTopWidth,
          borderTopStyle: css.borderTopStyle,
          borderRadius: css.borderTopLeftRadius,
          padding: css.padding,
          backgroundImage: css.backgroundImage,
          hasIcon: Boolean(hero.querySelector('.tool-icon')),
          hasHeading: Boolean(hero.querySelector('h1')),
          hasDescription: Boolean(hero.querySelector('p'))
        };
      });
      assert.ok(layout, 'Hero intro card should exist');
      assert.equal(layout.breadcrumbInsideShell, true);
      assert.equal(layout.heroInsideShell, true);
      assert.equal(layout.display, 'flex');
      assert.equal(layout.borderTopWidth, '1px');
      assert.equal(layout.borderTopStyle, 'solid');
      assert.equal(layout.borderRadius, '18px');
      assert.equal(layout.padding, viewport.width < 500 ? '17px' : '24px');
      assert.ok(layout.backgroundImage.includes('linear-gradient'));
      assert.equal(layout.hasIcon, true);
      assert.equal(layout.hasHeading, true);
      assert.equal(layout.hasDescription, true);
    }
  });

  await check('Default build returns hand-checked 500 g flour, 75% hydration, 20% starter and 2% salt', async () => {
    await fresh();
    await page.locator('#calculate-build').click();
    const stats = await page.locator('#result-stats').innerText();
    const lines = await page.locator('#result-lines').innerText();
    assert.match(stats, /75%/);
    assert.match(stats, /885 g/);
    assert.match(stats, /500 g/);
    assert.match(stats, /375 g/);
    assert.match(lines, /Bread flour to add[\s\S]*450 g/);
    assert.match(lines, /Water to add[\s\S]*325 g/);
    assert.match(lines, /Starter flour[\s\S]*50 g/);
    assert.match(lines, /Starter water[\s\S]*50 g/);
    assert.match(lines, /Salt[\s\S]*10 g/);
  });

  await check('Starter hydration changes the starter flour/water split without changing the target totals', async () => {
    await fresh();
    await page.locator('#build-starter-hydration').fill('150');
    await page.locator('#calculate-build').click();
    const lines = await page.locator('#result-lines').innerText();
    assert.match(lines, /Starter flour[\s\S]*40 g/);
    assert.match(lines, /Starter water[\s\S]*60 g/);
    assert.match(lines, /Water to add[\s\S]*315 g/);
    assert.match(await page.locator('#result-stats').innerText(), /885 g/);
  });

  await check('Multiple flour blend shares allocate only the flour added outside the starter', async () => {
    await fresh();
    await page.locator('#add-build-flour').click();
    await page.locator('.flour-row .flour-share').nth(0).fill('70');
    await page.locator('.flour-row .flour-name').nth(1).fill('Whole wheat');
    await page.locator('.flour-row .flour-share').nth(1).fill('30');
    await page.locator('#calculate-build').click();
    const lines = await page.locator('#result-lines').innerText();
    assert.match(lines, /Bread flour to add[\s\S]*315 g/);
    assert.match(lines, /Whole wheat to add[\s\S]*135 g/);
  });

  await check('Flour shares that do not total 100 percent are rejected with a clear message', async () => {
    await fresh();
    await page.locator('#add-build-flour').click();
    await page.locator('.flour-row .flour-share').nth(1).fill('10');
    await page.locator('#calculate-build').click();
    assert.match(await page.locator('#error-status').innerText(), /add up to exactly 100%/i);
    assert.equal(await page.locator('#result-card').isVisible(), false);
  });

  await check('Custom liquid water fraction is included in true hydration and recipe mass', async () => {
    await fresh();
    await page.locator('#add-build-liquid').click();
    await page.locator('.liquid-row .liquid-mass').fill('100');
    await page.locator('.liquid-row .liquid-water').fill('87');
    await page.locator('#calculate-build').click();
    const stats = await page.locator('#result-stats').innerText();
    const lines = await page.locator('#result-lines').innerText();
    assert.match(stats, /898 g/);
    assert.match(lines, /Water to add[\s\S]*238 g/);
    assert.match(lines, /Water from added liquids[\s\S]*87 g/);
  });

  await check('Flour-I-add basis calculates the matching total flour and starter automatically', async () => {
    await fresh();
    await page.locator('#build-basis').selectOption('added-flour');
    await page.locator('#build-target').fill('450');
    await page.locator('#calculate-build').click();
    const stats = await page.locator('#result-stats').innerText();
    const lines = await page.locator('#result-lines').innerText();
    assert.match(stats, /500 g/);
    assert.match(lines, /Starter total[\s\S]*100 g/);
    assert.match(lines, /Water to add[\s\S]*325 g/);
  });

  await check('Quick recipe presets update the target hydration without changing formula definitions', async () => {
    await fresh();
    await page.locator('[data-preset="country"]').click();
    assert.equal(await page.locator('#build-hydration').inputValue(), '75');
    assert.equal(await page.locator('#build-starter-pct').inputValue(), '20');
    await page.locator('[data-preset="open"]').click();
    assert.equal(await page.locator('#build-hydration').inputValue(), '82');
    assert.equal(await page.locator('#panel-build').isVisible(), true);
  });

  await check('Target-dough mode calculates the flour amount from a chosen finished weight', async () => {
    await fresh();
    await page.locator('#build-basis').selectOption('total-dough');
    await page.locator('#build-target').fill('885');
    await page.locator('#calculate-build').click();
    const stats = await page.locator('#result-stats').innerText();
    assert.match(stats, /500 g/);
    assert.match(stats, /885 g/);
  });

  await check('Existing-recipe check reports starter-aware true hydration and percentages', async () => {
    await fresh();
    await page.locator('#mode-check').click();
    await page.locator('#calculate-check').click();
    const stats = await page.locator('#result-stats').innerText();
    const lines = await page.locator('#result-lines').innerText();
    assert.match(stats, /75%/);
    assert.match(stats, /500 g/);
    assert.match(stats, /375 g/);
    assert.match(lines, /Starter \(% of total flour\)[\s\S]*20%/);
    assert.match(lines, /Prefermented flour \(% of total flour\)[\s\S]*10%/);
    assert.match(lines, /Salt percentage[\s\S]*2%/);
  });

  await check('Starter feeding ratio returns exact 1:2:2 amounts', async () => {
    await fresh();
    await page.locator('#mode-feed').click();
    await page.locator('#calculate-feed').click();
    const lines = await page.locator('#result-lines').innerText();
    assert.match(lines, /Existing starter \/ seed[\s\S]*40 g/);
    assert.match(lines, /Fresh flour to add[\s\S]*80 g/);
    assert.match(lines, /Fresh water to add[\s\S]*80 g/);
    assert.match(lines, /Flour in seed[\s\S]*20 g/);
    assert.match(lines, /Water in seed[\s\S]*20 g/);
    assert.match(await page.locator('#result-stats').innerText(), /100%/);
    await page.locator('#feed-seed-hydration').fill('150');
    await page.locator('#calculate-feed').click();
    assert.match(await page.locator('#result-stats').innerText(), /108\.33%/);
  });

  await check('Scaling multiplies every ingredient and the finished dough target', async () => {
    await fresh();
    await page.locator('#calculate-build').click();
    await page.locator('#scale-value').fill('2');
    await page.locator('#scale-recipe').click();
    const message = await page.locator('#scale-status').innerText();
    assert.match(message, /1,770 g/);
    assert.match(message, /Bread flour: 900 g/);
    assert.match(message, /Water to add: 650 g/);
  });

  await check('Weight-unit switching preserves the recipe mass calculation', async () => {
    await fresh();
    await page.locator('#weight-unit').selectOption('kg');
    assert.equal(await page.locator('#build-target').inputValue(), '0.5');
    assert.equal(await page.locator('#check-water').inputValue(), '0.325');
    await page.locator('#calculate-build').click();
    assert.match(await page.locator('#result-stats').innerText(), /0.89 kg|0.885 kg/);
    assert.match(await page.locator('#result-stats').innerText(), /0.5 kg/);
  });

  await check('CSV export generates a recipe ingredient file', async () => {
    await fresh();
    await page.locator('#calculate-build').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-csv').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'sourdough-recipe.csv');
  });

  await check('Recipe sharing serializes recipe details into a recoverable share URL', async () => {
    await fresh();
    await page.locator('#calculate-build').click();
    await page.locator('#share-recipe').click();
    await page.waitForFunction(() => new URL(location.href).searchParams.has('recipe'));
    const payload = await page.evaluate(() => JSON.parse(new URL(location.href).searchParams.get('recipe')));
    assert.equal(payload.title, 'Your sourdough recipe');
    assert.equal(payload.ingredients.length, 4);
    assert.equal(payload.unit, 'g');
    await page.goto(baseUrl + '/sourdough-calculator/?recipe=' + encodeURIComponent(JSON.stringify(payload)), { waitUntil: 'domcontentloaded' });
    await page.locator('#result-card.visible').waitFor();
    assert.match(await page.locator('#result-lines').innerText(), /Bread flour[\s\S]*450 g/);
  });

  await check('Dedicated calculator and category stay distinct, with the category acting as a directory', async () => {
    await page.goto(baseUrl + '/math-science/', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.title(), 'Math & Science Tools | ZemTools');
    assert.match(await page.locator('main.wrap h1').innerText(), /Math & Science Tools/);
    assert.equal(await page.locator('main.wrap .grid a[href="/sourdough-calculator/"]').count(), 1);
    assert.doesNotMatch(await page.locator('.category-guide').innerText(), /sourdough hydration|starter feeding|Sourdough Calculator/i);
  });

  await check('Homepage search for the exact primary query opens the dedicated calculator URL', async () => {
    await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('#tool-search').fill('sourdough calculator');
    await page.locator('#home-search .search-go').click();
    await page.waitForURL('**/sourdough-calculator/');
    assert.equal(new URL(page.url()).pathname, '/sourdough-calculator/');
  });

  await check('Mobile initial layout remains stable after the shared header initializes', async () => {
    await fresh({ width: 390, height: 844 });
    await page.waitForTimeout(1200);
    const cls = await page.evaluate(() => window.__zemLayoutShift || 0);
    assert.ok(cls <= 0.1, 'Mobile cumulative layout shift should be <= 0.1, observed ' + cls.toFixed(3));
  });

  await check('Mobile calculator remains within viewport and controls remain usable', async () => {
    await fresh({ width: 390, height: 844 });
    for (const selector of ['#mode-build','#mode-check','#mode-feed','#calculate-build','#build-target','#weight-unit']) {
      assert.equal(await page.locator(selector).isVisible(), true, selector+' should be visible');
    }
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth
    }));
    assert.ok(dimensions.scroll <= dimensions.client + 1, JSON.stringify(dimensions));
    await page.locator('#mode-check').click();
    await page.locator('#calculate-check').click();
    assert.equal(await page.locator('#result-card').isVisible(), true);
  });

} finally {
  await browser.close();
}
console.log('Sourdough calculator browser checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exitCode = 1;
