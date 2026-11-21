import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const failures = [];
let passed = 0;

async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (error) { failures.push({ name, error: error.message }); console.error('FAIL', name, error.message); }
}
async function fresh() {
  await page.goto(baseUrl + '/spreader-calibration-calculator/', { waitUntil: 'domcontentloaded' });
  await page.locator('#spreaderForm').waitFor();
  await page.locator('header.site-header[data-zem-unified="1"]').waitFor();
  await page.waitForFunction(() => [...document.styleSheets].some(sheet => sheet.href && sheet.href.includes('master-header.css')));
}
async function calculate() {
  await page.locator('#spreaderForm').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

try {
  await fresh();
  await check('page has canonical metadata, shared navigation and category breadcrumb', async () => {
    assert.match(await page.title(), /Spreader Calibration Calculator/i);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/spreader-calibration-calculator/');
    assert.equal(await page.locator('#toolHeaderMenuPanel a[href="/home-construction/"]').count(), 1);
    assert.match(await page.locator('body').innerText(), /Home & Construction/);
  });

  await check('SEO metadata and structured data are valid and complete', async () => {
    const metadata = await page.evaluate(() => {
      const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')].map(node => JSON.parse(node.textContent));
      return { title: document.title, description: document.querySelector('meta[name="description"]')?.content || '', robots: document.querySelector('meta[name="robots"]')?.content || '', schemas: scripts.map(x => x['@type']) };
    });
    assert.match(metadata.title, /Spreader Calibration Calculator.*Drop.*Rotary/i);
    assert.match(metadata.description, /drop or rotary spreader/i);
    assert.equal(metadata.robots, 'index,follow');
    assert.ok(metadata.schemas.includes('WebApplication'));
    assert.ok(metadata.schemas.includes('BreadcrumbList'));
  });

  await check('rotary effective-swath guide and extension reference are present', async () => {
    assert.match(await page.locator('body').innerText(), /How to Measure Rotary Spreader Effective Swath Width/i);
    assert.match(await page.locator('body').innerText(), /half the centre amount/i);
    assert.equal(await page.locator('a[href*="agrilifeextension.tamu.edu"][href$="spreadercalibration.pdf"]').count(), 1);
  });

  await check('category and all-tools discovery pages link this tool and directory schema count matches its items', async () => {
    const categoryResponse = await page.request.get(baseUrl + '/home-construction/');
    const categoryHtml = await categoryResponse.text();
    assert.equal(categoryResponse.status(), 200);
    assert.ok(categoryHtml.includes('href="/spreader-calibration-calculator/"'));
    assert.ok(categoryHtml.includes('<h2>Spreader Calibration Calculator</h2>'));
    const directoryResponse = await page.request.get(baseUrl + '/tools/');
    const directoryHtml = await directoryResponse.text();
    assert.equal(directoryResponse.status(), 200);
    assert.ok(directoryHtml.includes('href="/spreader-calibration-calculator/"'));
    const marker = '<script type="application/ld+json">';
    const start = directoryHtml.indexOf(marker);
    const end = directoryHtml.indexOf('</script>', start);
    assert.ok(start >= 0 && end > start);
    const listSchema = JSON.parse(directoryHtml.slice(start + marker.length, end));
    const items = listSchema.mainEntity.itemListElement;
    assert.equal(listSchema.mainEntity.numberOfItems, items.length);
    assert.ok(directoryHtml.includes(`All ${items.length} tools are linked directly above.`));
    const urls = new Set(items.map(item => item.url));
    for (const url of [
      'https://zemtools.com/raised-bed-soil-calculator/',
      'https://zemtools.com/mulch-calculator/',
      'https://zemtools.com/spreader-calibration-calculator/'
    ]) assert.ok(urls.has(url), 'Missing directory schema URL: ' + url);
  });

  await check('drop-spreader before/after test calculates rate, target weight and bag quantity', async () => {
    await page.locator('#rateValue').fill('2.5');
    await page.locator('#beforeWidth').fill('2');
    await page.locator('#beforeLength').fill('50');
    await page.locator('#startingWeight').fill('2');
    await page.locator('#remainingWeight').fill('1.75');
    await page.locator('#lawnArea').fill('5000');
    await page.locator('#bagSize').fill('20');
    await calculate();
    const result = await page.locator('#result').innerText();
    assert.match(result, /2\.5 lb \/ 1,000 sq ft/i);
    assert.match(result, /0\.25 lb/i);
    assert.match(result, /12\.5 lb/i);
    assert.match(result, /1 bag/i);
    assert.match(result, /Within your selected tolerance/i);
  });

  await check('nitrogen mode reveals percentage input and derives fertilizer product rate', async () => {
    await fresh();
    await page.locator('#targetBasis').selectOption('nitrogen');
    assert.equal(await page.locator('#nitrogenField').isVisible(), true);
    await page.locator('#rateValue').fill('1');
    await page.locator('#nitrogenPercent').fill('27');
    await page.locator('#beforeWidth').fill('2');
    await page.locator('#beforeLength').fill('50');
    await page.locator('#startingWeight').fill('2');
    await page.locator('#remainingWeight').fill('1.62962963');
    await calculate();
    assert.match(await page.locator('#result').innerText(), /3\.704 lb \/ 1,000 sq ft/i);
  });

  await check('rotary spreader exposes center-pan method and uses half rate per pass for two-pass plan', async () => {
    await fresh();
    await page.locator('#spreaderType').selectOption('rotary');
    assert.equal(await page.locator('#calibrationMethod option[value="rotary-center-pan"]').count(), 1);
    await page.locator('#calibrationMethod').selectOption('rotary-center-pan');
    await page.locator('#rateValue').fill('110');
    await page.locator('#applicationPasses').selectOption('2');
    await page.locator('#weightUnit').selectOption('g');
    await page.locator('#panArea').fill('1');
    await page.locator('#panPasses').fill('4');
    await page.locator('#panWeight').fill('100');
    await calculate();
    const result = await page.locator('#result').innerText();
    assert.match(result, /55 lb \/ 1,000 sq ft/i);
    assert.match(result, /Within your selected tolerance/i);
  });

  await check('switching to rotary removes drop-only calibration methods', async () => {
    await fresh();
    await page.locator('#spreaderType').selectOption('rotary');
    const options = await page.locator('#calibrationMethod option').allTextContents();
    assert.equal(options.some(value => /sweep and weigh/i.test(value)), false);
    assert.equal(options.some(value => /catch pan/i.test(value)), false);
  });

  await check('rejects remaining hopper weight above starting hopper weight', async () => {
    await fresh();
    await page.locator('#rateValue').fill('2.5');
    await page.locator('#beforeWidth').fill('2');
    await page.locator('#beforeLength').fill('50');
    await page.locator('#startingWeight').fill('2');
    await page.locator('#remainingWeight').fill('2.1');
    await calculate();
    assert.match(await page.locator('#error').innerText(), /Remaining weight cannot be greater/i);
  });

  await check('metric area and weight choices are accepted', async () => {
    await fresh();
    await page.locator('#rateUnit').selectOption('kg-100m2');
    await page.locator('#dimensionUnit').selectOption('m');
    await page.locator('#weightUnit').selectOption('kg');
    await page.locator('#rateValue').fill('1');
    await page.locator('#beforeWidth').fill('10');
    await page.locator('#beforeLength').fill('10');
    await page.locator('#startingWeight').fill('2');
    await page.locator('#remainingWeight').fill('1');
    await calculate();
    assert.match(await page.locator('#result').innerText(), /1 kg \/ 100 m²/i);
  });

  await check('mobile layout has no horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh();
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      overflowing: [...document.querySelectorAll('body *')].map(el => {
        const rect = el.getBoundingClientRect();
        return { tag: el.tagName, id: el.id, className: typeof el.className === 'string' ? el.className : '', left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      }).filter(item => item.right > window.innerWidth + 1 || item.left < -1 || item.scrollWidth > item.clientWidth + 2).slice(0, 20)
    }));
    assert.ok(dimensions.scroll <= dimensions.client + 1, 'horizontal overflow: ' + JSON.stringify(dimensions));
    await page.setViewportSize({ width: 1365, height: 900 });
  });
} finally {
  await browser.close();
}

console.log('Spreader calibration browser checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exitCode = 1;
