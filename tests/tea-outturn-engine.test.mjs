import assert from 'node:assert/strict';
import engine from '../tea-outturn-engine.js';

{
  const result = engine.execute({
    operation: 'actual',
    unit: 'kg',
    greenLeaf: 1000,
    madeTea: 225,
    firedTea: 240
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.netOutturnPercent, 22.5);
  assert.equal(result.data.grossOutturnPercent, 24);
  assert.ok(Math.abs(result.data.greenLeafPerMadeTea - (1000 / 225)) < 1e-12);
}

{
  const result = engine.calculateActual({
    unit: 'kg',
    greenLeaf: '1000',
    madeTea: '225',
    firedTea: ''
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.grossOutturnPercent, null);
  assert.equal(result.data.warning, null);
}

{
  const result = engine.execute({
    operation: 'actual',
    unit: 'lb',
    greenLeaf: 2204.62262185,
    madeTea: 496.04008991625,
    firedTea: 529.109429244
  });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.data.netOutturnPercent - 22.5) < 1e-9);
  assert.ok(Math.abs(result.data.grossOutturnPercent - 24) < 1e-9);
}

{
  const result = engine.execute({
    operation: 'plan',
    unit: 't',
    targetMadeTea: 1,
    outturnPercent: 22.5
  });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.data.requiredGreenLeaf - (1 / 0.225)) < 1e-12);
  assert.equal(result.data.outturnPercent, 22.5);
}

{
  const result = engine.calculatePlan({ unit: 'kg', targetMadeTea: 225, outturnPercent: 24 });
  assert.equal(result.ok, true);
  assert.equal(result.data.requiredGreenLeaf, 937.5);
}

for (const input of [
  { unit: 'kg', greenLeaf: 0, madeTea: 10 },
  { unit: 'kg', greenLeaf: 100, madeTea: -1 },
  { unit: 'kg', greenLeaf: 100, madeTea: '' },
  { unit: 'stones', greenLeaf: 100, madeTea: 20 },
  { unit: 'kg', greenLeaf: 100, madeTea: 101 },
  { unit: 'kg', greenLeaf: 100, madeTea: 20, firedTea: 101 }
]) {
  assert.equal(engine.calculateActual(input).ok, false);
}

assert.equal(engine.calculatePlan({ unit: 'kg', targetMadeTea: 100, outturnPercent: 0 }).ok, false);
assert.equal(engine.calculatePlan({ unit: 'kg', targetMadeTea: 100, outturnPercent: -5 }).ok, false);
assert.equal(engine.calculatePlan({ unit: 'kg', targetMadeTea: 100, outturnPercent: 100.1 }).ok, false);
assert.equal(engine.calculatePlan({ unit: 'kg', targetMadeTea: 100, outturnPercent: 20 }).ok, true);

{
  const result = engine.calculateActual({
    unit: 'kg',
    greenLeaf: 1000,
    madeTea: 225,
    firedTea: 200
  });
  assert.equal(result.ok, true);
  assert.match(result.data.warning, /fired-tea figure is below/i);
}

assert.equal(engine.execute({ operation: 'unsupported' }).ok, false);

console.log('Tea outturn engine checks passed.');
