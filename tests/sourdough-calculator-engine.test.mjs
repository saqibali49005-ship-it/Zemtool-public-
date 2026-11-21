import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../sourdough-calculator-engine.js');

assert.equal(engine.contractVersion, 1);
assert.equal(engine.toGrams(1, 'kg'), 1000);
assert.equal(engine.fromGrams(28.349523125, 'oz'), 1);
assert.equal(engine.fromGrams(453.59237, 'lb'), 1);
assert.throws(() => engine.toGrams(1, 'stone'), /supported weight unit/i);

const build75 = engine.calculateBuild({
  basis: 'total-flour', targetAmount: 500, hydrationPct: 75,
  starterPct: 20, starterHydrationPct: 100, saltPct: 2,
  flours: [{ name: 'Bread flour', sharePct: 100 }], liquids: []
});
assert.ok(Math.abs(build75.starter.mass - 100) < 1e-9);
assert.ok(Math.abs(build75.starter.flour - 50) < 1e-9);
assert.ok(Math.abs(build75.starter.water - 50) < 1e-9);
assert.ok(Math.abs(build75.flourToAdd - 450) < 1e-9);
assert.ok(Math.abs(build75.waterToAdd - 325) < 1e-9);
assert.ok(Math.abs(build75.saltMass - 10) < 1e-9);
assert.ok(Math.abs(build75.totalDough - 885) < 1e-9);
assert.ok(Math.abs(build75.trueHydrationPct - 75) < 1e-9);

const build70 = engine.calculateBuild({
  basis: 'total-flour', targetAmount: 500, hydrationPct: 70,
  starterPct: 20, starterHydrationPct: 100, saltPct: 2,
  flours: [{ name: 'Bread flour', sharePct: 100 }], liquids: []
});
assert.equal(build70.flourToAdd, 450);
assert.equal(build70.waterToAdd, 300);
assert.equal(build70.saltMass, 10);
assert.equal(build70.totalDough, 860);

// Non-100% starter hydration: 100 g starter at 150% = 40 g flour + 60 g water.
const split150 = engine.splitStarter(100, 150);
assert.equal(split150.flour, 40);
assert.equal(split150.water, 60);
const build150 = engine.calculateBuild({
  basis: 'total-flour', targetAmount: 500, hydrationPct: 75,
  starterPct: 20, starterHydrationPct: 150, saltPct: 2,
  flours: [{ name: 'Bread flour', sharePct: 100 }], liquids: []
});
assert.equal(build150.flourToAdd, 460);
assert.equal(build150.waterToAdd, 315);
assert.equal(build150.totalDough, 885);

// Multi-flour split is applied only to flour that must be added.
const multi = engine.calculateBuild({
  basis: 'total-flour', targetAmount: 500, hydrationPct: 75,
  starterPct: 20, starterHydrationPct: 100, saltPct: 2,
  flours: [{ name: 'Bread flour', sharePct: 70 }, { name: 'Whole wheat', sharePct: 30 }],
  liquids: []
});
assert.equal(multi.flourRows[0].mass, 315);
assert.equal(multi.flourRows[1].mass, 135);
assert.equal(multi.flourRows.reduce((s, r) => s + r.mass, 0), 450);

// Added milk/other liquid contributes only its declared water fraction to true hydration.
const withMilk = engine.calculateBuild({
  basis: 'total-flour', targetAmount: 500, hydrationPct: 75,
  starterPct: 20, starterHydrationPct: 100, saltPct: 2,
  flours: [{ name: 'Bread flour', sharePct: 100 }],
  liquids: [{ name: 'Milk', mass: 100, waterFraction: 0.87 }]
});
assert.ok(Math.abs(withMilk.waterToAdd - 238) < 1e-9);
assert.ok(Math.abs(withMilk.liquidWater - 87) < 1e-9);
assert.ok(Math.abs(withMilk.liquidDry - 13) < 1e-9);
assert.ok(Math.abs(withMilk.totalDough - 898) < 1e-9);

// Target-dough mode solves flour mass while retaining target hydration.
const targetDough = engine.calculateBuild({
  basis: 'total-dough', targetAmount: 885, hydrationPct: 75,
  starterPct: 20, starterHydrationPct: 100, saltPct: 2,
  flours: [{ name: 'Bread flour', sharePct: 100 }], liquids: []
});
assert.ok(Math.abs(targetDough.totalFlour - 500) < 1e-9);
assert.ok(Math.abs(targetDough.totalDough - 885) < 1e-9);

