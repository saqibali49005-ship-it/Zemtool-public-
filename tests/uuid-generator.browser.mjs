import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

try {
  await page.goto('http://127.0.0.1:4173/uuid-generator-calculator/', { waitUntil: 'domcontentloaded' });
  await page.locator('#count').fill('3');
  await page.locator('#format').selectOption('standard');
  await page.locator('#versionSeg button[data-version="4"]').click();
  await page.locator('#generate').click();

  let values = await page.locator('#genOutput .item .mono').allTextContents();
  assert.equal(values.length, 3);
  for (const value of values) assert.match(value, uuidV4);

  await page.locator('#versionSeg button[data-version="7"]').click();
  await page.locator('#generate').click();
  values = await page.locator('#genOutput .item .mono').allTextContents();
  assert.equal(values.length, 3);
  for (const value of values) assert.match(value, uuidV7);

  await page.locator('#inspectInput').fill('not-a-uuid');
  await page.locator('#inspectBtn').click();
  assert.match(await page.locator('#inspectOutput').innerText(), /Enter a valid UUID/);

  console.log('UUID Generator browser regression checks passed');
} finally {
  await browser.close();
}
