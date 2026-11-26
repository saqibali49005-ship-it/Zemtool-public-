import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../significant-figures-engine.js');

// Decimal source strings must remain exact; never route them through JS Number first.
assert.equal(engine.calculate('add', { expression: '0.1 + 0.2' }).fullPrecision, '0.3');
assert.equal(engine.calculate('add', { expression: '100.0 - 99.9' }).fullPrecision, '0.1');

// Finite arithmetic should retain all source decimal digits until the final
// measurement-precision rule is applied.
assert.equal(
  engine.calculate('multiply', { expression: '12345678901234567890.0 × 1.0' }).fullPrecision,
  '12345678901234567890'
);

// Decimal half-up means ties move away from zero, independent of binary FP noise.
assert.equal(engine.roundToSig('2.675', 3), '2.68');
assert.equal(engine.roundToSig('1.005', 3), '1.01');
assert.equal(engine.roundToSig('1.25', 2), '1.3');
assert.equal(engine.roundToSig('-1.25', 2), '-1.3');

// Rounding carry, tiny exponents and negative values must preserve requested digits.
assert.equal(engine.roundToSig('9.996', 3), '1.00e+1');
assert.equal(engine.roundToSig('1e-200', 2), '1.0e-200');
assert.equal(engine.roundToSig('-0.004995', 2), '-0.0050');

// Measurement rules apply only after a sufficiently precise working result.
assert.equal(engine.calculate('add', { expression: '100.0 - 99.9' }).value, '0.1');
assert.equal(engine.calculate('multiply', { expression: '2.50 × 4.0' }).value, '1.0e+1');
assert.equal(engine.calculate('multiply', { expression: '6.0 ÷ 2.0' }).value, '3.0');

// Repeating division must be explicitly bounded, then rounded by the operands' SF rule.
const third = engine.calculate('multiply', { expression: '1.0 ÷ 3.0' });
assert.equal(third.ok, true);
assert.equal(third.value, '0.33');
assert.match(third.fullPrecision, /^0\.3333/);

// Bad grouping is invalid everywhere (count, round and expression modes).
assert.equal(engine.calculate('count', { number: '1,2,3.4' }).ok, false);
assert.equal(engine.calculate('round', { number: '12,34', target: '3' }).ok, false);

// Guardrails: do not accept unbounded/excessively large user payloads or exponents.
assert.equal(engine.calculate('round', { number: '1e999999999', target: '2' }).ok, false);
assert.equal(engine.calculate('round', { number: '1'.repeat(10000), target: '2' }).ok, false);

console.log('Significant-figures decimal precision contract: passed.');
