import assert from 'node:assert/strict';
import engine from '../spreader-calibration-engine.js';

const base = {
  spreaderType: 'drop',
  method: 'before-after',
  targetBasis: 'product',
  targetRate: 2.5,
  rateUnit: 'lb-1000ft2',
  tolerancePercent: 10,
  applicationPasses: 1,
  dimensionUnit: 'ft',
  weightUnit: 'lb',
  testWidth: 2,
  testLength: 50,
  startingWeight: 2,
  remainingWeight: 1.75,
  lawnArea: 5000,
  lawnAreaUnit: 'ft2',
  bagSize: 20,
  bagUnit: 'lb'
};

function run(name, fn) {
  try {
    fn();
    console.log('PASS', name);
  } catch (error) {
    console.error('FAIL', name, error.message);
    process.exitCode = 1;
  }
}

run('shared engine contract exposes execute(request)', () => {
  const result = engine.execute(base);
  assert.equal(result.ok, true);
  assert.equal(result.data.actualRate, 2.5);
});

run('before/after method matches the 2.5 lb per 1,000 sq ft extension example', () => {
  const result = engine.calculate(base);
  assert.equal(result.ok, true);
  assert.equal(result.data.actualRate, 2.5);
  assert.equal(result.data.targetPerPassRate, 2.5);
  assert.equal(result.data.status, 'within');
  assert.equal(result.data.variancePercent, 0);
  assert.equal(result.data.targetTestWeight, 0.25);
  assert.equal(result.data.totalProduct, 12.5);
  assert.equal(result.data.bagCount, 1);
});

run('full-width drop catch-pan method calculates the measured lane rate', () => {
  const result = engine.calculate({
    ...base,
    method: 'drop-catch',
    targetRate: 2.727272727,
    testWidth: 3,
    testLength: 33,
    collectedWeight: 0.27
  });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.data.actualRate - 2.727272727) < 0.001);
});

run('sweep-and-weigh uses the area actually collected from the tarp', () => {
  const result = engine.calculate({
    ...base,
    method: 'sweep-weigh',
    testWidth: 2,
    testLength: 50,
    collectedWeight: 0.2
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.actualRate, 2);
});

run('rotary center-pan test compares a two-pass spreader with half the label rate per pass', () => {
  const result = engine.calculate({
    ...base,
    spreaderType: 'rotary',
    method: 'rotary-center-pan',
    targetRate: 110,
    applicationPasses: 2,
    tolerancePercent: 1,
    weightUnit: 'g',
    panArea: 1,
    panAreaUnit: 'ft2',
    collectionPasses: 4,
    collectedWeight: 100
  });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.data.targetPerPassRate - 55) < 0.0001);
  assert.ok(Math.abs(result.data.actualRate - 55) < 0.2);
  assert.equal(result.data.status, 'within');
  assert.ok(Math.abs(result.data.targetTestWeight - 99.8) < 0.5);
});

run('nitrogen mode converts nutrient target to product rate using the label N percentage', () => {
  const result = engine.calculate({
    ...base,
    targetBasis: 'nitrogen',
    targetRate: 1,
    nitrogenPercent: 27
  });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.data.targetFullRate - (1 / 0.27)) < 0.00001);
  assert.ok(Math.abs(result.data.targetPerPassRate - (1 / 0.27)) < 0.00001);
});

run('metric mass and area inputs produce the expected metric rate', () => {
  const result = engine.calculate({
    ...base,
    rateUnit: 'kg-100m2',
    targetRate: 1,
    dimensionUnit: 'm',
    weightUnit: 'kg',
    testWidth: 10,
    testLength: 10,
    startingWeight: 2,
    remainingWeight: 1
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.actualRate, 1);
});

run('rejects remaining hopper weight greater than starting weight', () => {
  const result = engine.calculate({ ...base, remainingWeight: 2.1 });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'REMAINING_EXCEEDS_START');
});

run('rejects rotary center-pan method when drop spreader is selected', () => {
  const result = engine.calculate({ ...base, method: 'rotary-center-pan' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_METHOD');
});

run('rejects zero test area dimensions and invalid tolerance', () => {
  assert.equal(engine.calculate({ ...base, testWidth: 0 }).error.code, 'INVALID_TEST_INPUTS');
  assert.equal(engine.calculate({ ...base, tolerancePercent: 51 }).error.code, 'INVALID_TOLERANCE');
});

run('rejects invalid bag size rather than silently calculating a package count', () => {
  const result = engine.calculate({ ...base, bagSize: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_BAG_SIZE');
});
