import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SCHEMA } from '../src/settings.mjs';
import { ALGORITHM_IDS } from '../src/hasher.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('Hash and Unit Converter: every element id the code looks up exists in the HTML, and scripts load in order', async () => {
  const html = await read('src/renderer/index.html');
  const app = await read('src/renderer/app.js');
  for (const prefix of ['fh', 'uc']) {
    const ids = [...new Set([...app.matchAll(new RegExp(`\\$\\('#(${prefix}-[a-z-]+)'\\)`, 'g'))].map((match) => match[1]))];
    assert.ok(ids.length > 15, `${prefix}: ids lidos`);
    for (const id of ids) assert.ok(html.includes(`id="${id}"`), `${id}: ausente no HTML`);
  }
  assert.ok(html.indexOf('units-engine.js') > 0 && html.indexOf('units-engine.js') < html.indexOf('app.js'), 'o motor de unidades carrega antes do app.js');
  assert.equal((html.match(/<section id="file-hash-view"/g) || []).length, 1);
  assert.equal((html.match(/<section id="unit-converter-view"/g) || []).length, 1);
});

test('settings: hash keeps only the algorithm choice; units keep category, precision and notation', () => {
  assert.deepEqual(Object.keys(SCHEMA.fileHash).sort(), ['algorithms', 'uppercase']);
  assert.deepEqual(SCHEMA.fileHash.algorithms[1], ['sha256']);
  assert.deepEqual(SCHEMA.fileHash.algorithms[0](['md5', 'sha256'], ['sha256']), ['md5', 'sha256']);
  assert.deepEqual(SCHEMA.fileHash.algorithms[0](['md5', 'whirlpool'], ['sha256']), ['sha256'], 'um id desconhecido invalida a lista inteira');
  assert.deepEqual([...ALGORITHM_IDS].sort(), ['crc32', 'md5', 'sha1', 'sha256', 'sha384', 'sha512']);
  assert.deepEqual(Object.keys(SCHEMA.units).sort(), ['category', 'notation', 'pairs', 'places', 'precision']);
  assert.equal(SCHEMA.units.precision[0](99, 10), 10);
  assert.equal(SCHEMA.units.precision[0](7, 10), 7);
  assert.equal(SCHEMA.units.notation[0]('scientific', 'auto'), 'scientific');
  assert.equal(SCHEMA.units.notation[0]('rot13', 'auto'), 'auto');
  assert.equal(SCHEMA.units.pairs[0]('x'.repeat(5000), '{}'), '{}');
});
