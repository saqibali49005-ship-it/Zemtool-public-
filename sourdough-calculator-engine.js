(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZemToolsSourdoughEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const UNITS_TO_GRAMS = Object.freeze({ g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 });

  function numeric(value, label, options) {
    const n = Number(value);
    const opts = options || {};
    if (!Number.isFinite(n) || (opts.min !== undefined && n < opts.min) ||
        (opts.max !== undefined && n > opts.max)) {
      throw new Error(label + ' is outside the accepted range.');
    }
    return n;
  }

  function toGrams(value, unit) {
    const factor = UNITS_TO_GRAMS[unit];
    if (!factor) throw new Error('Choose a supported weight unit.');
    return numeric(value, 'Weight', { min: 0 }) * factor;
  }

  function fromGrams(value, unit) {
    const factor = UNITS_TO_GRAMS[unit];
    if (!factor) throw new Error('Choose a supported weight unit.');
    return value / factor;
  }

  function normaliseRows(rows, kind) {
    if (!Array.isArray(rows)) throw new Error('Ingredient rows must be a list.');
    return rows.map((row, index) => {
      const name = String(row && row.name || (kind.indexOf('flour') === 0 ? 'Flour ' : 'Liquid ') + (index + 1)).trim().slice(0, 48);
      if (kind === 'flour-share') {
        const sharePct = numeric(row && row.sharePct, name + ' flour share', { min: 0, max: 100 });
        return { name: name || 'Flour ' + (index + 1), sharePct };
      }
      const mass = numeric(row && row.mass, name + ' weight', { min: 0, max: 100000000 });
      if (kind === 'flour') {
        const sharePct = numeric(row && row.sharePct === undefined ? 100 : row.sharePct, name + ' flour share', { min: 0, max: 100 });
        return { name: name || 'Flour ' + (index + 1), mass, sharePct };
      }
      const waterFraction = numeric(row && row.waterFraction, name + ' water fraction', { min: 0, max: 1 });
      return { name: name || 'Liquid ' + (index + 1), mass, waterFraction, waterMass: mass * waterFraction, dryMass: mass * (1 - waterFraction) };
    });
  }

  function splitStarter(starterMass, hydrationPct) {
    const h = hydrationPct / 100;
    const flour = starterMass / (1 + h);
    return { mass: starterMass, flour, water: starterMass - flour, hydrationPct };
  }

  function sum(rows, key) {
    return rows.reduce((total, row) => total + row[key], 0);
  }

  function calculateBuild(input) {
    const x = input || {};
    const hydrationPct = numeric(x.hydrationPct, 'Target hydration', { min: 0, max: 300 });
    const starterHydrationPct = numeric(x.starterHydrationPct, 'Starter hydration', { min: 0, max: 500 });
    const starterPct = numeric(x.starterPct, 'Starter percentage', { min: 0, max: 100 });
    const saltPct = numeric(x.saltPct, 'Salt percentage', { min: 0, max: 20 });
    const flours = normaliseRows(x.flours, 'flour-share');
    if (!flours.length || flours.every(row => row.sharePct === 0)) throw new Error('Add at least one flour and give it a share.');
    const shareTotal = sum(flours, 'sharePct');
    if (Math.abs(shareTotal - 100) > 0.001) throw new Error('Flour shares must add up to exactly 100%.');
    const liquids = normaliseRows(x.liquids || [], 'liquid');
    const liquidWater = sum(liquids, 'waterMass');
    const liquidDry = sum(liquids, 'dryMass');
    const saltRatio = saltPct / 100;
    const hydrationRatio = hydrationPct / 100;

    let totalFlour;
    if (x.basis === 'total-dough') {
      const targetDough = numeric(x.targetAmount, 'Target dough weight', { min: 1, max: 100000000 });
      totalFlour = (targetDough - liquidDry) / (1 + hydrationRatio + saltRatio);
      if (!(totalFlour > 0)) throw new Error('Target dough weight is too small for the selected ingredients.');
    } else if (x.basis === 'added-flour') {
      const addedFlourTarget = numeric(x.targetAmount, 'Added flour weight', { min: 1, max: 100000000 });
      const starterFlourFraction = (starterPct / 100) / (1 + starterHydrationPct / 100);
      const addedFlourFraction = 1 - starterFlourFraction;
      if (!(addedFlourFraction > 0)) throw new Error('The selected starter amount leaves no flour to add. Reduce starter percentage or change starter hydration.');
      totalFlour = addedFlourTarget / addedFlourFraction;
    } else {
      totalFlour = numeric(x.targetAmount, 'Total flour weight', { min: 1, max: 100000000 });
    }

    const starterMass = totalFlour * starterPct / 100;
    const starter = splitStarter(starterMass, starterHydrationPct);
    const flourToAdd = totalFlour - starter.flour;
    const waterToAdd = totalFlour * hydrationRatio - starter.water - liquidWater;
    if (flourToAdd < -1e-8) throw new Error('Starter contributes more flour than the selected total flour.');
    if (waterToAdd < -1e-8) throw new Error('The starter and added liquids already exceed the target hydration. Reduce them or increase target hydration.');
    const saltMass = totalFlour * saltRatio;
    const flourRows = flours.map(row => ({
      name: row.name,
      sharePct: row.sharePct,
      mass: flourToAdd * row.sharePct / 100
    }));

    return {
      basis: x.basis === 'total-dough' ? 'total-dough' : (x.basis === 'added-flour' ? 'added-flour' : 'total-flour'),
      totalFlour,
      targetHydrationPct: hydrationPct,
      trueHydrationPct: hydrationPct,
      starterPct,
      starterHydrationPct,
      starter,
      flourToAdd,
      flourRows,
      waterToAdd,
      liquidRows: liquids,
      liquidWater,
      liquidDry,
      totalWater: totalFlour * hydrationRatio,
      saltPct,
      saltMass,
      totalDough: totalFlour * (1 + hydrationRatio + saltRatio) + liquidDry,
      prefermentedFlourPct: totalFlour ? starter.flour / totalFlour * 100 : 0,
      totalIngredients: flourToAdd + waterToAdd + starterMass + saltMass + sum(liquids, 'mass')
    };
  }

  function calculateCheck(input) {
    const x = input || {};
    const flours = normaliseRows((x.flours && x.flours.length) ? x.flours : [{ name: 'Flour', mass: x.flour, sharePct: 100 }], 'flour');
    const flourAdded = sum(flours, 'mass');
    if (flourAdded <= 0) throw new Error('Enter at least some flour.');
    const waterAdded = numeric(x.water, 'Added water', { min: 0, max: 100000000 });
    const starterMass = numeric(x.starterMass || 0, 'Starter weight', { min: 0, max: 100000000 });
    const starterHydrationPct = numeric(x.starterHydrationPct === undefined ? 100 : x.starterHydrationPct, 'Starter hydration', { min: 0, max: 500 });
    const saltMass = numeric(x.saltMass || 0, 'Salt weight', { min: 0, max: 100000000 });
    const liquids = normaliseRows(x.liquids || [], 'liquid');
    const starter = splitStarter(starterMass, starterHydrationPct);
    const totalFlour = flourAdded + starter.flour;
    const liquidWater = sum(liquids, 'waterMass');
    const liquidDry = sum(liquids, 'dryMass');
    const totalWater = waterAdded + starter.water + liquidWater;
    const totalDough = flourAdded + waterAdded + starterMass + saltMass + sum(liquids, 'mass');
    return {
      flourAdded,
      flourRows: flours,
      waterAdded,
      starter,
      starterPct: totalFlour ? starterMass / totalFlour * 100 : 0,
      prefermentedFlourPct: totalFlour ? starter.flour / totalFlour * 100 : 0,
      totalFlour,
      totalWater,
      trueHydrationPct: totalFlour ? totalWater / totalFlour * 100 : null,
      addedWaterHydrationPct: flourAdded ? waterAdded / flourAdded * 100 : null,
      saltMass,
      saltPct: totalFlour ? saltMass / totalFlour * 100 : 0,
      liquidRows: liquids,
      liquidWater,
      liquidDry,
      totalDough
    };
  }

  function calculateFeed(input) {
    const x = input || {};
    const targetMass = numeric(x.targetMass, 'Target starter weight', { min: 0.01, max: 100000000 });
    const seedRatio = numeric(x.seedRatio, 'Seed ratio', { min: 0.0001, max: 10000 });
    const flourRatio = numeric(x.flourRatio, 'Flour ratio', { min: 0.0001, max: 10000 });
    const waterRatio = numeric(x.waterRatio, 'Water ratio', { min: 0.0001, max: 10000 });
    const seedHydrationPct = numeric(x.seedHydrationPct === undefined ? 100 : x.seedHydrationPct, 'Seed starter hydration', { min: 0, max: 500 });
    const totalRatio = seedRatio + flourRatio + waterRatio;
    const seed = targetMass * seedRatio / totalRatio;
    const flour = targetMass * flourRatio / totalRatio;
    const water = targetMass * waterRatio / totalRatio;
    const seedParts = splitStarter(seed, seedHydrationPct);
    const totalFlour = flour + seedParts.flour;
    const totalWater = water + seedParts.water;
    return {
      targetMass, seed, flour, water, seedHydrationPct,
      seedFlour: seedParts.flour,
      seedWater: seedParts.water,
      totalFlour,
      totalWater,
      resultingHydrationPct: totalFlour ? totalWater / totalFlour * 100 : null,
      ratio: [seedRatio, flourRatio, waterRatio]
    };
  }

  function scaleRecipe(input) {
    const x = input || {};
    const recipe = x.recipe || {};
    const multiplier = x.targetDoughMass !== undefined
      ? numeric(x.targetDoughMass, 'Target dough weight', { min: 0.01, max: 100000000 }) / numeric(recipe.totalDough, 'Original dough weight', { min: 0.01 })
      : numeric(x.multiplier === undefined ? 1 : x.multiplier, 'Scale multiplier', { min: 0.01, max: 10000 });
    return {
      multiplier,
      targetDoughMass: numeric(recipe.totalDough, 'Original dough weight', { min: 0.01 }) * multiplier,
      ingredients: (recipe.ingredients || []).map(item => ({
        name: String(item.name || 'Ingredient'),
        mass: numeric(item.mass, 'Ingredient weight', { min: 0 }) * multiplier
      }))
    };
  }

  function execute(request) {
    try {
      const x = request || {};
      let data;
      if (x.operation === 'build-recipe') data = calculateBuild(x);
      else if (x.operation === 'check-recipe') data = calculateCheck(x);
      else if (x.operation === 'feed-starter') data = calculateFeed(x);
      else if (x.operation === 'scale-recipe') data = scaleRecipe(x);
      else return { ok: false, error: { code: 'INVALID_OPERATION', message: 'Choose a supported sourdough calculation.' } };
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: error instanceof Error ? error.message : 'Check the entered values.' } };
    }
  }

  return Object.freeze({
    contractVersion: 1,
    UNITS_TO_GRAMS,
    toGrams,
    fromGrams,
    splitStarter,
    calculateBuild,
    calculateCheck,
    calculateFeed,
    scaleRecipe,
    execute
  });
});
