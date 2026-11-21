import assert from 'node:assert/strict';
import engine from '../raised-bed-soil-engine.js';

const base = {
  system: 'imperial',
  currency: 'USD',
  beds: [{
    name: 'Backyard bed',
    shape: 'rectangle',
    length: 6,
    width: 3,
    depth: 10,
    existingDepth: 0,
    count: 1
  }],
  ingredients: [
    { name: 'Topsoil', percentage: 60, bagVolumeL: 30, pricePerBag: 8 },
    { name: 'Compost', percentage: 30, bagVolumeL: 30, pricePerBag: 6 },
    { name: 'Growing medium', percentage: 10, bagVolumeL: 30, pricePerBag: 10 }
  ]
};

function calculate(overrides = {}) {
  return engine.calculateProject({ ...base, ...overrides });
}

{
  const result = calculate();
  assert.equal(result.ok, true);
  assert.equal(result.data.bedCount, 1);
  assert.ok(Math.abs(result.data.newMixVolumeM3 - 15 * 0.028316846592) < 1e-10);
  assert.equal(result.data.ratioTotal, 100);
  assert.deepEqual(result.data.ingredients.map(x => x.bags), [9, 5, 2]);
  assert.equal(result.data.allPriced, true);
  assert.equal(result.data.totalCost, (9 * 8) + (5 * 6) + (2 * 10));
}

{
  const result = calculate({
    beds: [
      base.beds[0],
      { name: 'Side bed', shape: 'rectangle', length: 4, width: 4, depth: 12, existingDepth: 0, count: 1 }
    ]
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.bedCount, 2);
  assert.ok(Math.abs(result.data.newMixVolumeM3 - 31 * 0.028316846592) < 1e-10);
}

{
  const result = calculate({
    beds: [{ ...base.beds[0], depth: 10, existingDepth: 5 }]
  });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.data.newMixVolumeM3 - 7.5 * 0.028316846592) < 1e-10);
}

{
  const result = calculate({
    beds: [{ name: 'Round bed', shape: 'circle', diameter: 6, depth: 12, existingDepth: 0, count: 1 }]
  });
  assert.equal(result.ok, true);
  const expectedFt3 = Math.PI * 3 * 3;
  assert.ok(Math.abs(result.data.newMixVolumeM3 - expectedFt3 * 0.028316846592) < 1e-10);
}

{
  const result = calculate({
    system: 'metric',
    beds: [{
      name: 'Equivalent metric bed',
      shape: 'rectangle',
      length: 1.8288,
      width: 0.9144,
      depth: 25.4,
      existingDepth: 0,
      count: 1
    }]
  });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.data.newMixVolumeM3 - 15 * 0.028316846592) < 1e-10);
}

{
  const result = calculate({
    ingredients: [
      { name: 'Topsoil', percentage: 60, bagVolumeL: 30 },
      { name: 'Compost', percentage: 20, bagVolumeL: 30 },
      { name: 'Growing medium', percentage: 10, bagVolumeL: 30 }
    ]
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'RATIO_TOTAL');
}

{
  const result = calculate({
    beds: [{ ...base.beds[0], existingDepth: 11 }]
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'EXISTING_DEPTH');
}

{
  const result = calculate({
    beds: [{ ...base.beds[0], count: 1.5 }]
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'BED_COUNT');
}

{
  const result = calculate({
    ingredients: [
      { name: 'Topsoil', percentage: 60, bagVolumeL: 0 },
      { name: 'Compost', percentage: 30, bagVolumeL: 30 },
      { name: 'Growing medium', percentage: 10, bagVolumeL: 30 }
    ]
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'BAG_VOLUME');
}

{
  const result = calculate({
    ingredients: [
      { name: 'Topsoil', percentage: 60, bagVolumeL: 30, pricePerBag: -1 },
      { name: 'Compost', percentage: 30, bagVolumeL: 30 },
      { name: 'Growing medium', percentage: 10, bagVolumeL: 30 }
    ]
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'BAG_PRICE');
}

console.log('Raised bed soil engine checks passed.');
