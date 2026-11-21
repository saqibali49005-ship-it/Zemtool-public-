import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const failures = [];
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
let passed = 0;

async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (error) { failures.push({ name, error: error.message }); console.error('FAIL', name, error.message); }
}

async function fresh() {
  await page.goto(`${baseUrl}/raised-bed-soil-calculator/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#calculateProject').waitFor();
  await page.locator('.bed-card').first().waitFor();
}
async function calculate() {
  await page.locator('#calculateProject').click();
  await page.locator('#projectResults:not(.hidden)').waitFor();
}
async function resultText() {
  return (await page.locator('#projectResults').innerText()).replace(/\s+/g, ' ');
}

try {
  await fresh();
  await check('Page loads with canonical URL, indexability, structured data and category navigation', async () => {
    assert.match(await page.title(), /Raised Bed Soil Calculator/i);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/raised-bed-soil-calculator/');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index,follow');
    const data = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.map(node => JSON.parse(node.textContent)));
    assert.ok(data.some(item => item['@type'] === 'WebApplication'));
    assert.ok(data.some(item => item['@type'] === 'BreadcrumbList'));
    assert.equal(await page.locator('#toolHeaderMenuPanel a[href="/home-construction/"]').count(), 1);
    assert.equal(await page.locator('label:not([for])').count(), 0);
  });

  await check('Default 60/30/10 editable example calculates 15 ft³ and rounds labelled bags up', async () => {
    await fresh();
    await calculate();
    const text = await resultText();
    assert.match(text, /424\.8? L · 15 ft³/);
    assert.match(text, /Topsoil/);
    assert.match(text, /9 × 30 L/);
    assert.match(text, /Compost/);
    assert.match(text, /5 × 30 L/);
    assert.match(text, /Soilless growing mix/);
    assert.match(text, /2 × 30 L/);
    assert.deepEqual(await page.locator('.ingredient-card [data-field="pricePerBag"]').evaluateAll(nodes => nodes.map(node => node.value)), ['', '', '']);
    assert.match(text, /Add a price for each ingredient with a non-zero percentage/i);
  });

  await check('Several beds combine into one project and preserve per-bed results', async () => {
    await fresh();
    await page.locator('#addBed').click();
    assert.equal(await page.locator('.bed-card').count(), 2);
    await calculate();
    const text = await resultText();
    assert.match(text, /2 total/);
    assert.match(text, /Backyard bed/);
    assert.match(text, /Bed 2/);
  });

  await check('Existing fill depth is deducted from target depth before mix ratios are applied', async () => {
    await fresh();
    await page.locator('.bed-card').first().locator('[data-field="existingDepth"]').fill('5');
    await calculate();
    assert.match(await resultText(), /212\.4? L · 7\.5 ft³/);
    assert.match(await resultText(), /Topsoil/);
  });

  await check('Mix percentages that do not total 100% are rejected clearly', async () => {
    await fresh();
    const ingredients = page.locator('.ingredient-card');
    await ingredients.nth(0).locator('[data-field="percentage"]').fill('50');
    await page.locator('#calculateProject').click();
    assert.match(await page.locator('#projectError').innerText(), /must add up to 100%/i);
    assert.equal(await page.locator('#projectResults').isVisible(), false);
  });

  await check('Metric mode converts dimensions without changing the physical soil volume', async () => {
    await fresh();
    await page.locator('#unitSystem').selectOption('metric');
    const bed = page.locator('.bed-card').first();
    assert.equal(await bed.locator('[data-field="length"]').inputValue(), '1.8288');
    assert.equal(await bed.locator('[data-field="width"]').inputValue(), '0.9144');
    assert.equal(await bed.locator('[data-field="depth"]').inputValue(), '25.4');
    await calculate();
    assert.match(await resultText(), /424\.8? L · 15 ft³/);
  });

  await check('Circle beds use circular area and the same fill-volume method', async () => {
    await fresh();
    const bed = page.locator('.bed-card').first();
    await bed.locator('[data-field="shape"]').selectOption('circle');
    await bed.locator('[data-field="diameter"]').fill('6');
    await bed.locator('[data-field="depth"]').fill('12');
    await calculate();
    assert.match(await resultText(), /800\.6? L/);
  });

  await check('Zero or invalid bag volume and negative pricing cannot produce a false package quote', async () => {
    await fresh();
    const topsoil = page.locator('.ingredient-card').first();
    await topsoil.locator('[data-field="bagVolumeL"]').fill('0');
    await page.locator('#calculateProject').click();
    assert.match(await page.locator('#projectError').innerText(), /package volume must be greater than zero/i);

    await topsoil.locator('[data-field="bagVolumeL"]').fill('30');
    await topsoil.locator('[data-field="pricePerBag"]').fill('-1');
    await page.locator('#calculateProject').click();
    assert.match(await page.locator('#projectError').innerText(), /price cannot be negative/i);
  });

  await check('User-entered ingredient names are rendered as text, not interpreted as HTML', async () => {
    await fresh();
    await page.locator('.ingredient-card').first().locator('[data-field="name"]').fill('<strong>Topsoil</strong>');
    await calculate();
    assert.equal(await page.locator('#ingredientResultRows strong').count(), 3);
    assert.equal(await page.locator('#ingredientResultRows strong').first().evaluate(node => node.querySelector('strong')), null);
    assert.match(await page.locator('#ingredientResultRows').innerText(), /<strong>Topsoil<\/strong>/);
  });

  await check('Catalog, homepage, All Tools, category page and sitemap all discover the calculator', async () => {
    const homepage = await page.request.get(`${baseUrl}/`);
    const homepageHtml = await homepage.text();
    assert.equal(homepage.status(), 200);
    assert.ok(homepageHtml.includes('href="/raised-bed-soil-calculator/"'));

    const category = await page.request.get(`${baseUrl}/home-construction/`);
    const categoryHtml = await category.text();
    assert.equal(category.status(), 200);
    assert.ok(categoryHtml.includes('href="raised-bed-soil-calculator/"'));

    const directory = await page.request.get(`${baseUrl}/tools/`);
    const directoryHtml = await directory.text();
    assert.equal(directory.status(), 200);
    assert.ok(directoryHtml.includes('href="/raised-bed-soil-calculator/"'));
    const schemaStart = directoryHtml.indexOf('<script type="application/ld+json">');
    const schemaEnd = directoryHtml.indexOf('</script>', schemaStart);
    const schema = JSON.parse(directoryHtml.slice(schemaStart + '<script type="application/ld+json">'.length, schemaEnd));
    const directoryItems = schema.mainEntity.itemListElement;
    assert.equal(schema.mainEntity.numberOfItems, directoryItems.length);
    assert.ok(directoryItems.some(item => item.url === 'https://zemtools.com/raised-bed-soil-calculator/'));

    const sitemap = await page.request.get(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemap.status(), 200);
    assert.ok((await sitemap.text()).includes('https://zemtools.com/raised-bed-soil-calculator/'));

    const mulchPage = await page.request.get(`${baseUrl}/mulch-calculator/`);
    assert.equal(mulchPage.status(), 200);
    assert.ok((await mulchPage.text()).includes('href="/raised-bed-soil-calculator/"'));

    const gravelPage = await page.request.get(`${baseUrl}/gravel-calculator/`);
    assert.equal(gravelPage.status(), 200);
    assert.ok((await gravelPage.text()).includes('href="/raised-bed-soil-calculator/"'));

    assert.ok(await page.locator('a[href="/mulch-calculator/"]').count() >= 1);
    assert.ok(await page.locator('a[href="/gravel-calculator/"]').count() >= 1);
  });

  await check('Mobile viewport has no horizontal page overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
    await page.locator('#calculateProject').isVisible();
    await page.locator('#addBed').isVisible();
  });

  await check('All calculator fields and action buttons have accessible names', async () => {
    await fresh();
    const unnamedFields = await page.locator('.rb-page input:not([type="hidden"]), .rb-page select, .rb-page textarea').evaluateAll(nodes =>
      nodes.filter(node =>
        !(node.labels && node.labels.length) &&
        !node.getAttribute('aria-label') &&
        !node.getAttribute('aria-labelledby')
      ).map(node => ({tag:node.tagName,id:node.id,name:node.name}))
    );
    assert.deepEqual(unnamedFields, []);
    const unnamedButtons = await page.locator('.rb-page button').evaluateAll(nodes =>
      nodes.filter(node =>
        !node.innerText.trim() &&
        !node.getAttribute('aria-label') &&
        !node.getAttribute('title')
      ).map(node => node.outerHTML)
    );
    assert.deepEqual(unnamedButtons, []);
    assert.equal(await page.locator('h1').count(), 1);
  });

  await check('Responsive layout fits phone, tablet and desktop breakpoints', async () => {
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll('body *')].map(node => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {tag:node.tagName,id:node.id,className:typeof node.className==='string'?node.className:'',left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width),overflowX:style.overflowX,position:style.position};
        }).filter(item => item.width>0 && (item.right>document.documentElement.clientWidth+1 || item.left < -1)).slice(0,20)
      }));
      assert.ok(dimensions.scroll <= dimensions.width + 1, width + 'px viewport: ' + JSON.stringify(dimensions));
      await page.locator('#calculateProject').isVisible();
      await page.locator('.hero h1').isVisible();
    }
    await page.setViewportSize({ width: 1365, height: 900 });
  });

  await check('Page interactions produce no uncaught JavaScript errors', async () => {
    assert.deepEqual(pageErrors, []);
  });
} finally {
  await browser.close();
}

console.log(`Raised bed soil browser checks: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
