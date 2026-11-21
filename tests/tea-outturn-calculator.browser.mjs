import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const failures = [];
const pageErrors = [];
let passed = 0;
page.on('pageerror', error => pageErrors.push(error.message));

async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (error) { failures.push({ name, error: error.message }); console.error('FAIL', name, error.message); }
}
async function fresh(route = '/tea-outturn-calculator/') {
  await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded' });
  await page.locator('#actualForm').waitFor();
  await page.waitForFunction(() => {
    const header = document.querySelector('.site-header');
    return Boolean(header && header.dataset.zemUnified === '1' &&
      header.querySelector('#toolHeaderSearch') && header.querySelector('#toolHeaderMenu'));
  });
}

try {
  await fresh();
  await check('Calculator page has unique SEO metadata, canonical, indexability and valid structured data', async () => {
    assert.equal(await page.title(), 'Tea Outturn Calculator | Green Leaf to Made Tea | ZemTools');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/tea-outturn-calculator/');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index,follow');
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    assert.ok(description.length >= 100 && description.length <= 180);
    assert.equal(await page.locator('meta[property="og:description"]').getAttribute('content'), description);
    assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), await page.title());
    assert.equal(await page.locator('meta[name="twitter:title"]').getAttribute('content'), await page.title());
    assert.equal(await page.locator('meta[name="twitter:description"]').getAttribute('content'), description);
    const json = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.map(node => JSON.parse(node.textContent)));
    assert.ok(json.some(item => item['@type'] === 'WebApplication'));
    assert.ok(json.some(item => item['@type'] === 'BreadcrumbList'));
    const faqSchema = json.find(item => item['@type'] === 'FAQPage');
    assert.ok(faqSchema);
    const visibleQuestions = await page.locator('.faq summary').allTextContents();
    for (const question of faqSchema.mainEntity) {
      assert.ok(visibleQuestions.includes(question.name), 'FAQ structured data question must be visible: ' + question.name);
    }
    assert.equal(await page.locator('label:not([for])').count(), 0);
  });

  await check('Actual batch calculates net outturn, optional gross outturn and the conversion ratio', async () => {
    await fresh();
    await page.locator('#greenLeafWeight').fill('1000');
    await page.locator('#madeTeaWeight').fill('225');
    await page.locator('#firedTeaWeight').fill('240');
    await page.locator('#actualForm button[type="submit"]').click();
    const results = page.locator('#actualResults');
    await results.waitFor({ state: 'visible' });
    const text = await results.innerText();
    assert.match(text, /Net outturn[\s\S]*22\.5%/i);
    assert.match(text, /Gross outturn[\s\S]*24%/i);
    assert.match(text, /4\.444\s*:\s*1/);
    assert.equal(await page.locator('#actualMetrics .metric').count(), 3);
  });

  await check('Fired-tea input is optional and omitted gross outturn is not shown as zero', async () => {
    await fresh();
    await page.locator('#greenLeafWeight').fill('1000');
    await page.locator('#madeTeaWeight').fill('225');
    await page.locator('#actualForm button[type="submit"]').click();
    const text = await page.locator('#actualResults').innerText();
    assert.match(text, /22\.5%/);
    assert.doesNotMatch(text, /Gross outturn/i);
  });

  await check('Planning estimates the green leaf required from the user-entered outturn', async () => {
    await fresh();
    await page.locator('#planUnit').selectOption('t');
    await page.locator('#targetMadeTea').fill('1');
    await page.locator('#expectedOutturn').fill('22.5');
    await page.locator('#planForm button[type="submit"]').click();
    const text = await page.locator('#planResults').innerText();
    assert.match(text, /4\.444\s*t/);
    assert.match(text, /Target made tea[\s\S]*1\s*t/i);
    assert.match(text, /22\.5%/);
  });

  await check('Unit conversion preserves the calculated percentage', async () => {
    await fresh();
    await page.locator('#actualUnit').selectOption('lb');
    await page.locator('#greenLeafWeight').fill('2204.62262185');
    await page.locator('#madeTeaWeight').fill('496.04008991625');
    await page.locator('#actualForm button[type="submit"]').click();
    assert.match(await page.locator('#actualResults').innerText(), /22\.5%/);
  });

  await check('Physically impossible weights and outturn values outside the allowed range are rejected', async () => {
    await fresh();
    await page.locator('#greenLeafWeight').fill('100');
    await page.locator('#madeTeaWeight').fill('101');
    await page.locator('#actualForm button[type="submit"]').click();
    assert.match(await page.locator('#actualError').innerText(), /cannot exceed the green leaf weight/i);
    await page.locator('#targetMadeTea').fill('100');
    await page.locator('#expectedOutturn').fill('0');
    await page.locator('#planForm button[type="submit"]').click();
    assert.match(await page.locator('#planError').innerText(), /greater than 0%/i);
  });

  await check('Reset controls clear inputs and previous output', async () => {
    await fresh();
    await page.locator('#greenLeafWeight').fill('1000');
    await page.locator('#madeTeaWeight').fill('225');
    await page.locator('#actualForm button[type="submit"]').click();
    await page.locator('#resetActual').click();
    assert.equal(await page.locator('#greenLeafWeight').inputValue(), '');
    assert.equal(await page.locator('#actualResults').isVisible(), false);
  });

  await check('Homepage, All Tools, Math & Science category and sitemap discover the new calculator', async () => {
    await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('#tool-search').fill('tea outturn');
    await page.waitForFunction(() => {
      const panel = document.querySelector('#search-suggestions');
      return Boolean(panel && !panel.hidden && panel.querySelectorAll('.search-suggestion').length > 0);
    });
    assert.match(await page.locator('#search-suggestions').innerText(), /Tea Outturn Calculator/i);

    const directory = await page.request.get(baseUrl + '/tools/');
    assert.equal(directory.status(), 200);
    const directoryHtml = await directory.text();
    assert.ok(directoryHtml.includes('/tea-outturn-calculator/'));
    const directorySchemas = [...directoryHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const directorySchema = directorySchemas.map(match => JSON.parse(match[1])).find(item => item['@type'] === 'CollectionPage');
    const directoryItems = directorySchema.mainEntity.itemListElement;
    assert.equal(directorySchema.mainEntity.numberOfItems, directoryItems.length);
    assert.ok(directoryHtml.includes(`All ${directoryItems.length} tools are linked directly above.`));
    assert.ok(directoryItems.some(item => item.url === 'https://zemtools.com/tea-outturn-calculator/'));

    const category = await page.request.get(baseUrl + '/math-science/');
    assert.equal(category.status(), 200);
    const categoryHtml = await category.text();
    assert.ok(categoryHtml.includes('/tea-outturn-calculator/'));
    const schemas = [...categoryHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const collection = schemas.map(match => JSON.parse(match[1])).find(item => item['@type'] === 'CollectionPage');
    assert.ok(collection.mainEntity.itemListElement.some(item => item.url === 'https://zemtools.com/tea-outturn-calculator/'));

    const sitemap = await page.request.get(baseUrl + '/sitemap.xml');
    assert.equal(sitemap.status(), 200);
    assert.ok((await sitemap.text()).includes('https://zemtools.com/tea-outturn-calculator/'));
  });

  await check('Shared search finds the calculator from the global tool catalog', async () => {
    await fresh();
    await page.locator('#toolHeaderSearch').click();
    await page.locator('#toolHeaderSearchInput').fill('tea outturn');
    await page.waitForFunction(() => document.querySelectorAll('#toolHeaderSearchResults a').length > 0);
    assert.match(await page.locator('#toolHeaderSearchResults').innerText(), /Tea Outturn Calculator/);
  });

  await check('Mobile, tablet and desktop layouts align content, place Report a problem above the footer and avoid overflow', async () => {
    await page.waitForSelector('.report-problem-wrap #reportProblemBtn');
    for (const width of [390, 768, 1365]) {
      await page.setViewportSize({ width, height: 900 });
      await fresh();
      const state = await page.evaluate(() => {
        const report = document.querySelector('.report-problem-wrap');
        const panel = document.querySelector('.tea-page > .panel');
        const footer = document.querySelector('.tea-page > footer');
        const reportRect = report?.getBoundingClientRect();
        const panelRect = panel?.getBoundingClientRect();
        const footerRect = footer?.getBoundingClientRect();
        const footerInner = footer?.querySelector('.footer-inner');
        const footerInnerRect = footerInner?.getBoundingClientRect();
        const footerInnerStyle = footerInner ? getComputedStyle(footerInner) : null;
        return {
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          reportLeft: reportRect?.left,
          reportRight: reportRect?.right,
          reportBottom: reportRect?.bottom,
          panelLeft: panelRect?.left,
          panelRight: panelRect?.right,
          footerTop: footerRect?.top,
          footerLeft: footerRect?.left,
          footerRight: footerRect?.right,
          footerContentLeft: footerInnerRect ? footerInnerRect.left + parseFloat(footerInnerStyle.paddingLeft) : null,
          footerContentRight: footerInnerRect ? footerInnerRect.right - parseFloat(footerInnerStyle.paddingRight) : null,
          reportBeforeFooter: Boolean(report && footer && (report.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING))
        };
      });
      assert.ok(state.scroll <= state.client + 1, width + 'px horizontal overflow: ' + JSON.stringify(state));
      assert.ok(state.reportBeforeFooter, width + 'px Report a problem must appear before the footer');
      assert.ok(Math.abs(state.reportLeft - state.panelLeft) <= 1, width + 'px Report a problem left alignment mismatch: ' + JSON.stringify(state));
      assert.ok(Math.abs(state.reportRight - state.panelRight) <= 1, width + 'px Report a problem right alignment mismatch: ' + JSON.stringify(state));
      assert.ok(state.footerTop >= state.reportBottom, width + 'px footer overlaps Report a problem: ' + JSON.stringify(state));
      assert.ok(state.footerLeft >= -1 && state.footerRight <= state.client + 1, width + 'px footer exceeds viewport: ' + JSON.stringify(state));
      assert.ok(Math.abs(state.footerContentLeft - state.panelLeft) <= 1, width + 'px footer content left alignment mismatch: ' + JSON.stringify(state));
      assert.ok(Math.abs(state.footerContentRight - state.panelRight) <= 1, width + 'px footer content right alignment mismatch: ' + JSON.stringify(state));
      assert.equal(await page.locator('#toolHeaderSearch').count(), 1);
      assert.equal(await page.locator('#toolHeaderMenu').count(), 1);
    }
  });

  assert.deepEqual(pageErrors, [], 'Page should not produce uncaught JavaScript errors');
} finally {
  await browser.close();
}
console.log('Tea Outturn Calculator browser checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exitCode = 1;
