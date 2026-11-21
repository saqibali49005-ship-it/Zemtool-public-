import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const failures = [];
let passed = 0;

async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (error) { failures.push({ name, error: error.message }); console.error('FAIL', name, error.message); }
}

try {
  for (const viewport of [
    { name: 'desktop', width: 1365, height: 900 },
    { name: 'mobile', width: 390, height: 844 }
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.goto('http://127.0.0.1:4173/home-construction/', { waitUntil: 'domcontentloaded' });

    await check(viewport.name + ': category keeps its broad purpose and canonical', async () => {
      assert.match(await page.title(), /Home & Construction Tools/i);
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute('href'),
        'https://zemtools.com/home-construction/'
      );
      const guideText = (await page.locator('section.category-guide').allTextContents()).join(' ');
      assert.doesNotMatch(guideText, /Deck Joist Blocking Calculator/i);
    });

    await check(viewport.name + ': category retains one direct calculator card link', async () => {
      const card = page.locator('section.card').filter({
        has: page.getByRole('heading', { name: 'Deck Joist Blocking Calculator', exact: true })
      });
      assert.equal(await card.count(), 1);
      const link = card.getByRole('link', { name: 'Open calculator', exact: true });
      assert.equal(await link.count(), 1);
      const target = await link.evaluate(node => new URL(node.href, document.baseURI).pathname);
      assert.equal(target, '/deck-joist-blocking-calculator/');
      const bounds = await link.boundingBox();
      assert.ok(bounds && bounds.width > 0 && bounds.height > 0, 'Direct calculator link must remain visible');
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1, 'Direct link must fit the viewport');
    });

    await page.close();
  }

  const toolPage = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  await toolPage.goto('http://127.0.0.1:4173/deck-joist-blocking-calculator/', { waitUntil: 'domcontentloaded' });
  await toolPage.locator('#blockForm').waitFor();

  await check('individual calculator remains the primary self-canonical landing page', async () => {
    assert.match(await toolPage.title(), /Deck Joist Blocking Calculator/i);
    assert.equal(
      await toolPage.locator('link[rel="canonical"]').getAttribute('href'),
      'https://zemtools.com/deck-joist-blocking-calculator/'
    );
    assert.equal(await toolPage.locator('h1').first().innerText(), 'Deck Joist Blocking Calculator');
  });

  await toolPage.close();
} finally {
  await browser.close();
}

console.log('Home & Construction search-intent routing checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exitCode = 1;
