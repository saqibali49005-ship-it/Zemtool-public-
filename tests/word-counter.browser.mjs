import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

try {
  await page.goto('http://127.0.0.1:4173/word-counter/', { waitUntil: 'domcontentloaded' });
  await page.locator('#inputText').fill('Hello world.\nSecond line.');

  assert.equal(await page.locator('#words').innerText(), '4');
  assert.equal(await page.locator('#chars').innerText(), '25');
  assert.equal(await page.locator('#noSpaces').innerText(), '23');
  assert.equal(await page.locator('#sentences').innerText(), '2');
  assert.equal(await page.locator('#paragraphs').innerText(), '1');
  assert.equal(await page.locator('#lines').innerText(), '2');

  await page.locator('#limitInput').fill('20');
  assert.match(await page.locator('#limitStatus').innerText(), /Over limit by 5 characters/);

  await page.locator('#clearBtn').click();
  assert.equal(await page.locator('#words').innerText(), '0');
  assert.equal(await page.locator('#limitStatus').innerText(), 'No limit selected');

  console.log('Word Counter browser regression checks passed');
} finally {
  await browser.close();
}
