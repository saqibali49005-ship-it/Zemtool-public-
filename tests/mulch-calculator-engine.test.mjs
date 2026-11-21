import assert from 'node:assert/strict';
import engine from '../mulch-calculator-engine.js';

function run(name, fn) {
  try { fn(); console.log('PASS', name); }
  catch (error) { console.error('FAIL', name, error.message); process.exitCode = 1; }
}
const product = {
  id: 'bark', name: 'Bark mulch', type: 'bark',
  bag: { basis: 'volume', volume: 2, volumeUnit: 'ft3' },
  offers: []
};
const base = {
  lengthUnit: 'ft', depthUnit: 'in',
  products: [product],
  zones: [{
    id: 'bed-1', name: 'Border bed', shape: 'rectangle',
    length: 10, width: 4, targetDepth: 3, existingDepth: 1,
    allowancePercent: 0, productId: 'bark'
  }]
};

run('shared engine contract exposes execute(request)', () => {
  const result = engine.execute(base);
  assert.equal(result.ok, true);
  assert.equal(typeof engine.calculateCoverage, 'function');
  assert.equal(result.data.zones.length, 1);
});

run('rectangle top-up uses target minus existing depth and exact cubic-yard conversion', () => {
  const result = engine.calculateProject(base);
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.data.zones[0].areaM2 - 3.7161216) < 1e-9);
  assert.ok(Math.abs(result.data.zones[0].requiredVolumeM3 - 0.18877897728) < 1e-7);
  assert.ok(Math.abs(result.data.totalRequiredM3 * 35.3146667215 - 6.6666667) < 1e-6);
  assert.equal(result.data.products[0].packagesRequired, 4);
  assert.ok(Math.abs(result.data.products[0].bagSurplusVolumeM3 / 0.028316846592 - 1.3333333) < 1e-6);
});

run('a circle uses its measured diameter and an existing depth per zone', () => {
  const result = engine.calculateProject({
    ...base,
    zones: [{ ...base.zones[0], shape: 'circle', diameter: 6, targetDepth: 3, existingDepth: 1 }]
  });
  assert.equal(result.ok, true);
  const expectedFt2 = Math.PI * 9;
  assert.ok(Math.abs(result.data.zones[0].areaM2 / 0.09290304 - expectedFt2) < 1e-9);
});

run('a tree ring subtracts the inner exclusion instead of counting the trunk area', () => {
  const result = engine.calculateProject({
    ...base,
    zones: [{ id: 'ring', name: 'Tree ring', shape: 'ring', outerDiameter: 6, innerDiameter: 2, targetDepth: 2, existingDepth: 0, allowancePercent: 0, productId: 'bark' }]
  });
  assert.equal(result.ok, true);
  const expectedFt2 = Math.PI * (3 ** 2 - 1 ** 2);
  assert.ok(Math.abs(result.data.zones[0].areaM2 / 0.09290304 - expectedFt2) < 1e-9);
});

run('triangle and explicit custom area shapes are supported', () => {
  const tri = engine.calculateProject({ ...base, zones: [{ ...base.zones[0], shape: 'triangle', base: 10, height: 5 }] });
  const custom = engine.calculateProject({ ...base, zones: [{ ...base.zones[0], shape: 'custom', customArea: 50, areaUnit: 'ft2' }] });
  assert.equal(tri.ok, true);
  assert.ok(Math.abs(tri.data.zones[0].areaM2 / 0.09290304 - 25) < 1e-9);
  assert.equal(custom.ok, true);
  assert.ok(Math.abs(custom.data.zones[0].areaM2 / 0.09290304 - 50) < 1e-9);
});

run('an excluded non-ring area cannot exceed or equal the measured area', () => {
  const result = engine.calculateProject({ ...base, zones: [{ ...base.zones[0], excludedArea: 40, excludedAreaUnit: 'ft2' }] });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_ZONE_GEOMETRY');
});

run('a bed already at or above target depth needs zero new material', () => {
  const result = engine.calculateProject({ ...base, zones: [{ ...base.zones[0], existingDepth: 4 }] });
  assert.equal(result.ok, true);
  assert.equal(result.data.zones[0].requiredVolumeM3, 0);
});

run('allowance is explicit and applied per selected zone', () => {
  const result = engine.calculateProject({ ...base, zones: [{ ...base.zones[0], allowancePercent: 10 }] });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.data.totalRequiredM3 - 0.207656874008) < 1e-8);
});

