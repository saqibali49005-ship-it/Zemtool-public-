import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

try {
  await page.goto('http://127.0.0.1:4173/remove-line-breaks/', { waitUntil: 'domcontentloaded' });
  await page.locator('#inputText').fill('Alpha\nBeta\n\nGamma');
  await page.locator('#mode').selectOption('paragraphs');
  await page.locator('#runBtn').click();
  assert.equal(await page.locator('#outputText').inputValue(), 'Alpha Beta\n\nGamma');

  await page.locator('#inputText').fill('Alpha\nBeta\nGamma');
  await page.locator('#mode').selectOption('all');
  await page.locator('#replacement').selectOption(', ');
  assert.equal(await page.locator('#outputText').inputValue(), 'Alpha, Beta, Gamma');

  await page.locator('#clearBtn').click();
  assert.equal(await page.locator('#outputText').inputValue(), '');
  assert.equal(await page.locator('#copyBtn').isDisabled(), true);

  console.log('Remove Line Breaks browser regression checks passed');
} finally {
  await browser.close();
}
