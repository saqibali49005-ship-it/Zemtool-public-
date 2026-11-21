import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

try {
  await page.goto('http://127.0.0.1:4173/find-replace/', { waitUntil: 'domcontentloaded' });
  await page.locator('#findText').fill('cat');
  await page.locator('#replaceText').fill('fox');
  await page.locator('#inputText').fill('cat dog cat');

  assert.match(await page.locator('#matchCount').innerText(), /2 matches/);
  await page.locator('#replaceAllBtn').click();
  assert.equal(await page.locator('#inputText').inputValue(), 'fox dog fox');

  await page.locator('#findText').fill('cat');
  await page.locator('#inputText').fill('cat concatenate cat.');
  await page.locator('#wholeWord').check();
  await page.locator('#replaceAllBtn').click();
  assert.equal(await page.locator('#inputText').inputValue(), 'fox concatenate fox.');

  await page.locator('#clearBtn').click();
  assert.equal(await page.locator('#inputText').inputValue(), '');
  assert.equal(await page.locator('#findText').inputValue(), '');
  assert.equal(await page.locator('#replaceText').inputValue(), '');

  console.log('Find & Replace browser regression checks passed');
} finally {
  await browser.close();
}
