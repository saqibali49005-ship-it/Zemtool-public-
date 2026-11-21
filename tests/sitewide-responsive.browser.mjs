import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const routes = [
  '/', '/tools/', '/math-science/', '/digital-developer/', '/home-construction/', '/energy-electrical/',
  '/about/', '/contact/', '/privacy/', '/terms/',
  '/aspect-ratio-calculator/', '/business-hours-calculator/', '/calculator/', '/case-converter/',
  '/conduit-fill-calculator/', '/deck-joist-blocking-calculator/', '/duplicate-line-remover/',
  '/fence-calculator/', '/find-replace/', '/gravel-calculator/', '/paint-calculator/',
  '/paver-edge-restraint-calculator/', '/pilot-hole-calculator/', '/remove-line-breaks/',
  '/sod-staple-calculator/', '/sod-staple-spacing-guide/', '/text-cleaner/', '/time-calculator/',
  '/tea-outturn-calculator/', '/uuid-generator-calculator/', '/wire-size-calculator/', '/word-counter/', '/404.html'
];
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1365, height: 900 }
];
const failures = [];
let passed = 0;

for (const route of routes) {
  for (const viewport of viewports) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await page.goto('http://127.0.0.1:4173' + route, { waitUntil: 'domcontentloaded' });
      assert.ok(response && response.status() === 200, `HTTP status: ${response?.status()}`);
      await page.waitForFunction(() => {
        const header = document.querySelector('.site-header');
        return Boolean(header && header.dataset.zemUnified === '1' &&
          header.querySelector('#toolHeaderSearch') && header.querySelector('#toolHeaderMenu'));
      }, null, { timeout: 5000 });

      const state = await page.evaluate(() => {
        const header = document.querySelector('.site-header');
        const brand = header?.querySelector('.brand[href="/"]');
        const homeNav = header?.querySelector('.top-nav a[href="/"]');
        const search = header?.querySelectorAll('#toolHeaderSearch');
        const menu = header?.querySelectorAll('#toolHeaderMenu');
        const categoryToggle = header?.querySelector('#zemCategoriesToggle');
        return {
          header: Boolean(header),
          brandHome: Boolean(brand),
          brandVisible: Boolean(brand && getComputedStyle(brand).display !== 'none' && brand.getBoundingClientRect().width > 0),
          desktopHomeLink: Boolean(homeNav),
          sticky: header ? getComputedStyle(header).position : '',
          searchCount: search?.length || 0,
          menuCount: menu?.length || 0,
          searchVisible: Boolean(search?.[0] && getComputedStyle(search[0]).display !== 'none' && search[0].getBoundingClientRect().width > 0),
          menuVisible: Boolean(menu?.[0] && getComputedStyle(menu[0]).display !== 'none' && menu[0].getBoundingClientRect().width > 0),
          categoryToggleVisible: Boolean(categoryToggle && getComputedStyle(categoryToggle).display !== 'none' && categoryToggle.getBoundingClientRect().width > 0),
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth
        };
      });

      assert.ok(state.header, 'missing shared site header');
      assert.ok(state.brandHome && state.brandVisible, 'header logo is not a visible Home link');
      assert.ok(state.desktopHomeLink, 'primary navigation has no Home link');
      assert.equal(state.sticky, 'sticky', 'header is not sticky');
      assert.equal(state.searchCount, 1, 'expected exactly one site search button');
      assert.equal(state.menuCount, 1, 'expected exactly one mobile menu button');
      assert.ok(state.searchVisible, 'site search button is not visible');
      assert.equal(state.menuVisible, viewport.width <= 820, 'mobile menu visibility does not match the responsive breakpoint');
      assert.equal(state.categoryToggleVisible, viewport.width > 820, 'desktop category toggle visibility does not match the responsive breakpoint');
      assert.ok(state.scroll <= state.client + 1, `horizontal overflow: ${state.scroll}px > ${state.client}px`);

      if (viewport.width <= 820) {
        const menuButton = page.locator('#toolHeaderMenu');
        const menuPanel = page.locator('#toolHeaderMenuPanel');
        await menuButton.click();
        await menuPanel.waitFor({ state: 'visible' });
        assert.ok(await menuPanel.locator('a[href="/"]').count(), 'opened mobile menu has no Home link');
        await menuButton.click();
        await menuPanel.waitFor({ state: 'hidden' });
      } else {
        const categoryToggle = page.locator('#zemCategoriesToggle');
        const categoryPanel = page.locator('#zemCategoriesPanel');
        await categoryToggle.click();
        await page.waitForFunction(() => document.querySelector('#zemCategoriesPanel')?.classList.contains('is-open'));
        assert.ok(await categoryPanel.locator('a[href="/tools/"]').count(), 'opened category panel has no All Tools link');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#zemCategoriesPanel')?.classList.contains('is-open'));
      }

      const searchButton = page.locator('#toolHeaderSearch');
      const searchPanel = page.locator('#toolHeaderSearchPanel');
      await searchButton.click();
      await searchPanel.waitFor({ state: 'visible' });
      const searchInputFocused = await page.evaluate(() => document.activeElement?.id === 'toolHeaderSearchInput');
      assert.ok(searchInputFocused, 'search button did not focus the shared search input');
      await searchButton.click();
      await searchPanel.waitFor({ state: 'hidden' });

      passed++;
      console.log('PASS', route, viewport.name);
    } catch (error) {
      failures.push({ route, viewport: viewport.name, error: error.message });
      console.error('FAIL', route, viewport.name, error.message);
    }
  }
}
await browser.close();
console.log(`Sitewide navigation regression checks: ${passed}/${routes.length * viewports.length} passed; ${failures.length} failed`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
