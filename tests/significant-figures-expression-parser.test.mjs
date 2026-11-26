import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../significant-figures-engine.js');

// Grouped operands should be accepted without changing the precision-bearing text.
assert.deepEqual(engine.parseExpression('1,234.50 + 2.0', ['+']), {
  a: '1234.50',
  op: '+',
  b: '2.0'
});
assert.equal(
  engine.calculate('add', { expression: '1,234.50 + 2.0' }).value,
  '1236.5'
);
assert.equal(
  engine.calculate('add', { expression: '-1,234.50 + 2.0' }).value,
  '-1,232.5'
);
assert.deepEqual(engine.parseExpression('1,234.50e2 + 1.0', ['+']), {
  a: '1234.50e2',
  op: '+',
  b: '1.0'
});

// Invalid thousands separators must be rejected, never silently stripped.
for (const expression of [
  '1,2,3.4 + 2.0',
  '12,34 + 2.0',
  '1234,567 + 2.0',
  '1,234.5,6 + 2.0',
  '1,,234 + 2.0'
]) {
  assert.equal(
    engine.calculate('add', { expression }).ok,
    false,
    `Expected invalid grouping to be rejected: ${expression}`
  );
}

// Both comma-grouped operands and no-comma input remain supported.
assert.equal(
  engine.calculate('multiply', { expression: '1,200.0 × 2.0' }).ok,
  true
);
assert.equal(
  engine.calculate('add', { expression: '1234.50 + 2.0' }).value,
  '1236.5'
);

console.log('Significant-figures expression parser contract: passed.');
