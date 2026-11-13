import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { LIMITS, classifyByName, collectAttachments, looksLikeText } from '../src/attachments.mjs';

async function projectFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'arc-attach-'));
  const project = path.join(root, 'proj');
  await mkdir(path.join(project, 'src', 'util'), { recursive: true });
  await mkdir(path.join(project, 'node_modules', 'pacote'), { recursive: true });
  await mkdir(path.join(project, '.git'), { recursive: true });
  await writeFile(path.join(project, 'README.md'), '# Projeto\r\nTexto com acentuação: ção.\r\n');
  await writeFile(path.join(project, 'src', 'main.js'), 'console.log("oi");\n');
  await writeFile(path.join(project, 'src', 'util', 'fmt.py'), 'def fmt(x):\n    return x\n');
  await writeFile(path.join(project, 'notes'), 'arquivo sem extensão, mas é texto');
  await writeFile(path.join(project, '.env'), 'API_KEY=segredo-super-secreto');
  await writeFile(path.join(project, '.env.example'), 'API_KEY=coloque-aqui');
  await writeFile(path.join(project, 'id_rsa'), 'chave privada');
  await writeFile(path.join(project, 'package-lock.json'), '{"lockfileVersion":3}');
  await writeFile(path.join(project, 'bundle.min.js'), 'var a=1;');
  await writeFile(path.join(project, 'data.bin'), Buffer.from([1, 2, 0, 3, 4, 0, 255]));
  await writeFile(path.join(project, 'mistério'), Buffer.from([0, 0, 0, 1, 2, 3]));
  await writeFile(path.join(project, 'node_modules', 'pacote', 'index.js'), 'module.exports = 1;');
  await writeFile(path.join(project, '.git', 'config'), '[core]');
  await sharp({ create: { width: 64, height: 32, channels: 3, background: '#888' } }).png().toFile(path.join(project, 'logo.png'));
  return { root, project, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('classifies by name: secrets, generated files, binaries, images and text', () => {
  assert.equal(classifyByName('.env').kind, 'secret');
  assert.equal(classifyByName('.env.production').kind, 'secret');
  assert.equal(classifyByName('.env.example').kind, 'text', 'o modelo de .env não tem segredos');
  assert.equal(classifyByName('server.pem').kind, 'secret');
  assert.equal(classifyByName('id_ed25519').kind, 'secret');
  assert.equal(classifyByName('package-lock.json').kind, 'ignored');
  assert.equal(classifyByName('app.min.js').kind, 'ignored');
  assert.equal(classifyByName('relatorio.pdf').kind, 'binary');
  assert.equal(classifyByName('foto.JPG').kind, 'image');
  assert.equal(classifyByName('main.mjs').kind, 'text');
  assert.equal(classifyByName('Dockerfile').kind, 'text');
  assert.equal(classifyByName('qualquercoisa.xyz').kind, 'unknown');
});

test('sniffs text versus binary content', () => {
  assert.equal(looksLikeText(Buffer.from('olá, mundo ção')), true);
  assert.equal(looksLikeText(Buffer.from([72, 0, 105])), false);
  assert.equal(looksLikeText(Buffer.alloc(0)), true);
  assert.equal(looksLikeText(Buffer.from([0xff, 0xfe, 0xfd, 0xfc, 0xfb, 0xfa, 0xf9, 0xf8, 0xf7, 0xf6])), false);
});

test('reads a folder: text with content, images with size, and never secrets or dependency folders', async () => {
  const box = await projectFixture();
  try {
    const result = await collectAttachments([box.project]);
    const byPath = Object.fromEntries(result.entries.map((entry) => [entry.relativePath, entry]));
    assert.equal(byPath['proj/src/main.js'].kind, 'text');
    assert.equal(byPath['proj/src/main.js'].content, 'console.log("oi");\n');
    assert.equal(byPath['proj/src/main.js'].lines, 2);
    assert.equal(byPath['proj/README.md'].content.includes('\r'), false, 'quebras de linha normalizadas');
    assert.match(byPath['proj/README.md'].content, /acentuação: ção/);
    assert.equal(byPath['proj/notes'].kind, 'text', 'sem extensão, mas é texto');
    assert.equal(byPath['proj/.env.example'].kind, 'text');
    assert.equal(byPath['proj/logo.png'].kind, 'image');
    assert.deepEqual([byPath['proj/logo.png'].width, byPath['proj/logo.png'].height], [64, 32]);

    for (const secret of ['proj/.env', 'proj/id_rsa']) {
      assert.equal(byPath[secret].kind, 'secret');
      assert.equal(byPath[secret].content, undefined, 'o conteúdo de um arquivo secreto nunca é lido');
    }
    assert.equal(byPath['proj/package-lock.json'].kind, 'ignored');
    assert.equal(byPath['proj/bundle.min.js'].kind, 'ignored');
    assert.equal(byPath['proj/data.bin'].kind, 'binary');
    assert.equal(byPath['proj/mistério'].kind, 'binary');
    assert.equal(byPath['proj/data.bin'].content, undefined);

    assert.ok(!Object.keys(byPath).some((name) => name.includes('node_modules') || name.includes('.git/')), 'pastas de dependências e .git ficam de fora');
    assert.deepEqual(result.skippedDirectories, ['.git', 'node_modules']);
    assert.equal(result.limitReached, false);
    assert.ok(result.entries.every((entry, index, all) => index === 0 || all[index - 1].relativePath.localeCompare(entry.relativePath) <= 0), 'ordenado por caminho');
    assert.ok(!JSON.stringify(result.entries).includes('segredo-super-secreto'));
  } finally { await box.cleanup(); }
});

test('individual files are accepted, duplicates are removed, and a missing path is ignored', async () => {
  const box = await projectFixture();
  try {
    const file = path.join(box.project, 'src', 'main.js');
    const result = await collectAttachments([file, file, path.join(box.root, 'nao-existe.txt'), 42, '', path.join(box.project, 'src')]);
    const names = result.entries.map((entry) => entry.relativePath);
    // main.js was added first as a single file; the folder walk then finds the same file and does not add it again.
    assert.deepEqual(names.sort(), ['main.js', 'src/util/fmt.py'].sort());
  } finally { await box.cleanup(); }
});

test('large files are read only up to the limit and flagged as truncated', async () => {
  const box = await projectFixture();
  try {
    const big = path.join(box.project, 'big.txt');
    await writeFile(big, `${'linha de texto muito comprida para encher o arquivo\n'.repeat(20000)}`);
    const { entries } = await collectAttachments([big]);
    assert.equal(entries[0].kind, 'text');
    assert.equal(entries[0].truncated, true);
    assert.ok(entries[0].content.length <= LIMITS.maxReadBytes);
    assert.ok(entries[0].size > LIMITS.maxReadBytes);
  } finally { await box.cleanup(); }
});

test('respects the file-count, depth and total-read limits', async () => {
  const box = await projectFixture();
  try {
    const limited = await collectAttachments([box.project], { limits: { ...LIMITS, maxFiles: 3 } });
    assert.equal(limited.entries.length, 3);
    assert.equal(limited.limitReached, true);

    const shallow = await collectAttachments([box.project], { limits: { ...LIMITS, maxDepth: 0 } });
    assert.ok(!shallow.entries.some((entry) => entry.relativePath.startsWith('proj/src/util/')));

    const tinyBudget = await collectAttachments([box.project], { limits: { ...LIMITS, maxTotalBytes: 40 } });
    const withContent = tinyBudget.entries.filter((entry) => entry.kind === 'text' && typeof entry.content === 'string');
    assert.ok(withContent.reduce((sum, entry) => sum + Buffer.byteLength(entry.content), 0) <= 40 + 8);
    assert.ok(tinyBudget.entries.some((entry) => entry.reason === 'limite total de leitura atingido'));
  } finally { await box.cleanup(); }
});

test('symbolic links are never followed', async (context) => {
  const box = await projectFixture();
  try {
    try { await symlink(path.join(box.project, 'src'), path.join(box.project, 'atalho'), 'junction'); }
    catch { context.skip('o sistema não permitiu criar o link simbólico'); return; }
    const { entries } = await collectAttachments([box.project]);
    assert.ok(!entries.some((entry) => entry.relativePath.startsWith('proj/atalho')));
    assert.equal((await collectAttachments([path.join(box.project, 'atalho')])).entries.length, 0, 'um link escolhido diretamente também é ignorado');
  } finally { await box.cleanup(); }
});
