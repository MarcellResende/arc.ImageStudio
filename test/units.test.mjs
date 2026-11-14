import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(await readFile(path.join(root, 'src/renderer/units-engine.js'), 'utf8'), sandbox);
const U = sandbox.ArcUnits;
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * tolerance + 1e-12, `${actual} ≉ ${expected}`);

test('well-known conversions come out right', () => {
  close(U.convert('length', 1, 'mi', 'km'), 1.609344);
  close(U.convert('length', 12, 'in', 'ft'), 1);
  close(U.convert('length', 1, 'ly', 'km'), 9460730472580.8);
  close(U.convert('mass', 1, 'lb', 'g'), 453.59237);
  close(U.convert('mass', 2, 'arroba', 'kg'), 30);
  close(U.convert('area', 1, 'ha', 'm2'), 10000);
  close(U.convert('area', 1, 'ac', 'm2'), 4046.8564224);
  close(U.convert('volume', 1, 'gal-us', 'l'), 3.785411784);
  close(U.convert('volume', 1, 'xic-br', 'ml'), 240);
  close(U.convert('speed', 108, 'kmh', 'ms'), 30);
  close(U.convert('speed', 100, 'kmh', 'mph'), 62.13711922373339);
  close(U.convert('time', 1, 'd', 'h'), 24);
  close(U.convert('time', 1, 'y', 'd'), 365.25);
  close(U.convert('energy', 1, 'kwh', 'kj'), 3600);
  close(U.convert('energy', 1, 'kcal', 'kj'), 4.184);
  close(U.convert('power', 1, 'hp', 'w'), 745.69987158227);
  close(U.convert('pressure', 1, 'atm', 'pa'), 101325);
  close(U.convert('pressure', 760, 'torr', 'atm'), 1);
  close(U.convert('angle', 180, 'deg', 'rad'), Math.PI);
  close(U.convert('frequency', 120, 'rpm', 'hz'), 2);
});

test('digital storage keeps decimal (kB) and binary (KiB) apart', () => {
  close(U.convert('data', 1, 'gb', 'mb'), 1000);
  close(U.convert('data', 1, 'gib', 'mib'), 1024);
  close(U.convert('data', 1, 'gb', 'gib'), 1e9 / 1024 ** 3);
  close(U.convert('data', 1, 'b', 'bit'), 8);
  close(U.convert('data', 1, 'mbit', 'kb'), 125);
  close(U.convert('data', 256, 'gib', 'gb'), 274.877906944);
});

test('temperature uses formulas, including the absolute-zero and crossover points', () => {
  close(U.convert('temperature', 0, 'c', 'f'), 32);
  close(U.convert('temperature', 100, 'c', 'f'), 212);
  close(U.convert('temperature', -40, 'c', 'f'), -40);
  close(U.convert('temperature', 37, 'c', 'k'), 310.15);
  close(U.convert('temperature', 0, 'k', 'c'), -273.15);
  close(U.convert('temperature', 98.6, 'f', 'c'), 37);
  close(U.convert('temperature', 0, 'k', 'r'), 0);
  close(U.convert('temperature', 80, 're', 'c'), 100);
});

test('fuel economy inverts correctly and survives zero', () => {
  close(U.convert('fuel', 10, 'kml', 'l100'), 10);
  close(U.convert('fuel', 12.5, 'kml', 'l100'), 8);
  close(U.convert('fuel', 8, 'l100', 'kml'), 12.5);
  close(U.convert('fuel', 30, 'mpg-us', 'l100'), 7.84048611);
  close(U.convert('fuel', 30, 'mpg-us', 'kml'), 12.754, 1e-4);
  assert.ok(Number.isNaN(U.convert('fuel', 0, 'kml', 'l100')), 'zero km/L não tem L/100 km finito');
});

