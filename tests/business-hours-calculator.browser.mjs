import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const failures = [];
let passed = 0;

async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (error) { failures.push({ name, error: error.message }); console.error('FAIL', name, error.message); }
}
async function between(start, end) {
  await page.locator('#betweenTab').click();
  await page.locator('#betweenStart').fill(start);
  await page.locator('#betweenEnd').fill(end);
  await page.locator('#calculateBetween').click();
}
async function fresh() {
  await page.goto('http://127.0.0.1:4173/business-hours-calculator/', { waitUntil: 'domcontentloaded' });
  await page.locator('#calculateBetween').waitFor();
  await page.locator('#holidayCountry').selectOption('');
  await page.waitForFunction(() => document.getElementById('countryHolidayStatus').textContent.includes('off'));
}
const resultValue = () => page.locator('#resultArea .result-value').innerText();

try {
  await fresh();
  await check('Primary page metadata and canonical remain specific and indexable', async () => {
    assert.match(await page.title(), /Business Hours Calculator/i);
    assert.match(await page.title(), /SLA Deadlines/i);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://zemtools.com/business-hours-calculator/');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index,follow');
  });

  await check('Default 9–5 weekday range counts 40 business hours', async () => {
    await fresh();
    await between('2026-11-23T09:00', '2026-11-27T17:00');
    assert.equal(await resultValue(), '40 hours');
    assert.equal(await page.locator('#breakdownArea tbody tr').count(), 5);
  });


  await check('Weekly operating-hours summary starts at 40 hours and five open days', async () => {
    await fresh();
    assert.equal(await page.locator('#weeklyTotalHours').innerText(), '40 hours');
    assert.equal(await page.locator('#weeklyOpenDays').innerText(), '5 of 7');
  });

  await check('Weekly operating-hours summary updates for a 24/7 schedule', async () => {
    await fresh();
    await page.locator('[data-schedule-preset="247"]').click();
    assert.equal(await page.locator('#weeklyTotalHours').innerText(), '168 hours');
    assert.equal(await page.locator('#weeklyOpenDays').innerText(), '7 of 7');
  });

  await check('Weekly operating-hours summary counts overnight shifts correctly', async () => {
    await fresh();
    await page.locator('#day-0-start1').fill('22:00');
    await page.locator('#day-0-end1').fill('06:00');
    assert.equal(await page.locator('#weeklyTotalHours').innerText(), '40 hours');
  });

  await check('Partial first and last dates are clipped to exact entered times', async () => {
    await fresh();
    await between('2026-11-24T13:00', '2026-11-25T12:00');
    assert.equal(await resultValue(), '7 hours');
  });

  await check('Split shifts exclude the gap between work periods', async () => {
    await fresh();
    await page.locator('[data-schedule-preset="lunch"]').click();
    await between('2026-11-23T08:30', '2026-11-23T17:30');
    assert.equal(await resultValue(), '8 hours');
  });

  await check('An overnight shift continues into the following date', async () => {
    await fresh();
    await page.locator('#day-0-start1').fill('22:00');
    await page.locator('#day-0-end1').fill('06:00');
    await page.locator('#day-1-enabled').uncheck();
    await between('2026-11-23T22:00', '2026-11-24T06:00');
    assert.equal(await resultValue(), '8 hours');
  });

  await check('The 24/7 preset counts a complete local calendar day', async () => {
    await fresh();
    await page.locator('[data-schedule-preset="247"]').click();
    await between('2026-11-23T00:00', '2026-11-24T00:00');
    assert.equal(await resultValue(), '24 hours');
  });

  await check('Disabling a workday excludes it from the date range', async () => {
    await fresh();
    await page.locator('#day-2-enabled').uncheck();
    await between('2026-11-23T09:00', '2026-11-27T17:00');
    assert.equal(await resultValue(), '32 hours');
  });

  await check('Manual holiday date excludes the entire selected workday', async () => {
    await fresh();
    await page.locator('#holidayCountry').selectOption('');
    await page.locator('#holidayDates').fill('2026-11-23');
    await between('2026-11-23T09:00', '2026-11-23T17:00');
    assert.equal(await resultValue(), '0 minutes');
    assert.match(await page.locator('#resultArea').innerText(), /Holiday dates excluded\s+1/i);
  });

  await check('Country API national holiday is automatically excluded', async () => {
    await page.route('https://nagerholidays.com/api/v4/Holidays/US/2026', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{date:'2026-11-23',name:'Test Federal Holiday',countryCode:'US',nationalHoliday:true,subdivisionCodes:[],holidayTypes:['Public']}])
    }));
    await fresh();
    await page.locator('#holidayCountry').selectOption('US');
    await page.locator('#betweenStart').fill('2026-11-23T09:00');
    await page.locator('#betweenEnd').fill('2026-11-23T17:00');
    await page.waitForFunction(() => document.getElementById('countryHolidayStatus').textContent.includes('1 national'));
    await page.locator('#calculateBetween').click();
    assert.equal(await resultValue(), '0 minutes');
    await page.locator('#breakdownDetails').evaluate(el => { el.open = true; });
    assert.match(await page.locator('#breakdownArea').innerText(), /Test Federal Holiday/);
    await page.unroute('https://nagerholidays.com/api/v4/Holidays/US/2026');
  });

  await check('Regional holiday is included when the selected region code matches', async () => {
    await page.route('https://nagerholidays.com/api/v4/Holidays/US/2026', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{date:'2026-11-24',name:'California State Holiday',countryCode:'US',nationalHoliday:false,subdivisionCodes:['US-CA'],holidayTypes:['Public']}])
    }));
    await fresh();
    await page.locator('#holidayCountry').selectOption('US');
    await page.locator('#holidayRegion').fill('US-CA');
    await page.locator('#holidayRegion').dispatchEvent('change');
    await page.locator('#betweenStart').fill('2026-11-24T09:00');
    await page.locator('#betweenEnd').fill('2026-11-24T17:00');
    await page.waitForFunction(() => document.getElementById('countryHolidayStatus').textContent.includes('1 national'));
    await page.locator('#calculateBetween').click();
    assert.equal(await resultValue(), '0 minutes');
    await page.unroute('https://nagerholidays.com/api/v4/Holidays/US/2026');
  });

  await check('IANA time-zone suggestions include Pakistan and the device time-zone action works', async () => {
    await fresh();
    const values = await page.locator('#commonTimeZones option').evaluateAll(options => options.map(option => option.value));
    assert.ok(values.includes('Asia/Karachi'));
    assert.ok(values.includes('America/New_York'));
    assert.ok(values.includes('Europe/London'));
    const deviceZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    await page.locator('#useDeviceTimezone').click();
    assert.equal(await page.locator('#timezoneId').inputValue(), deviceZone);
    assert.ok((await page.locator('#resultArea').innerText()).includes(deviceZone));
  });

  await check('Changing the time zone immediately recalculates and labels the new zone', async () => {
    await fresh();
    await page.locator('#timezoneId').fill('Asia/Karachi');
    await page.locator('#timezoneId').dispatchEvent('change');
    assert.equal(await resultValue(), '40 hours');
    assert.ok((await page.locator('#resultArea').innerText()).includes('Asia/Karachi'));
    assert.ok((await page.locator('#timezoneStatus').innerText()).includes('Asia/Karachi'));
  });

  await check('Invalid time-zone change clears stale results and a valid zone recovers', async () => {
    await fresh();
    assert.equal(await resultValue(), '40 hours');
    await page.locator('#timezoneId').fill('Not/A_Real_Zone');
    await page.locator('#timezoneId').dispatchEvent('change');
    assert.match(await resultValue(), /not recognized/i);
    await page.locator('#timezoneId').fill('UTC');
    await page.locator('#timezoneId').dispatchEvent('change');
    assert.equal(await resultValue(), '40 hours');
    assert.match(await page.locator('#resultArea').innerText(), /UTC/);
  });

  await check('Invalid IANA time zone is rejected clearly', async () => {
    await fresh();
    await page.locator('#timezoneId').fill('Not/A_Real_Zone');
    await between('2026-11-23T09:00','2026-11-23T17:00');
    assert.match(await resultValue(), /not recognized/i);
  });

  await check('Spring-forward non-existent local clock time is rejected', async () => {
    await fresh();
    await page.locator('#timezoneId').fill('America/New_York');
    await between('2026-03-08T02:30','2026-03-08T03:30');
    assert.match(await resultValue(), /does not exist/i);
  });

  await check('Fall-back repeated local clock time is rejected instead of guessed', async () => {
    await fresh();
    await page.locator('#timezoneId').fill('America/New_York');
    await between('2026-11-01T01:30','2026-11-01T02:30');
    assert.match(await resultValue(), /occurs twice/i);
  });

  await check('Normal weekday shifts retain their duration across the DST weekend', async () => {
    await fresh();
    await page.locator('#timezoneId').fill('America/New_York');
    await between('2026-03-06T09:00','2026-03-09T17:00');
    assert.equal(await resultValue(), '16 hours');
    assert.match(await page.locator('#resultArea').innerText(), /Non-working time\s+2 days 15 hours/i);
  });

  await check('SLA quick target fills the selected business-hour amount', async () => {
    await fresh();
    await page.locator('#deadlineTab').click();
    await page.locator('[data-sla-hours="4"]').click();
    assert.equal(await page.locator('#deadlineHours').inputValue(), '4');
    assert.equal(await page.locator('#deadlineMinutes').inputValue(), '0');
    assert.equal(await page.locator('#deadlineTab').getAttribute('aria-selected'), 'true');
  });

  await check('SLA deadline carries remaining time into the next workday', async () => {
    await fresh();
    await page.locator('#deadlineTab').click();
    await page.locator('#deadlineBase').fill('2026-11-27T16:00');
    await page.locator('#deadlineOperation').selectOption('add');
    await page.locator('#deadlineHours').fill('2');
    await page.locator('#deadlineMinutes').fill('0');
    await page.locator('#calculateDeadline').click();
    assert.match(await resultValue(), /Nov 30, 2026/i);
    assert.match(await resultValue(), /10:00 AM/i);
  });

  await check('Schedule validation rejects overlapping periods', async () => {
    await fresh();
    await page.locator('#day-0-start1').fill('09:00');
    await page.locator('#day-0-end1').fill('13:00');
    await page.locator('#day-0-start2').fill('12:00');
    await page.locator('#day-0-end2').fill('17:00');
    await between('2026-11-23T09:00','2026-11-23T17:00');
    assert.match(await resultValue(), /overlapping work periods/i);
  });

  await check('TXT and CSV export controls appear after a successful calculation', async () => {
    await fresh();
    await between('2026-11-23T09:00','2026-11-23T17:00');
    assert.equal(await page.locator('#downloadGrid').isHidden(), false);
    await page.locator('#downloadTxt').waitFor();
    await page.locator('#downloadCsv').waitFor();
  });
} finally {
  await browser.close();
}

console.log('Business-hours calculator browser checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) process.exitCode = 1;
