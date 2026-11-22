import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, timezoneId: 'America/New_York' });
const page = await context.newPage();
let baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
while (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
const failures = [];
let passed = 0;

async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (error) { failures.push({ name, error: error.message }); console.error('FAIL', name, error.message); }
}
async function fresh() {
  await page.goto(baseUrl + '/time-calculator/', { waitUntil: 'domcontentloaded' });
  await page.locator('#calcDuration').waitFor();
}

try {
  await fresh();
  await check('Page loads with canonical URL and extracted engine', async () => {
    assert.match(await page.title(), /Time Calculator/i);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/time-calculator/');
    assert.equal(await page.evaluate(() => typeof window.ZemToolsTimeEngine.calculateDuration), 'function');
  });

  await check('Default duration retains 7 hours 45 minutes and decimal hours', async () => {
    await fresh();
    const result = await page.locator('#durationResult').innerText();
    assert.match(result, /7 hours 45 minutes/);
    assert.match(result, /465 minutes/);
    assert.match(result, /27,900 seconds/);
    assert.match(result, /7\.75 decimal hours/);
  });

  await check('Cross-midnight duration requires next-day setting', async () => {
    await fresh();
    await page.locator('#startTime').fill('23:30:00');
    await page.locator('#endTime').fill('01:15:00');
    await page.locator('#calcDuration').click();
    assert.match(await page.locator('#durationResult').innerText(), /End time is earlier than start time/i);
    await page.locator('#nextDay').check();
    await page.locator('#calcDuration').click();
    assert.match(await page.locator('#durationResult').innerText(), /1 hour 45 minutes/);
  });

  await check('Invalid duration time keeps the existing validation message', async () => {
    await fresh();
    await page.locator('#startTime').fill('');
    await page.locator('#calcDuration').click();
    assert.match(await page.locator('#durationResult').innerText(), /Enter valid start and end times/i);
  });

  await check('Add operation calculates and wraps after midnight correctly', async () => {
    await fresh();
    await page.locator('#addTab').click();
    await page.locator('#baseTime').fill('23:30:00');
    await page.locator('#addHours').fill('2');
    await page.locator('#addMinutes').fill('30');
    await page.locator('#addSeconds').fill('0');
    await page.locator('#operation').selectOption('add');
    await page.locator('#calcAdd').click();
    assert.match(await page.locator('#addResult').innerText(), /02:00:00 \(next day\)/);
    assert.match(await page.locator('#addResult').innerText(), /2 hours 30 minutes/);
  });

  await check('Subtract operation wraps to the previous day correctly', async () => {
    await fresh();
    await page.locator('#addTab').click();
    await page.locator('#baseTime').fill('00:30:00');
    await page.locator('#addHours').fill('1');
    await page.locator('#addMinutes').fill('15');
    await page.locator('#operation').selectOption('subtract');
    await page.locator('#calcAdd').click();
    assert.match(await page.locator('#addResult').innerText(), /23:15:00 \(previous day\)/);
  });

  await check('Fractional duration input is rejected', async () => {
    await fresh();
    await page.locator('#addTab').click();
    await page.locator('#addHours').fill('1.5');
    await page.locator('#calcAdd').click();
    assert.match(await page.locator('#addResult').innerText(), /valid base time and whole-number duration values/i);
  });

  await check('Reset controls restore the documented default values', async () => {
    await fresh();
    await page.locator('#startTime').fill('12:00:00');
    await page.locator('#nextDay').check();
    await page.locator('#resetDuration').click();
    assert.equal(await page.locator('#startTime').inputValue(), '09:30:00');
    assert.equal(await page.locator('#endTime').inputValue(), '17:15:00');
    assert.equal(await page.locator('#nextDay').isChecked(), false);
    await page.locator('#addTab').click();
    await page.locator('#baseTime').fill('12:00:00');
    await page.locator('#resetAdd').click();
    assert.equal(await page.locator('#baseTime').inputValue(), '10:30:00');
    assert.equal(await page.locator('#addHours').inputValue(), '2');
    assert.equal(await page.locator('#addMinutes').inputValue(), '30');
  });
  await check('Multiple duration rows add and subtract into one correct total', async () => {
    await fresh();
    await page.locator('#durationListTab').click();
    const rows = page.locator('#durationRows .duration-row');
    await rows.nth(0).locator('.row-hours').fill('1');
    await rows.nth(0).locator('.row-minutes').fill('30');
    await page.locator('#addDurationRow').click();
    await rows.nth(1).locator('.row-hours').fill('0');
    await rows.nth(1).locator('.row-minutes').fill('45');
    await page.locator('#addDurationRow').click();
    await rows.nth(2).locator('.row-operation').selectOption('subtract');
    await rows.nth(2).locator('.row-minutes').fill('10');
    await page.locator('#calcDurationList').click();
    const result = await page.locator('#durationListResult').innerText();
    assert.match(result, /02:05:00/);
    assert.match(result, /2 hours 5 minutes/);
    assert.match(result, /125 minutes/);
    assert.match(result, /7,500 seconds/);
    assert.match(result, /2\.0833 decimal hours/);
    assert.equal(await page.locator('#copyDurationList').isVisible(), true);
  });

  await check('Duration totals can exceed 24 hours without wrapping like clock time', async () => {
    await fresh();
    await page.locator('#durationListTab').click();
    const row = page.locator('#durationRows .duration-row').first();
    await row.locator('.row-hours').fill('50');
    await row.locator('.row-minutes').fill('10');
    await page.locator('#calcDurationList').click();
    const result = await page.locator('#durationListResult').innerText();
    assert.match(result, /50:10:00/);
    assert.match(result, /2 days/);
    assert.match(result, /50\.1667 decimal hours/);
  });

  await check('Negative duration totals and blank-row validation are handled', async () => {
    await fresh();
    await page.locator('#durationListTab').click();
    await page.locator('#calcDurationList').click();
    assert.match(await page.locator('#durationListResult').innerText(), /Enter at least one duration/i);
    const row = page.locator('#durationRows .duration-row').first();
    await row.locator('.row-operation').selectOption('subtract');
    await row.locator('.row-minutes').fill('10');
    await page.locator('#calcDurationList').click();
    const result = await page.locator('#durationListResult').innerText();
    assert.match(result, /-00:10:00/);
    assert.match(result, /-10 minutes/);
    assert.match(result, /-0\.1667 decimal hours/);
  });

  await check('Duration rows can be added, removed and reset safely', async () => {
    await fresh();
    await page.locator('#durationListTab').click();
    await page.locator('#addDurationRow').click();
    assert.equal(await page.locator('#durationRows .duration-row').count(), 2);
    await page.locator('#durationRows .duration-row').nth(1).locator('.row-remove').click();
    assert.equal(await page.locator('#durationRows .duration-row').count(), 1);
    assert.equal(await page.locator('#durationRows .row-remove').isDisabled(), true);
    await page.locator('#addDurationRow').click();
    await page.locator('#resetDurationList').click();
    assert.equal(await page.locator('#durationRows .duration-row').count(), 1);
    assert.equal(await page.locator('#durationListResult').innerText(), '');
  });

  await check('Calculated duration result can be copied when clipboard permission is available', async () => {
    await fresh();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
    await page.locator('#durationListTab').click();
    const row = page.locator('#durationRows .duration-row').first();
    await row.locator('.row-hours').fill('2');
    await row.locator('.row-minutes').fill('5');
    await page.locator('#calcDurationList').click();
    await page.locator('#copyDurationList').click();
    await page.waitForFunction(() => {
      const status = document.querySelector('#copyDurationStatus');
      return Boolean(status && status.textContent.trim());
    });
    assert.match(await page.locator('#copyDurationStatus').innerText(), /Result copied/i);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(copied, /02:05:00/);
    assert.match(copied, /2\.0833 decimal hours/);
  });

  await check('Third mode tabs and duration rows fit the mobile viewport', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await fresh();
      await page.locator('#durationListTab').click();
      const dimensions = await page.evaluate(() => {
        const tabs = document.querySelector('.mode-tabs');
        const row = document.querySelector('.duration-row');
        return {
          tabsWidth: tabs.clientWidth,
          tabsScrollWidth: tabs.scrollWidth,
          rowWidth: row.clientWidth,
          rowScrollWidth: row.scrollWidth
        };
      });
      assert.ok(dimensions.tabsScrollWidth <= dimensions.tabsWidth + 1, JSON.stringify(dimensions));
      assert.ok(dimensions.rowScrollWidth <= dimensions.rowWidth + 1, JSON.stringify(dimensions));
      await page.locator('#addDurationRow').click();
      assert.equal(await page.locator('#durationRows .duration-row').count(), 2);
    } finally {
      await page.setViewportSize({ width: 1365, height: 900 });
    }
  });


  await check('Work Hours deducts breaks and reports gross, net and decimal hours', async () => {
    await fresh();
    await page.locator('#workTab').click();
    await page.locator('#workStartTime').fill('09:00');
    await page.locator('#workEndTime').fill('17:00');
    await page.locator('#workBreakMinutes').fill('30');
    await page.locator('#calcWork').click();
    const result = await page.locator('#workResult').innerText();
    assert.match(result, /7 hours 30 minutes/);
    assert.match(result, /Gross time\s+8 hours/);
    assert.match(result, /Break deducted\s+30 minutes/);
    assert.match(result, /7\\.5/);
  });

  await check('Work Hours switches between 24-hour and 12-hour input safely', async () => {
    await fresh();
    await page.locator('#workTab').click();
    await page.locator('#workClockFormat').selectOption('12');
    assert.equal(await page.locator('#workStartTime').inputValue(), '9:00 AM');
    assert.equal(await page.locator('#workEndTime').inputValue(), '5:00 PM');
    await page.locator('#calcWork').click();
    assert.match(await page.locator('#workResult').innerText(), /8 hours/);
    await page.locator('#workClockFormat').selectOption('24');
    assert.equal(await page.locator('#workStartTime').inputValue(), '09:00');
  });

  await check('Work Hours requires next-day confirmation for overnight shifts', async () => {
    await fresh();
    await page.locator('#workTab').click();
    await page.locator('#workStartTime').fill('22:00');
    await page.locator('#workEndTime').fill('06:00');
    await page.locator('#calcWork').click();
    assert.match(await page.locator('#workResult').innerText(), /next-day option/i);
    await page.locator('#workNextDay').check();
    await page.locator('#calcWork').click();
    assert.match(await page.locator('#workResult').innerText(), /8 hours/);
  });

  await check('Work Hours rejects a break longer than the rounded shift', async () => {
    await fresh();
    await page.locator('#workTab').click();
    await page.locator('#workStartTime').fill('09:00');
    await page.locator('#workEndTime').fill('10:00');
    await page.locator('#workBreakMinutes').fill('61');
    await page.locator('#calcWork').click();
    assert.match(await page.locator('#workResult').innerText(), /Break time cannot be longer/i);
  });

  await check('Work Hours rounding applies to start and end inputs', async () => {
    await fresh();
    await page.locator('#workTab').click();
    await page.locator('#workStartTime').fill('09:02');
    await page.locator('#workEndTime').fill('17:02');
    await page.locator('#workRounding').selectOption('5');
    await page.locator('#calcWork').click();
    const result = await page.locator('#workResult').innerText();
    assert.match(result, /8 hours/);
    assert.match(result, /Rounded shift entries: 09:00 to 17:00/);
  });

  await check('Date and Time calculates elapsed duration across a US daylight-saving transition', async () => {
    await fresh();
    await page.locator('#dateTimeTab').click();
    await page.locator('#rangeStartDateTime').fill('2026-03-07T12:00:00');
    await page.locator('#rangeEndDateTime').fill('2026-03-08T12:00:00');
    await page.locator('#calcDateRange').click();
    const result = await page.locator('#dateRangeResult').innerText();
    assert.match(result, /23 hours/);
    assert.match(result, /82,800 seconds/);
  });

  await check('Date and Time rejects a nonexistent local time in a daylight-saving gap', async () => {
    await fresh();
    await page.locator('#dateTimeTab').click();
    await page.locator('#rangeStartDateTime').fill('2026-03-08T02:30:00');
    await page.locator('#rangeEndDateTime').fill('2026-03-08T04:00:00');
    await page.locator('#calcDateRange').click();
    assert.match(await page.locator('#dateRangeResult').innerText(), /Check for daylight-saving clock changes/i);
  });

  await check('Date and Time adds 24 elapsed hours across a daylight-saving change', async () => {
    await fresh();
    await page.locator('#dateTimeTab').click();
    await page.locator('#offsetBaseDateTime').fill('2026-03-07T12:00:00');
    await page.locator('#offsetDays').fill('1');
    await page.locator('#offsetHours').fill('0');
    await page.locator('#calcDateOffset').click();
    assert.match(await page.locator('#dateOffsetResult').innerText(), /2026-03-08 13:00:00/);
  });

  await check('Date and Time rejects an end date earlier than the start date', async () => {
    await fresh();
    await page.locator('#dateTimeTab').click();
    await page.locator('#rangeStartDateTime').fill('2026-11-22T17:00:00');
    await page.locator('#rangeEndDateTime').fill('2026-11-22T09:00:00');
    await page.locator('#calcDateRange').click();
    assert.match(await page.locator('#dateRangeResult').innerText(), /must not be earlier/i);
  });

  await check('Expression mode evaluates safe duration expressions and selectable units', async () => {
    await fresh();
    await page.locator('#expressionTab').click();
    await page.locator('#timeExpression').fill('1d 2h 3m 4s + 4h 5s - 2030s + 28h');
    await page.locator('#expressionOutputUnit').selectOption('days');
    await page.locator('#calcExpression').click();
    const result = await page.locator('#expressionResult').innerText();
    assert.match(result, /2 days 9 hours 29 minutes 19 seconds/);
    assert.match(result, /2\\.39536 days/);
  });

  await check('Expression mode supports duration multiplication and division by a scalar', async () => {
    await fresh();
    await page.locator('#expressionTab').click();
    await page.locator('#timeExpression').fill('3h 43m 11s * 6');
    await page.locator('#calcExpression').click();
    assert.match(await page.locator('#expressionResult').innerText(), /22 hours 19 minutes 6 seconds/);
    await page.locator('#timeExpression').fill('3 weeks / 5');
    await page.locator('#expressionOutputUnit').selectOption('days');
    await page.locator('#calcExpression').click();
    assert.match(await page.locator('#expressionResult').innerText(), /4\\.2 days/);
  });

  await check('Expression mode rejects code-like input and division by zero without executing it', async () => {
    await fresh();
    await page.locator('#expressionTab').click();
    await page.locator('#timeExpression').fill('alert(1)');
    await page.locator('#calcExpression').click();
    assert.match(await page.locator('#expressionResult').innerText(), /Check the expression/i);
    await page.locator('#timeExpression').fill('3h / 0');
    await page.locator('#calcExpression').click();
    assert.match(await page.locator('#expressionResult').innerText(), /cannot be divided by zero/i);
  });

} finally {
  await browser.close();
}
console.log('Time calculator browser checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exitCode = 1;
