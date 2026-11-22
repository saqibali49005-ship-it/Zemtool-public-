import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--host-resolver-rules=MAP zemtools.com 127.0.0.1'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const base = 'http://zemtools.com:4173';
const localTrackingScript = await readFile(new URL('../master-ui.js', import.meta.url), 'utf8');
const infoPageFixtures = await Promise.all([
  { route: '/about/', file: '../about/index.html' },
  { route: '/privacy/', file: '../privacy/index.html' },
  { route: '/contact/', file: '../contact/index.html' },
  { route: '/terms/', file: '../terms/index.html' }
].map(async item => ({ ...item, html: await readFile(new URL(item.file, import.meta.url), 'utf8') })));
await page.route('http://zemtools.com:4173/master-ui.js*', route => route.fulfill({
  status: 200,
  contentType: 'application/javascript; charset=utf-8',
  body: localTrackingScript
}));
await page.route('https://www.googletagmanager.com/gtag/js*', route => route.abort());

async function fresh(route) {
  await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.gtag === 'function');
}

async function recordedEvents() {
  return page.evaluate(() => (window.dataLayer || [])
    .map(args => Array.from(args))
    .filter(args => args[0] === 'event'));
}

async function assertEvent(expectedName, expectedAction, expectedPath) {
  const events = await recordedEvents();
  const matches = events.filter(args => args[1] === expectedName);
  assert.equal(matches.length, 1, 'expected exactly one ' + expectedName + ' event');
  const params = matches[0][2] || {};
  assert.equal(params.action_type, expectedAction);
  assert.equal(params.tool_path, expectedPath);
  assert.ok(params.tool_name, 'tool_name should be populated');
  assert.ok(params.button_label, 'button_label should be populated');
}
async function submitSearchWithoutNavigation(formSelector,inputSelector,value){
  await page.locator(inputSelector).fill(value);
  await page.evaluate(() => {
    document.addEventListener('submit', event => event.stopPropagation(), { capture: true, once: true });
  });
  await page.locator(formSelector).evaluate(form => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}
async function searchEvents(name){
  const events=await recordedEvents();
  return events.filter(args=>args[1]===name).map(args=>args[2]||{});
}

try {
  await fresh('/paint-calculator/');
  await page.locator('#calculate').click();
  await assertEvent('tool_calculate', 'calculate', '/paint-calculator/');

  await fresh('/business-hours-calculator/');
  await page.locator('#deadlineTab').click();
  await page.locator('#calculateDeadline').click();
  await assertEvent('tool_calculate', 'calculate', '/business-hours-calculator/');

  await fresh('/aspect-ratio-calculator/');
  const faqQuestion = page.locator('.faq button').filter({ hasText: /calculate/i }).first();
  assert.equal(await faqQuestion.count(), 1, 'expected an FAQ question containing the word calculate');
  await faqQuestion.click();
  assert.equal((await recordedEvents()).length, 0, 'FAQ clicks must not be recorded as calculator use');
  await page.locator('#findRatio').click();
  await assertEvent('tool_calculate', 'calculate', '/aspect-ratio-calculator/');

  await fresh('/uuid-generator-calculator/');
  await page.locator('#generate').click();
  await assertEvent('tool_generate', 'generate', '/uuid-generator-calculator/');

  await page.route('https://preview-test.zemtools-review.pages.dev/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html><body><a id="internal" href="https://zemtools.com/tools/">All Tools</a></body></html>'
  }));
  await page.goto('https://preview-test.zemtools-review.pages.dev/');
  await page.addScriptTag({ content: localTrackingScript });
  assert.equal(
    await page.locator('#internal').getAttribute('href'),
    'https://preview-test.zemtools-review.pages.dev/tools/',
    'preview internal links must stay on the preview host'
  );
  await page.locator('#internal').click();
  await page.waitForURL('https://preview-test.zemtools-review.pages.dev/tools/');
  assert.equal(new URL(page.url()).hostname, 'preview-test.zemtools-review.pages.dev');


  await fresh('/');
  await submitSearchWithoutNavigation('#home-search','#tool-search','mulch');
  let searches=await searchEvents('search');
  assert.equal(searches.length,1,'homepage search should send one GA4 search event');
  assert.equal(searches[0].search_term,'mulch');
  assert.equal(searches[0].search_surface,'homepage');
  assert.equal((await searchEvents('search_no_results')).length,0);

  await fresh('/');
  await page.locator('#toolHeaderSearch').click();
  await submitSearchWithoutNavigation('#toolHeaderSearchForm','#toolHeaderSearchInput','mulch');
  searches=await searchEvents('search');
  assert.equal(searches.length,1,'header search should send one GA4 search event');
  assert.equal(searches[0].search_term,'mulch');
  assert.equal(searches[0].search_surface,'header');

  await fresh('/tools/');
  await submitSearchWithoutNavigation('#dir-search','#dir-input','zemtools-query-with-no-matching-results-xyz');
  searches=await searchEvents('search');
  const noResults=await searchEvents('search_no_results');
  assert.equal(searches.length,1,'directory search should send one GA4 search event');
  assert.equal(searches[0].search_surface,'directory');
  assert.equal(noResults.length,1,'zero directory matches should send search_no_results');

  await fresh('/');
  await submitSearchWithoutNavigation('#home-search','#tool-search','private.user@example.com');
  searches=await searchEvents('search');
  const privateNoResults=await searchEvents('search_no_results');
  assert.equal(searches.length,1,'privacy-filtered search should still count the search action');
  assert.equal(Object.hasOwn(searches[0],'search_term'),false,'email-like search text must not be sent to GA4');
  assert.equal(Object.hasOwn(privateNoResults[0]||{},'search_term'),false,'email-like search text must not be sent in no-results analytics');
  assert.ok(!JSON.stringify(await recordedEvents()).includes('private.user@example.com'),'raw email must never enter analytics events');

  await fresh('/paint-calculator/');
  await page.evaluate(() => {
    const form=document.createElement('form');
    form.id='analytics-validation-test';
    form.innerHTML='<label for="analytics-required-test">Required test field</label><input id="analytics-required-test" required><button id="analytics-calculate-submit" type="submit">Calculate</button>';
    document.querySelector('main').append(form);
  });
  await page.locator('#analytics-validation-test button').click();
  const validationEvents=await searchEvents('tool_validation_error');
  assert.equal(validationEvents.length,1,'native calculator validation should be recorded once');
  assert.equal(validationEvents[0].tool_path,'/paint-calculator/');
  assert.equal(validationEvents[0].validation_source,'native_constraint');


  // The four informational pages must use the shared production-host-only analytics loader.
  for (const infoPage of infoPageFixtures) {
    await fresh(infoPage.route);
    const productionAnalytics = await page.evaluate(() => ({
      gtagType: typeof window.gtag,
      configCount: (window.dataLayer || []).map(args => Array.from(args))
        .filter(args => args[0] === 'config' && args[1] === 'G-LX61P24FYK').length
    }));
    assert.equal(productionAnalytics.gtagType, 'function', infoPage.route + ' should initialize GA4 on production');
    assert.equal(productionAnalytics.configCount, 1, infoPage.route + ' should configure GA4 exactly once');
  }

  // Simulate the same informational pages on a *.pages.dev host.
  const analyticsPreviewHost = 'https://analytics-host-guard-test.zemtools-review.pages.dev';
  const previewPages = new Map(infoPageFixtures.map(item => [item.route, item.html]));
  let previewGoogleTagRequests = 0;
  page.on('request', request => {
    if (!request.url().includes('googletagmanager.com/gtag/js')) return;
    // Count only requests initiated by the simulated preview document. A deferred
    // production-host GA request from earlier fixtures must not fail this guard.
    try {
      const initiatorHost = new URL(request.frame().url()).hostname.toLowerCase();
      if (initiatorHost === new URL(analyticsPreviewHost).hostname) previewGoogleTagRequests += 1;
    } catch (_) {
      // Requests without a page frame are not initiated by this preview document.
    }
  });
  await page.route(analyticsPreviewHost + '/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/master-ui.js') {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: localTrackingScript
      });
    }
    if (url.pathname === '/tools-data.js') {
      return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: 'window.UTILITY_TOOLS = [];'});
    }
    const html = previewPages.get(url.pathname.endsWith('/') ? url.pathname : url.pathname + '/');
    if (html) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    return route.fulfill({ status: 404, body: 'Not found' });
  });
  const previewRequestCountBefore = previewGoogleTagRequests;
  for (const infoPage of infoPageFixtures) {
    await page.goto(analyticsPreviewHost + infoPage.route, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => performance.getEntriesByType('resource')
      .some(resource => new URL(resource.name).pathname === '/master-ui.js'));
    const previewAnalytics = await page.evaluate(() => ({
      gtagType: typeof window.gtag,
      loaderFlag: window.__zemtoolsGa4Loaded
    }));
    assert.equal(previewAnalytics.gtagType, 'undefined', infoPage.route + ' must not initialize GA4 on a preview host');
    assert.equal(previewAnalytics.loaderFlag, undefined, infoPage.route + ' must not set the production GA loader flag on a preview host');
  }
  assert.equal(
    previewGoogleTagRequests,
    previewRequestCountBefore,
    'informational pages on *.pages.dev must never request the Google tag library'
  );

  console.log('GA4 tool tracking checks: 4 original tool scenarios plus search/privacy/validation passed; preview navigation host check passed.');
} finally {
  await browser.close();
}
