import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SettingsStore, defaultSettings, isAbsoluteDirectory, sanitizeSettings } from '../src/settings.mjs';

async function sandbox() {
  const directory = await mkdtemp(path.join(tmpdir(), 'arc-settings-'));
  return { directory, filePath: path.join(directory, 'nested', 'settings.json'), cleanup: () => rm(directory, { recursive: true, force: true }) };
}

test('defaults cover every tool and keep destructive modes out of persistence', () => {
  const defaults = defaultSettings();
  assert.deepEqual(Object.keys(defaults.paths), ['compressor', 'resizer', 'converter', 'renamer', 'metadata', 'receiver']);
  assert.equal(defaults.compressor.level, 'lossless');
  assert.equal(defaults.renamer.outputMode, undefined);
});

test('sanitize drops unknown keys and rejects invalid values', () => {
  const clean = sanitizeSettings({
    paths: { compressor: 'relative\\folder', resizer: 'C:\\Fotos\\Saida', hacker: 'x' },
    converter: { format: 'bmp', quality: 500, background: 'red', lossless: 'yes' },
    resizer: { mode: 'percentage', percentage: 75, presetId: 'x'.repeat(100) },
    renamer: { digits: 9, pattern: 'a\u0000b' },
    evil: { a: 1 }
  });
  assert.equal(clean.paths.compressor, '');
  assert.equal(clean.paths.resizer, 'C:\\Fotos\\Saida');
  assert.equal(clean.paths.hacker, undefined);
  assert.equal(clean.converter.format, 'webp');
  assert.equal(clean.converter.quality, 88);
  assert.equal(clean.converter.background, '#ffffff');
  assert.equal(clean.converter.lossless, false);
  assert.equal(clean.resizer.mode, 'percentage');
  assert.equal(clean.resizer.percentage, 75);
  assert.equal(clean.resizer.presetId, 'instagram-square');
  assert.equal(clean.renamer.digits, 3);
  assert.equal(clean.renamer.pattern, '{nome}-{n}');
  assert.equal(clean.evil, undefined);
});

test('absolute directory check accepts Windows and POSIX paths only', () => {
  assert.equal(isAbsoluteDirectory('C:\\Users\\Ana\\Pictures'), true);
  assert.equal(isAbsoluteDirectory('/home/ana'), true);
  assert.equal(isAbsoluteDirectory('..\\up'), false);
  assert.equal(isAbsoluteDirectory(''), false);
  assert.equal(isAbsoluteDirectory(42), false);
});

test('values survive a restart and are written atomically', async () => {
  const box = await sandbox();
  try {
    const first = new SettingsStore({ filePath: box.filePath, debounceMs: 5 });
    assert.deepEqual(first.load(), { firstRun: true, recovered: false });
    first.update({ paths: { receiver: 'D:\\Recebidos' }, converter: { format: 'avif', quality: 60 } });
    await first.save();
    assert.deepEqual((await readdir(path.dirname(box.filePath))).filter((name) => name.endsWith('.tmp')), []);

    const second = new SettingsStore({ filePath: box.filePath });
    assert.deepEqual(second.load(), { firstRun: false, recovered: false });
    assert.equal(second.get().paths.receiver, 'D:\\Recebidos');
    assert.equal(second.get().converter.format, 'avif');
    assert.equal(second.get().converter.quality, 60);
    assert.equal(second.get().resizer.mode, 'dimensions');
  } finally { await box.cleanup(); }
});

test('partial updates keep earlier values', async () => {
  const box = await sandbox();
  try {
    const store = new SettingsStore({ filePath: box.filePath, debounceMs: 5 });
    store.load();
    store.update({ converter: { format: 'png' } });
    store.update({ converter: { quality: 10 } });
    assert.equal(store.get().converter.format, 'png');
    assert.equal(store.get().converter.quality, 10);
  } finally { await box.cleanup(); }
});

test('a corrupted file is set aside, defaults load, and nothing is lost', async () => {
  const box = await sandbox();
  try {
    const store = new SettingsStore({ filePath: box.filePath });
    store.update({ ui: { lastTool: 'resizer' } });
    await store.save();
    await writeFile(box.filePath, '{ not json', 'utf8');

    const reborn = new SettingsStore({ filePath: box.filePath, onError: () => {} });
    assert.deepEqual(reborn.load(), { firstRun: false, recovered: true });
    assert.equal(reborn.get().ui.lastTool, 'compressor');
    const names = await readdir(path.dirname(box.filePath));
    assert.ok(names.some((name) => name.startsWith('settings.json.corrupt-')));
  } finally { await box.cleanup(); }
});

test('flushSync persists pending changes on the quit path', async () => {
  const box = await sandbox();
  try {
    const store = new SettingsStore({ filePath: box.filePath, debounceMs: 60000 });
    store.load();
    store.update({ ui: { lastTool: 'metadata' } });
    store.flushSync();
    const saved = JSON.parse(await readFile(box.filePath, 'utf8'));
    assert.equal(saved.ui.lastTool, 'metadata');
  } finally { await box.cleanup(); }
});

test('Prompt Gen keeps its options and draft, but never the pasted material or examples', () => {
  const clean = sanitizeSettings({
    promptGen: { target: 'claude', style: 'markdown', clarify: 'ask', reasoning: true, promptLanguage: 'klingon' },
    promptDraft: { idea: 'linha 1\nlinha 2\tcom tab', context: 'x\u0007y', material: 'segredo', exampleIn: 'segredo', role: 'duas\nlinhas' }
  });
  assert.equal(clean.promptGen.target, 'claude');
  assert.equal(clean.promptGen.style, 'markdown');
  assert.equal(clean.promptGen.clarify, 'ask');
  assert.equal(clean.promptGen.reasoning, true);
  assert.equal(clean.promptGen.promptLanguage, 'pt', 'valor inválido volta ao padrão');
  assert.equal(clean.promptDraft.idea, 'linha 1\nlinha 2\tcom tab', 'quebras de linha são permitidas no rascunho');
  assert.equal(clean.promptDraft.context, '', 'caractere de controle é rejeitado');
  assert.equal(clean.promptDraft.role, '', 'campo de linha única não aceita quebra de linha');
  assert.equal(clean.promptDraft.material, undefined);
  assert.equal(clean.promptDraft.exampleIn, undefined);
});

test('Prompt Gen factory defaults are the most common setup: ChatGPT with plain-text messages', () => {
  const defaults = defaultSettings().promptGen;
  assert.equal(defaults.target, 'gpt');
  assert.equal(defaults.style, 'plain');
  assert.equal(defaults.promptLanguage, 'pt');
  assert.equal(defaults.clarify, 'assume');
  assert.equal(defaults.grounding, true);
  assert.equal(defaults.verify, true);
  assert.equal(defaults.reasoning, false);
});
