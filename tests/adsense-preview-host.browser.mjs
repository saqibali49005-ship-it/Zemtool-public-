import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const routes = ['/', '/calculator/', '/business-hours-calculator/'];
const browser = await chromium.launch({ headless: true });
try {
  for (const route of routes) {
    const page = await browser.newPage();
    const adRequests = [];
    page.on('request', request => {
      if (request.url().includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')) {
        adRequests.push(request.url());
      }
    });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    assert.equal(adRequests.length, 0,
      'Preview/local host must not request the production AdSense library: ' + route);
    assert.equal(await page.evaluate(() => typeof window.adsbygoogle), 'undefined',
      'Preview/local host must not initialize AdSense: ' + route);
    console.log('PASS AdSense preview-host isolation: ' + route);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('AdSense preview-host isolation tests passed.');
