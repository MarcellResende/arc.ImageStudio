import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { HashJob, availableAlgorithms, collectFiles, detectAlgorithms, formatChecksums, hashBuffer, hashFile, hashText, matchHash, normalizeHex, parseChecksums, sanitizeAlgorithms } from '../src/hasher.mjs';

const ALL = ['crc32', 'md5', 'sha1', 'sha256', 'sha384', 'sha512'];

test('algorithms: all six are available and unknown ones are dropped', () => {
  assert.deepEqual(availableAlgorithms().map((item) => item.id), ALL);
  assert.deepEqual(sanitizeAlgorithms(['sha256', 'bogus', 'md5', 'md5']), ['sha256', 'md5']);
  assert.deepEqual(sanitizeAlgorithms(['x']), ['sha256']);
  assert.deepEqual(sanitizeAlgorithms('nope'), ['sha256']);
});

test('digests match the published test vectors', () => {
  const abc = hashBuffer(Buffer.from('abc'), ALL);
  assert.equal(abc.md5, '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(abc.sha1, 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(abc.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(abc.sha384, 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7');
  assert.equal(abc.sha512.slice(0, 32), 'ddaf35a193617abacc417349ae204131');
  assert.equal(hashBuffer(Buffer.from('123456789'), ['crc32']).crc32, 'cbf43926');
  assert.equal(hashBuffer(Buffer.alloc(0), ['crc32', 'md5']).crc32, '00000000');
  assert.equal(hashBuffer(Buffer.alloc(0), ['md5']).md5, 'd41d8cd98f00b204e9800998ecf8427e');
});

test('text hashing uses UTF-8 and refuses absurd sizes', () => {
  assert.equal(hashText('ação', ['sha256']).hashes.sha256, createHash('sha256').update(Buffer.from('ação', 'utf8')).digest('hex'));
  assert.equal(hashText('ação', ['md5']).bytes, 6);
  assert.throws(() => hashText('x'.repeat(9 * 1024 * 1024), ['md5']), /8 MB/);
  assert.throws(() => hashText(42, ['md5']), /inválido/);
});

