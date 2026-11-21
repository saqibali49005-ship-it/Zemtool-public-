import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const routes = [
  { route: '/business-hours-calculator/', title: 'Business Hours Calculator' },
  { route: '/remove-line-breaks/', title: 'Remove Line Breaks Online' }
];
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1365, height: 900 }
];
let passed = 0;
const failures = [];

await page.addInitScript(() => {
  window.confirm = () => true;
  window.open = url => {
    window.__capturedReportUrl = String(url);
    return null;
  };
});

try {
  for (const item of routes) {
    for (const viewport of viewports) {
      try {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto('http://127.0.0.1:4173' + item.route, { waitUntil: 'domcontentloaded' });
        assert.ok(response && response.status() === 200, `HTTP status: ${response?.status()}`);
        const reportButton = page.locator('#reportProblemBtn');
        await reportButton.waitFor({ state: 'visible' });

        const geometry = await page.evaluate(() => {
          const main = document.querySelector('main');
          const layout = main?.querySelector('.layout');
          const wrapper = document.querySelector('.report-problem-wrap');
          const button = document.querySelector('#reportProblemBtn');
          if (!main || !layout || !wrapper || !button) return null;

          const buttonStyle = getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          const buttonBox = {
            left: rect.left + window.scrollX,
            right: rect.right + window.scrollX,
            top: rect.top + window.scrollY,
            bottom: rect.bottom + window.scrollY
          };
          const overlaps = [...main.querySelectorAll('button, a[href], input, select, textarea')]
            .filter(el => el !== button && !wrapper.contains(el))
            .map(el => {
              const style = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              return {
                label: (el.innerText || el.getAttribute('aria-label') || el.id || el.tagName).trim().slice(0, 70),
                display: style.display,
                visibility: style.visibility,
                box: {
                  left: r.left + window.scrollX,
                  right: r.right + window.scrollX,
                  top: r.top + window.scrollY,
                  bottom: r.bottom + window.scrollY
                }
              };
            })
            .filter(item => item.display !== 'none' && item.visibility !== 'hidden' &&
              item.box.right > buttonBox.left && item.box.left < buttonBox.right &&
              item.box.bottom > buttonBox.top && item.box.top < buttonBox.bottom);

          return {
            insideMain: main.contains(wrapper),
            immediatelyAfterToolLayout: layout.nextElementSibling === wrapper,
            wrapperPosition: getComputedStyle(wrapper).position,
            buttonPosition: buttonStyle.position,
            buttonLabel: button.textContent.trim(),
            overlaps
          };
        });

        assert.ok(geometry, 'report button wrapper or tool layout is missing');
        assert.ok(geometry.insideMain, 'report action must remain within the main content');
        assert.ok(geometry.immediatelyAfterToolLayout, 'report action must follow the calculator layout in normal flow');
        assert.equal(geometry.wrapperPosition, 'static', 'report wrapper must not be fixed or sticky');
        assert.equal(geometry.buttonPosition, 'static', 'report button must not be fixed or sticky');
        assert.equal(geometry.buttonLabel, '⚑ Report a problem');
        assert.deepEqual(geometry.overlaps, [], 'report button overlaps another page control: ' + JSON.stringify(geometry.overlaps));

        if (viewport.name === 'mobile') {
          await page.evaluate(() => {
            history.replaceState({}, '', location.pathname + '?private_query=must_not_leak#private-fragment');
            const field = document.createElement('input');
            field.type = 'text';
            field.value = 'SENSITIVE_CALCULATOR_VALUE';
            field.setAttribute('aria-label', 'Private example field');
            document.querySelector('main').append(field);
          });
          await reportButton.click();
          const reportUrl = await page.evaluate(() => window.__capturedReportUrl || '');
          assert.ok(reportUrl.includes('github.com/saqibali49005-ship-it/utility-platform/issues/new'),
            'report button should still open a prefilled GitHub issue URL');
          assert.equal(new URL(reportUrl).searchParams.get('title'), '[Tool Bug] ' + item.title);
          const reportBody = new URL(reportUrl).searchParams.get('body') || '';
          assert.ok(!reportBody.includes('SENSITIVE_CALCULATOR_VALUE'), 'calculator inputs must never be prefilled into a public issue');
          assert.ok(!reportBody.includes('private_query'), 'URL query parameters must not be included in the issue draft');
          assert.ok(!reportBody.includes('private-fragment'), 'URL fragments must not be included in the issue draft');
          assert.ok(reportBody.includes('No calculator input values, selected options, or textarea content were collected automatically.'),
            'public issue draft should explain that form values were excluded by default');
        }

        passed++;
        console.log('PASS', item.route, viewport.name);
      } catch (error) {
        failures.push({ route: item.route, viewport: viewport.name, error: error.message });
        console.error('FAIL', item.route, viewport.name, error.message);
      }
    }
  }
} finally {
  await browser.close();
}

console.log(`Report a problem layout checks: ${passed}/${routes.length * viewports.length} passed; ${failures.length} failed`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
