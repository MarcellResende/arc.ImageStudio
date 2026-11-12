import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findLanAddresses, sanitizeFileName, WifiReceiver } from '../src/wifi-receiver.mjs';

test('sanitizeFileName blocks traversal and Windows reserved characters', () => {
  assert.equal(sanitizeFileName('../../foto:verão?.jpg'), 'foto_verão_.jpg');
  assert.equal(sanitizeFileName('  relatório final.png. '), 'relatório final.png');
  assert.equal(sanitizeFileName('..'), 'arquivo');
  assert.equal(sanitizeFileName('CON.txt'), '_CON.txt');
});

test('findLanAddresses prefers Wi-Fi and ignores public or internal addresses', () => {
  const addresses = findLanAddresses({
    Ethernet: [{ family: 'IPv4', address: '192.168.1.5', internal: false }],
    'Wi-Fi': [{ family: 'IPv4', address: '10.0.0.8', internal: false }],
    Public: [{ family: 'IPv4', address: '8.8.8.8', internal: false }],
    Loopback: [{ family: 'IPv4', address: '127.0.0.1', internal: true }]
  });
  assert.deepEqual(addresses.map((item) => item.address), ['10.0.0.8', '192.168.1.5']);
});

test('receiver streams exact bytes, validates its token and avoids overwrites', async (context) => {
  const destinationRoot = await mkdtemp(path.join(tmpdir(), 'arc-wifi-receiver-'));
  const events = [];
  const receiver = new WifiReceiver({ onEvent: (event) => events.push(event), maxFileBytes: 1024 * 1024 });
  context.after(async () => {
    await receiver.stop();
    await rm(destinationRoot, { recursive: true, force: true });
  });

  const state = await receiver.start({ destinationRoot, host: '127.0.0.1', advertisedAddress: '127.0.0.1' });
  assert.equal(state.running, true);
  assert.match(state.url, /^http:\/\/127\.0\.0\.1:\d+\/\?token=/);

  const token = new URL(state.url).searchParams.get('token');
  const page = await fetch(state.url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Enviar arquivos para o PC/);

  const denied = await fetch(`http://127.0.0.1:${state.port}/health?token=errado`);
  assert.equal(denied.status, 403);

  const original = Buffer.concat([
    Buffer.from([0, 255, 31, 17, 88, 0, 9]),
    Buffer.from('conteúdo binário sem recompressão', 'utf8')
  ]);
  const upload = async () => fetch(`http://127.0.0.1:${state.port}/upload?token=${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-ARC-File-Name': encodeURIComponent('férias 2026.jpg'),
      'Content-Length': String(original.length)
    },
    body: original
  });

  const firstResponse = await upload();
  assert.equal(firstResponse.status, 201);
  const firstResult = await firstResponse.json();
  assert.equal(firstResult.sha256, createHash('sha256').update(original).digest('hex'));
  assert.deepEqual(await readFile(path.join(destinationRoot, 'férias 2026.jpg')), original);

  const secondResponse = await upload();
  assert.equal(secondResponse.status, 201);
  assert.deepEqual(await readFile(path.join(destinationRoot, 'férias 2026 (2).jpg')), original);

  const names = await readdir(destinationRoot);
  assert.deepEqual(names.sort(), ['férias 2026 (2).jpg', 'férias 2026.jpg']);
  assert.equal(events.filter((event) => event.type === 'upload-completed').length, 2);
  assert.equal(receiver.publicState().receivedBytes, original.length * 2);
});
