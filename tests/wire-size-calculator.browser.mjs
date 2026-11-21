import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
let page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(20000);
const failures = [];
let passed = 0;
let baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
while (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

async function resetTestPage() {
  const previousPage = page;
  let closeTimer;
  try {
    await Promise.race([
      previousPage.close({ runBeforeUnload: false }),
      new Promise(resolve => { closeTimer = setTimeout(resolve, 3000); })
    ]);
  } catch {}
  finally {
    if (closeTimer) clearTimeout(closeTimer);
  }

  page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  await page.goto(baseUrl + '/wire-size-calculator/', {
    waitUntil: 'domcontentloaded',
    timeout: 20000
  });
}

async function check(name, fn) {
  let timer;
  console.log('START', name);
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Test timed out after 30000 ms; browser state will be reset.')), 30000);
      })
    ]);
    passed++;
    console.log('PASS', name);
  } catch (error) {
    failures.push({ name, error: error.message });
    console.error('FAIL', name, error.message);
    if (/Test timed out after 30000 ms/.test(error.message)) {
      let recoveryTimer;
      try {
        await Promise.race([
          resetTestPage(),
          new Promise((_, reject) => {
            recoveryTimer = setTimeout(
              () => reject(new Error('Browser recovery exceeded 25000 ms.')),
              25000
            );
          })
        ]);
        console.log('RECOVERED browser page after timeout in: ' + name);
      } catch (recoveryError) {
        failures.push({ name: 'browser recovery after ' + name, error: recoveryError.message });
        console.error('FAIL browser recovery after ' + name, recoveryError.message);
      } finally {
        if (recoveryTimer) clearTimeout(recoveryTimer);
      }
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function value(id) { return page.locator('#' + id).innerText(); }
async function fill(id, val) { await page.locator('#' + id).fill(String(val)); }
async function setFixture(options) {
  await page.locator('#ampacityTable').fill('');
  await page.locator('#ampacitySource').fill('');
  if (await page.locator('#ampacityFinalConfirmed').isChecked()) await page.locator('#ampacityFinalConfirmed').uncheck();
  const o = Object.assign({
    task: 'find', standard: 'us', circuit: 'single', load: 'amps', targetUnit: 'percent',
    voltage: 120, amps: 20, watts: 1200, pf: 1, length: 100, unit: 'ft',
    material: 'cu', construction: 'stranded', temperature: 75, target: 3, parallelSets: 1, method: 'zemtools', manualInputMode: 'single', manualImpedanceUnits: 'per1000ft',
    ampacityTable: '', ampacitySource: '', ampacityMaterial: 'cu', ampacityFinalConfirmed: false
  }, options || {});
  await page.locator('[data-task="' + o.task + '"]').click();
  await page.locator('#useReactance').evaluate(el => {
    if (el.checked) { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.locator('#calculationMethod').selectOption(o.method);
  await page.locator('[data-circuit="' + o.circuit + '"]').click();
  await page.locator('[data-load="' + o.load + '"]').click();
  await page.locator('#sizeStandard').selectOption(o.standard);
  if (o.method === 'manual') {
    await page.locator('#manualInputMode').selectOption(o.manualInputMode);
    await page.locator('#manualImpedanceUnits').selectOption(o.manualImpedanceUnits);
    if (o.manualInputMode === 'table') await fill('manualTable', o.manualTable || '');
    else await page.locator('#manualTable').evaluate(el => { el.value = ''; });
  }
  await page.locator('#targetUnit').selectOption(o.targetUnit);
  await fill('parallelSets', o.parallelSets);
  await fill('voltage', o.voltage);
  if (o.load === 'amps') await fill('amps', o.amps);
  else await fill('watts', o.watts);
  if (o.circuit !== 'dc' && await page.locator('#pfField').isVisible()) await fill('pf', o.pf);
  if (o.task !== 'distance') {
    await fill('length', o.length);
    await page.locator('#lengthUnit').selectOption(o.unit);
  }
  if (await page.locator('#material').isEnabled()) await page.locator('#material').selectOption(o.material);
  if (await page.locator('#construction').isEnabled()) await page.locator('#construction').selectOption(o.construction);
  if (await page.locator('#temperature').isEnabled()) await fill('temperature', o.temperature);
  await page.locator('#ampacityMaterial').selectOption(o.ampacityMaterial);
  await fill('ampacitySource', o.ampacitySource);
  if (o.ampacityFinalConfirmed) await page.locator('#ampacityFinalConfirmed').check();
  await fill('ampacityTable', o.ampacityTable);
  await fill('target', o.target);
  await page.locator('#calculateBtn').click();
}

try {
  await page.goto(baseUrl + '/wire-size-calculator/', { waitUntil: 'domcontentloaded' });

  await check('Non-canonical preview hosts do not load the production AdSense script', async () => {
    const hostname = new URL(page.url()).hostname.toLowerCase();
    if (hostname !== 'zemtools.com' && hostname !== 'www.zemtools.com') {
      const adScript = page.locator('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
      assert.equal(await adScript.count(), 0, 'staging and local previews must not load the production AdSense tag');
    }
  });

  await check('Wire gauge metadata and query-specific FAQs stay accurate about DC and motor scope', async () => {
    assert.equal(await page.title(), 'Wire Size & Wire Gauge Calculator | Voltage Drop');
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    const socialTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const socialDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
    const twitterTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content');
    const twitterDescription = await page.locator('meta[name="twitter:description"]').getAttribute('content');
    assert.match(description, /wire size or wire gauge/i);
    assert.ok(description.length <= 160, 'meta description should remain a concise search snippet');
    assert.equal(socialTitle, await page.title(), 'Open Graph title must match the page title');
    assert.equal(socialDescription, description, 'Open Graph description must match the meta description');
    assert.equal(twitterTitle, await page.title(), 'Twitter title must match the page title');
    assert.equal(twitterDescription, description, 'Twitter description must match the meta description');
    const gaugeFaq = page.locator('.faq').filter({ hasText: 'Is wire size the same as wire gauge?' });
    assert.equal(await gaugeFaq.count(), 1, 'the page should explain wire-gauge terminology once');
    const gaugeAnswer = gaugeFaq.locator('.faq-answer');
    await gaugeFaq.locator('button').click();
    await gaugeAnswer.waitFor({ state: 'visible' });
    const explanation = await gaugeAnswer.innerText();
    assert.match(explanation, /lower AWG number means a larger conductor/i);
    assert.match(explanation, /cross-sectional area in mm²/i);
    assert.match(explanation, /separate size series/i);

    const dcFaq = page.locator('.faq').filter({ hasText: 'Can I use this as a 12V, 24V or 48V wire gauge calculator?' });
    assert.equal(await dcFaq.count(), 1, 'the page should answer low-voltage DC wire-gauge intent once');
    await dcFaq.locator('button').click();
    const dcAnswer = await dcFaq.locator('.faq-answer').innerText();
    assert.match(dcAnswer, /Select DC mode/i);
    assert.match(dcAnswer, /one-way cable length/i);
    assert.match(dcAnswer, /does not select fuses/i);

    const lowVoltageExample = page.locator('#low-voltage-example');
    assert.equal(await lowVoltageExample.count(), 1, 'the page should include one worked 12V DC example');
    const lowVoltageText = await lowVoltageExample.innerText();
    assert.match(lowVoltageText, /12 V DC, 15 A/i);
    assert.match(lowVoltageText, /20 ft one-way/i);
    assert.match(lowVoltageText, /6 AWG/i);
    assert.match(lowVoltageText, /2\.45% voltage drop/i);
    assert.match(lowVoltageText, /does not select a fuse/i);

    const compressorFaq = page.locator('.faq').filter({ hasText: 'Is this a dedicated air compressor wire size calculator?' });
    assert.equal(await compressorFaq.count(), 1, 'motor-specific intent must be answered with a clear scope limit');
    await compressorFaq.locator('button').click();
    const compressorAnswer = await compressorFaq.locator('.faq-answer').innerText();
    assert.match(compressorAnswer, /does not derive motor full-load current from horsepower/i);
    assert.match(compressorAnswer, /locked-rotor voltage dip/i);
    assert.match(compressorAnswer, /locally adopted electrical code/i);

    const references = page.locator('.source-notes');
    assert.equal(await references.count(), 1, 'calculation references should appear once');
    const referenceText = await references.innerText();
    assert.match(referenceText, /NIST Copper Wire Tables/i);
    assert.match(referenceText, /0.017241/);
    assert.match(referenceText, /0.00393/);
    assert.match(referenceText, /Paige.*11\.2.*17\.4/s);
    assert.match(referenceText, /Omni.*0\.0168.*0\.00404/s);
        const sourceLinks = await references.locator('a[href]').evaluateAll(links => links.map(link => link.href));
    assert.deepEqual(sourceLinks, [
      'https://nvlpubs.nist.gov/nistpubs/Legacy/circ/nbscircular31e4.pdf',
      'https://paigeconnected.com/calculators/wiresize-calculator',
      'https://www.omnicalculator.com/physics/wire-size'
    ]);
  });

  await check('Wire Size internal navigation and related links resolve to site-root paths', async () => {
    const unresolved = await page.locator('a[href]').evaluateAll(anchors => anchors
      .map(anchor => {
        const href = anchor.getAttribute('href') || '';
        const url = new URL(href, document.baseURI);
        return { href, pathname: url.pathname, origin: url.origin };
      })
      .filter(link => link.origin === location.origin && !link.href.startsWith('/') && !link.href.startsWith('#')));
    assert.deepEqual(unresolved, [], 'Wire Size page must not contain nested-path relative internal links');

    const sources = [
      { path: '/energy-electrical/', selector: 'article.card a.button[href="/wire-size-calculator/"]', expectedText: 'Open Wire Size Calculator' },
      { path: '/conduit-fill-calculator/', selector: 'a.related-item[href="/wire-size-calculator/"]', expectedText: 'Wire Size & Voltage Drop Calculator' },
      { path: '/tools/', heading: 'Wire Size & Voltage Drop Calculator', selector: 'article.dir-card a[href]', expectedText: 'Open Wire Size Calculator' }
    ];
    for (const source of sources) {
      const sourcePage = await browser.newPage({ viewport: { width: 1365, height: 900 } });
      try {
        await sourcePage.goto(baseUrl + source.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
        let target;
        if (source.heading) {
          const card = sourcePage.locator('article.dir-card').filter({ has: sourcePage.getByRole('heading', { name: source.heading, exact: true }) });
          assert.equal(await card.count(), 1, source.path + ': expected exactly one Wire Size directory card');
          assert.equal(await card.getAttribute('data-category'), null, 'the test must exercise the live registry-rendered card, not the static fallback');
          target = card.locator('a[href]');
        } else {
          target = sourcePage.locator(source.selector);
        }
        assert.equal(await target.count(), 1, source.path + ': expected exactly one canonical Wire Size link');
        const href = await target.evaluate(anchor => anchor.href);
        assert.equal(new URL(href).pathname, '/wire-size-calculator/',
          source.path + ': link must resolve to the canonical Wire Size URL');
        assert.ok((await target.innerText()).includes(source.expectedText),
          source.path + ': link text must clearly identify the Wire Size Calculator');
      } finally {
        await sourcePage.close().catch(() => {});
      }
    }
  });

  await check('Sitemap lists the canonical Wire Size URL with its verified significant-update date', async () => {
    const response = await page.request.get(baseUrl + '/sitemap.xml');
    assert.equal(response.status(), 200, 'sitemap must be accessible');
    const xml = await response.text();
    const entries = xml.split('<url>').slice(1)
      .map(entry => entry.split('</url>')[0])
      .filter(entry => entry.includes('<loc>https://zemtools.com/wire-size-calculator/</loc>'));
    assert.equal(entries.length, 1, 'canonical Wire Size URL must appear exactly once in sitemap');
    assert.ok(entries[0].includes('<lastmod>2026-11-21</lastmod>'),
      'Wire Size lastmod must match the significant page/link update date');
  });

  await check('Unified header CSS is in the document head before shared UI initialization and reserves stable geometry', async () => {
    const structure = await page.evaluate(() => {
      const headerCss = document.querySelector('head link[rel="stylesheet"][href*="master-header.css?v=20261115-tap-highlight-1"]');
      const toolsData = document.querySelector('script[src="/tools-data.js"]');
      const sharedUi = document.querySelector('script[src*="master-ui.js?v=20261114-shell-final"]');
      const pageEngine = document.querySelector('script[type="module"]');
      let parsedRules = 0;
      try { parsedRules = headerCss?.sheet?.cssRules?.length ?? 0; } catch (_) {}
      return {
        cssInHead: Boolean(headerCss && headerCss.parentElement === document.head),
        cssBeforeSharedUi: Boolean(headerCss && sharedUi &&
          (headerCss.compareDocumentPosition(sharedUi) & Node.DOCUMENT_POSITION_FOLLOWING)),
        toolsDataDeferred: Boolean(toolsData?.defer),
        sharedUiDeferred: Boolean(sharedUi?.defer),
        pageEngineIsModule: Boolean(pageEngine),
        pageEngineBeforeSharedUi: Boolean(pageEngine && sharedUi &&
          (pageEngine.compareDocumentPosition(sharedUi) & Node.DOCUMENT_POSITION_FOLLOWING)),
        pageEngineAvailable: typeof window.WireSizeCalculator?.calculateCandidate === 'function',
        toolsDataBeforeSharedUi: Boolean(toolsData && sharedUi &&
          (toolsData.compareDocumentPosition(sharedUi) & Node.DOCUMENT_POSITION_FOLLOWING)),
        toolsDataAvailable: Array.isArray(window.UTILITY_TOOLS) && window.UTILITY_TOOLS.length > 0,
        parsedRules,
        unified: document.querySelector('header.site-header')?.dataset.zemUnified === '1',
        desktopHeight: document.querySelector('header.site-header')?.getBoundingClientRect().height
      };
    });
    assert.ok(structure.cssInHead, 'shared header stylesheet should be linked from the document head');
    assert.ok(structure.cssBeforeSharedUi, 'header stylesheet link should precede master-ui.js in document order');
    assert.equal(structure.toolsDataDeferred, true, 'shared tool data should not block the HTML parser');
    assert.equal(structure.sharedUiDeferred, true, 'shared header UI should initialize after parsing');
    assert.equal(structure.pageEngineIsModule, true, 'calculator engine should use a deferred inline module instead of blocking the HTML parser');
    assert.equal(structure.pageEngineBeforeSharedUi, true, 'calculator module should precede shared header initialization in document order');
    assert.equal(structure.pageEngineAvailable, true, 'calculator engine should be available by DOMContentLoaded');
    assert.equal(structure.toolsDataBeforeSharedUi, true, 'deferred tool data must execute before shared UI initialization');
    assert.equal(structure.toolsDataAvailable, true, 'tool search data must be available when the shared UI initializes');
    assert.ok(structure.parsedRules > 0, 'shared header stylesheet should be parsed before the UI script initializes');
    assert.equal(structure.unified, true, 'shared header should finish initialization');
    assert.ok(structure.desktopHeight >= 70 && structure.desktopHeight < 100, 'desktop header should retain its reserved layout height');
    assert.equal(await page.locator('header.site-header .mobile-nav').evaluate(el => getComputedStyle(el).display), 'none');
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.locator('header.site-header').evaluate(el => ({
      height: el.getBoundingClientRect().height,
      mobileNav: getComputedStyle(el.querySelector('.mobile-nav')).display
    }));
    assert.ok(mobile.height >= 60 && mobile.height < 85, 'mobile header should retain its reserved layout height');
    assert.equal(mobile.mobileNav, 'none', 'mobile navigation should not occupy layout until opened');
    await page.setViewportSize({ width: 1365, height: 900 });
  });

  await check('Page loads with canonical URL and all three calculator tasks', async () => {
    assert.match(await page.title(), /Wire Size/i);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/wire-size-calculator/');
    await page.getByRole('heading', { name: 'Size Your Cable' }).waitFor();
    await page.locator('[data-task="find"]').waitFor();
    await page.locator('[data-task="check"]').waitFor();
    await page.locator('[data-task="distance"]').waitFor();
  });

  await check('Safety notices and result labels clearly identify voltage-drop planning limits', async () => {
    const topNotice = await page.locator('#safetyNotice').innerText();
    assert.match(topNotice, /planning estimate only/i);
    assert.match(topNotice, /does not determine a safe or code-compliant conductor size/i);
    assert.match(topNotice, /qualified electrical professional/i);
    const resultNotice = await page.locator('#resultSafetyNote').innerText();
    assert.match(resultNotice, /not an ampacity, installation, electrical-safety or code-compliance approval/i);
    assert.match(await page.locator('#resultTitle').innerText(), /Voltage-drop size estimate/i);
    assert.match(await page.locator('#calculateBtn').innerText(), /Calculate voltage-drop size/i);
  });

  await check('Calculation breakdown exposes substituted resistance, path factor and result for ZemTools and Omni profiles', async () => {
    await setFixture({ task: 'check', method: 'zemtools', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, temperature: 75, construction: 'stranded' });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    await page.locator('#calculationDetails summary').click();
    const zemtoolsDetails = await value('calculationBreakdown');
    assert.match(zemtoolsDetails, /Temperature-adjusted resistivity/);
    assert.match(zemtoolsDetails, /Path factor = 2/);
    assert.match(zemtoolsDetails, /One-way run used = 30\.48 m/);
    assert.match(zemtoolsDetails, /Signed voltage change ΔV = [0-9]+\.[0-9]{4} V/);
    assert.match(zemtoolsDetails, /Voltage-drop target = 3\.6 V/);
    assert.match(zemtoolsDetails, /Load-end voltage = source voltage − ΔV = 120 − \(3\.117\) = 116\.883 V/);
    assert.match(zemtoolsDetails, /does not calculate code ampacity/i);

    await setFixture({ method: 'omni', task: 'find', circuit: 'three', load: 'amps', voltage: 400, amps: 25, length: 40, unit: 'm', target: 3, material: 'cu', temperature: 50, construction: 'solid' });
    const omniDetails = await value('calculationBreakdown');
    assert.equal(await value('recommended'), '12 AWG');
    assert.match(omniDetails, /Omni published copper model/);
    assert.match(omniDetails, /Path factor = √3/);
    assert.match(omniDetails, /9\.86 V/);
  });

  await check('Calculator form fields expose accessible names and result feedback is announced', async () => {
    const fieldIds = [
      'sizeStandard', 'calculationMethod', 'selectedSize', 'voltage', 'amps', 'watts', 'pf', 'length',
      'lengthUnit', 'target', 'targetUnit', 'material', 'construction', 'temperature',
      'parallelSets', 'useReactance', 'frequency', 'pfDirection', 'singleSpacing', 'manualImpedanceUnits', 'manualTableFile',
      'spacingAB', 'spacingBC', 'spacingCA', 'manualInputMode', 'manualResistance',
      'manualReactance', 'manualFrequency', 'manualPfDirection', 'manualTable', 'ampacityTable', 'ampacityTableFile', 'ampacityMaterial', 'ampacitySource', 'ampacityFinalConfirmed'
    ];
    for (const id of fieldIds) {
      assert.equal(await page.locator('#' + id).count(), 1, id + ' should exist once');
      const control = page.locator('#' + id);
      const label = page.locator('label[for="' + id + '"]');
      const hasVisibleLabel = await label.count() === 1 && (await label.innerText()).trim().length > 0;
      const ariaLabel = await control.getAttribute('aria-label');
      const ariaLabelledBy = await control.getAttribute('aria-labelledby');
      const hasAriaName = Boolean((ariaLabel || '').trim() || (ariaLabelledBy || '').trim());
      assert.ok(hasVisibleLabel || hasAriaName, id + ' should have a programmatic accessible name');
    }
    for (const id of ['clearBtn', 'calculateBtn', 'copySummaryBtn', 'printResultBtn', 'downloadAmpacityTableTemplate']) {
      assert.ok((await page.locator('#' + id).innerText()).trim().length > 0, id + ' should have an accessible text name');
    }
    assert.equal(await page.locator('.result-card').getAttribute('aria-live'), 'polite');
    assert.equal(await page.locator('#resultActionStatus').getAttribute('role'), 'status');
  });

  await check('Fixture A: 120 V single-phase selects 8 AWG and meets 3%', async () => {
    await setFixture({ voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3 });
    assert.equal(await value('recommended'), '8 AWG');
    assert.match(await value('status'), /smallest supported conductor/i);
    assert.ok(Math.abs(parseFloat(await value('dropV')) - 3.115) < 0.02);
    assert.ok(Math.abs(parseFloat((await value('dropPct')).replace('%','')) - 2.596) < 0.02);
  });

  await check('Fixture B: 240 V 40 A voltage-drop-only result is 8 AWG', async () => {
    await setFixture({ voltage: 240, amps: 40, length: 100, unit: 'ft', target: 3 });
    assert.equal(await value('recommended'), '8 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropPct')).replace('%','')) - 2.596) < 0.02);
    assert.match(await value('resultAssumptions'), /resistance-only|reactance/i);
  });

  await check('Fixture C: 12 V DC low-voltage run selects 6 AWG', async () => {
    await setFixture({ circuit: 'dc', voltage: 12, amps: 15, length: 20, unit: 'ft', target: 3 });
    assert.equal(await value('recommended'), '6 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropPct')).replace('%','')) - 2.451) < 0.02);
    assert.equal(await page.locator('#pfField').isVisible(), false);
    assert.match(await value('resultAssumptions'), /PF: not applicable/);
  });

  await check('Fixture D: balanced 400 V three-phase selects 12 AWG', async () => {
    await setFixture({ circuit: 'three', voltage: 400, amps: 25, length: 40, unit: 'm', target: 3 });
    assert.equal(await value('recommended'), '12 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V','')) - 11.191) < 0.02);
    assert.ok(Math.abs(parseFloat((await value('dropPct')).replace('%','')) - 2.798) < 0.02);
  });

  await check('Fixture E: 1,200 W at 120 V and PF 0.80 gives 12.50 A', async () => {
    await setFixture({ circuit: 'single', load: 'watts', voltage: 120, watts: 1200, pf: 0.8, length: 100, unit: 'ft' });
    assert.ok(Math.abs(parseFloat((await value('resultCurrent')).replace(' A','')) - 12.5) < 0.01);
    assert.match(await value('resultAssumptions'), /Power factor: 0.8/);
  });

  await check('Invalid AC power factor values are rejected, not clamped', async () => {
    await setFixture({ circuit: 'single', load: 'watts', voltage: 120, watts: 1200, pf: 0.8 });
    for (const bad of ['', '0', '-0.2', '1.1']) {
      await fill('pf', bad);
      await page.locator('#calculateBtn').click();
      assert.match(await value('status'), /power factor/i);
    }
  });

  await check('AC current mode shows PF and explicitly reports unity assumption', async () => {
    await setFixture({ circuit: 'single', load: 'amps', pf: 1, voltage: 120, amps: 20 });
    assert.equal(await page.locator('#pfField').isVisible(), true);
    assert.match(await page.locator('#pfHint').innerText(), /Assumed unity PF/i);
    assert.match(await value('resultAssumptions'), /Power factor: 1/);
  });

  await check('Fixture F: selected existing 10 AWG fails and 8 AWG passes', async () => {
    await setFixture({ task: 'check', circuit: 'single', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3 });
    assert.equal(await page.locator('#selectedSizeField').isVisible(), true);
    await page.locator('#selectedSize').selectOption('10 AWG');
    await page.locator('#calculateBtn').click();
    assert.equal(await value('recommended'), '10 AWG');
    assert.match(await value('status'), /does not meet/i);
    assert.ok(Math.abs(parseFloat((await value('dropPct')).replace('%','')) - 4.131) < 0.02);
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    assert.equal(await value('recommended'), '8 AWG');
    assert.match(await value('status'), /meets your voltage-drop target/i);
  });

  await check('Metric mode remains separate and selects 10 mm² for Fixture A', async () => {
    await setFixture({ standard: 'metric', circuit: 'single', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3 });
    assert.equal(await value('recommended'), '10 mm²');
    assert.match(await value('recommendedSub'), /Metric mm²/);
  });

  await check('Metric size ladder covers IEC nominal sizes through 1000 mm² and selects 300 mm² for a large DC feeder', async () => {
    const metricSizes = await page.evaluate(() => window.WireSizeCalculator.candidates('metric').map(c => c.name));
    for (const size of ['0.5 mm²', '0.75 mm²', '300 mm²', '400 mm²', '500 mm²', '630 mm²', '800 mm²', '1000 mm²']) {
      assert.ok(metricSizes.includes(size), 'missing metric conductor size: ' + size);
    }
    await setFixture({ standard: 'metric', circuit: 'dc', voltage: 48, amps: 100, length: 100, unit: 'm', target: 3, temperature: 75 });
    assert.equal(await value('recommended'), '300 mm²');
    assert.ok(Math.abs(parseFloat((await value('dropPct')).replace('%','')) - 2.97) < 0.03);
    assert.match(await value('status'), /smallest supported conductor/i);
  });

  await check('Feet and metre inputs produce equivalent drops', async () => {
    await setFixture({ task: 'check', circuit: 'single', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3 });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    const ftDrop = parseFloat((await value('dropV')).replace(' V',''));
    await fill('length', 30.48);
    await page.locator('#lengthUnit').selectOption('m');
    await page.locator('#calculateBtn').click();
    const metreDrop = parseFloat((await value('dropV')).replace(' V',''));
    assert.ok(Math.abs(ftDrop - metreDrop) < 0.001);
  });

  await check('Temperature correction increases resistance and voltage drop', async () => {
    await setFixture({ task: 'check', circuit: 'single', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, temperature: 20 });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    const cold = parseFloat((await value('dropV')).replace(' V',''));
    await fill('temperature', 90);
    await page.locator('#calculateBtn').click();
    const hot = parseFloat((await value('dropV')).replace(' V',''));
    assert.ok(hot > cold);
  });

  await check('Class B/C construction factor increases modelled drop', async () => {
    await setFixture({ task: 'check', circuit: 'single', voltage: 120, amps: 20, length: 100, unit: 'ft', temperature: 75 });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#construction').selectOption('solid');
    await page.locator('#calculateBtn').click();
    const solid = parseFloat((await value('dropV')).replace(' V',''));
    await page.locator('#construction').selectOption('stranded');
    await page.locator('#calculateBtn').click();
    const stranded = parseFloat((await value('dropV')).replace(' V',''));
    assert.ok(stranded > solid);
  });

  await check('Copper and aluminium properties affect selected conductor size', async () => {
    await setFixture({ task: 'find', circuit: 'single', voltage: 120, amps: 20, length: 100, unit: 'ft', material: 'cu' });
    const copper = await value('recommended');
    await page.locator('#material').selectOption('al1350');
    await page.locator('#calculateBtn').click();
    const aluminium = await value('recommended');
    assert.ok(parseFloat((await page.locator('#recommendedSub').innerText()).match(/[0-9.]+/)[0]) > 0);
    assert.notEqual(aluminium, copper);
  });

  await check('No passing candidate is not labelled as a recommendation', async () => {
    await setFixture({ task: 'find', circuit: 'dc', voltage: 12, amps: 100, length: 1000, unit: 'm', target: 0.1 });
    assert.equal(await value('status'), 'No supported size meets this voltage-drop target.');
    assert.match(await value('recommendedSub'), /does not pass/i);
    assert.match(await page.locator('#resultLabel').innerText(), /does not pass/i);
  });

  await check('Invalid voltage, length, target and temperature are rejected', async () => {
    await setFixture({ circuit: 'dc', voltage: 48, amps: 60, length: 5, unit: 'm' });
    await fill('length', 0);
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'), /length/i);
    await fill('length', 5);
    await fill('temperature', 91);
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'), /temperature/i);
    await fill('temperature', 75);
    await fill('target', 10.1);
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'), /target/i);
    await fill('target', 3);
    await fill('voltage', 0);
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'), /voltage/i);
  });

  await check('Three-phase watts use line-to-line voltage and PF', async () => {
    await setFixture({ circuit: 'three', load: 'watts', voltage: 400, watts: 17320.508, pf: 1, length: 40, unit: 'm' });
    assert.ok(Math.abs(parseFloat((await value('resultCurrent')).replace(' A','')) - 25) < 0.01);
  });

  await check('Mobile layout has no horizontal page overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.client + 1, JSON.stringify(dimensions));
    await page.locator('#calculateBtn').isVisible();
  });

  await check('Maximum-distance mode exactly inverts the selected conductor voltage-drop model', async () => {
    await setFixture({ task: 'check', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, targetUnit: 'percent', size: '8 AWG' });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    const baselineDropV = parseFloat((await value('dropV')).replace(' V', ''));
    const expectedFeet = 100 * 3.6 / baselineDropV;

    await page.locator('[data-task="distance"]').click();
    await page.locator('#calculateBtn').click();
    assert.equal(await value('recommended'), '8 AWG');
    assert.equal(await page.locator('#maxDistanceRow').isVisible(), true);
    const distanceText = await value('maxDistance');
    const displayedMetres = Number(distanceText.split('/')[0].replace('m', '').replace(/,/g, '').trim());
    const displayedFeet = Number(distanceText.split('/')[1].replace('ft', '').replace(/,/g, '').trim());
    assert.ok(Math.abs(displayedFeet - expectedFeet) < 0.02, distanceText);
    assert.ok(Math.abs(displayedMetres - expectedFeet * 0.3048) < 0.01, distanceText);
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V', '')) - 3.6) < 0.001);
    assert.ok(Math.abs(parseFloat((await value('dropPct')).replace('%', '')) - 3) < 0.001);
    assert.match(await value('status'), /maximum one-way distance/i);
  });

  await check('Percent and absolute-voltage targets are equivalent', async () => {
    await setFixture({ task: 'check', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', size: '8 AWG', target: 3, targetUnit: 'percent' });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    const pctDrop = await value('dropV');
    await page.locator('#targetUnit').selectOption('volts');
    await fill('target', 3.6);
    await page.locator('#calculateBtn').click();
    assert.equal(await value('dropV'), pctDrop);
    assert.match(await value('status'), /meets your voltage-drop target/i);
  });

  await check('Two equal parallel sets halve modeled voltage drop and I²R loss', async () => {
    await setFixture({ task: 'check', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', size: '8 AWG', parallelSets: 1 });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    const oneDrop = parseFloat((await value('dropV')).replace(' V',''));
    const oneLoss = parseFloat((await value('lossW')).replace(' W',''));
    await fill('parallelSets', 2);
    await page.locator('#calculateBtn').click();
    const twoDrop = parseFloat((await value('dropV')).replace(' V',''));
    const twoLoss = parseFloat((await value('lossW')).replace(' W',''));
    assert.ok(Math.abs(twoDrop - oneDrop/2) < 0.002);
    assert.ok(Math.abs(twoLoss - oneLoss/2) < 0.02);
    assert.equal(await value('currentPerSet'), '10 A');
  });

  await check('Advanced AC reactance matches the published spacing/radius equation', async () => {
    await setFixture({ task: 'check', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', size: '8 AWG', pf: 0.9 });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#useReactance').check();
    await page.locator('#frequency').selectOption('');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'), /actual AC frequency/i);
    await page.locator('#frequency').selectOption('60');
    await fill('singleSpacing', 0.45);
    await page.locator('#calculateBtn').click();
    assert.equal(await page.locator('#reactanceRow').isVisible(), true);

    const area = await page.evaluate(() => window.WireSizeCalculator.candidates('us').find(c => c.name === '8 AWG').area);
    const radiusIn = Math.sqrt(area / Math.PI) / 25.4;
    const expectedX = 2 * Math.PI * 60 * (0.1404 * Math.log10(0.45 / radiusIn) + 0.0153) / 1000;
    const displayedX = parseFloat((await value('reactanceValue')).split('Ω')[0]);
    assert.ok(Math.abs(displayedX - expectedX) < 0.00006, 'single-phase reactance should match the independent equation');

    const rhoAt75 = 0.017241 * (1 + 0.00393 * (75 - 20));
    const resistancePerMetre = 1.02 * rhoAt75 / area;
    const reactancePerMetre = expectedX / 304.8;
    const expectedDropV = 20 * 2 * 30.48 * (resistancePerMetre * 0.9 + reactancePerMetre * Math.sqrt(1 - 0.9 * 0.9));
    const displayedDropV = parseFloat((await value('dropV')).replace(' V', ''));
    assert.ok(Math.abs(displayedDropV - expectedDropV) < 0.0011, 'single-phase R/X voltage drop should match the independent calculation');
  });

  await check('Advanced reactance raises drop at lagging PF and AWG 9 is in the U.S. list', async () => {
    await setFixture({ task: 'check', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', size: '8 AWG', pf: 0.9 });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    const resistanceOnly = parseFloat((await value('dropV')).replace(' V',''));
    await page.locator('#useReactance').check();
    await page.locator('#frequency').selectOption('60');
    await page.locator('#pfDirection').selectOption('lagging');
    await fill('singleSpacing', 0.45);
    await page.locator('#calculateBtn').click();
    const laggingDrop = parseFloat((await value('dropV')).replace(' V',''));
    assert.ok(laggingDrop > resistanceOnly);
    assert.match(await value('resultAssumptions'), /PF direction lagging/i);
    await page.locator('#pfDirection').selectOption('leading');
    await page.locator('#calculateBtn').click();
    const leadingDrop = parseFloat((await value('dropV')).replace(' V',''));
    assert.ok(leadingDrop < laggingDrop);
    await page.locator('#sizeStandard').selectOption('us');
    await page.locator('[data-task="check"]').click();
    assert.ok(await page.locator('#selectedSize option[value="9 AWG"]').count() === 1);
  });

  await check('Leading-PF voltage rise is not reported as a passing voltage drop', async () => {
    await setFixture({ task: 'check', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, pf: 0.1, temperature: 75 });
    await page.locator('#selectedSize').selectOption('4/0 AWG');
    await page.locator('#useReactance').check();
    await page.locator('#frequency').selectOption('60');
    await page.locator('#pfDirection').selectOption('leading');
    await fill('singleSpacing', 36);
    await page.locator('#calculateBtn').click();
    const voltageChange = parseFloat((await value('dropV')).replace(' V', ''));
    assert.ok(voltageChange < -0.01, 'fixture should produce a negative voltage change');
    assert.match(await value('status'), /voltage rise/i);
    assert.doesNotMatch(await value('status'), /meets your voltage-drop target/i);
    assert.equal(await page.locator('#dropPctLabel').innerText(), 'Voltage Rise (%)');
    assert.equal(await page.locator('#dropVLabel').innerText(), 'Voltage Rise (V)');
  });

  await check('Three-phase reactance uses GMD and the correct balanced voltage-drop path; DC hides reactance control', async () => {
    await setFixture({ task: 'check', circuit: 'three', load: 'amps', voltage: 400, amps: 25, length: 40, unit: 'm', size: '12 AWG', pf: 0.9 });
    await page.locator('#selectedSize').selectOption('12 AWG');
    await page.locator('#useReactance').check();
    await page.locator('#frequency').selectOption('50');
    await fill('spacingAB', 0.5);
    await fill('spacingBC', 0.6);
    await fill('spacingCA', 0.7);
    await page.locator('#pfDirection').selectOption('lagging');
    await page.locator('#calculateBtn').click();
    assert.equal(await page.locator('#reactanceRow').isVisible(), true);
    assert.match(await value('resultAssumptions'), /spacing\/GMD/i);

    const area = await page.evaluate(() => window.WireSizeCalculator.candidates('us').find(c => c.name === '12 AWG').area);
    const radiusIn = Math.sqrt(area / Math.PI) / 25.4;
    const gmdIn = Math.cbrt(0.5 * 0.6 * 0.7);
    const expectedX = 2 * Math.PI * 50 * (0.1404 * Math.log10(gmdIn / radiusIn) + 0.0153) / 1000;
    const displayedX = parseFloat((await value('reactanceValue')).split('Ω')[0]);
    assert.ok(Math.abs(displayedX - expectedX) < 0.00006, 'three-phase reactance should use the geometric mean spacing');

    const rhoAt75 = 0.017241 * (1 + 0.00393 * (75 - 20));
    const resistancePerMetre = 1.02 * rhoAt75 / area;
    const reactancePerMetre = expectedX / 304.8;
    const expectedDropV = 25 * Math.sqrt(3) * 40 * (resistancePerMetre * 0.9 + reactancePerMetre * Math.sqrt(1 - 0.9 * 0.9));
    const displayedDropV = parseFloat((await value('dropV')).replace(' V', ''));
    assert.ok(Math.abs(displayedDropV - expectedDropV) < 0.0011, 'balanced three-phase voltage drop should match the independent R/X calculation');

    await page.locator('[data-circuit="dc"]').click();
    assert.equal(await page.locator('#reactanceToggleField').isVisible(), false);
  });

  await check('Parallel sets and absolute target reject invalid values', async () => {
    await setFixture({ circuit: 'dc', load: 'amps', voltage: 48, amps: 60, length: 5, unit: 'm' });
    await fill('parallelSets', 1.5);
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'), /parallel conductor sets/i);
    await fill('parallelSets', 1);
    await page.locator('#targetUnit').selectOption('volts');
    await fill('target', 20);
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'), /between 0.1% and 10%/i);
  });


  await check('Check and maximum-distance tasks preserve selected size and require its matching ampacity row', async () => {
    await setFixture({
      task:'check', circuit:'dc', load:'amps', voltage:48, amps:20, length:1, unit:'m', target:3,
      ampacitySource:'Manufacturer final rating document, page 6', ampacityFinalConfirmed:true
    });
    await page.locator('#selectedSize').selectOption('6 AWG');
    await fill('ampacityTable','8 AWG,30');
    assert.equal(await page.locator('#selectedSize').inputValue(),'6 AWG', 'adding a partial ampacity table must not silently change the selected conductor');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'),/does not include the selected conductor size 6 AWG/i);
    assert.equal(await page.locator('#selectedSize').inputValue(),'6 AWG');
    await fill('ampacityTable','6 AWG,40');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'),/passes the supplied ampacity comparison/i);
    assert.equal(await page.locator('#selectedSize').inputValue(),'6 AWG');
    await page.locator('[data-task="distance"]').click();
    assert.equal(await page.locator('#selectedSize').inputValue(),'6 AWG', 'switching to maximum-distance mode must preserve the selected conductor');
    assert.match(await value('status'),/supplied ampacity comparison also passes/i);
  });

  await check('Manual R/X check and distance modes preserve an omitted selected conductor and require its matching table row', async () => {
    await setFixture({
      method:'manual', manualInputMode:'table',
      manualTable:'8 AWG,0.778,0.052',
      task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft', target:5, pf:1
    });
    await page.locator('#selectedSize').selectOption('6 AWG');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'), /manufacturer R\/X table does not include the selected conductor size 6 AWG/i);
    assert.equal(await page.locator('#selectedSize').inputValue(), '6 AWG', 'the selected conductor must remain unchanged when its R/X row is missing');
    await page.locator('[data-task="distance"]').click();
    assert.match(await value('status'), /manufacturer R\/X table does not include the selected conductor size 6 AWG/i);
    assert.equal(await page.locator('#selectedSize').inputValue(), '6 AWG', 'maximum-distance mode must preserve the selected conductor too');
    await fill('manualTable', '6 AWG,0.491,0.045');
    await page.locator('#calculateBtn').click();
    assert.equal(await page.locator('#selectedSize').inputValue(), '6 AWG');
    assert.match(await value('status'), /maximum one-way distance/i);
  });

  await check('External ampacity import accepts quoted UTF-8 BOM TSV data and decimal commas for a selected-conductor cross-check', async () => {
    await setFixture({
      task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft', target:5,
      ampacityMaterial:'cu', ampacitySource:'Manufacturer installation schedule, revision D',
      ampacityFinalConfirmed:true
    });
    const tsv='\uFEFF"Size"\t"AllowableAmpacityA"\r\n"10 AWG"\t15,5\r\n"8 AWG"\t"25,5"\r\n';
    await page.locator('#ampacityTableFile').setInputFiles({
      name:'allowable-ampacity.tsv',
      mimeType:'text/tab-separated-values',
      buffer:Buffer.from(tsv,'utf8')
    });
    await page.waitForFunction(()=>/Loaded 2 valid ampacity row/.test(document.querySelector('#ampacityTableImportStatus').textContent));
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    assert.equal(await value('recommended'),'8 AWG');
    assert.match(await value('ampacityValue'),/25.5 A \/ conductor/);
    assert.match(await value('resultAssumptions'),/Manufacturer installation schedule, revision D/);
  });

  await check('External ampacity and manufacturer R/X tables support a selected-conductor cross-check', async () => {
    await setFixture({
      method:'manual', manualInputMode:'table',
      manualTable:'10 AWG,1.24,0.062\n8 AWG,0.778,0.052',
      task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft', target:5, pf:0.9,
      ampacityMaterial:'cu', ampacitySource:'Manufacturer cable data sheet, table 4',
      ampacityFinalConfirmed:true
    });
    await fill('ampacityTable','10 AWG,15\n8 AWG,25');
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    assert.equal(await value('recommended'),'8 AWG');
    assert.match(await value('status'),/passes the supplied ampacity comparison/i);
    assert.match(await value('resultAssumptions'),/Manufacturer-entered per-size R\/X table/i);
    assert.match(await value('resultAssumptions'),/External ampacity screen/i);
  });

  await check('External ampacity table rejects an unsupported conductor size', async () => {
    await setFixture({
      task:'find', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft', target:5,
      ampacityMaterial:'cu', ampacitySource:'Source document, page 4', ampacityFinalConfirmed:true
    });
    await fill('ampacityTable','21 AWG,25');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'),/21 AWG is not a supported size/i);
  });

  await check('Copied result summary discloses user-supplied ampacity and its unverified status', async () => {
    await setFixture({
      task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft', target:5,
      ampacityMaterial:'cu', ampacitySource:'Manufacturer final rating sheet, page 2', ampacityFinalConfirmed:true
    });
    await fill('ampacityTable','8 AWG,25');
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async text => { window.__wireSummaryCopied = text; } }
      });
    });
    await page.locator('#copySummaryBtn').click();
    await page.waitForFunction(() => /summary copied/i.test(document.querySelector('#resultActionStatus')?.textContent || ''));
    const copied=await page.evaluate(()=>window.__wireSummaryCopied||'');
    assert.match(copied,/External ampacity table: user-supplied final allowable ampacity values/i);
    assert.match(copied,/25 A \/ conductor/);
    assert.match(copied,/not an ampacity, code-compliance or installation-safety determination/i);
    assert.match(copied,/user-supplied ampacity table is a separate manual comparison and never automatically selects or upsizes a conductor/i);
  });

  await check('Paige 127°F copper formula fixtures: single-phase and balanced three-phase', async () => {
    await setFixture({ task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, material: 'cu', temperature: 53, construction: 'solid' });
    assert.equal(await value('recommended'), '9 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V','')) - 3.579) < 0.02);
    await setFixture({ task: 'find', circuit: 'three', load: 'amps', voltage: 400, amps: 25, length: 40, unit: 'm', target: 3, material: 'cu', temperature: 53, construction: 'solid' });
    assert.equal(await value('recommended'), '12 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V','')) - 10.196) < 0.02);
  });

  await check('Paige live aluminium benchmark fixture remains a separate observed comparison', async () => {
    await setFixture({ task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, material: 'al1350', temperature: 53, construction: 'solid' });
    assert.equal(await value('recommended'), '6 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropPct')).replace('%','')) - 2.438) < 0.02);
  });


  await check('Find mode selects by voltage drop and displays the supplied ampacity comparison without automatic upsizing', async () => {
    await setFixture({
      task:'find', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft',
      construction:'solid', material:'cu', temperature:75, target:3,
      ampacityMaterial:'cu', ampacitySource:'Manufacturer cable data sheet, table 4, revision 2026',
      ampacityFinalConfirmed:true,
      ampacityTable:'Size,AllowableAmpacityA\n10 AWG,35\n8 AWG,15\n6 AWG,30'
    });
    assert.equal(await value('recommended'),'8 AWG','the minimum size must be selected by voltage drop only');
    assert.match(await value('ampacityValue'),/15 A \/ conductor.*20 A \/ set.*Fail/);
    assert.match(await value('status'),/fails the user-supplied ampacity cross-check/i);
    assert.match(await value('status'),/not automatically upsized/i);
    assert.match(await value('whyText'),/does not filter candidates or automatically choose a larger conductor/i);
  });

  await check('Find mode reports a missing ampacity row for its selected voltage-drop size without substituting another size', async () => {
    await setFixture({
      task:'find', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft',
      construction:'solid', material:'cu', temperature:75, target:3,
      ampacityMaterial:'cu', ampacitySource:'Manufacturer installation schedule, page 4',
      ampacityFinalConfirmed:true, ampacityTable:'10 AWG,35\n6 AWG,30'
    });
    assert.equal(await value('recommended'),'8 AWG');
    assert.match(await value('ampacityValue'),/No supplied value for 8 AWG/i);
    assert.match(await value('status'),/no ampacity value was supplied for this conductor/i);
  });

  await check('External ampacity table compares current per parallel conductor set', async () => {
    await setFixture({
      task:'check', circuit:'dc', load:'amps', voltage:48, amps:40, length:5, unit:'m',
      parallelSets:2, construction:'solid', material:'cu', target:3,
      ampacityMaterial:'cu', ampacitySource:'Manufacturer final derated rating, page 2',
      ampacityFinalConfirmed:true, ampacityTable:'8 AWG,20'
    });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    assert.equal(await value('currentPerSet'),'20 A');
    assert.match(await value('ampacityValue'),/20 A \/ conductor.*20 A \/ set.*Pass/);
    assert.match(await value('status'),/passes the supplied ampacity comparison/i);
  });

  await check('Selected-conductor check reports an external ampacity failure even when the voltage-drop result passes', async () => {
    await setFixture({
      task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft',
      construction:'solid', material:'cu', temperature:75, target:3,
      ampacityMaterial:'cu', ampacitySource:'Manufacturer final rating document, page 3',
      ampacityFinalConfirmed:true, ampacityTable:'8 AWG,15'
    });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    assert.ok(parseFloat((await value('dropPct')).replace('%','')) <= 3, 'selected 8 AWG conductor should pass the voltage-drop target');
    assert.match(await value('status'),/exceeds the user-supplied final allowable ampacity/i);
    assert.match(await value('ampacityValue'),/Fail/);
  });

  await check('Maximum-distance mode keeps its voltage-drop distance separate from ampacity suitability', async () => {
    await setFixture({
      task:'distance', circuit:'single', load:'amps', voltage:120, amps:20, target:3,
      construction:'solid', material:'cu', temperature:75,
      ampacityMaterial:'cu', ampacitySource:'Manufacturer final rating document, page 3',
      ampacityFinalConfirmed:true, ampacityTable:'8 AWG,15'
    });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    assert.match(await value('maxDistance'),/m\s*\//);
    assert.match(await value('status'),/fails the supplied ampacity comparison/i);
    assert.match(await value('whyText'),/Distance is inverted from the voltage-drop model only/i);
  });

  await check('External ampacity comparison requires a source, material match and final-rating confirmation', async () => {
    await setFixture({
      task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft',
      construction:'solid', material:'cu', target:3,
      ampacityMaterial:'cu', ampacitySource:'', ampacityFinalConfirmed:false,
      ampacityTable:'8 AWG,30'
    });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'),/traceable ampacity source/i);
    await fill('ampacitySource','Source document, page 4');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'),/Confirm that the ampacity values are final allowable/i);
    await page.locator('#ampacityFinalConfirmed').check();
    await page.locator('#ampacityMaterial').selectOption('al1350');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'),/does not match the selected conductor material/i);
  });

  await check('External ampacity table rejects duplicate and invalid numeric rows', async () => {
    await setFixture({
      task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft',
      material:'cu', target:3, ampacityMaterial:'cu', ampacitySource:'Source document, page 4',
      ampacityFinalConfirmed:true, ampacityTable:'8 AWG,30\n8 AWG,25'
    });
    assert.match(await value('status'),/duplicate conductor size/i);
    await fill('ampacityTable','8 AWG,-5');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'),/final allowable ampacity must be a positive/i);
  });

  await check('External ampacity CSV template has no invented code ratings', async () => {
    await setFixture({});
    const [download]=await Promise.all([
      page.waitForEvent('download'),
      page.locator('#downloadAmpacityTableTemplate').click()
    ]);
    assert.equal(download.suggestedFilename(),'zemtools-allowable-ampacity-template.csv');
    const contents=await readFile(await download.path(),'utf8');
    assert.equal(contents,'Size,AllowableAmpacityA\r\n');
  });

  await check('External ampacity CSV import applies the listed table and reports its provenance to a selected conductor', async () => {
    await setFixture({
      task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft',
      construction:'solid', material:'cu', temperature:75, target:3,
      ampacityMaterial:'cu', ampacitySource:'Manufacturer installation schedule, rev C',
      ampacityFinalConfirmed:true
    });
    const csv='Size,AllowableAmpacityA\r\n10 AWG,35\r\n8 AWG,15\r\n6 AWG,30\r\n';
    await page.locator('#ampacityTableFile').setInputFiles({
      name:'final-allowable-ampacity.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')
    });
    await page.waitForFunction(()=>/Loaded 3 valid ampacity row/.test(document.querySelector('#ampacityTableImportStatus').textContent));
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    assert.equal(await value('recommended'),'8 AWG');
    assert.match(await value('resultAssumptions'),/Manufacturer installation schedule, rev C/);
  });

  await check('External ampacity file import rejects workbooks rather than silently parsing them', async () => {
    await setFixture({});
    await page.locator('#ampacityTableFile').setInputFiles({
      name:'ampacity.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('not CSV')
    });
    await page.waitForFunction(()=>/Unsupported file type/.test(document.querySelector('#ampacityTableImportStatus').textContent));
    assert.equal(await page.locator('#ampacityTable').inputValue(),'');
  });

  await check('External ampacity file import rejects files larger than 256 KB', async () => {
    await setFixture({});
    await page.locator('#ampacityTableFile').setInputFiles({
      name:'oversized.csv',mimeType:'text/csv',buffer:Buffer.alloc(256*1024+1,65)
    });
    await page.waitForFunction(()=>/no larger than 256 KB/.test(document.querySelector('#ampacityTableImportStatus').textContent));
    assert.equal(await page.locator('#ampacityTable').inputValue(),'');
  });

  await check('Minimum-size mode compares copper and aluminium side by side', async () => {
    await setFixture({ task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', material: 'cu' });
    assert.equal(await page.locator('#materialComparison').isVisible(), true);
    const rows = await value('materialComparisonRows');
    assert.match(rows, /Copper/);
    assert.match(rows, /Aluminium EC 1350/);
    assert.match(rows, /8 AWG/);
    assert.match(rows, /6 AWG/);
  });


  await check('Copy result summary includes selected wire, voltage drop and assumptions', async () => {
    await setFixture({ task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3 });
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async text => { window.__wireSummaryCopied = text; } }
      });
    });
    await page.locator('#copySummaryBtn').click();
    await page.waitForFunction(() => /summary copied/i.test(document.querySelector('#resultActionStatus')?.textContent || ''));
    assert.match(await page.locator('#resultActionStatus').textContent(), /summary copied/i);
    const copied = await page.evaluate(() => window.__wireSummaryCopied || '');
    assert.match(copied, /8 AWG/);
    assert.match(copied, /3\.117 V/);
    assert.match(copied, /AC reactance: X = 0/);
    assert.match(copied, /Calculation breakdown:/);
    assert.match(copied, /Path factor = 2/);
    assert.match(copied, /voltage change \(a negative value means estimated voltage rise\)/i);
    assert.match(copied, /voltage-drop planning estimate only/i);
  });

  await check('Print and Save PDF action is available and print stylesheet isolates the result', async () => {
    await page.locator('#printResultBtn').waitFor({ state: 'visible' });
    const printCss = await page.locator('style').allTextContents();
    assert.ok(printCss.some(css => css.includes('@media print') && css.includes('.result-card')));
    assert.match(await page.locator('#printResultBtn').innerText(), /Print \/ Save PDF/);
  });


  await check('Paige published K-factor profile reproduces the 127°F copper sizing basis', async () => {
    await setFixture({ method: 'paige', task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, material: 'cu', temperature: 90, construction: 'stranded' });
    assert.equal(await page.locator('#temperature').isDisabled(), true);
    assert.equal(await page.locator('#construction').isDisabled(), true);
    assert.equal(await page.locator('#pfField').isVisible(), false);
    assert.equal(await value('recommended'), '8 AWG');
    const area = await page.evaluate(() => window.WireSizeCalculator.candidates('us').find(c => c.name === '8 AWG').area);
    const expectedDrop = 2 * 11.2 * 20 * 100 / (area / 0.000506707479);
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V', '')) - expectedDrop) < 0.0011);
    assert.match(await value('resultAssumptions'), /Paige published K-factor model/i);
    assert.match(await value('resultAssumptions'), /53°C/i);
    await setFixture({ method: 'paige', task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, material: 'al1350' });
    assert.equal(await value('recommended'), '6 AWG');
    await setFixture({ method: 'paige', task: 'find', circuit: 'three', load: 'amps', voltage: 400, amps: 25, length: 40, unit: 'm', target: 3, material: 'cu' });
    assert.equal(await value('recommended'), '12 AWG');
    const threePhaseArea = await page.evaluate(() => window.WireSizeCalculator.candidates('us').find(c => c.name === '12 AWG').area);
    const threePhaseExpected = Math.sqrt(3) * 11.2 * 25 * (40 / 0.3048) / (threePhaseArea / 0.000506707479);
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V', '')) - threePhaseExpected) < 0.0011);
    await setFixture({ method: 'paige', task: 'find', circuit: 'single', load: 'watts', voltage: 120, watts: 2400, pf: 0.8, length: 100, unit: 'ft', target: 3, material: 'cu' });
    assert.equal(await page.locator('#pfField').isVisible(), true);
    assert.equal(await value('resultCurrent'), '25 A');
    assert.equal(await value('recommended'), '8 AWG');
    assert.match(await value('resultAssumptions'), /used only to derive line current/i);
  });

  await check('Omni published copper profile reproduces its 3 AWG worked example', async () => {
    await setFixture({ method: 'omni', task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 25, length: 100, unit: 'm', target: 3, material: 'cu', temperature: 50, construction: 'stranded' });
    assert.equal(await page.locator('#material').isEnabled(), true);
    assert.equal(await page.locator('#pfField').isVisible(), false);
    assert.equal(await page.locator('#material option[value="al1350"]').isDisabled(), true);
    assert.equal(await page.locator('#construction').isDisabled(), true);
    assert.equal(await value('recommended'), '3 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V', '')) - 3.5313) < 0.002);
    assert.match(await value('resultAssumptions'), /Omni published copper model/i);
    await setFixture({ method: 'omni', task: 'find', circuit: 'three', load: 'amps', voltage: 400, amps: 25, length: 40, unit: 'm', target: 3, material: 'cu', temperature: 50 });
    assert.equal(await value('recommended'), '12 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V', '')) - 9.86) < 0.02);
  });

  await check('Manufacturer R/X mode checks a selected cable with the impedance voltage-drop equation', async () => {
    await setFixture({ method: 'manual', task: 'check', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, material: 'cu', pf: 0.9 });
    assert.equal(await page.locator('#manualImpedanceFields').isVisible(), true);
    for (const id of ['manualResistance','manualReactance','manualPfDirection','manualFrequency']) {
      assert.equal(await page.locator('label[for="' + id + '"]').count(), 1, id + ' should have a label');
      assert.ok((await page.locator('label[for="' + id + '"]').innerText()).trim().length > 0, id + ' label should be readable');
    }
    assert.equal(await page.locator('#temperature').isDisabled(), true);
    await page.locator('#selectedSize').selectOption('8 AWG');
    await fill('manualResistance', 0.778);
    await fill('manualReactance', 0.052);
    await page.locator('#manualFrequency').selectOption('60');
    await page.locator('#manualPfDirection').selectOption('lagging');
    await page.locator('#calculateBtn').click();
    const expected = 20 * 2 * 100 / 1000 * (0.778 * 0.9 + 0.052 * Math.sqrt(1 - 0.9 * 0.9));
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V', '')) - expected) < 0.0011);
    assert.match(await value('resultAssumptions'), /Manufacturer-entered (?:single-conductor )?R\/X model/i);
    assert.match(await value('resultAssumptions'), /reference frequency 60 Hz/i);
    await setFixture({ method: 'manual', task: 'distance', circuit: 'three', load: 'amps', voltage: 400, amps: 25, target: 3, pf: 0.9 });
    await page.locator('#selectedSize').selectOption('12 AWG');
    await fill('manualResistance', 0.5);
    await fill('manualReactance', 0.1);
    await page.locator('#manualFrequency').selectOption('50');
    await page.locator('#manualPfDirection').selectOption('lagging');
    await page.locator('#calculateBtn').click();
    const expectedDropPerMetre = 25 * Math.sqrt(3) * (0.5 * 0.9 + 0.1 * Math.sqrt(1 - 0.9 * 0.9)) / 304.8;
    const expectedMaximumMetres = 12 / expectedDropPerMetre;
    const maxDistance = Number((await value('maxDistance')).split('/')[0].replace('m', '').replace(/,/g, '').trim());
    assert.ok(Math.abs(maxDistance - expectedMaximumMetres) < 0.02);
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V', '')) - 12) < 0.001);
  });

  await check('Manufacturer R/X table supports Ω/km and produces the same result as Ω/1000 ft', async () => {
    const run = async (units, table) => {
      await setFixture({
        method:'manual', manualInputMode:'table', manualImpedanceUnits:units, manualTable:table,
        task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft', target:3, pf:0.9
      });
      await page.locator('#selectedSize').selectOption('8 AWG');
      await page.locator('#calculateBtn').click();
      return parseFloat((await value('dropV')).replace(' V',''));
    };
    const per1000ft = await run('per1000ft','8 AWG,0.778,0.052');
    const perKm = await run('perKm','8 AWG,2.55249343832021,0.170603674540682');
    assert.ok(Math.abs(per1000ft-perKm)<0.0001, 'Ω/km and Ω/1000 ft inputs must normalize to the same voltage drop');
    assert.ok((await value('resultAssumptions')).includes('Entered units: Ω / km'));
    assert.equal(await page.locator('#manualImpedanceUnits').isVisible(),true);
    await setFixture({
      method:'manual', manualInputMode:'single', manualImpedanceUnits:'perKm',
      task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft', target:3, pf:0.9
    });
    assert.match(await page.locator('#manualResistanceLabel').innerText(),/Ω \/ km/);
    assert.match(await page.locator('#manualReactanceLabel').innerText(),/Ω \/ km/);
    await page.locator('#selectedSize').selectOption('8 AWG');
    await fill('manualResistance','2.55249343832021');
    await fill('manualReactance','0.170603674540682');
    await page.locator('#calculateBtn').click();
    const singlePairPerKm = parseFloat((await value('dropV')).replace(' V',''));
    assert.ok(Math.abs(per1000ft-singlePairPerKm)<0.0001, 'single-pair Ω/km values must use the same conversion as table values');
  });

  await check('Manufacturer R/X table parses semicolon-delimited decimal-comma exports', async () => {
    await setFixture({
      method:'manual', manualInputMode:'table', manualImpedanceUnits:'perKm',
      manualTable:'8 AWG;2,55249343832021;0,170603674540682',
      task:'check', circuit:'single', load:'amps', voltage:120, amps:20, length:100, unit:'ft', target:3, pf:0.9
    });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    const drop = parseFloat((await value('dropV')).replace(' V',''));
    const expected = 20*100*2*(0.778*0.9+0.052*Math.sqrt(1-0.9*0.9))/1000;
    assert.ok(Math.abs(drop-expected)<0.001, 'semicolon-separated decimal-comma values should parse and normalize correctly');
    assert.ok((await value('resultAssumptions')).includes('Entered units: Ω / km'));
  });

  await check('Manufacturer R/X mode refuses unsupported minimum-size search from one fixed pair', async () => {
    await setFixture({ method: 'manual', manualInputMode: 'single', task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, pf: 0.9 });
    assert.match(await value('status'), /single manufacturer R\/X pair checks one selected conductor/i);
  });

  await check('Manufacturer R/X table downloads a correctly headed CSV template', async () => {
    await setFixture({method:'manual',manualInputMode:'table',manualTable:'',task:'find',circuit:'single',load:'amps',voltage:120,amps:20,length:100,unit:'ft',target:3});
    const [download]=await Promise.all([
      page.waitForEvent('download'),
      page.locator('#downloadManualTableTemplate').click()
    ]);
    assert.equal(download.suggestedFilename(),'zemtools-manufacturer-rx-template.csv');
    const filePath=await download.path();
    const contents=await readFile(filePath,'utf8');
    assert.equal(contents,'Size,Resistance,Reactance\r\n');
  });

  await check('Manufacturer R/X table imports CSV files and feeds listed sizes into the calculator', async () => {
    await setFixture({method:'manual',manualInputMode:'table',manualTable:'',task:'find',circuit:'single',load:'amps',voltage:120,amps:20,length:100,unit:'ft',target:3,pf:0.9});
    const csv='Size,Resistance,Reactance\r\n10 AWG,1.24,0.062\r\n8 AWG,0.7780,0.0520\r\n';
    await page.locator('#manualTableFile').setInputFiles({
      name:'manufacturer-impedance.csv',
      mimeType:'text/csv',
      buffer:Buffer.from(csv,'utf8')
    });
    await page.waitForFunction(()=>/Loaded 2 valid conductor row/.test(document.querySelector('#manualTableImportStatus').textContent));
    assert.equal(await page.locator('#manualTable').inputValue(),csv.replace(/\r\n/g,'\n'));
    await page.locator('#calculateBtn').click();
    assert.equal(await value('recommended'),'8 AWG');
    assert.match(await value('resultAssumptions'),/normalized manufacturer R: 0\.778/);
  });

  await check('Manufacturer R/X table imports UTF-8 BOM and quoted tab-separated exports', async () => {
    await setFixture({method:'manual',manualInputMode:'table',manualTable:'',task:'find',circuit:'single',load:'amps',voltage:120,amps:20,length:100,unit:'ft',target:3,pf:0.9});
    const tsv='\uFEFF"Size"\t"Resistance"\t"Reactance"\r\n"10 AWG"\t1.24\t0.062\r\n"8 AWG"\t0.7780\t0.0520\r\n';
    await page.locator('#manualTableFile').setInputFiles({
      name:'manufacturer-impedance.tsv',
      mimeType:'text/tab-separated-values',
      buffer:Buffer.from(tsv,'utf8')
    });
    await page.waitForFunction(()=>/Loaded 2 valid conductor row/.test(document.querySelector('#manualTableImportStatus').textContent));
    await page.locator('#calculateBtn').click();
    assert.equal(await value('recommended'),'8 AWG');
    assert.match(await value('status'),/smallest listed manufacturer-table conductor/i);
  });

  await check('Manufacturer R/X table refuses unsupported workbook file types', async () => {
    await setFixture({method:'manual',manualInputMode:'table',manualTable:'',task:'find',circuit:'single',load:'amps',voltage:120,amps:20,length:100,unit:'ft',target:3});
    await page.locator('#manualTableFile').setInputFiles({
      name:'manufacturer-data.xlsx',
      mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer:Buffer.from('not a csv')
    });
    await page.waitForFunction(()=>/Unsupported file type/.test(document.querySelector('#manualTableImportStatus').textContent));
    assert.equal(await page.locator('#manualTable').inputValue(),'');
  });

  await check('Manufacturer R/X table rejects files larger than 256 KB', async () => {
    await setFixture({method:'manual',manualInputMode:'table',manualTable:'',task:'find',circuit:'single',load:'amps',voltage:120,amps:20,length:100,unit:'ft',target:3});
    await page.locator('#manualTableFile').setInputFiles({
      name:'oversized.csv',
      mimeType:'text/csv',
      buffer:Buffer.alloc(256*1024+1,65)
    });
    await page.waitForFunction(()=>/no larger than 256 KB/.test(document.querySelector('#manualTableImportStatus').textContent));
    assert.equal(await page.locator('#manualTable').inputValue(),'');
  });

  await check('Per-size manufacturer R/X table finds the smallest passing listed conductor', async () => {
    await setFixture({
      method: 'manual', manualInputMode: 'table', manualTable: 'Size,Resistance,Reactance\n10 AWG,1.24,0.062\n8 AWG,0.7780,0.0520',
      task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, pf: 0.9
    });
    assert.equal(await value('recommended'), '8 AWG');
    assert.match(await value('resultLabel'), /Smallest passing size in supplied manufacturer table/i);
    assert.match(await value('status'), /Smallest listed manufacturer-table conductor/i);
    const expectedDropV = 20 * 100 * 2 * (0.778 * 0.9 + 0.052 * Math.sqrt(1 - 0.9 * 0.9)) / 1000;
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V', '')) - expectedDropV) < 0.001);
    assert.match(await value('resultAssumptions'), /normalized manufacturer R: 0\.778/);
    assert.match(await value('whyText'), /Sizes not listed in the table are not inferred/i);
    const options = await page.locator('#selectedSize option').allTextContents();
    assert.ok(!options.some(option => option.startsWith('6 AWG')), 'unprovided sizes must not appear as table-backed candidates');
  });

  await check('Per-size manufacturer R/X table checks the selected row and closes maximum distance', async () => {
    const table = '10 AWG,1.24,0.062\n8 AWG,0.7780,0.0520';
    await setFixture({
      method: 'manual', manualInputMode: 'table', manualTable: table,
      task: 'check', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3, pf: 0.9
    });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    const expectedDropV = 20 * 100 * 2 * (0.778 * 0.9 + 0.052 * Math.sqrt(1 - 0.9 * 0.9)) / 1000;
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V', '')) - expectedDropV) < 0.001);
    await setFixture({
      method: 'manual', manualInputMode: 'table', manualTable: table,
      task: 'distance', circuit: 'single', load: 'amps', voltage: 120, amps: 20, target: 3, pf: 0.9
    });
    await page.locator('#selectedSize').selectOption('8 AWG');
    await page.locator('#calculateBtn').click();
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V', '')) - 3.6) < 0.001);
    assert.match(await value('maxDistance'), /m\s*\//);
  });

  await check('Per-size manufacturer R/X table rejects duplicate, unsupported and malformed rows', async () => {
    await setFixture({
      method: 'manual', manualInputMode: 'table', manualTable: '8 AWG,0.778,0.052\n8 AWG,0.77,0.05',
      task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 20, length: 100, unit: 'ft', target: 3
    });
    assert.match(await value('status'), /duplicate conductor size/i);
    await fill('manualTable', '2.5 mm²,0.8,0.05');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'), /not a supported size in the selected standard/i);
    await fill('manualTable', '8 AWG,not-a-number,0.052');
    await page.locator('#calculateBtn').click();
    assert.match(await value('status'), /resistance must be positive/i);
  });

  await check('Per-size manufacturer R/X table preserves a voltage-rise warning for leading PF', async () => {
    await setFixture({
      method: 'manual', manualInputMode: 'table', manualTable: '8 AWG,0.01,0.5',
      task: 'find', circuit: 'single', load: 'amps', voltage: 120, amps: 10, length: 100, unit: 'ft', target: 3, pf: 0.8
    });
    await page.locator('#manualPfDirection').selectOption('leading');
    await page.locator('#calculateBtn').click();
    assert.match(await value('resultLabel'), /Voltage-rise estimate only/i);
    assert.match(await value('status'), /voltage rise/i);
    assert.doesNotMatch(await value('status'), /smallest listed manufacturer-table conductor/i);
  });

  await check('Paige published K-factor profile reproduces its copper minimum-size benchmark', async () => {
    await setFixture({method:'paige',task:'find',standard:'us',circuit:'single',load:'amps',voltage:120,amps:20,length:100,unit:'ft',target:3,material:'cu'});
    assert.equal(await value('recommended'),'8 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V',''))-2.714)<0.003);
    assert.match(await value('resultAssumptions'),/Paige published K-factor model.*53°C/);
    assert.match(await value('resultAssumptions'),/PF is not used/);
  });

  await check('Paige published K-factor profile evaluates aluminium with its own constant', async () => {
    await setFixture({method:'paige',task:'find',standard:'us',circuit:'single',load:'amps',voltage:120,amps:20,length:100,unit:'ft',target:3,material:'al1350'});
    assert.equal(await value('recommended'),'6 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropPct')).replace('%',''))-2.212)<0.01);
    assert.match(await value('resultAssumptions'),/Aluminium EC 1350/);
  });

  await check('Omni published copper profile reproduces its 120 V / 25 A / 100 m / 50°C worked size', async () => {
    await setFixture({method:'omni',task:'find',standard:'us',circuit:'single',load:'amps',voltage:120,amps:25,length:100,unit:'m',target:3,temperature:50,material:'cu',construction:'solid'});
    assert.equal(await value('recommended'),'3 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V',''))-3.531)<0.01);
    assert.match(await value('resultAssumptions'),/Omni published copper model/);
  });

  await check('Omni published copper profile handles balanced three-phase path factor', async () => {
    await setFixture({method:'omni',task:'find',standard:'us',circuit:'three',load:'amps',voltage:400,amps:25,length:40,unit:'m',target:3,temperature:50,material:'cu',construction:'solid'});
    assert.equal(await value('recommended'),'12 AWG');
    assert.ok(Math.abs(parseFloat((await value('dropV')).replace(' V',''))-9.860)<0.02);
  });

  // Independent 14-case benchmark matrix. Each fixture holds a selected
  // conductor fixed and checks the UI result against a separately calculated
  // resistance/voltage-drop reference. Competitor references are published
  // equations/constants, not claims that their live UI returns identical data.
  const benchmarkFixtures = [
    {id:'PA-01', source:'Paige', circuit:'single', material:'cu', voltage:120, amps:20, length:100, unit:'ft', temperature:53, standard:'us', size:'8 AWG', pf:1},
    {id:'PA-02', source:'Paige', circuit:'single', material:'cu', voltage:240, amps:40, length:200, unit:'ft', temperature:53, standard:'us', size:'6 AWG', pf:1},
    {id:'PA-03', source:'Paige', circuit:'three', material:'cu', voltage:400, amps:25, length:40, unit:'m', temperature:53, standard:'us', size:'12 AWG', pf:1},
    {id:'PA-04', source:'Paige', circuit:'three', material:'cu', voltage:480, amps:50, length:100, unit:'m', temperature:53, standard:'us', size:'4 AWG', pf:1},
    {id:'PA-05', source:'Paige', circuit:'single', material:'al1350', voltage:120, amps:20, length:100, unit:'ft', temperature:53, standard:'us', size:'6 AWG', pf:1},
    {id:'PA-06', source:'Paige', circuit:'single', material:'al1350', voltage:240, amps:35, length:150, unit:'ft', temperature:53, standard:'us', size:'4 AWG', pf:1},
    {id:'PA-07', source:'Paige', circuit:'three', material:'al1350', voltage:480, amps:25, length:80, unit:'m', temperature:53, standard:'us', size:'2 AWG', pf:1},
    {id:'OM-08', source:'Omni', circuit:'dc', material:'cu', voltage:48, amps:50, length:20, unit:'m', temperature:75, standard:'metric', size:'16 mm²', pf:1},
    {id:'OM-09', source:'Omni', circuit:'single', material:'cu', voltage:120, amps:16, length:100, unit:'ft', temperature:75, standard:'us', size:'8 AWG', pf:1},
    {id:'OM-10', source:'Omni', circuit:'three', material:'cu', voltage:400, amps:30, length:100, unit:'m', temperature:75, standard:'metric', size:'25 mm²', pf:1},
    {id:'OM-11', source:'Omni', circuit:'single', material:'cu', voltage:230, amps:10, length:50, unit:'m', temperature:50, standard:'metric', size:'4 mm²', pf:1},
    {id:'OM-12', source:'Omni', circuit:'three', material:'cu', voltage:480, amps:20, length:100, unit:'m', temperature:75, standard:'metric', size:'25 mm²', pf:1},
    {id:'OM-13', source:'Omni', circuit:'single', material:'cu', voltage:240, amps:20, length:80, unit:'m', temperature:50, standard:'metric', size:'16 mm²', pf:1},
    {id:'OM-14', source:'Omni', circuit:'single', material:'cu', voltage:120, amps:25, length:100, unit:'m', temperature:50, standard:'us', size:'3 AWG', pf:1},
  ];
  const benchmarkMaterialData = {
    cu: { rho20: 0.017241, alpha20: 0.00393 },
    al1350: { rho20: 0.028172, alpha20: 0.00403 }
  };
  const parseDisplayedNumber = text => {
    const match = String(text).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    assert.ok(match, 'expected a numeric UI value, got: ' + text);
    return Number(match[0]);
  };
  assert.equal(benchmarkFixtures.length, 14);
  for (const f of benchmarkFixtures) {
    await check('Benchmark ' + f.id + ': ' + f.source + ' normalized voltage-drop fixture', async () => {
      await setFixture({
        task: f.task || 'check', standard: f.standard, circuit: f.circuit, load: 'amps',
        voltage: f.voltage, amps: f.amps, length: f.length, unit: f.unit,
        material: f.material, construction: 'solid', temperature: f.temperature,
        target: 3, targetUnit: 'percent', parallelSets: 1, pf: f.pf
      });
      if (f.task === 'find') {
        assert.equal(await value('recommended'), f.size, f.id + ': minimum-size result should match the published Omni worked example');
      } else {
        await page.locator('#selectedSize').selectOption(f.size);
        await page.locator('#calculateBtn').click();
      }

      const appArea = await page.evaluate(({standard, name}) => {
        const item = window.WireSizeCalculator.candidates(standard).find(c => c.name === name);
        return item ? item.area : null;
      }, {standard: f.standard, name: f.size});
      assert.ok(Number.isFinite(appArea), f.id + ': selected size is missing from the candidate ladder');

      let independentlyDerivedArea;
      if (f.standard === 'metric') {
        independentlyDerivedArea = Number(f.size.split(' ')[0]);
      } else {
        const awg = Number(f.size.match(/^(\d+) AWG$/)[1]);
        const diameterMm = 0.127 * Math.pow(92, (36 - awg) / 39);
        independentlyDerivedArea = Math.PI * diameterMm * diameterMm / 4;
      }
      assert.ok(Math.abs(appArea - independentlyDerivedArea) < 0.0005, f.id + ': nominal conductor area drifted');

      const material = benchmarkMaterialData[f.material];
      const rhoAtTemp = material.rho20 * (1 + material.alpha20 * (f.temperature - 20));
      const lengthM = f.unit === 'ft' ? f.length * 0.3048 : f.length;
      const pathFactor = f.circuit === 'three' ? Math.sqrt(3) : 2;
      const powerFactor = f.circuit === 'dc' ? 1 : f.pf;
      const expectedDropV = f.amps * lengthM * pathFactor * rhoAtTemp / appArea * powerFactor;
      const expectedDropPct = expectedDropV / f.voltage * 100;
      const phaseConductors = f.circuit === 'three' ? 3 : 2;
      const expectedLossW = f.amps * f.amps * rhoAtTemp / appArea * lengthM * phaseConductors;

      const displayedDropV = parseDisplayedNumber(await value('dropV'));
      const displayedDropPct = parseDisplayedNumber(await value('dropPct'));
      const displayedLossW = parseDisplayedNumber(await value('lossW'));
      assert.ok(Math.abs(displayedDropV - expectedDropV) < 0.0011,
        f.id + ': voltage drop differs from independent model; got ' + displayedDropV + ', expected ' + expectedDropV.toFixed(4));
      assert.ok(Math.abs(displayedDropPct - expectedDropPct) < 0.0011,
        f.id + ': percentage drop differs from independent model; got ' + displayedDropPct + ', expected ' + expectedDropPct.toFixed(4));
      assert.ok(Math.abs(displayedLossW - expectedLossW) < 0.015,
        f.id + ': conductor I²R loss differs from independent model; got ' + displayedLossW + ', expected ' + expectedLossW.toFixed(3));

      let publishedEquationDropV = null;
      let equationDeltaPct = null;
      if (f.source === 'Paige') {
        const k = f.material === 'cu' ? 11.2 : 17.4;
        const paigePathFactor = f.circuit === 'three' ? 2 * 0.866 : 2;
        const circularMils = appArea * 1973.525;
        const oneWayFeet = lengthM / 0.3048;
        publishedEquationDropV = k * paigePathFactor * f.amps * oneWayFeet / circularMils;
      } else if (f.source === 'Omni') {
        // Omni's official article publishes a copper worked example:
        // rho20 = 1.68e-8 ohm·m (0.0168 ohm·mm²/m), alpha = 0.00404 /°C.
        // The article does not publish a numeric aluminium resistivity value.
        assert.equal(f.material, 'cu', f.id + ': Omni published numerical reference is copper-only');
        const publishedRho = 0.0168 * (1 + 0.00404 * (f.temperature - 20));
        publishedEquationDropV = pathFactor * publishedRho * f.amps * lengthM * powerFactor / appArea;
      }
      if (publishedEquationDropV !== null) {
        equationDeltaPct = (expectedDropV - publishedEquationDropV) / publishedEquationDropV * 100;
        assert.ok(Number.isFinite(equationDeltaPct), f.id + ': competitor formula delta must be finite');
      }
      console.log('WIRE_BENCHMARK ' + JSON.stringify({
        id: f.id, source: f.source, wire: f.size,
        zemToolsDropV: Number(expectedDropV.toFixed(4)),
        publishedEquationDropV: publishedEquationDropV === null ? null : Number(publishedEquationDropV.toFixed(4)),
        deltaPercent: equationDeltaPct === null ? null : Number(equationDeltaPct.toFixed(2))
      }));
    });
  }

  await check('Omni published worked sizing example exposes the 3 AWG vs 2 AWG model difference', async () => {
    await setFixture({
      task: 'find', standard: 'us', circuit: 'single', load: 'amps',
      voltage: 120, amps: 25, length: 100, unit: 'm',
      material: 'cu', construction: 'solid', temperature: 50,
      target: 3, targetUnit: 'percent', parallelSets: 1, pf: 1
    });
    assert.equal(await value('recommended'), '2 AWG');
    const omniRequiredArea = 2 * 0.0168 * (1 + 0.00404 * (50 - 20)) * 100 * 25 / 3.6;
    const zemtoolsRequiredArea = 2 * 0.017241 * (1 + 0.00393 * (50 - 20)) * 100 * 25 / 3.6;
    assert.ok(Math.abs(omniRequiredArea - 26.16) < 0.01);
    assert.ok(zemtoolsRequiredArea > 26.67 && zemtoolsRequiredArea < 26.9);
    assert.match(await value('status'), /smallest supported conductor/i);
  });

  // Ten independent cases exercise the Omni published copper constants and
  // equations through the actual Omni reference profile in the UI.
  const omniProfileFixtures = [
    {id:'OMNI-01', circuit:'single', voltage:120, amps:25, length:100, unit:'m', temperature:50, target:3, standard:'us', size:'3 AWG', requiredArea:26.161, expectedDropPct:2.943},
    {id:'OMNI-02', circuit:'single', voltage:120, amps:20, length:30.48, unit:'m', temperature:75, target:3, standard:'us', size:'8 AWG', requiredArea:6.954, expectedDropPct:2.494},
    {id:'OMNI-03', circuit:'single', voltage:120, amps:20, length:30.48, unit:'m', temperature:20, target:3, standard:'us', size:'9 AWG', requiredArea:5.690, expectedDropPct:2.573},
    {id:'OMNI-04', circuit:'dc', voltage:12, amps:15, length:20, unit:'ft', temperature:75, target:3, standard:'us', size:'7 AWG', requiredArea:10.431, expectedDropPct:2.966},
    {id:'OMNI-05', circuit:'three', voltage:400, amps:30, length:100, unit:'m', temperature:75, target:3, standard:'metric', size:'10 mm²', requiredArea:8.891, expectedDropPct:2.667},
    {id:'OMNI-06', circuit:'dc', voltage:48, amps:50, length:20, unit:'m', temperature:75, target:2, standard:'metric', size:'50 mm²', requiredArea:42.777, expectedDropPct:1.711},
    {id:'OMNI-07', circuit:'single', voltage:230, amps:16, length:50, unit:'m', temperature:50, target:3, standard:'metric', size:'6 mm²', requiredArea:4.368, expectedDropPct:2.184},
    {id:'OMNI-08', circuit:'three', voltage:480, amps:20, length:100, unit:'m', temperature:75, target:2, standard:'us', size:'8 AWG', requiredArea:7.409, expectedDropPct:1.771},
    {id:'OMNI-09', circuit:'single', voltage:240, amps:20, length:80, unit:'m', temperature:50, target:3, standard:'us', size:'7 AWG', requiredArea:8.372, expectedDropPct:2.381},
    {id:'OMNI-10', circuit:'three', voltage:480, amps:65, length:75, unit:'m', temperature:75, target:2, standard:'metric', size:'25 mm²', requiredArea:18.060, expectedDropPct:1.445}
  ];
  assert.equal(omniProfileFixtures.length, 10);
  for (const f of omniProfileFixtures) {
    await check('Omni published-profile ' + f.id + ' sizing fixture', async () => {
      await setFixture({
        task:'find', method:'omni', standard:f.standard, circuit:f.circuit, load:'amps',
        voltage:f.voltage, amps:f.amps, length:f.length, unit:f.unit, material:'cu',
        construction:'solid', temperature:f.temperature, target:f.target,
        targetUnit:'percent', parallelSets:1, pf:1
      });

      const lengthM = f.unit === 'ft' ? f.length * 0.3048 : f.length;
      const pathFactor = f.circuit === 'three' ? Math.sqrt(3) : 2;
      const rhoAtTemp = 0.0168 * (1 + 0.00404 * (f.temperature - 20));
      const allowedDropV = f.voltage * f.target / 100;
      const independentlyRequiredArea = pathFactor * f.amps * rhoAtTemp * lengthM / allowedDropV;
      assert.ok(Math.abs(independentlyRequiredArea - f.requiredArea) < 0.002,
        f.id + ': independent published-formula area changed');

      const candidates = await page.evaluate(
        standard => window.WireSizeCalculator.candidates(standard),
        f.standard
      );
      const independentlySelected = candidates.find(candidate =>
        candidate.area + 1e-10 >= independentlyRequiredArea
      );
      assert.ok(independentlySelected, f.id + ': no listed size meets the published formula');
      assert.equal(independentlySelected.name, f.size,
        f.id + ': independent candidate selection changed');
      assert.equal(await value('recommended'), f.size,
        f.id + ': Omni profile did not select the independently derived candidate');

      const selectedArea = candidates.find(candidate => candidate.name === f.size)?.area;
      assert.ok(Number.isFinite(selectedArea) && selectedArea >= independentlyRequiredArea - 1e-10,
        f.id + ': selected nominal area is below the independently required area');
      const actualDropPct = parseDisplayedNumber(await value('dropPct'));
      assert.ok(actualDropPct <= f.target + 0.01,
        f.id + ': selected conductor does not meet the requested voltage-drop target');
      assert.ok(Math.abs(actualDropPct - f.expectedDropPct) < 0.02,
        f.id + ': displayed drop differs from the independent result');
      assert.match(await value('resultAssumptions'), /Omni published copper model/i);
    });
  }

  await check('12V and 24V DC quick presets load matched inputs and produce the independently checked voltage-drop sizes', async () => {
    await page.locator('[data-preset="low12"]').click();
    assert.equal(await page.locator('#voltage').inputValue(), '12');
    assert.equal(await page.locator('#amps').inputValue(), '15');
    assert.equal(await page.locator('#length').inputValue(), '20');
    assert.equal(await page.locator('#lengthUnit').inputValue(), 'ft');
    assert.equal(await value('recommended'), '16 mm²');
    assert.ok(Math.abs(parseDisplayedNumber(await value('dropPct')) - 2.45) < 0.02);

    await page.locator('[data-preset="low24"]').click();
    assert.equal(await page.locator('#voltage').inputValue(), '24');
    assert.equal(await page.locator('#amps').inputValue(), '30');
    assert.equal(await page.locator('#length').inputValue(), '5');
    assert.equal(await page.locator('#lengthUnit').inputValue(), 'm');
    assert.equal(await value('recommended'), '16 mm²');

    // Recompute the 24 V preset using the disclosed copper IACS constants.
    // The metric catalog selects 16 mm²; the next smaller listed metric size fails 3%.
    const copperRho75 = 0.017241 * (1 + 0.00393 * (75 - 20)) * 1.02;
    const metricDropPct = area => 30 * 2 * 5 * copperRho75 / area / 24 * 100;
    const expected16mmDropPct = metricDropPct(16);
    const smaller10mmDropPct = metricDropPct(10);
    assert.ok(Math.abs(parseDisplayedNumber(await value('dropPct')) - expected16mmDropPct) < 0.01);
    assert.ok(expected16mmDropPct <= 3 && smaller10mmDropPct > 3,
      '16 mm² must be the smallest listed metric conductor that meets the 3% target');
    assert.match(await value('status'), /smallest supported conductor/i);
  });

  await check('3% and 5% target shortcuts set percent mode without changing the circuit inputs', async () => {
    await setFixture({
      task:'find', circuit:'dc', load:'amps', voltage:48, amps:60,
      length:5, unit:'m', target:1.2, targetUnit:'volts', material:'cu'
    });
    const originalVoltage = await page.locator('#voltage').inputValue();
    const originalCurrent = await page.locator('#amps').inputValue();
    await page.locator('[data-target-preset="5"]').click();
    assert.equal(await page.locator('#target').inputValue(), '5');
    assert.equal(await page.locator('#targetUnit').inputValue(), 'percent');
    assert.equal(await page.locator('#voltage').inputValue(), originalVoltage);
    assert.equal(await page.locator('#amps').inputValue(), originalCurrent);
    await page.locator('[data-target-preset="3"]').click();
    assert.equal(await page.locator('#target').inputValue(), '3');
    assert.equal(await page.locator('#targetUnit').inputValue(), 'percent');
  });

  await check('Model-difference guide explains the verified Omni 3 AWG versus ZemTools 2 AWG example', async () => {
    const guide = await page.locator('#model-difference-guide').innerText();
    assert.match(guide, /resistance constants/i);
    assert.match(guide, /Omni-published copper model selects 3 AWG/i);
    assert.match(guide, /default ZemTools IACS model selects 2 AWG/i);
    assert.match(guide, /not an ampacity or installation approval|not an ampacity, installation, electrical-safety or code-compliance approval/i);
  });


} finally {
  await browser.close();
}
console.log('Wire-size browser checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exitCode = 1;
