import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');

async function check(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 600, isMobile: width < 600 });
  try {
    await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => {
      const selectors = ['.site-header a', '.site-header button', '.site-header input', 'main a', 'main button'];
      const values = {};
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) values[selector] = getComputedStyle(element).webkitTapHighlightColor;
      }
      const headerLink = document.querySelector('.site-header a');
      const focusRule = headerLink ? getComputedStyle(headerLink, ':focus-visible').outlineStyle : null;
      return { values, focusRule };
    });
    for (const [selector, value] of Object.entries(result.values)) {
      assert.match(value, /rgba\(0, 0, 0, 0\)|transparent/i, `Tap highlight should be transparent for ${selector}, got ${value}`);
    }
    assert.notEqual(result.focusRule, 'none', 'Keyboard focus outline should remain available');
    console.log(`Tap-highlight check passed at ${width}x${height}`, JSON.stringify(result));
  } finally {
    await page.close();
  }
}

try {
  await check(390, 844);
  await check(1365, 900);
  console.log('Mobile tap-highlight browser regression checks passed');
} finally {
  await browser.close();
}
