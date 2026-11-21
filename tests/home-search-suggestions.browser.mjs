import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');

async function inspectViewport(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });

  try {
    await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded' });
    const input = page.locator('#tool-search');
    const suggestions = page.locator('#search-suggestions');

    await input.fill('Cal');
    await page.waitForFunction(() => {
      const panel = document.querySelector('#search-suggestions');
      return panel && !panel.hidden && panel.querySelectorAll('.search-suggestion').length > 0;
    });

    const metrics = await page.evaluate(() => {
      const hero = document.querySelector('.home-hero');
      const search = document.querySelector('.home-search');
      const field = document.querySelector('.home-search .search-field');
      const panel = document.querySelector('#search-suggestions');
      const firstRow = panel.querySelector('.search-suggestion');
      const heroRect = hero.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      return {
        heroOverflow: getComputedStyle(hero).overflow,
        panelPosition: getComputedStyle(panel).position,
        panelParentIsSearchField: panel.parentElement === field,
        panelTop: panelRect.top,
        panelBottom: panelRect.bottom,
        panelHeight: panelRect.height,
        panelMaxHeight: parseFloat(getComputedStyle(panel).maxHeight),
        panelOverflowY: getComputedStyle(panel).overflowY,
        fieldBottom: fieldRect.bottom,
        heroBottom: heroRect.bottom,
        rowCount: panel.querySelectorAll('.search-suggestion').length,
        rowSeparator: getComputedStyle(firstRow).borderBottomStyle,
        searchZIndex: getComputedStyle(search).zIndex
      };
    });

    assert.equal(metrics.panelParentIsSearchField, true, 'Suggestions should be anchored to the search field');
    assert.equal(metrics.heroOverflow, 'visible', 'Hero must not clip the suggestion dropdown');
    assert.equal(metrics.panelPosition, 'absolute', 'Suggestions should remain an overlay');
    assert.equal(metrics.panelOverflowY, 'auto', 'Long suggestion lists should be scrollable');
    assert.ok(metrics.searchZIndex !== 'auto', 'Search form should layer above following homepage sections');
    assert.ok(metrics.panelTop >= metrics.fieldBottom + 5 && metrics.panelTop <= metrics.fieldBottom + 12,
      'Suggestion panel should start directly below the search field: ' + JSON.stringify(metrics));
    assert.ok(metrics.panelHeight > 0 && metrics.panelHeight <= metrics.panelMaxHeight + 1,
      'Suggestion panel should stay within its responsive max height: ' + JSON.stringify(metrics));
    assert.ok(metrics.panelBottom > metrics.heroBottom,
      'Suggestion panel should extend beyond the hero instead of being clipped by it: ' + JSON.stringify(metrics));
    assert.ok(metrics.rowCount > 0, 'Typing a matching query should show suggestions');
    assert.equal(metrics.rowSeparator, 'solid', 'Suggestion rows should have a visible separator');

    console.log(`Homepage search suggestions layout passed at ${width}x${height}:`, JSON.stringify(metrics));

    if (width >= 768) {
      const firstSuggestion = suggestions.locator('.search-suggestion').first();
      const href = await firstSuggestion.getAttribute('data-href');
      assert.ok(href, 'First suggestion should retain its destination');
      const targetPath = new URL(href, baseUrl + '/').pathname;
      await Promise.all([
        page.waitForURL(url => new URL(url).pathname === targetPath),
        firstSuggestion.click()
      ]);
      assert.equal(new URL(page.url()).pathname, targetPath,
        'Selecting a suggestion should navigate to its original tool destination');
    }
  } finally {
    await page.close();
  }
}

try {
  await inspectViewport(1365, 900);
  await inspectViewport(375, 812);
  console.log('Homepage search suggestions browser regression checks passed');
} finally {
  await browser.close();
}
