(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZemToolsRaisedBedSoilEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LENGTH_TO_M = Object.freeze({
    m: 1, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254
  });
  const MAX_BEDS = 30;
  const MAX_INGREDIENTS = 8;

  function number(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function round(value, places = 10) {
    const factor = Math.pow(10, places);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
  function invalid(code, message) {
    return { ok: false, error: { code, message } };
  }
  function toMetres(value, unit) {
    return LENGTH_TO_M[unit] ? value * LENGTH_TO_M[unit] : null;
  }

  function calculateProject(input) {
    if (!input || typeof input !== 'object') {
      return invalid('INPUT', 'Enter your bed measurements and soil-mix details.');
    }
    const system = input.system || 'imperial';
    if (system !== 'imperial' && system !== 'metric') {
      return invalid('UNITS', 'Choose Imperial or Metric units.');
    }
    const lengthUnit = system === 'imperial' ? 'ft' : 'm';
    const depthUnit = system === 'imperial' ? 'in' : 'cm';
    const beds = Array.isArray(input.beds) ? input.beds : [];
    const ingredients = Array.isArray(input.ingredients) ? input.ingredients : [];
    if (!beds.length || beds.length > MAX_BEDS) {
      return invalid('BEDS', 'Add between 1 and ' + MAX_BEDS + ' beds to calculate a project.');
    }
    if (!ingredients.length || ingredients.length > MAX_INGREDIENTS) {
      return invalid('INGREDIENTS', 'Use between 1 and ' + MAX_INGREDIENTS + ' mix ingredients.');
    }

    const bedResults = [];
    let totalAreaM2 = 0;
    let targetVolumeM3 = 0;
    let existingVolumeM3 = 0;
    let newMixVolumeM3 = 0;

    for (let i = 0; i < beds.length; i++) {
      const bed = beds[i] || {};
      const name = String(bed.name || ('Bed ' + (i + 1))).trim().slice(0, 60) || ('Bed ' + (i + 1));
      const shape = bed.shape || 'rectangle';
      const count = number(bed.count);
      if (count === null || !Number.isInteger(count) || count < 1 || count > 100) {
        return invalid('BED_COUNT', name + ': enter a whole number of matching beds from 1 to 100.');
      }

      let areaM2;
      let lengthM = null;
      let widthM = null;
      let diameterM = null;
      if (shape === 'rectangle') {
        const length = number(bed.length);
        const width = number(bed.width);
        if (length === null || width === null || length <= 0 || width <= 0) {
          return invalid('BED_DIMENSIONS', name + ': enter positive inside length and width.');
        }
        lengthM = toMetres(length, lengthUnit);
        widthM = toMetres(width, lengthUnit);
        areaM2 = lengthM * widthM;
      } else if (shape === 'circle') {
        const diameter = number(bed.diameter);
        if (diameter === null || diameter <= 0) {
          return invalid('BED_DIAMETER', name + ': enter a positive inside diameter.');
        }
        diameterM = toMetres(diameter, lengthUnit);
        areaM2 = Math.PI * diameterM * diameterM / 4;
      } else {
        return invalid('BED_SHAPE', name + ': choose rectangle or circle.');
      }

      const depth = number(bed.depth);
      const existing = number(bed.existingDepth === undefined ? 0 : bed.existingDepth);
      if (depth === null || depth <= 0) {
        return invalid('BED_DEPTH', name + ': enter a target fill depth greater than zero.');
      }
      if (existing === null || existing < 0 || existing > depth) {
        return invalid('EXISTING_DEPTH', name + ': existing fill must be zero or greater and cannot exceed target depth.');
      }
      const targetDepthM = toMetres(depth, depthUnit);
      const existingDepthM = toMetres(existing, depthUnit);
      const bedTargetM3 = areaM2 * targetDepthM * count;
      const bedExistingM3 = areaM2 * existingDepthM * count;
      const bedNewM3 = Math.max(0, bedTargetM3 - bedExistingM3);

      if (![areaM2, bedTargetM3, bedExistingM3, bedNewM3].every(Number.isFinite) ||
          areaM2 <= 0 || areaM2 > 1000000 || bedTargetM3 > 10000000) {
        return invalid('RANGE', name + ': measurements are outside the supported planning range.');
      }

      totalAreaM2 += areaM2 * count;
      targetVolumeM3 += bedTargetM3;
      existingVolumeM3 += bedExistingM3;
      newMixVolumeM3 += bedNewM3;
      bedResults.push({
        name, shape, count, areaM2,
        targetVolumeM3: bedTargetM3,
        existingVolumeM3: bedExistingM3,
        newMixVolumeM3: bedNewM3,
        lengthM, widthM, diameterM,
        targetDepthM, existingDepthM
      });
    }

    let ratioTotal = 0;
    const checkedIngredients = [];
    for (let i = 0; i < ingredients.length; i++) {
      const ingredient = ingredients[i] || {};
      const name = String(ingredient.name || '').trim().slice(0, 50);
      const percentage = number(ingredient.percentage);
      if (!name) return invalid('INGREDIENT_NAME', 'Give every mix ingredient a name.');
      if (percentage === null || percentage < 0 || percentage > 100) {
        return invalid('INGREDIENT_PERCENT', name + ': enter a percentage from 0 to 100.');
      }
      ratioTotal += percentage;
      const bagVolumeL = number(ingredient.bagVolumeL);
      const pricePerBag = number(ingredient.pricePerBag);
      if (bagVolumeL !== null && bagVolumeL <= 0) {
        return invalid('BAG_VOLUME', name + ': package volume must be greater than zero litres.');
      }
      if (pricePerBag !== null && pricePerBag < 0) {
        return invalid('BAG_PRICE', name + ': price cannot be negative.');
      }
      if (pricePerBag !== null && bagVolumeL === null) {
        return invalid('BAG_VOLUME', name + ': enter the labelled package volume before adding a bag price.');
      }
      checkedIngredients.push({ name, percentage, bagVolumeL, pricePerBag });
    }
    if (Math.abs(ratioTotal - 100) > 0.01) {
      return invalid('RATIO_TOTAL', 'Mix percentages must add up to 100%. They currently add up to ' + round(ratioTotal, 2) + '%.');
    }

    const currency = String(input.currency || 'USD').trim().slice(0, 10) || 'USD';
    let totalCost = 0;
    let pricedIngredients = 0;
    const ingredientResults = checkedIngredients.map((ingredient) => {
      const volumeM3 = newMixVolumeM3 * ingredient.percentage / 100;
      const volumeL = volumeM3 * 1000;
      const bags = ingredient.bagVolumeL === null
        ? null
        : (volumeL > 0 ? Math.ceil(volumeL / ingredient.bagVolumeL - 1e-10) : 0);
      const cost = ingredient.pricePerBag === null || bags === null ? null : round(bags * ingredient.pricePerBag, 2);
      if (cost !== null) {
        totalCost += cost;
        pricedIngredients += 1;
      }
      return {
        name: ingredient.name,
        percentage: ingredient.percentage,
        volumeM3: round(volumeM3, 10),
        volumeL: round(volumeL, 6),
        bagVolumeL: ingredient.bagVolumeL,
        bags,
        pricePerBag: ingredient.pricePerBag,
        cost
      };
    });

    const allPriced = ingredientResults.every(x => x.percentage === 0 || x.cost !== null);
    return {
      ok: true,
      data: {
        system, lengthUnit, depthUnit, currency,
        bedCount: bedResults.reduce((sum, bed) => sum + bed.count, 0),
        totalAreaM2: round(totalAreaM2, 10),
        targetVolumeM3: round(targetVolumeM3, 10),
        existingVolumeM3: round(existingVolumeM3, 10),
        newMixVolumeM3: round(newMixVolumeM3, 10),
        beds: bedResults,
        ingredients: ingredientResults,
        pricedIngredients,
        allPriced,
        totalCost: allPriced ? round(totalCost, 2) : null,
        ratioTotal: round(ratioTotal, 4)
      }
    };
  }

  return Object.freeze({
    calculateProject,
    MAX_BEDS,
    MAX_INGREDIENTS,
    round
  });
});