run('compatible zones group by product without mixing different products', () => {
  const second = { id: 'cedar', name: 'Cedar mulch', type: 'cedar', bag: { basis: 'volume', volume: 1.5, volumeUnit: 'ft3' }, offers: [] };
  const result = engine.calculateProject({
    ...base, products: [product, second],
    zones: [
      { ...base.zones[0], id: 'one', productId: 'bark' },
      { ...base.zones[0], id: 'two', productId: 'cedar' }
    ]
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.products.length, 2);
  assert.notEqual(result.data.products[0].productId, result.data.products[1].productId);
});

run('label coverage and depth are converted to package volume, then rounded to whole bags', () => {
  const productWithCoverage = {
    ...product,
    bag: { basis: 'coverage', coverageArea: 12, coverageAreaUnit: 'ft2', coverageDepth: 2, coverageDepthUnit: 'in' },
    offers: [{ id: 'retail', supplier: 'Garden store', mode: 'bag', pricePerPackage: 5, currency: 'USD', orderIncrement: 1 }]
  };
  const result = engine.calculateProject({
    ...base, products: [productWithCoverage],
    zones: [{ ...base.zones[0], length: 9, width: 4, targetDepth: 2, existingDepth: 0 }]
  });
  assert.equal(result.ok, true);
  const group = result.data.products[0];
  assert.ok(Math.abs(group.bagVolumeM3 / 0.028316846592 - 2) < 1e-9);
  assert.equal(group.quotes[0].orderQuantity, 3);
});

run('bag and bulk offers compare whole purchase totals including delivery and supplier increments', () => {
  const priced = {
    ...product,
    offers: [
      { id: 'bag-a', supplier: 'Bag shop', mode: 'bag', pricePerPackage: 6, currency: 'USD', deliveryFee: 0, taxPercent: 0, minimumQuantity: 0, orderIncrement: 1 },
      { id: 'bulk-b', supplier: 'Bulk yard', mode: 'bulk', pricePerVolume: 12, priceVolumeUnit: 'yd3', deliveryFee: 40, taxPercent: 0, minimumVolume: 0.5, orderIncrement: 0.25 }
    ]
  };
  const result = engine.calculateProject({ ...base, products: [priced] });
  assert.equal(result.ok, true);
  const group = result.data.products[0];
  assert.equal(group.bestOfferId, 'bag-a');
  assert.equal(group.quotes.find(q => q.id === 'bulk-b').orderQuantity, 0.5);
  assert.equal(group.quotes.find(q => q.id === 'bulk-b').deliveryFee, 40);
});

run('supplier order increments are counted from the stated minimum, not from zero', () => {
  const priced = {
    ...product,
    offers: [{
      id: 'min-three-step-two',
      mode: 'bag',
      pricePerPackage: 6,
      currency: 'USD',
      minimumQuantity: 3,
      orderIncrement: 2
    }]
  };
  const result = engine.calculateProject({ ...base, products: [priced] });
  assert.equal(result.ok, true);
  assert.equal(result.data.products[0].quotes[0].orderQuantity, 5);
});

run('already-at-target areas do not trigger supplier minimum purchases', () => {
  const priced = {
    ...product,
    offers: [{
      id: 'min-ten',
      mode: 'bag',
      pricePerPackage: 6,
      currency: 'USD',
      minimumQuantity: 10,
      orderIncrement: 1
    }]
  };
  const result = engine.calculateProject({
    ...base,
    products: [priced],
    zones: [{ ...base.zones[0], targetDepth: 3, existingDepth: 4 }]
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.products[0].noPurchaseNeeded, true);
  assert.equal(result.data.products[0].packagesRequired, 0);
  assert.equal(result.data.products[0].quotes.length, 0);
  assert.equal(result.data.products[0].bestOfferId, null);
});

run('supplier offers in different currencies are not ranked against each other', () => {
  const priced = {
    ...product,
    offers: [
      { id: 'usd', mode: 'bag', pricePerPackage: 6, currency: 'USD', orderIncrement: 1 },
      { id: 'eur', mode: 'bulk', pricePerVolume: 10, priceVolumeUnit: 'yd3', currency: 'EUR' }
    ]
  };
  const result = engine.calculateProject({ ...base, products: [priced] });
  assert.equal(result.ok, true);
  assert.equal(result.data.products[0].comparable, false);
  assert.equal(result.data.products[0].bestOfferId, null);
});

run('metric dimensions and depth match equivalent imperial dimensions', () => {
  const metric = engine.calculateProject({
    lengthUnit: 'm', depthUnit: 'mm',
    products: [product],
    zones: [{ id: 'metric', shape: 'rectangle', length: 3.048, width: 1.2192, targetDepth: 76.2, existingDepth: 25.4, allowancePercent: 0, productId: 'bark' }]
  });
  assert.equal(metric.ok, true);
  assert.ok(Math.abs(metric.data.totalRequiredM3 - engine.calculateProject(base).data.totalRequiredM3) < 1e-8);
});

run('rejects invalid dimensions, ring diameters and depth inputs', () => {
  assert.equal(engine.calculateProject({ ...base, zones: [{ ...base.zones[0], length: 0 }] }).error.code, 'INVALID_ZONE_GEOMETRY');
  assert.equal(engine.calculateProject({ ...base, zones: [{ ...base.zones[0], shape: 'ring', outerDiameter: 3, innerDiameter: 4 }] }).error.code, 'INVALID_ZONE_GEOMETRY');
  assert.equal(engine.calculateProject({ ...base, zones: [{ ...base.zones[0], targetDepth: 0 }] }).error.code, 'INVALID_DEPTH');
});

run('reverse coverage converts available bags and depth into coverable area', () => {
  const result = engine.calculateCoverage({
    quantityMode: 'bags', quantity: 4, depth: 2, depthUnit: 'in', product: product
  });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.data.areaFt2 - 48) < 1e-8);
});

run('reverse bag coverage requires a whole available package count', () => {
  const result = engine.calculateCoverage({ quantityMode: 'bags', quantity: 2.5, depth: 2, depthUnit: 'in', product: product });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_COVERAGE_QUANTITY');
});

run('reverse coverage rejects a missing package label specification', () => {
  const result = engine.calculateCoverage({
    quantityMode: 'bags', quantity: 4, depth: 2, depthUnit: 'in', product: { id: 'empty', bag: {} }
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_BAG_SPEC');
});
