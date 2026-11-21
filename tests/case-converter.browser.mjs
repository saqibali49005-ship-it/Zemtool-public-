import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

try {
  await page.goto('http://127.0.0.1:4173/case-converter/', { waitUntil: 'domcontentloaded' });
  await page.locator('#inputText').fill('hello WORLD\nSecond line');

  await page.locator('.case-btn[data-case="title"]').click();
  assert.equal(await page.locator('#outputText').inputValue(), 'Hello World\nSecond Line');

  await page.locator('.case-btn[data-case="snake"]').click();
  assert.equal(await page.locator('#outputText').inputValue(), 'hello_world\nsecond_line');

  assert.equal(await page.locator('#copyBtn').isDisabled(), false);
  await page.locator('#clearBtn').click();
  assert.equal(await page.locator('#inputText').inputValue(), '');
  assert.equal(await page.locator('#outputText').inputValue(), '');
  assert.equal(await page.locator('#copyBtn').isDisabled(), true);

  console.log('Case Converter browser regression checks passed');
} finally {
  await browser.close();
}
