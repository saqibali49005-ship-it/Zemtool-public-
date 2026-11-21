import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

try {
  await page.goto('http://127.0.0.1:4173/pilot-hole-calculator/', { waitUntil: 'domcontentloaded' });
  await page.locator('#screw').selectOption('8');
  await page.locator('#material').selectOption('soft');
  await page.locator('#hole').selectOption('pilot');
  await page.locator('#preference').selectOption('calculated');
  await page.locator('#calculate').click();

  assert.match(await page.locator('#result').innerText(), /Recommended pilot hole/);
  assert.match(await page.locator('#result .big').innerText(), /2\.8 mm/);

  await page.locator('#major').fill('4.2');
  await page.locator('#root').fill('5.0');
  await page.locator('#measure').click();
  assert.match(await page.locator('#measureResult').innerText(), /Root diameter should be smaller/);

  await page.locator('#root').fill('2.8');
  await page.locator('#measure').click();
  assert.match(await page.locator('#measureResult').innerText(), /2\.8 mm/);

  await page.locator('#reset').click();
  assert.equal(await page.locator('#screw').inputValue(), '8');
  assert.equal(await page.locator('#material').inputValue(), 'hard');

  console.log('Pilot Hole Calculator browser regression checks passed');
} finally {
  await browser.close();
}
