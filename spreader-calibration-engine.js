(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZemToolsSpreaderEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const AREA_UNITS = Object.freeze({
    'ft2': 0.09290304,
    'm2': 1,
    'acre': 4046.8564224,
    'ha': 10000
  });
  const WEIGHT_TO_KG = Object.freeze({
    kg: 1,
    g: 0.001,
    lb: 0.45359237,
    oz: 0.028349523125
  });
  const RATE_UNITS = Object.freeze({
    'lb-1000ft2': { massToKg: WEIGHT_TO_KG.lb, areaM2: 92.90304, label: 'lb / 1,000 sq ft' },
    'lb-acre': { massToKg: WEIGHT_TO_KG.lb, areaM2: AREA_UNITS.acre, label: 'lb / acre' },
    'kg-100m2': { massToKg: 1, areaM2: 100, label: 'kg / 100 m²' },
    'kg-ha': { massToKg: 1, areaM2: AREA_UNITS.ha, label: 'kg / hectare' }
  });

  function number(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function areaToM2(value, unit) {
    if (!AREA_UNITS[unit]) return null;
    return value * AREA_UNITS[unit];
  }

  function weightToKg(value, unit) {
    if (!WEIGHT_TO_KG[unit]) return null;
    return value * WEIGHT_TO_KG[unit];
  }

  function rateToKgPerM2(value, unit) {
    const definition = RATE_UNITS[unit];
    if (!definition) return null;
    return value * definition.massToKg / definition.areaM2;
  }

  function kgPerM2ToRate(value, unit) {
    const definition = RATE_UNITS[unit];
    if (!definition) return null;
    return value * definition.areaM2 / definition.massToKg;
  }

  function round(value, places) {
    const factor = Math.pow(10, places === undefined ? 6 : places);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function invalid(code, message) {
    return { ok: false, error: { code: code, message: message } };
  }

  function calculate(request) {
    const input = request || {};
    const type = input.spreaderType;
    const method = input.method;
    const allowedMethods = type === 'drop'
      ? ['before-after', 'drop-catch', 'sweep-weigh']
      : type === 'rotary'
        ? ['before-after', 'rotary-center-pan']
        : [];

    if (!allowedMethods.length || allowedMethods.indexOf(method) === -1) {
      return invalid('INVALID_METHOD', 'Choose a calibration method that matches the selected spreader type.');
    }

    const rateValue = number(input.targetRate);
    const rateUnit = RATE_UNITS[input.rateUnit];
    const tolerance = number(input.tolerancePercent);
    const applicationPasses = number(input.applicationPasses);
    const dimensionUnit = input.dimensionUnit;
    const dimensionFactor = dimensionUnit === 'ft' ? 0.3048 : dimensionUnit === 'm' ? 1 : null;
    const weightUnit = input.weightUnit;
    const weightFactor = WEIGHT_TO_KG[weightUnit];

    if (rateValue === null || rateValue <= 0 || !rateUnit) {
      return invalid('INVALID_TARGET_RATE', 'Enter a positive target rate and choose a supported rate unit.');
    }
    if (tolerance === null || tolerance < 0 || tolerance > 50) {
      return invalid('INVALID_TOLERANCE', 'Tolerance must be between 0% and 50%.');
    }
    if (!Number.isInteger(applicationPasses) || applicationPasses < 1 || applicationPasses > 2) {
      return invalid('INVALID_APPLICATION_PASSES', 'Choose one or two planned application passes.');
    }
    if (type === 'drop' && applicationPasses !== 1) {
      return invalid('INVALID_APPLICATION_PASSES', 'Drop-spreader mode uses one calibration pass in this calculator.');
    }
    if (!dimensionFactor || !weightFactor) {
      return invalid('INVALID_UNITS', 'Choose supported distance and weight units.');
    }

    let fullTargetRate = rateValue;
    let targetBasis = 'product';
    let nitrogenPercent = null;
    if (input.targetBasis === 'nitrogen') {
      nitrogenPercent = number(input.nitrogenPercent);
      if (nitrogenPercent === null || nitrogenPercent <= 0 || nitrogenPercent > 100) {
        return invalid('INVALID_NITROGEN_PERCENT', 'Enter the first nutrient percentage from the product label (greater than 0 and no more than 100).');
      }
      fullTargetRate = rateValue / (nitrogenPercent / 100);
      targetBasis = 'nitrogen';
    }

    const fullTargetKgPerM2 = rateToKgPerM2(fullTargetRate, input.rateUnit);
    const perPassTargetKgPerM2 = fullTargetKgPerM2 / applicationPasses;
    const perPassTargetRate = kgPerM2ToRate(perPassTargetKgPerM2, input.rateUnit);

    let effectiveAreaM2 = null;
    let materialAppliedKg = null;
    let testDescription = '';
    let calibrationPasses = null;

    if (method === 'before-after') {
      const width = number(input.testWidth);
      const length = number(input.testLength);
      const startingWeight = number(input.startingWeight);
      const remainingWeight = number(input.remainingWeight);
      if ([width, length, startingWeight, remainingWeight].some(value => value === null) ||
          width <= 0 || length <= 0 || startingWeight <= 0 || remainingWeight < 0) {
        return invalid('INVALID_TEST_INPUTS', 'Enter positive test dimensions and valid starting and remaining weights.');
      }
      if (remainingWeight > startingWeight) {
        return invalid('REMAINING_EXCEEDS_START', 'Remaining weight cannot be greater than the starting weight.');
      }
      effectiveAreaM2 = width * dimensionFactor * length * dimensionFactor;
      materialAppliedKg = weightToKg(startingWeight - remainingWeight, weightUnit);
      testDescription = 'Hopper weight before and after over one measured test lane';
    } else if (method === 'drop-catch' || method === 'sweep-weigh') {
      const width = number(input.testWidth);
      const length = number(input.testLength);
      const collectedWeight = number(input.collectedWeight);
      if ([width, length, collectedWeight].some(value => value === null) ||
          width <= 0 || length <= 0 || collectedWeight <= 0) {
        return invalid('INVALID_TEST_INPUTS', 'Enter positive collection dimensions and a collected weight greater than zero.');
      }
      effectiveAreaM2 = width * dimensionFactor * length * dimensionFactor;
      materialAppliedKg = weightToKg(collectedWeight, weightUnit);
      testDescription = method === 'drop-catch'
        ? 'Full-width drop-spreader catch pan over a measured test lane'
        : 'Material swept and weighed from a measured clean surface';
    } else if (method === 'rotary-center-pan') {
      const panArea = number(input.panArea);
      const panUnit = input.panAreaUnit;
      const passes = number(input.collectionPasses);
      const collectedWeight = number(input.collectedWeight);
      if (panArea === null || panArea <= 0 || !AREA_UNITS[panUnit] ||
          !Number.isInteger(passes) || passes < 1 || passes > 20 ||
          collectedWeight === null || collectedWeight <= 0) {
        return invalid('INVALID_TEST_INPUTS', 'Enter a positive center-pan area, collected weight and a whole number of collection passes (1–20).');
      }
      effectiveAreaM2 = areaToM2(panArea, panUnit) * passes;
      materialAppliedKg = weightToKg(collectedWeight, weightUnit);
      calibrationPasses = passes;
      testDescription = 'Material collected in the center pan over repeated rotary-spreader passes';
    }

    if (!Number.isFinite(effectiveAreaM2) || effectiveAreaM2 <= 0 ||
        !Number.isFinite(materialAppliedKg) || materialAppliedKg <= 0) {
      return invalid('INVALID_MEASUREMENTS', 'The measured area and applied material must both be greater than zero.');
    }

    const actualKgPerM2 = materialAppliedKg / effectiveAreaM2;
    const actualRate = kgPerM2ToRate(actualKgPerM2, input.rateUnit);
    const variancePercent = ((actualKgPerM2 - perPassTargetKgPerM2) / perPassTargetKgPerM2) * 100;
    const status = Math.abs(variancePercent) <= tolerance
      ? 'within'
      : variancePercent > 0 ? 'over' : 'under';
    const targetTestWeightKg = perPassTargetKgPerM2 * effectiveAreaM2;

    const lawnAreaValue = number(input.lawnArea);
    const lawnAreaUnit = input.lawnAreaUnit;
    const lawnAreaM2 = lawnAreaValue === null ? null : areaToM2(lawnAreaValue, lawnAreaUnit);
    let totalProductKg = null;
    let totalProductWeightUnit = null;
    let totalProductWeight = null;
    let bagCount = null;
    let bagSizeKg = null;

    if (lawnAreaValue !== null) {
      if (lawnAreaValue <= 0 || !Number.isFinite(lawnAreaM2) || !WEIGHT_TO_KG[input.bagUnit || weightUnit]) {
        return invalid('INVALID_LAWN_AREA', 'Enter a positive lawn area and choose a supported area and package-weight unit.');
      }
      totalProductKg = fullTargetKgPerM2 * lawnAreaM2;
      totalProductWeightUnit = input.bagUnit || weightUnit;
      totalProductWeight = totalProductKg / WEIGHT_TO_KG[totalProductWeightUnit];
      const bagSize = number(input.bagSize);
      if (bagSize !== null) {
        if (bagSize <= 0) {
          return invalid('INVALID_BAG_SIZE', 'Package size must be greater than zero, or leave it blank.');
        }
        bagSizeKg = weightToKg(bagSize, totalProductWeightUnit);
        const exactBags = totalProductKg / bagSizeKg;
        const nearest = Math.round(exactBags);
        const safeCeil = Math.abs(exactBags - nearest) < 1e-10 ? nearest : Math.ceil(exactBags);
        bagCount = safeCeil;
      }
    } else if (input.lawnArea !== '' && input.lawnArea !== null && input.lawnArea !== undefined) {
      return invalid('INVALID_LAWN_AREA', 'Enter a valid positive lawn area.');
    }

    const targetTestWeight = targetTestWeightKg / weightFactor;
    return {
      ok: true,
      data: {
        spreaderType: type,
        method: method,
        targetBasis: targetBasis,
        nitrogenPercent: nitrogenPercent,
        targetInputRate: rateValue,
        targetFullRate: round(fullTargetRate),
        targetPerPassRate: round(perPassTargetRate),
        actualRate: round(actualRate),
        rateUnit: input.rateUnit,
        rateLabel: rateUnit.label,
        tolerancePercent: tolerance,
        variancePercent: round(variancePercent, 2),
        status: status,
        plannedApplicationPasses: applicationPasses,
        calibrationPasses: calibrationPasses,
        effectiveAreaM2: round(effectiveAreaM2, 6),
        materialApplied: round(materialAppliedKg / weightFactor, 6),
        materialWeightUnit: weightUnit,
        targetTestWeight: round(targetTestWeight, 6),
        testDescription: testDescription,
        lawnArea: lawnAreaValue,
        lawnAreaUnit: lawnAreaUnit || null,
        totalProduct: totalProductWeight === null ? null : round(totalProductWeight, 4),
        totalProductWeightUnit: totalProductWeightUnit,
        bagSize: number(input.bagSize),
        bagCount: bagCount
      }
    };
  }

  function execute(request) {
    return calculate(request);
  }

  return Object.freeze({
    contractVersion: 1,
    execute: execute,
    calculate: calculate,
    areaToM2: areaToM2,
    weightToKg: weightToKg,
    rateToKgPerM2: rateToKgPerM2,
    kgPerM2ToRate: kgPerM2ToRate,
    round: round,
    rateUnits: RATE_UNITS
  });
});
