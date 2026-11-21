import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

try {
  await page.goto(baseUrl + '/duplicate-line-remover/', { waitUntil: 'domcontentloaded' });
  await page.locator('#inputText').fill('Apple\napple\nBanana\nApple');
  await page.locator('#ignoreCase').check();
  await page.locator('#dedupeBtn').click();

  assert.equal(await page.locator('#outputText').inputValue(), 'Apple\nBanana');
  assert.match(await page.locator('#removedStats').innerText(), /2 duplicates/);
  assert.equal(await page.locator('#outputLabel').innerText(), 'Unique result');

  await page.locator('.mode button[data-mode="last"]').click();
  assert.equal(await page.locator('#outputText').inputValue(), 'Banana\nApple');

  await page.locator('[data-result-mode="duplicates"]').click();
  assert.equal(await page.locator('#occurrenceControl').isHidden(), true);
  assert.equal(await page.locator('#outputLabel').innerText(), 'Repeated lines');
  assert.equal(await page.locator('#outputText').inputValue(), 'Apple\napple\nApple');
  assert.match(await page.locator('#removedStats').innerText(), /1 groups/);
  assert.match(await page.locator('#status').innerText(), /3 lines across 1 repeated group/);

  await page.locator('[data-result-mode="unique"]').click();
  assert.equal(await page.locator('#outputLabel').innerText(), 'Only unique lines');
  assert.equal(await page.locator('#outputText').inputValue(), 'Banana');
  assert.match(await page.locator('#removedStats').innerText(), /3 lines/);

  await page.locator('[data-result-mode="remove"]').click();
  assert.equal(await page.locator('#occurrenceControl').isHidden(), false);
  await page.locator('#clearBtn').click();
  assert.equal(await page.locator('#outputText').inputValue(), '');
  assert.equal(await page.locator('#copyBtn').isDisabled(), true);

  await page.locator('#inputText').fill('A\nB\nC');
  await page.locator('[data-result-mode="duplicates"]').click();
  assert.equal(await page.locator('#outputText').inputValue(), '');
  assert.match(await page.locator('#status').innerText(), /No repeated lines were found/);

  await page.locator('[data-result-mode="unique"]').click();
  assert.equal(await page.locator('#outputText').inputValue(), 'A\nB\nC');
  assert.match(await page.locator('#status').innerText(), /Every eligible line appears once/);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(baseUrl + '/duplicate-line-remover/', { waitUntil: 'domcontentloaded' });
  const mobileMetrics = await page.evaluate(() => {
    const selector = document.querySelector('.result-modes');
    const selectorRect = selector.getBoundingClientRect();
    const buttons = [...selector.querySelectorAll('button')].map(button => {
      const rect = button.getBoundingClientRect();
      return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
    });
    return {
      viewportWidth: document.documentElement.clientWidth,
      selector: {
        left: Math.round(selectorRect.left),
        right: Math.round(selectorRect.right),
        width: Math.round(selectorRect.width),
        scrollWidth: selector.scrollWidth,
        clientWidth: selector.clientWidth
      },
      resultModeButtons: buttons
    };
  });
  console.log('Mobile result-mode selector metrics:', JSON.stringify(mobileMetrics));
  assert.equal(mobileMetrics.resultModeButtons.length, 3);
  assert.ok(
    mobileMetrics.selector.left >= -1 &&
    mobileMetrics.selector.right <= mobileMetrics.viewportWidth + 1 &&
    mobileMetrics.selector.scrollWidth <= mobileMetrics.selector.clientWidth + 1 &&
    mobileMetrics.resultModeButtons.every(button => button.left >= -1 && button.right <= mobileMetrics.viewportWidth + 1),
    'New result-mode selector should fit within the mobile viewport: ' + JSON.stringify(mobileMetrics)
  );

  console.log('Duplicate Line Remover browser regression checks passed');
} finally {
  await browser.close();
}