async function withTemp(run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'arc-hash-'));
  try { return await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('streaming a file in several chunks equals hashing the whole buffer, and progress is reported', async () => {
  await withTemp(async (dir) => {
    const data = Buffer.alloc(3 * 1024 * 1024 + 123, 7);
    data.writeUInt32LE(0xdeadbeef, 1000);
    const file = path.join(dir, 'big.bin');
    await writeFile(file, data);
    const progress = [];
    const result = await hashFile(file, ALL, { onProgress: (read, total) => progress.push([read, total]) });
    assert.equal(result.size, data.length);
    assert.deepEqual(result.hashes, hashBuffer(data, ALL));
    assert.deepEqual(progress.at(-1), [data.length, data.length]);
    const empty = path.join(dir, 'empty');
    await writeFile(empty, '');
    assert.equal((await hashFile(empty, ['md5'])).hashes.md5, 'd41d8cd98f00b204e9800998ecf8427e');
    await assert.rejects(hashFile(dir, ['md5']), /arquivo/i);
    await assert.rejects(hashFile(path.join(dir, 'nao-existe'), ['md5']));
  });
});

test('cancelling stops a file mid-way', async () => {
  await withTemp(async (dir) => {
    const file = path.join(dir, 'x.bin');
    await writeFile(file, Buffer.alloc(8 * 1024 * 1024, 1));
    const controller = new AbortController();
    const pending = hashFile(file, ['sha512'], { signal: controller.signal, onProgress: () => controller.abort() });
    await assert.rejects(pending, (error) => error.name === 'AbortError');
    const already = new AbortController();
    already.abort();
    await assert.rejects(hashFile(file, ['md5'], { signal: already.signal }), (error) => error.name === 'AbortError');
  });
});

test('collectFiles flattens folders, keeps relative paths, dedupes and reports what it skipped', async () => {
  await withTemp(async (dir) => {
    await mkdir(path.join(dir, 'pasta', 'sub'), { recursive: true });
    await writeFile(path.join(dir, 'pasta', 'a.txt'), 'a');
    await writeFile(path.join(dir, 'pasta', 'sub', 'b.txt'), 'bb');
    await writeFile(path.join(dir, 'solto.txt'), 'ccc');
    let linked = false;
    try { await symlink(path.join(dir, 'solto.txt'), path.join(dir, 'pasta', 'atalho.txt')); linked = true; } catch { /* needs privileges on Windows */ }
    const result = await collectFiles([path.join(dir, 'pasta'), path.join(dir, 'solto.txt'), path.join(dir, 'pasta', 'a.txt'), path.join(dir, 'fantasma'), 'relativo.txt', 42]);
    assert.deepEqual(result.files.map((file) => file.relative), ['pasta/a.txt', 'pasta/sub/b.txt', 'solto.txt']);
    assert.deepEqual(result.files.map((file) => file.size), [1, 2, 3]);
    assert.ok(result.skipped.some((item) => /não encontrado/.test(item.reason)));
    if (linked) assert.ok(result.skipped.some((item) => /link simbólico/.test(item.reason)));
    assert.equal(result.truncated, false);
    const limited = await collectFiles([path.join(dir, 'pasta')], { limit: 1 });
    assert.equal(limited.files.length, 1);
    assert.equal(limited.truncated, true);
  });
});

test('comparison: detects the algorithm by length and ignores formatting noise', () => {
  assert.deepEqual(detectAlgorithms('cbf43926'), ['crc32']);
  assert.deepEqual(detectAlgorithms('900150983cd24fb0d6963f7d28e17f72'), ['md5']);
  assert.deepEqual(detectAlgorithms('a9993e364706816aba3e25717850c26c9cd0d89d'), ['sha1']);
  assert.deepEqual(detectAlgorithms('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'), ['sha256']);
  assert.deepEqual(detectAlgorithms('zzzz'), []);
  assert.deepEqual(detectAlgorithms('abc'), []);
  assert.equal(normalizeHex(' 0xBA:78 16bf '), 'ba7816bf');
  const hashes = hashBuffer(Buffer.from('abc'), ALL);
  assert.equal(matchHash('BA78 16BF 8F01 CFEA 4141 40DE 5DAE 2223 B003 61A3 9617 7A9C B410 FF61 F200 15AD', hashes), 'sha256');
  assert.equal(matchHash('900150983CD24FB0D6963F7D28E17F72', hashes), 'md5');
  assert.equal(matchHash('900150983cd24fb0d6963f7d28e17f73', hashes), null, 'um dígito diferente');
  assert.equal(matchHash('', hashes), null);
});

test('checksum files: GNU, BSD, comments, binary marker and bad lines', () => {
  const sha = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const md5 = '900150983cd24fb0d6963f7d28e17f72';
  const text = ['# gerado por alguém', `${sha}  arquivo um.txt`, `${md5} *pasta/dois.bin`, `SHA256 (tres.iso) = ${sha.toUpperCase()}`, `MD5 (quatro) = ${md5}`, 'lixo sem hash', '; comentário', 'abc  curto.txt', ''].join('\r\n');
  const entries = parseChecksums(text);
  assert.deepEqual(entries.map((entry) => [entry.name, entry.algorithm, entry.hash.length]), [['arquivo um.txt', 'sha256', 64], ['pasta/dois.bin', 'md5', 32], ['tres.iso', 'sha256', 64], ['quatro', 'md5', 32]]);
  assert.equal(entries[2].hash, sha, 'hash em maiúsculas é normalizado');
  assert.deepEqual(parseChecksums(''), []);
});

test('formatChecksums writes "hash *relative/path" lines that parseChecksums reads back', () => {
  const rows = [{ relative: 'pasta\\a.txt', name: 'a.txt', hashes: { sha256: 'a'.repeat(64) } }, { name: 'b.txt', hashes: { sha256: 'b'.repeat(64) } }, { name: 'sem.txt', hashes: {} }];
  const out = formatChecksums(rows, 'sha256');
  assert.equal(out, `${'a'.repeat(64)} *pasta/a.txt\n${'b'.repeat(64)} *b.txt\n`);
  assert.deepEqual(parseChecksums(out).map((entry) => entry.name), ['pasta/a.txt', 'b.txt']);
  assert.throws(() => formatChecksums(rows, 'md5'), /Não há hashes/);
  assert.throws(() => formatChecksums(rows, 'whirlpool'), /inválido/);
});

test('HashJob runs files in order, reports errors per file, supports cancel and refuses overlap', async () => {
  await withTemp(async (dir) => {
    const one = path.join(dir, 'um.txt');
    const two = path.join(dir, 'dois.txt');
    await writeFile(one, 'abc');
    await writeFile(two, 'abcd');
    const job = new HashJob();
    const events = [];
    const summary = await job.run([one, path.join(dir, 'fantasma.txt'), two], ['md5', 'sha256'], (event) => events.push(event));
    assert.equal(job.running, false);
    assert.deepEqual({ done: summary.done, failed: summary.failed, cancelled: summary.cancelled, bytes: summary.bytes }, { done: 2, failed: 1, cancelled: false, bytes: 7 });
    assert.deepEqual(events.filter((event) => event.type === 'file-start').map((event) => event.index), [0, 1, 2]);
    assert.equal(events.find((event) => event.type === 'file-done' && event.index === 0).hashes.md5, '900150983cd24fb0d6963f7d28e17f72');
    assert.match(events.find((event) => event.type === 'file-error').error, /não encontrado/i);
    assert.equal(events.at(-1).type, 'done');

    await assert.rejects(job.run([], ['md5'], () => {}), /Nenhum arquivo/);
    await assert.rejects(job.run(['relativo'], ['md5'], () => {}), /Nenhum arquivo/);

    const big = path.join(dir, 'grande.bin');
    await writeFile(big, Buffer.alloc(16 * 1024 * 1024, 3));
    const cancelEvents = [];
    const running = job.run([big, one], ['sha512'], (event) => { cancelEvents.push(event); if (event.type === 'progress') job.cancel(); });
    await assert.rejects(job.run([one], ['md5'], () => {}), /em andamento/);
    const cancelled = await running;
    assert.equal(cancelled.cancelled, true);
    assert.equal(cancelEvents.some((event) => event.type === 'file-start' && event.index === 1), false, 'o segundo arquivo não começa');
  });
});
