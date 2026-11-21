(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZemToolsTeaOutturnEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const UNIT_TO_KG = Object.freeze({ kg: 1, t: 1000, lb: 0.45359237 });

  function failure(code, message) {
    return { ok: false, error: { code, message } };
  }

  function isSupportedUnit(unit) {
    return Object.prototype.hasOwnProperty.call(UNIT_TO_KG, unit);
  }

  function parseWeight(value, unit, label, optional) {
    if (!isSupportedUnit(unit)) {
      return { ok: false, error: { code: 'INVALID_UNIT', message: 'Choose kg, tonnes or lb as the weight unit.' } };
    }
    const raw = value === null || value === undefined ? '' : String(value).trim();
    if (optional && raw === '') return { ok: true, valueKg: null };
    const number = Number(raw);
    if (!Number.isFinite(number) || number <= 0 || number > 1e12) {
      return { ok: false, error: { code: 'INVALID_WEIGHT', message: label + ' must be a positive number greater than zero.' } };
    }
    const valueKg = number * UNIT_TO_KG[unit];
    if (!Number.isFinite(valueKg) || valueKg <= 0) {
      return { ok: false, error: { code: 'INVALID_WEIGHT', message: label + ' is outside the supported calculation range.' } };
    }
    return { ok: true, valueKg };
  }

  function fromKg(valueKg, unit) {
    return valueKg / UNIT_TO_KG[unit];
  }

  function calculateActual(input) {
    const values = input || {};
    const unit = values.unit || 'kg';
    const green = parseWeight(values.greenLeaf, unit, 'Green leaf weight', false);
    if (!green.ok) return green;
    const made = parseWeight(values.madeTea, unit, 'Made tea weight', false);
    if (!made.ok) return made;
    const fired = parseWeight(values.firedTea, unit, 'Fired tea weight', true);
    if (!fired.ok) return fired;

    const tolerance = Math.max(1e-9, green.valueKg * 1e-10);
    if (made.valueKg > green.valueKg + tolerance) {
      return failure('MADE_TEA_EXCEEDS_GREEN_LEAF', 'Made tea weight cannot exceed the green leaf weight for the same batch. Check the units and batch figures.');
    }
    if (fired.valueKg !== null && fired.valueKg > green.valueKg + tolerance) {
      return failure('FIRED_TEA_EXCEEDS_GREEN_LEAF', 'Fired tea weight cannot exceed the green leaf weight for the same batch. Check the units and batch figures.');
    }

    const ratio = green.valueKg / made.valueKg;
    const warning = fired.valueKg !== null && fired.valueKg + tolerance < made.valueKg
      ? 'The fired-tea figure is below the made-tea figure. Check that both weights use your factory’s intended production-stage definitions.'
      : null;

    return {
      ok: true,
      data: {
        unit,
        greenLeaf: fromKg(green.valueKg, unit),
        madeTea: fromKg(made.valueKg, unit),
        firedTea: fired.valueKg === null ? null : fromKg(fired.valueKg, unit),
        greenLeafKg: green.valueKg,
        madeTeaKg: made.valueKg,
        firedTeaKg: fired.valueKg,
        netOutturnPercent: (made.valueKg / green.valueKg) * 100,
        grossOutturnPercent: fired.valueKg === null ? null : (fired.valueKg / green.valueKg) * 100,
        greenLeafPerMadeTea: ratio,
        warning
      }
    };
  }

  function calculatePlan(input) {
    const values = input || {};
    const unit = values.unit || 'kg';
    const target = parseWeight(values.targetMadeTea, unit, 'Target made tea weight', false);
    if (!target.ok) return target;

    const rawOutturn = values.outturnPercent === null || values.outturnPercent === undefined
      ? ''
      : String(values.outturnPercent).trim();
    const outturn = Number(rawOutturn);
    if (!Number.isFinite(outturn) || outturn <= 0 || outturn > 100) {
      return failure('INVALID_OUTTURN', 'Expected net outturn must be greater than 0% and no more than 100%. Enter the rate you intend to use.');
    }

    const requiredGreenLeafKg = target.valueKg / (outturn / 100);
    if (!Number.isFinite(requiredGreenLeafKg) || requiredGreenLeafKg <= 0) {
      return failure('INVALID_PLAN', 'The requested batch is outside the supported calculation range.');
    }

    return {
      ok: true,
      data: {
        unit,
        targetMadeTea: fromKg(target.valueKg, unit),
        requiredGreenLeaf: fromKg(requiredGreenLeafKg, unit),
        targetMadeTeaKg: target.valueKg,
        requiredGreenLeafKg,
        outturnPercent: outturn,
        greenLeafPerMadeTea: 100 / outturn
      }
    };
  }

  function execute(request) {
    const input = request || {};
    if (input.operation === 'actual') return calculateActual(input);
    if (input.operation === 'plan') return calculatePlan(input);
    return failure('INVALID_OPERATION', 'Choose actual batch calculation or production planning.');
  }

  return Object.freeze({
    contractVersion: 1,
    execute,
    calculateActual,
    calculatePlan,
    isSupportedUnit
  });
});
