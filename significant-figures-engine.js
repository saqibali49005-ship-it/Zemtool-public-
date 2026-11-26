(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZemToolsSignificantFiguresEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_INPUT_LENGTH = 256;
  const MAX_ABS_EXPONENT = 1000;
  const DIVISION_PRECISION = 60;

  function parseDecimal(raw) {
    const text = String(raw).trim();
    if (!text || text.length > MAX_INPUT_LENGTH) throw new Error('Enter a number within the supported input length.');
    const match = text.match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/);
    if (!match) throw new Error('Enter a valid decimal number.');
    const exponent = match[5] ? Number(match[5]) : 0;
    if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > MAX_ABS_EXPONENT) throw new Error('The exponent is outside the supported range.');
    const fraction = match[3] !== undefined ? match[3] : (match[4] || '');
    const whole = match[2] || '0';
    const digits = (whole + fraction).replace(/^0+(?=\d)/, '') || '0';
    const coefficient = BigInt(digits) * (match[1] === '-' ? -1n : 1n);
    const scale = fraction.length - exponent;
    if (Math.abs(scale) > MAX_ABS_EXPONENT) throw new Error('The decimal scale is outside the supported range.');
    return { coefficient, scale };
  }

  function pow10(n) {
    if (!Number.isInteger(n) || n < 0 || n > 2000) throw new Error('The requested calculation exceeds the supported range.');
    return 10n ** BigInt(n);
  }

  function formatDecimal(coefficient, scale, minFraction = 0) {
    if (coefficient === 0n) return minFraction ? '0.' + '0'.repeat(minFraction) : '0';
    const negative = coefficient < 0n;
    let digits = (negative ? -coefficient : coefficient).toString();
    if (scale < 0) { digits += '0'.repeat(-scale); scale = 0; }
    if (scale > 0) { digits = digits.padStart(scale + 1, '0'); const split = digits.length - scale; digits = digits.slice(0, split) + '.' + digits.slice(split); }
    if (minFraction > 0) { const have = (digits.split('.')[1] || '').length; if (!digits.includes('.')) digits += '.'; digits += '0'.repeat(Math.max(0, minFraction - have)); }
    return (negative ? '-' : '') + digits;
  }

  function normalizeNumeric(raw) {
    const text = String(raw).trim();
    if (!text) return '';
    const sign = /^[+-]/.test(text) ? text[0] : '';
    const body = sign ? text.slice(1) : text;
    const e = body.search(/[eE]/);
    let mantissa = e < 0 ? body : body.slice(0, e);
    const exponent = e < 0 ? '' : body.slice(e);
    if (mantissa.includes(',')) {
      const grouped = mantissa.match(/^(\d{1,3}(?:,\d{3})+)(\.\d*)?$/);
      if (!grouped) throw new Error('Use commas only as thousands separators (for example, 1,234.5).');
      mantissa = grouped[1].replace(/,/g, '') + (grouped[2] || '');
    }
    const normalized = sign + mantissa + exponent;
    parseDecimal(normalized);
    return normalized;
  }

  function significantCount(raw) {
    const value = normalizeNumeric(raw).toLowerCase();
    if (!value) return 1;
    const mantissa = value.split('e')[0].replace(/^[+-]/, '');
    const hasDecimalPoint = mantissa.includes('.');
    const digits = mantissa.replace(/\./g, '');
    const first = digits.search(/[1-9]/);
    if (first < 0) {
      // In an all-zero decimal, digits to the right of the decimal point
      // communicate measured precision (0.00 has two significant zeros).
      return hasDecimalPoint ? Math.max(1, (mantissa.split('.')[1] || '').length) : 1;
    }
    const significant = digits.slice(first);
    // Integer trailing zeros are ambiguous and therefore insignificant by default.
    return hasDecimalPoint ? significant.length : (significant.replace(/0+$/, '').length || 1);
  }

  function decimalExponent(value) {
    if (value.coefficient === 0n) return 0;
    const digits = (value.coefficient < 0n ? -value.coefficient : value.coefficient).toString();
    return digits.length - 1 - value.scale;
  }

  function roundHalfUp(numerator, denominator) {
    if (denominator === 0n) throw new Error('Division by zero is not allowed.');
    const negative = (numerator < 0n) !== (denominator < 0n);
    const n = numerator < 0n ? -numerator : numerator;
    const d = denominator < 0n ? -denominator : denominator;
    const q = n / d;
    const r = n % d;
    const rounded = q + (r * 2n >= d ? 1n : 0n);
    return negative ? -rounded : rounded;
  }

  function roundToScale(value, targetScale) {
    if (targetScale >= value.scale) return { coefficient: value.coefficient * pow10(targetScale - value.scale), scale: targetScale };
    return { coefficient: roundHalfUp(value.coefficient, pow10(value.scale - targetScale)), scale: targetScale };
  }

  function roundDecimalToSig(value, count) {
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Enter a valid significant-figure count.');
    if (value.coefficient === 0n) return '0';
    const originalExponent = decimalExponent(value);
    const initialScale = count - 1 - originalExponent;
    let rounded = roundToScale(value, initialScale);
    let exponent = decimalExponent(rounded);
    const targetScale = count - 1 - exponent;
    // A rounding carry can change the decimal exponent. Re-quantize at the
    // new exponent so the displayed result has exactly the requested digits.
    if (targetScale !== initialScale) rounded = roundToScale(rounded, targetScale);
    exponent = decimalExponent(rounded);
    const digits = (rounded.coefficient < 0n ? -rounded.coefficient : rounded.coefficient).toString();
    const sig = digits.padEnd(count, '0').slice(0, count);
    const mantissa = sig.length === 1 ? sig : sig[0] + '.' + sig.slice(1);
    const sign = rounded.coefficient < 0n ? '-' : '';
    const carriedIntegerBoundary = exponent > originalExponent && exponent >= 1;
    const ambiguousIntegerPrecision = exponent >= 1 && targetScale <= 0;
    if (exponent <= -4 || exponent >= count || carriedIntegerBoundary || ambiguousIntegerPrecision) {
      return sign + mantissa + 'e' + (exponent >= 0 ? '+' : '') + exponent;
    }
    return formatDecimal(rounded.coefficient, rounded.scale, Math.max(0, targetScale));
  }

  function roundToSig(raw, count) {
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Enter a valid number and significant-figure count.');
    return roundDecimalToSig(parseDecimal(normalizeNumeric(raw)), count);
  }

  function formatForSig(value, count) {
    if (typeof value === 'string') return roundToSig(value, count);
    if (!Number.isFinite(value)) throw new Error('Enter a valid number.');
    return roundToSig(String(value), count);
  }

  function decimalPlacePosition(raw) { return parseDecimal(normalizeNumeric(raw)).scale; }

  function roundAtDecimalPosition(rawValue, position) {
    const value = typeof rawValue === 'number' ? parseDecimal(String(rawValue)) : rawValue;
    if (!Number.isInteger(position) || Math.abs(position) > MAX_ABS_EXPONENT) throw new Error('The requested decimal place is outside the supported range.');
    const rounded = roundToScale(value, position);
    const significant = rounded.coefficient === 0n ? 1 : Math.max(1, decimalExponent(rounded) + position + 1);
    return { text: formatDecimal(rounded.coefficient, rounded.scale, Math.max(0, position)), significant };
  }
  function parseExpression(expression, allowedOperators) {
    const cleaned = String(expression).trim().replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    const pattern = /^\s*([+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([+\-*/])\s*([+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*$/i;
    const match = cleaned.match(pattern);
    if (!match || !allowedOperators.includes(match[2])) throw new Error('Enter a valid expression with two numbers and a supported operator.');
    return { a: normalizeNumeric(match[1]), op: match[2], b: normalizeNumeric(match[3]) };
  }

  function divideDecimal(a, b) {
    if (b.coefficient === 0n) throw new Error('Division by zero is not allowed.');
    if (a.coefficient === 0n) return { coefficient: 0n, scale: 0 };
    const numerator = a.coefficient * pow10(b.scale);
    const denominator = b.coefficient * pow10(a.scale);
    const n = numerator < 0n ? -numerator : numerator;
    const d = denominator < 0n ? -denominator : denominator;
    let exponent = n.toString().length - d.toString().length;
    if (exponent >= 0 ? n < d * pow10(exponent) : n * pow10(-exponent) < d) exponent--;
    const decimalPlaces = DIVISION_PRECISION - 1 - exponent;
    if (decimalPlaces >= 0) return { coefficient: roundHalfUp(numerator * pow10(decimalPlaces), denominator), scale: decimalPlaces };
    return { coefficient: roundHalfUp(numerator, denominator * pow10(-decimalPlaces)), scale: decimalPlaces };
  }

  function calculate(mode, inputs) {
    const values = inputs || {};
    try {
      if (mode === 'count') {
        const raw = normalizeNumeric(values.number || '');
        if (!raw) throw new Error('Enter a number.');
        const count = significantCount(raw);
        return { ok: true, value: String(count), subtitle: 'significant figures', fullPrecision: raw, count: String(count) };
      }
      if (mode === 'round') {
        const raw = normalizeNumeric(values.number || '');
        const count = Number(values.target);
        if (!raw) throw new Error('Enter a number.');
        return { ok: true, value: roundToSig(raw, count), subtitle: count + ' significant figures', fullPrecision: raw, count: String(count) };
      }
      const allowed = mode === 'add' ? ['+', '-'] : mode === 'multiply' ? ['*', '/'] : [];
      if (!allowed.length) throw new Error('Choose a supported calculation mode.');
      const expression = parseExpression(values.expression || '', allowed);
      const a = parseDecimal(expression.a);
      const b = parseDecimal(expression.b);
      const count = Math.min(significantCount(expression.a), significantCount(expression.b));
      let result;
      if (expression.op === '+' || expression.op === '-') {
        const scale = Math.max(a.scale, b.scale);
        const av = a.coefficient * pow10(scale - a.scale);
        const bv = b.coefficient * pow10(scale - b.scale);
        result = { coefficient: expression.op === '+' ? av + bv : av - bv, scale };
      } else if (expression.op === '*') {
        result = { coefficient: a.coefficient * b.coefficient, scale: a.scale + b.scale };
      } else {
        result = divideDecimal(a, b);
      }
      const fullPrecision = formatDecimal(result.coefficient, result.scale);
      if (mode === 'add') {
        const position = Math.min(decimalPlacePosition(expression.a), decimalPlacePosition(expression.b));
        const rounded = roundToScale(result, position);
        const significant = result.coefficient === 0n ? 1 : Math.max(1, decimalExponent(rounded) + position + 1);
        const subtitle = position < 0 ? 'rounded to nearest ' + (10 ** (-position)).toLocaleString('en-US') : position === 0 ? 'rounded to the nearest whole number' : 'rounded to ' + position + ' decimal place' + (position === 1 ? '' : 's');
        let displayValue = formatDecimal(rounded.coefficient, rounded.scale, Math.max(0, position));
        if (rounded.coefficient !== 0n && position < 0) {
          const exponent = decimalExponent(rounded);
          const digits = (rounded.coefficient < 0n ? -rounded.coefficient : rounded.coefficient).toString();
          const mantissa = digits.length === 1 ? digits : digits[0] + '.' + digits.slice(1);
          displayValue = (rounded.coefficient < 0n ? '-' : '') + mantissa + 'e' + (exponent >= 0 ? '+' : '') + exponent;
        }
        return { ok: true, value: displayValue, subtitle, fullPrecision, count: String(significant) };
      }
      return { ok: true, value: roundDecimalToSig(result, count), subtitle: count + ' significant figures', fullPrecision, count: String(count) };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : 'Unable to calculate this value.' };
    }
  }
  function execute(request) {
    const input = request || {};
    const mode = input.operation;
    const result = calculate(mode, input.params || {});
    if (!result.ok) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: result.error } };
    }
    const { ok, ...data } = result;
    return { ok: true, data };
  }

  return Object.freeze({
    contractVersion: 1,
    execute,
    normalizeNumeric,
    significantCount,
    formatForSig,
    roundToSig,
    parseExpression,
    decimalPlacePosition,
    roundAtDecimalPosition,
    calculate
  });
});
