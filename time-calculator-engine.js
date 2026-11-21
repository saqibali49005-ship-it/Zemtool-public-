(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZemToolsTimeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function parseClockTime(value) {
    if (!value) return null;
    const parts = String(value).split(':').map(Number);
    if (parts.some(Number.isNaN) || parts.length < 2) return null;
    const hours = parts[0];
    const minutes = parts[1];
    const seconds = parts[2] || 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  function decomposeDuration(total) {
    const sign = total < 0 ? '-' : '';
    let remaining = Math.abs(Math.round(total));
    const days = Math.floor(remaining / 86400);
    remaining %= 86400;
    const hours = Math.floor(remaining / 3600);
    remaining %= 3600;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return { sign, days, hours, mins: minutes, secs: seconds };
  }

  function describeDuration(total) {
    const parts = decomposeDuration(total);
    const labels = [];
    if (parts.days) labels.push(parts.days + ' day' + (parts.days === 1 ? '' : 's'));
    if (parts.hours) labels.push(parts.hours + ' hour' + (parts.hours === 1 ? '' : 's'));
    if (parts.mins) labels.push(parts.mins + ' minute' + (parts.mins === 1 ? '' : 's'));
    if (parts.secs || !labels.length) labels.push(parts.secs + ' second' + (parts.secs === 1 ? '' : 's'));
    return (parts.sign || '') + labels.join(' ');
  }

  function formatClockTime(total) {
    const dayCount = Math.floor(total / 86400);
    let remaining = ((total % 86400) + 86400) % 86400;
    const hours = Math.floor(remaining / 3600);
    remaining %= 3600;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const pad = value => String(Math.trunc(value)).padStart(2, '0');
    const suffix = dayCount === 0 ? '' : (dayCount > 0 ? ' (next day)' : ' (previous day)');
    return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds) + suffix;
  }

  function calculateDuration(startValue, endValue, nextDay) {
    const start = parseClockTime(startValue);
    const end = parseClockTime(endValue);
    if (start === null || end === null) return { ok: false, error: 'invalid-times' };

    let seconds = end - start;
    if (seconds < 0 && nextDay === true) seconds += 86400;
    if (seconds < 0) return { ok: false, error: 'end-before-start' };

    const decimalHours = (seconds / 3600).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return {
      ok: true,
      seconds,
      parts: decomposeDuration(seconds),
      pretty: describeDuration(seconds),
      totalMinutes: seconds / 60,
      decimalHours
    };
  }

  function calculateClockOperation(baseValue, hoursValue, minutesValue, secondsValue, operation) {
    const base = parseClockTime(baseValue);
    const hours = Number(hoursValue || 0);
    const minutes = Number(minutesValue || 0);
    const seconds = Number(secondsValue || 0);
    if (
      base === null ||
      ![hours, minutes, seconds].every(Number.isFinite) ||
      hours < 0 || minutes < 0 || seconds < 0 ||
      !Number.isInteger(hours) || !Number.isInteger(minutes) || !Number.isInteger(seconds)
    ) {
      return { ok: false, error: 'invalid-inputs' };
    }

    const amount = hours * 3600 + minutes * 60 + seconds;
    const action = operation === 'add' ? 'add' : 'subtract';
    const resultSeconds = action === 'add' ? base + amount : base - amount;
    return {
      ok: true,
      amount,
      action,
      resultSeconds,
      clockTime: formatClockTime(resultSeconds),
      prettyAmount: describeDuration(amount)
    };
  }


  function formatDurationClock(total) {
    const sign = total < 0 ? '-' : '';
    let remaining = Math.abs(Math.round(total));
    const hours = Math.floor(remaining / 3600);
    remaining %= 3600;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const pad = value => String(value).padStart(2, '0');
    return sign + pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
  }

  function calculateDurationList(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return { ok: false, error: 'invalid-inputs' };
    }

    let totalSeconds = 0;
    let hasEnteredValue = false;

    for (const entry of entries) {
      if (!entry || (entry.operation !== 'add' && entry.operation !== 'subtract')) {
        return { ok: false, error: 'invalid-inputs' };
      }

      const rawHours = entry.hours === undefined || entry.hours === null ? '' : String(entry.hours).trim();
      const rawMinutes = entry.minutes === undefined || entry.minutes === null ? '' : String(entry.minutes).trim();
      const rawSeconds = entry.seconds === undefined || entry.seconds === null ? '' : String(entry.seconds).trim();
      if (rawHours || rawMinutes || rawSeconds) hasEnteredValue = true;

      const hours = Number(rawHours || 0);
      const minutes = Number(rawMinutes || 0);
      const seconds = Number(rawSeconds || 0);
      const values = [hours, minutes, seconds];

      if (!values.every(Number.isSafeInteger) || values.some(value => value < 0)) {
        return { ok: false, error: 'invalid-inputs' };
      }

      const rowSeconds = hours * 3600 + minutes * 60 + seconds;
      if (!Number.isSafeInteger(rowSeconds)) return { ok: false, error: 'invalid-inputs' };

      totalSeconds += entry.operation === 'subtract' ? -rowSeconds : rowSeconds;
      if (!Number.isSafeInteger(totalSeconds)) return { ok: false, error: 'invalid-inputs' };
    }

    if (!hasEnteredValue) return { ok: false, error: 'invalid-inputs' };

    const decimalHours = (totalSeconds / 3600).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return {
      ok: true,
      totalSeconds,
      durationClock: formatDurationClock(totalSeconds),
      parts: decomposeDuration(totalSeconds),
      pretty: describeDuration(totalSeconds),
      totalMinutes: totalSeconds / 60,
      decimalHours
    };
  }

  function execute(request) {
    const input = request || {};
    let result;
    if (input.operation === 'duration') {
      result = calculateDuration(input.start, input.end, input.nextDay === true);
    } else if (input.operation === 'clock-operation') {
      result = calculateClockOperation(input.baseTime, input.hours, input.minutes, input.seconds, input.action);
    } else if (input.operation === 'duration-list') {
      result = calculateDurationList(input.entries);
    } else {
      return { ok: false, error: { code: 'INVALID_OPERATION', message: 'Choose a supported time operation.' } };
    }
    if (!result.ok) {
      const code = result.error === 'end-before-start' ? 'INVALID_RANGE' : 'INVALID_INPUT';
      const message = result.error === 'end-before-start'
        ? 'End time is earlier than start time.'
        : 'Enter valid clock times and whole-number duration values.';
      return { ok: false, error: { code, message } };
    }
    const { ok, ...data } = result;
    return { ok: true, data };
  }

  return Object.freeze({
    contractVersion: 1,
    execute,
    parseClockTime,
    decomposeDuration,
    describeDuration,
    formatClockTime,
    formatDurationClock,
    calculateDuration,
    calculateClockOperation,
    calculateDurationList
  });
});