test('every conversion round-trips and every category has distinct, positive units', () => {
  for (const category of U.CATEGORIES.filter((item) => !item.special)) {
    const ids = category.units.map((unit) => unit.id);
    assert.equal(new Set(ids).size, ids.length, `${category.id}: ids repetidos`);
    assert.ok(ids.includes(category.from) && ids.includes(category.to), `${category.id}: padrão inválido`);
    for (const a of category.units) for (const b of category.units) {
      const value = category.id === 'temperature' ? 25 : category.id === 'fuel' ? 7 : 13.37;
      const there = U.convert(category.id, value, a.id, b.id);
      close(U.convert(category.id, there, b.id, a.id), value, 1e-9);
    }
    const all = U.convertAll(category.id, 1, category.from);
    assert.equal(all.length, category.units.length);
    close(all.find((entry) => entry.id === category.from).value, 1);
  }
});

test('number input: Brazilian and plain formats, expressions, and no code execution', () => {
  const v = (text) => U.parseInput(text);
  assert.equal(v('1.234,56').value, 1234.56);
  assert.equal(v('1.234.567').value, 1234567);
  assert.equal(v('2,5').value, 2.5);
  assert.equal(v('1 234,5').value, 1234.5, 'espaço como separador de milhar');
  assert.equal(v('2.5').value, 2.5);
  assert.equal(v('1.234').value, 1.234, 'um grupo de 3 dígitos com ponto é decimal');
  assert.equal(v('1e3').value, 1000);
  assert.equal(v('1,5e-3').value, 0.0015);
  assert.equal(v('-7').value, -7);
  assert.equal(v('2 * (3 + 4,5)').value, 15);
  assert.equal(v('10 / 4').value, 2.5);
  assert.equal(v('2^10').value, 1024);
  assert.equal(v('-2^2').value, -4);
  assert.equal(v('2^-1').value, 0.5);
  assert.equal(v('5 × 3 ÷ 2').value, 7.5);
  assert.equal(v('').empty, true);
  for (const bad of ['abc', '2 +', '(1', '1..2', 'process.exit()', 'alert(1)', '1/0', '__proto__', '2**3x']) assert.equal(v(bad).ok, false, bad);
});

test('number bases handle BigInt-size values, prefixes and invalid digits', () => {
  const p = (text, radix) => U.parseInteger(text, radix);
  assert.equal(U.formatInteger(p('255', 10).value, 16), 'FF');
  assert.equal(U.formatInteger(p('0xff', 16).value, 2), '11111111');
  assert.equal(U.formatInteger(p('ff', 16).value, 10), '255');
  assert.equal(U.formatInteger(p('11111111', 2).value, 8), '377');
  assert.equal(U.formatInteger(p('zz', 36).value, 10), '1295');
  assert.equal(U.formatInteger(p('-10', 10).value, 2), '-1010');
  assert.equal(U.formatInteger(p('18446744073709551616', 10).value, 16), '10000000000000000', '2^64 sem perder precisão');
  assert.equal(p('12', 2).ok, false);
  assert.equal(p('g', 16).ok, false);
  assert.equal(p('', 10).empty, true);
  assert.equal(p('9'.repeat(300), 10).ok, false);
});

test('display: significant digits, grouping, scientific and fixed notation', () => {
  const f = (value, options) => U.formatNumber(value, options);
  assert.equal(f(1234.5678, { precision: 6 }), '1.234,57');
  assert.equal(f(0.1 + 0.2, { precision: 10 }), '0,3', 'ruído de ponto flutuante some');
  assert.equal(f(1 / 3, { precision: 5 }), '0,33333');
  assert.equal(f(1e21, {}), '1 × 10^21');
  assert.equal(f(1.5e-9, {}), '1,5 × 10^-9');
  assert.equal(f(12345.678, { notation: 'scientific', precision: 4 }), '1,235 × 10^4');
  assert.equal(f(2.5, { notation: 'fixed', places: 3 }), '2,500');
  assert.equal(f(0, {}), '0');
  assert.equal(f(NaN, {}), '—');
  assert.equal(f(Infinity, {}), '—');
  assert.equal(U.plainNumber(1234.5, 12), '1234.5');
  assert.equal(U.plainNumber(0.1 + 0.2, 12), '0.3');
});
