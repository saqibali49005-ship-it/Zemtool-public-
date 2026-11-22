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


  function parseLocalDateTime(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hours = Number(match[4]);
    const minutes = Number(match[5]);
    const seconds = match[6] ? Number(match[6]) : 0;
    if (year < 100 || month < 1 || month > 12 || day < 1 || day > 31 ||
        hours > 23 || minutes > 59 || seconds > 59) return null;
    const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 ||
        date.getDate() !== day || date.getHours() !== hours ||
        date.getMinutes() !== minutes || date.getSeconds() !== seconds) return null;
    return date.getTime();
  }

  function formatLocalDateTime(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return '';
    const pad = value => String(value).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' +
      pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' +
      pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }

  function calculateDateTimeDuration(startValue, endValue) {
    const start = parseLocalDateTime(startValue);
    const end = parseLocalDateTime(endValue);
    if (start === null || end === null) return { ok: false, error: 'invalid-datetime' };
    if (end < start) return { ok: false, error: 'end-before-start' };
    const seconds = (end - start) / 1000;
    const decimalHours = (seconds / 3600).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return {
      ok: true,
      seconds,
      parts: decomposeDuration(seconds),
      pretty: describeDuration(seconds),
      totalMinutes: seconds / 60,
      decimalHours,
      startTimestamp: start,
      endTimestamp: end
    };
  }

  function readDurationParts(daysValue, hoursValue, minutesValue, secondsValue) {
    const raw = [daysValue, hoursValue, minutesValue, secondsValue]
      .map(value => value === undefined || value === null ? '' : String(value).trim());
    if (!raw.some(Boolean)) return null;
    const values = raw.map(value => Number(value || 0));
    if (!values.every(Number.isSafeInteger) || values.some(value => value < 0)) return null;
    const totalSeconds = values[0] * 86400 + values[1] * 3600 + values[2] * 60 + values[3];
    if (!Number.isSafeInteger(totalSeconds)) return null;
    return totalSeconds;
  }

  function calculateDateTimeOffset(baseValue, daysValue, hoursValue, minutesValue, secondsValue, operation) {
    const base = parseLocalDateTime(baseValue);
    const amount = readDurationParts(daysValue, hoursValue, minutesValue, secondsValue);
    if (base === null || amount === null) return { ok: false, error: 'invalid-inputs' };
    const sign = operation === 'subtract' ? -1 : 1;
    const resultTimestamp = base + sign * amount * 1000;
    if (!Number.isFinite(resultTimestamp)) return { ok: false, error: 'invalid-inputs' };
    return {
      ok: true,
      action: sign === 1 ? 'add' : 'subtract',
      amount,
      prettyAmount: describeDuration(amount),
      resultTimestamp,
      resultDateTime: formatLocalDateTime(resultTimestamp)
    };
  }

  function parseFormattedClock(value, clockFormat) {
    const input = String(value || '').trim();
    if (clockFormat === '12') {
      const match = input.match(/^(1[0-2]|0?[1-9]):([0-5]\d)(?::([0-5]\d))?\s*(AM|PM)$/i);
      if (!match) return null;
      let hours = Number(match[1]) % 12;
      if (match[4].toUpperCase() === 'PM') hours += 12;
      return hours * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
    }
    const match = input.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
    if (!match) return null;
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
  }

  function formatFormattedClock(totalSeconds, clockFormat) {
    const value = ((Math.round(totalSeconds) % 86400) + 86400) % 86400;
    const hours24 = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const pad = number => String(number).padStart(2, '0');
    if (clockFormat === '12') {
      const suffix = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12;
      return hours12 + ':' + pad(minutes) + ' ' + suffix;
    }
    return pad(hours24) + ':' + pad(minutes);
  }

  function calculateWorkHours(startValue, endValue, breakMinutesValue, nextDay, clockFormat, roundingMinutesValue) {
    const start = parseFormattedClock(startValue, clockFormat);
    const end = parseFormattedClock(endValue, clockFormat);
    const breakMinutes = Number(breakMinutesValue || 0);
    const roundingMinutes = Number(roundingMinutesValue || 0);
    if (start === null || end === null || !Number.isSafeInteger(breakMinutes) ||
        breakMinutes < 0 || ![0, 5, 6, 15].includes(roundingMinutes)) {
      return { ok: false, error: 'invalid-inputs' };
    }
    const crossesMidnight = end < start || (end === start && nextDay === true);
    if (end < start && nextDay !== true) return { ok: false, error: 'end-before-start' };
    const startAbsolute = start;
    const endAbsolute = end + (crossesMidnight ? 86400 : 0);
    const roundAbsolute = value => roundingMinutes
      ? Math.round(value / 60 / roundingMinutes) * roundingMinutes * 60
      : value;
    const roundedStart = roundAbsolute(startAbsolute);
    const roundedEnd = roundAbsolute(endAbsolute);
    const grossSeconds = Math.max(0, roundedEnd - roundedStart);
    const breakSeconds = breakMinutes * 60;
    if (!Number.isSafeInteger(breakSeconds) || breakSeconds > grossSeconds) {
      return { ok: false, error: 'break-exceeds-shift' };
    }
    const netSeconds = grossSeconds - breakSeconds;
    return {
      ok: true,
      grossSeconds,
      breakSeconds,
      netSeconds,
      grossPretty: describeDuration(grossSeconds),
      breakPretty: describeDuration(breakSeconds),
      netPretty: describeDuration(netSeconds),
      totalMinutes: netSeconds / 60,
      decimalHours: (netSeconds / 3600).toFixed(4).replace(/0+$/, '').replace(/\.$/, ''),
      roundingMinutes,
      roundedStart: formatFormattedClock(roundedStart, clockFormat),
      roundedEnd: formatFormattedClock(roundedEnd, clockFormat),
      clockFormat
    };
  }

  function calculateTimeExpression(expression, outputUnit) {
    const input = String(expression || '').trim();
    const units = {
      d: 86400, day: 86400, days: 86400,
      w: 604800, week: 604800, weeks: 604800,
      h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
      m: 60, min: 60, mins: 60, minute: 60, minutes: 60,
      s: 1, sec: 1, secs: 1, second: 1, seconds: 1
    };
    const outputUnits = { seconds: 1, minutes: 60, hours: 3600, days: 86400 };
    if (!input || input.length > 500 || !Object.prototype.hasOwnProperty.call(outputUnits, outputUnit || 'hours')) {
      return { ok: false, error: 'invalid-expression' };
    }
    const groups = [];
    const operators = [];
    let current = [];
    let index = 0;
    while (index < input.length) {
      if (/\s/.test(input[index])) { index += 1; continue; }
      const character = input[index];
      if ('+-*/'.includes(character)) {
        if (!current.length) return { ok: false, error: 'invalid-expression' };
        groups.push(current);
        current = [];
        operators.push(character);
        index += 1;
        continue;
      }
      const numberMatch = input.slice(index).match(/^\d+(?:\.\d+)?/);
      if (!numberMatch) return { ok: false, error: 'invalid-expression' };
      const amount = Number(numberMatch[0]);
      if (!Number.isFinite(amount)) return { ok: false, error: 'invalid-expression' };
      index += numberMatch[0].length;
      while (index < input.length && /\s/.test(input[index])) index += 1;
      const unitMatch = input.slice(index).match(/^[a-zA-Z]+/);
      let unit = null;
      let seconds = null;
      if (unitMatch) {
        unit = unitMatch[0].toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(units, unit)) return { ok: false, error: 'invalid-expression' };
        seconds = amount * units[unit];
        index += unitMatch[0].length;
      }
      current.push({ amount, unit, seconds });
      if (current.length > 100) return { ok: false, error: 'invalid-expression' };
    }
    if (!current.length) return { ok: false, error: 'invalid-expression' };
    groups.push(current);
    if (operators.length !== groups.length - 1) return { ok: false, error: 'invalid-expression' };

    const values = [];
    for (const group of groups) {
      if (group.length === 1 && group[0].unit === null) {
        values.push({ type: 'scalar', value: group[0].amount });
      } else {
        if (group.some(item => item.unit === null)) return { ok: false, error: 'invalid-expression' };
        const seconds = group.reduce((sum, item) => sum + item.seconds, 0);
        if (!Number.isFinite(seconds) || Math.abs(seconds) > Number.MAX_SAFE_INTEGER) {
          return { ok: false, error: 'invalid-expression' };
        }
        values.push({ type: 'duration', value: seconds });
      }
    }

    for (let i = 0; i < operators.length; i += 1) {
      if (operators[i] !== '*' && operators[i] !== '/') continue;
      const left = values[i];
      const right = values[i + 1];
      let result;
      if (operators[i] === '/' && right.value === 0) return { ok: false, error: 'division-by-zero' };
      if (left.type === 'duration' && right.type === 'scalar') {
        result = { type: 'duration', value: operators[i] === '*' ? left.value * right.value : left.value / right.value };
      } else if (left.type === 'scalar' && right.type === 'duration' && operators[i] === '*') {
        result = { type: 'duration', value: left.value * right.value };
      } else if (left.type === 'scalar' && right.type === 'scalar') {
        result = { type: 'scalar', value: operators[i] === '*' ? left.value * right.value : left.value / right.value };
      } else {
        return { ok: false, error: 'invalid-expression' };
      }
      if (!Number.isFinite(result.value) || Math.abs(result.value) > Number.MAX_SAFE_INTEGER) {
        return { ok: false, error: 'invalid-expression' };
      }
      values.splice(i, 2, result);
      operators.splice(i, 1);
      i -= 1;
    }

    if (values[0].type !== 'duration') return { ok: false, error: 'invalid-expression' };
    let totalSeconds = values[0].value;
    for (let i = 0; i < operators.length; i += 1) {
      if (values[i + 1].type !== 'duration' || (operators[i] !== '+' && operators[i] !== '-')) {
        return { ok: false, error: 'invalid-expression' };
      }
      totalSeconds += operators[i] === '+' ? values[i + 1].value : -values[i + 1].value;
      if (!Number.isFinite(totalSeconds) || Math.abs(totalSeconds) > Number.MAX_SAFE_INTEGER) {
        return { ok: false, error: 'invalid-expression' };
      }
    }
    totalSeconds = Math.round(totalSeconds);
    const divisor = outputUnits[outputUnit || 'hours'];
    const outputValue = Number((totalSeconds / divisor).toFixed(6));
    return {
      ok: true,
      totalSeconds,
      parts: decomposeDuration(totalSeconds),
      pretty: describeDuration(totalSeconds),
      durationClock: formatDurationClock(totalSeconds),
      outputUnit: outputUnit || 'hours',
      outputValue,
      outputLabel: outputUnit || 'hours',
      totalMinutes: totalSeconds / 60,
      decimalHours: (totalSeconds / 3600).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
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
    } else if (input.operation === 'date-time-duration') {
      result = calculateDateTimeDuration(input.start, input.end);
    } else if (input.operation === 'date-time-offset') {
      result = calculateDateTimeOffset(input.base, input.days, input.hours, input.minutes, input.seconds, input.action);
    } else if (input.operation === 'work-hours') {
      result = calculateWorkHours(input.start, input.end, input.breakMinutes, input.nextDay, input.clockFormat, input.roundingMinutes);
    } else if (input.operation === 'time-expression') {
      result = calculateTimeExpression(input.expression, input.outputUnit);
    } else {
      return { ok: false, error: { code: 'INVALID_OPERATION', message: 'Choose a supported time operation.' } };
    }
    if (!result.ok) {
      const code = result.error === 'end-before-start' ? 'INVALID_RANGE' : 'INVALID_INPUT';
      const messages = {
        'end-before-start': 'End time is earlier than start time.',
        'invalid-datetime': 'Enter valid local dates and times. Check daylight-saving clock changes.',
        'break-exceeds-shift': 'Break time cannot be longer than the rounded shift duration.',
        'division-by-zero': 'A time duration cannot be divided by zero.',
        'invalid-expression': 'Check the time expression. Use d, w, h, m or s units and supported operators.'
      };
      const message = messages[result.error] || 'Enter valid time values and whole-number duration fields.';
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
    calculateDurationList,
    parseLocalDateTime,
    formatLocalDateTime,
    calculateDateTimeDuration,
    calculateDateTimeOffset,
    parseFormattedClock,
    formatFormattedClock,
    calculateWorkHours,
    calculateTimeExpression
  });
});
