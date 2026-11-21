(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZemToolsMulchEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LENGTH_TO_M = Object.freeze({ m: 1, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254, yd: 0.9144 });
  const AREA_TO_M2 = Object.freeze({ m2: 1, cm2: 0.0001, ft2: 0.09290304, yd2: 0.83612736, acre: 4046.8564224 });
  const VOLUME_TO_M3 = Object.freeze({ m3: 1, L: 0.001, ft3: 0.028316846592, yd3: 0.764554857984 });
  const MAX_ZONES = 50;
  const MAX_PRODUCTS = 20;
  const MAX_OFFERS_PER_PRODUCT = 12;

  function number(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function round(value, places) {
    const factor = Math.pow(10, places === undefined ? 8 : places);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
  function invalid(code, message) {
    return { ok: false, error: { code: code, message: message } };
  }
  function lengthToM(value, unit) {
    return LENGTH_TO_M[unit] ? value * LENGTH_TO_M[unit] : null;
  }
  function areaToM2(value, unit) {
    return AREA_TO_M2[unit] ? value * AREA_TO_M2[unit] : null;
  }
  function volumeToM3(value, unit) {
    return VOLUME_TO_M3[unit] ? value * VOLUME_TO_M3[unit] : null;
  }
  function depthToM(value, unit) {
    return lengthToM(value, unit);
  }
  function areaForZone(zone, lengthUnit) {
    const shape = zone.shape;
    let area = null;
    let a, b, c;
    if (shape === 'rectangle') {
      a = number(zone.length); b = number(zone.width);
      if (a === null || b === null || a <= 0 || b <= 0) {
        return { error: 'Enter positive length and width for ' + (zone.name || 'each rectangular bed') + '.' };
      }
      a = lengthToM(a, zone.lengthUnit || lengthUnit);
      b = lengthToM(b, zone.lengthUnit || lengthUnit);
      area = a * b;
    } else if (shape === 'circle') {
      a = number(zone.diameter);
      if (a === null || a <= 0) return { error: 'Enter a positive diameter for ' + (zone.name || 'the circular bed') + '.' };
      a = lengthToM(a, zone.lengthUnit || lengthUnit);
      area = Math.PI * a * a / 4;
    } else if (shape === 'ring') {
      a = number(zone.outerDiameter); b = number(zone.innerDiameter);
      if (a === null || b === null || a <= 0 || b < 0 || b >= a) {
        return { error: 'Enter a positive outer diameter and a smaller, non-negative inner diameter for ' + (zone.name || 'the ring') + '.' };
      }
      a = lengthToM(a, zone.lengthUnit || lengthUnit);
      b = lengthToM(b, zone.lengthUnit || lengthUnit);
      area = Math.PI * (a * a - b * b) / 4;
    } else if (shape === 'triangle') {
      a = number(zone.base); b = number(zone.height);
      if (a === null || b === null || a <= 0 || b <= 0) {
        return { error: 'Enter positive base and height for ' + (zone.name || 'the triangular bed') + '.' };
      }
      a = lengthToM(a, zone.lengthUnit || lengthUnit);
      b = lengthToM(b, zone.lengthUnit || lengthUnit);
      area = a * b / 2;
    } else if (shape === 'custom') {
      a = number(zone.customArea);
      if (a === null || a <= 0 || !AREA_TO_M2[zone.areaUnit || 'm2']) {
        return { error: 'Enter a positive custom area and choose its area unit for ' + (zone.name || 'the custom bed') + '.' };
      }
      area = areaToM2(a, zone.areaUnit || 'm2');
    } else {
      return { error: 'Choose a supported bed shape for ' + (zone.name || 'each area') + '.' };
    }

    if (!Number.isFinite(area) || area <= 0 || area > 100000000) {
      return { error: 'The calculated area is outside the supported range for ' + (zone.name || 'this bed') + '.' };
    }
    const excluded = number(zone.excludedArea);
    if (excluded !== null) {
      if (excluded < 0 || !AREA_TO_M2[zone.excludedAreaUnit || 'm2']) {
        return { error: 'Excluded area must be zero or greater and use a supported area unit.' };
      }
      const excludedM2 = areaToM2(excluded, zone.excludedAreaUnit || 'm2');
      if (excludedM2 >= area) {
        return { error: 'Excluded area must be smaller than the measured bed area for ' + (zone.name || 'this bed') + '.' };
      }
      area -= excludedM2;
    }
    return { areaM2: area };
  }
  function bagVolumeM3(product) {
    const bag = product.bag || {};
    if (bag.basis === 'coverage') {
      const area = number(bag.coverageArea);
      const depth = number(bag.coverageDepth);
      const areaUnit = bag.coverageAreaUnit || 'ft2';
      const depthUnit = bag.coverageDepthUnit || 'in';
      if (area === null || depth === null || area <= 0 || depth <= 0 ||
          !AREA_TO_M2[areaUnit] || !LENGTH_TO_M[depthUnit]) return null;
      return areaToM2(area, areaUnit) * depthToM(depth, depthUnit);
    }
    const volume = number(bag.volume);
    const unit = bag.volumeUnit || 'ft3';
    if (volume === null || volume <= 0 || !VOLUME_TO_M3[unit]) return null;
    return volumeToM3(volume, unit);
  }
  function roundOrderQuantity(required, minimum, increment) {
    const min = minimum === null ? 0 : minimum;
    const step = increment === null ? 0 : increment;
    if (!Number.isFinite(required) || required < 0 || min < 0 || step < 0) return null;
    if (required <= min) return min;
    if (step === 0) return required;
    const steps = Math.ceil((required - min - 1e-11) / step);
    return min + steps * step;
  }
  function cents(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
  function offerResult(offer, product, requiredM3) {
    const mode = offer.mode;
    const supplier = String(offer.supplier || 'Supplier offer').trim() || 'Supplier offer';
    const currency = String(offer.currency || 'USD').trim().toUpperCase();
    const delivery = number(offer.deliveryFee) || 0;
    const tax = number(offer.taxPercent) || 0;
    if (!Number.isFinite(delivery) || delivery < 0 || tax < 0 || tax > 100) {
      return { ok: false, message: 'Delivery must be zero or greater and tax must be between 0% and 100%.' };
    }
    const price = number(mode === 'bag' ? offer.pricePerPackage : offer.pricePerVolume);
    if (price === null) return { skipped: true, message: 'No price entered for this offer.' };
    if (price < 0) return { ok: false, message: 'Offer prices cannot be negative.' };
    let orderQuantity, orderedVolumeM3, materialCost, minimum, increment, unitLabel, displayUnit;
    if (mode === 'bag') {
      const singleBagM3 = bagVolumeM3(product);
      if (!Number.isFinite(singleBagM3) || singleBagM3 <= 0) {
        return { ok: false, message: 'Enter a valid bag volume or the package label coverage and its stated depth before pricing a bag offer.' };
      }
      minimum = number(offer.minimumQuantity);
      increment = number(offer.orderIncrement);
      if (minimum !== null && minimum < 0 || increment !== null && increment <= 0) {
        return { ok: false, message: 'Bag minimum must be zero or greater and the bag order increment must be greater than zero.' };
      }
      orderQuantity = roundOrderQuantity(requiredM3 / singleBagM3, minimum, increment === null ? 1 : increment);
      if (orderQuantity === null || Math.abs(orderQuantity - Math.round(orderQuantity)) > 1e-8) {
        return { ok: false, message: 'Bag order increments must result in a whole number of packages.' };
      }
      orderQuantity = Math.round(orderQuantity);
      orderedVolumeM3 = orderQuantity * singleBagM3;
      materialCost = orderQuantity * price;
      unitLabel = 'bags';
      displayUnit = 'bag';
    } else if (mode === 'bulk') {
      const priceUnit = offer.priceVolumeUnit || 'yd3';
      const unitM3 = VOLUME_TO_M3[priceUnit];
      if (!unitM3) return { ok: false, message: 'Choose a supported bulk price volume unit.' };
      minimum = number(offer.minimumVolume);
      increment = number(offer.orderIncrement);
      if (minimum !== null && minimum < 0 || increment !== null && increment < 0) {
        return { ok: false, message: 'Bulk minimum and order increment must be zero or greater.' };
      }
      const minimumM3 = minimum === null ? 0 : minimum * unitM3;
      const incrementM3 = increment === null ? 0 : increment * unitM3;
      const orderM3 = roundOrderQuantity(requiredM3, minimumM3, incrementM3);
      if (orderM3 === null) return { ok: false, message: 'Bulk minimum or increment is invalid.' };
      orderQuantity = orderM3 / unitM3;
      orderedVolumeM3 = orderM3;
      materialCost = orderQuantity * price;
      unitLabel = priceUnit === 'yd3' ? 'yd³' : priceUnit === 'ft3' ? 'ft³' : priceUnit === 'L' ? 'L' : 'm³';
      displayUnit = priceUnit;
    } else {
      return { ok: false, message: 'Choose bagged or bulk purchasing for each supplier offer.' };
    }
    const subtotal = cents(materialCost);
    const deliveryCents = cents(delivery);
    const taxableTotal = subtotal + deliveryCents;
    const taxAmount = cents(taxableTotal * tax / 100);
    const totalCost = cents(taxableTotal + taxAmount);
    return {
      ok: true,
      data: {
        id: String(offer.id || ''),
        supplier: supplier,
        mode: mode,
        currency: currency,
        orderQuantity: round(orderQuantity, mode === 'bag' ? 0 : 6),
        unitLabel: unitLabel,
        orderedVolumeM3: orderedVolumeM3,
        requiredVolumeM3: requiredM3,
        surplusVolumeM3: Math.max(0, orderedVolumeM3 - requiredM3),
        materialCost: subtotal,
        deliveryFee: deliveryCents,
        taxPercent: tax,
        taxAmount: taxAmount,
        totalCost: totalCost,
        comparisonNote: 'Tax is applied to the entered material subtotal plus delivery fee.'
      }
    };
  }

  function calculateProject(request) {
    const input = request || {};
    const zones = Array.isArray(input.zones) ? input.zones : [];
    const products = Array.isArray(input.products) ? input.products : [];
    const lengthUnit = input.lengthUnit || 'ft';
    const depthUnit = input.depthUnit || 'in';
    if (!zones.length || zones.length > MAX_ZONES) return invalid('INVALID_ZONE_COUNT', 'Add between 1 and ' + MAX_ZONES + ' project areas.');
    if (!products.length || products.length > MAX_PRODUCTS) return invalid('INVALID_PRODUCT_COUNT', 'Add between 1 and ' + MAX_PRODUCTS + ' mulch products.');
    if (!LENGTH_TO_M[lengthUnit] || !LENGTH_TO_M[depthUnit]) return invalid('INVALID_UNITS', 'Choose supported length and depth units.');

    const productMap = new Map();
    for (const product of products) {
      const id = String(product.id || '');
      if (!id || productMap.has(id)) return invalid('INVALID_PRODUCT_ID', 'Each mulch product needs a unique ID.');
      const name = String(product.name || '').trim();
      if (!name) return invalid('INVALID_PRODUCT_NAME', 'Give each mulch product a name taken from the label or your own project description.');
      productMap.set(id, product);
    }

    const zoneResults = [];
    const grouped = new Map();
    let totalAreaM2 = 0;
    let totalRequiredM3 = 0;
    for (let index = 0; index < zones.length; index += 1) {
      const zone = zones[index] || {};
      const name = String(zone.name || ('Area ' + (index + 1))).trim() || ('Area ' + (index + 1));
      const geometry = areaForZone(zone, lengthUnit);
      if (geometry.error) return invalid('INVALID_ZONE_GEOMETRY', geometry.error);
      const target = number(zone.targetDepth);
      const existing = number(zone.existingDepth);
      if (target === null || target <= 0 || existing === null || existing < 0) {
        return invalid('INVALID_DEPTH', 'Enter a positive target depth and a zero-or-greater existing depth for ' + name + '.');
      }
      const targetM = depthToM(target, depthUnit);
      const existingM = depthToM(existing, depthUnit);
      if (!Number.isFinite(targetM) || !Number.isFinite(existingM)) return invalid('INVALID_DEPTH', 'The entered depth is outside the supported calculation range for ' + name + '.');
      const addedDepthM = Math.max(0, targetM - existingM);
      const rawM3 = geometry.areaM2 * addedDepthM;
      if (!Number.isFinite(rawM3) || rawM3 > 1e12) return invalid('VOLUME_OUT_OF_RANGE', 'The calculated volume is outside the supported range for ' + name + '.');
      const waste = number(zone.allowancePercent);
      const allowance = waste === null ? 0 : waste;
      if (allowance < 0 || allowance > 100) {
        return invalid('INVALID_ALLOWANCE', 'Allowance must be between 0% and 100% for ' + name + '.');
      }
      const requiredM3 = rawM3 * (1 + allowance / 100);
      if (!Number.isFinite(requiredM3) || requiredM3 > 1e12) return invalid('VOLUME_OUT_OF_RANGE', 'The adjusted volume is outside the supported range for ' + name + '.');
      const productId = String(zone.productId || '');
      const product = productMap.get(productId);
      if (!product) return invalid('UNKNOWN_PRODUCT', 'Choose a valid mulch product for ' + name + '.');
      const row = {
        id: String(zone.id || ('zone-' + (index + 1))),
        name: name,
        shape: zone.shape,
        productId: productId,
        productName: String(product.name).trim(),
        areaM2: geometry.areaM2,
        targetDepthM: targetM,
        existingDepthM: existingM,
        addedDepthM: addedDepthM,
        rawVolumeM3: rawM3,
        allowancePercent: allowance,
        allowanceVolumeM3: requiredM3 - rawM3,
        requiredVolumeM3: requiredM3,
        alreadyAtTarget: addedDepthM === 0
      };
      zoneResults.push(row);
      totalAreaM2 += geometry.areaM2;
      totalRequiredM3 += requiredM3;
      if (!grouped.has(productId)) grouped.set(productId, { product: product, zones: [], areaM2: 0, rawVolumeM3: 0, allowanceVolumeM3: 0, requiredVolumeM3: 0 });
      const group = grouped.get(productId);
      group.zones.push(row);
      group.areaM2 += row.areaM2;
      group.rawVolumeM3 += row.rawVolumeM3;
      group.allowanceVolumeM3 += row.allowanceVolumeM3;
      group.requiredVolumeM3 += row.requiredVolumeM3;
    }

    const productResults = [];
    for (const [productId, group] of grouped.entries()) {
      const product = group.product;
      const offers = Array.isArray(product.offers) ? product.offers : [];
      if (offers.length > MAX_OFFERS_PER_PRODUCT) return invalid('TOO_MANY_OFFERS', 'Each product can have up to ' + MAX_OFFERS_PER_PRODUCT + ' supplier offers.');
      const packageVolume = bagVolumeM3(product);
      const productBagVolumeM3 = Number.isFinite(packageVolume) && packageVolume > 0 ? packageVolume : null;
      const packagesRequired = productBagVolumeM3 === null ? null : (group.requiredVolumeM3 > 0 ? Math.ceil(group.requiredVolumeM3 / productBagVolumeM3 - 1e-10) : 0);
      const bagSurplusVolumeM3 = packagesRequired === null ? null : Math.max(0, packagesRequired * productBagVolumeM3 - group.requiredVolumeM3);
      const quoteResults = [];
      const quoteErrors = [];
      for (const offer of offers) {
        if (group.requiredVolumeM3 <= 0) break;
        const result = offerResult(offer || {}, product, group.requiredVolumeM3);
        if (result.skipped) continue;
        if (!result.ok) {
          quoteErrors.push({ id: String(offer.id || ''), supplier: String(offer.supplier || 'Supplier offer'), message: result.message });
        } else {
          quoteResults.push(result.data);
        }
      }
      const currencies = Array.from(new Set(quoteResults.map(item => item.currency)));
      const comparable = currencies.length <= 1;
      const orderedQuotes = comparable
        ? quoteResults.slice().sort((a, b) => a.totalCost - b.totalCost || a.surplusVolumeM3 - b.surplusVolumeM3)
        : [];
      productResults.push({
        productId: productId,
        productName: String(product.name).trim(),
        productType: String(product.type || 'other'),
        areaM2: group.areaM2,
        rawVolumeM3: group.rawVolumeM3,
        allowanceVolumeM3: group.allowanceVolumeM3,
        requiredVolumeM3: group.requiredVolumeM3,
        bagVolumeM3: productBagVolumeM3,
        packagesRequired: packagesRequired,
        bagSurplusVolumeM3: bagSurplusVolumeM3,
        noPurchaseNeeded: group.requiredVolumeM3 <= 0,
        quotes: quoteResults,
        quoteErrors: quoteErrors,
        comparable: comparable,
        currencies: currencies,
        bestOfferId: orderedQuotes.length ? orderedQuotes[0].id : null,
        bestOffer: orderedQuotes.length ? orderedQuotes[0] : null
      });
    }
    return {
      ok: true,
      data: {
        totalAreaM2: totalAreaM2,
        totalRequiredM3: totalRequiredM3,
        zones: zoneResults,
        products: productResults,
        notes: [
          'Mulch quantities are calculated by volume; no density or material weight is assumed.',
          'Each area is calculated separately, then grouped only with zones assigned to the same named product.',
          'Existing depth is deducted only as a measured usable layer; an over-target layer is not a recommendation to add more.'
        ]
      }
    };
  }

  function calculateCoverage(request) {
    const input = request || {};
    const depth = number(input.depth);
    const quantity = number(input.quantity);
    const depthUnit = input.depthUnit || 'in';
    const mode = input.quantityMode || 'bulk';
    if (depth === null || depth <= 0 || !LENGTH_TO_M[depthUnit]) {
      return invalid('INVALID_COVERAGE_DEPTH', 'Enter a positive coverage depth and supported depth unit.');
    }
    if (quantity === null || quantity <= 0) {
      return invalid('INVALID_COVERAGE_QUANTITY', 'Enter an available quantity greater than zero.');
    }
    let volumeM3;
    let bagCount = null;
    if (mode !== 'bags' && mode !== 'bulk') return invalid('INVALID_COVERAGE_MODE', 'Choose labelled bags or bulk volume.');
    if (mode === 'bags' && !Number.isInteger(quantity)) return invalid('INVALID_COVERAGE_QUANTITY', 'Enter a whole number of available bags.');
    if (mode === 'bags') {
      const product = input.product || {};
      const singleBagM3 = bagVolumeM3(product);
      if (!Number.isFinite(singleBagM3) || singleBagM3 <= 0) {
        return invalid('INVALID_BAG_SPEC', 'Enter the package volume or its labelled coverage and depth first.');
      }
      bagCount = quantity;
      volumeM3 = bagCount * singleBagM3;
    } else {
      const unit = input.volumeUnit || 'yd3';
      if (!VOLUME_TO_M3[unit]) return invalid('INVALID_VOLUME_UNIT', 'Choose a supported volume unit.');
      volumeM3 = volumeToM3(quantity, unit);
    }
    const depthM = depthToM(depth, depthUnit);
    const areaM2 = volumeM3 / depthM;
    if (!Number.isFinite(areaM2) || areaM2 <= 0 || areaM2 > 100000000) {
      return invalid('COVERAGE_OUT_OF_RANGE', 'The calculated coverage is outside the supported range.');
    }
    return {
      ok: true,
      data: {
        availableVolumeM3: volumeM3,
        depthM: depthM,
        areaM2: areaM2,
        areaFt2: areaM2 / AREA_TO_M2.ft2,
        areaYd2: areaM2 / AREA_TO_M2.yd2,
        bagCount: bagCount
      }
    };
  }

  function execute(request) {
    return calculateProject(request);
  }

  return Object.freeze({
    contractVersion: 1,
    execute: execute,
    calculateProject: calculateProject,
    calculateCoverage: calculateCoverage,
    areaForZone: areaForZone,
    bagVolumeM3: bagVolumeM3,
    lengthToM: lengthToM,
    areaToM2: areaToM2,
    volumeToM3: volumeToM3,
    round: round,
    constants: Object.freeze({ lengthToM: LENGTH_TO_M, areaToM2: AREA_TO_M2, volumeToM3: VOLUME_TO_M3 })
  });
});