const fromAddedFlour = engine.calculateBuild({
  basis: 'added-flour', targetAmount: 450, hydrationPct: 75,
  starterPct: 20, starterHydrationPct: 100, saltPct: 2,
  flours: [{ name: 'Bread flour', sharePct: 100 }], liquids: []
});
assert.ok(Math.abs(fromAddedFlour.totalFlour - 500) < 1e-9);
assert.ok(Math.abs(fromAddedFlour.starter.mass - 100) < 1e-9);
assert.ok(Math.abs(fromAddedFlour.flourToAdd - 450) < 1e-9);
assert.ok(Math.abs(fromAddedFlour.waterToAdd - 325) < 1e-9);

const checked = engine.calculateCheck({
  flours: [{ name: 'Bread flour', mass: 450, sharePct: 100 }],
  water: 325, starterMass: 100, starterHydrationPct: 100, saltMass: 10, liquids: []
});
assert.equal(checked.totalFlour, 500);
assert.equal(checked.totalWater, 375);
assert.equal(checked.trueHydrationPct, 75);
assert.equal(checked.starterPct, 20);
assert.equal(checked.prefermentedFlourPct, 10);
assert.equal(checked.saltPct, 2);
assert.equal(checked.totalDough, 885);

// Starter feeding: 1:2:2 for 250 g total gives 50 g seed + 100 g flour + 100 g water.
const feed = engine.calculateFeed({ targetMass: 250, seedRatio: 1, flourRatio: 2, waterRatio: 2 });
assert.equal(feed.seed, 50);
assert.equal(feed.flour, 100);
assert.equal(feed.water, 100);
assert.equal(feed.seedFlour, 25);
assert.equal(feed.seedWater, 25);
assert.equal(feed.totalFlour, 125);
assert.equal(feed.totalWater, 125);
assert.equal(feed.resultingHydrationPct, 100);

const feed150Seed = engine.calculateFeed({
  targetMass: 250, seedRatio: 1, flourRatio: 2, waterRatio: 2, seedHydrationPct: 150
});
assert.equal(feed150Seed.seedFlour, 20);
assert.equal(feed150Seed.seedWater, 30);
assert.equal(feed150Seed.totalFlour, 120);
assert.equal(feed150Seed.totalWater, 130);
assert.ok(Math.abs(feed150Seed.resultingHydrationPct - (130 / 120 * 100)) < 1e-9);

// Scale an ingredient list either by multiplier or target total dough weight.
const scaled = engine.scaleRecipe({
  recipe: { totalDough: 885, ingredients: [{ name: 'Flour', mass: 450 }, { name: 'Water', mass: 325 }, { name: 'Starter', mass: 100 }, { name: 'Salt', mass: 10 }] },
  multiplier: 2
});
assert.equal(scaled.targetDoughMass, 1770);
assert.equal(scaled.ingredients[0].mass, 900);
const targetScaled = engine.scaleRecipe({
  recipe: { totalDough: 885, ingredients: [{ name: 'Dough', mass: 885 }] },
  targetDoughMass: 442.5
});
assert.equal(targetScaled.multiplier, 0.5);
assert.equal(targetScaled.targetDoughMass, 442.5);

// Input validation for negative weights, invalid ranges, zero/oversized recipe and wrong flour shares.
assert.equal(engine.execute({ operation: 'build-recipe', targetAmount: 500, hydrationPct: 500 }).ok, false);
assert.equal(engine.execute({ operation: 'build-recipe', basis: 'total-flour', targetAmount: 500, hydrationPct: 75,
  starterPct: 20, starterHydrationPct: 100, saltPct: 2, flours: [{ name: 'A', sharePct: 70 }, { name: 'B', sharePct: 20 }], liquids: [] }).error.code, 'INVALID_INPUT');
assert.equal(engine.execute({ operation: 'check-recipe', flour: -1, water: 20, starterMass: 10, saltMass: 1 }).ok, false);
assert.equal(engine.execute({ operation: 'feed-starter', targetMass: 100, seedRatio: 0, flourRatio: 1, waterRatio: 1 }).ok, false);
assert.equal(engine.execute({ operation: 'unknown' }).error.code, 'INVALID_OPERATION');

console.log('Sourdough calculator engine unit checks: passed.');
