import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

try {
  await page.goto('http://127.0.0.1:4173/text-cleaner/', { waitUntil: 'domcontentloaded' });
  await page.locator('#inputText').fill('  Alpha   \r\n\r\nBeta\t  Gamma \nAlpha   ');
  await page.locator('#cleanBtn').click();
  assert.equal(await page.locator('#outputText').inputValue(), 'Alpha\nBeta Gamma\nAlpha');

  await page.locator('#duplicateLines').check();
  assert.equal(await page.locator('#outputText').inputValue(), 'Alpha\nBeta Gamma');

  await page.locator('#clearBtn').click();
  assert.equal(await page.locator('#outputText').inputValue(), '');
  assert.equal(await page.locator('#copyBtn').isDisabled(), true);

  console.log('Text Cleaner browser regression checks passed');
} finally {
  await browser.close();
}
