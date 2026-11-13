import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { WifiSender } from '../src/wifi-sender.mjs';

test('sender serves exact bytes, protects the session and supports byte ranges', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'arc-wifi-sender-'));
  const sourcePath = path.join(directory, 'vídeo original.bin');
  const original = Buffer.concat([
    Buffer.from([0, 255, 17, 22, 0, 91]),
    Buffer.from('arquivo enviado sem recompressão', 'utf8'),
    Buffer.from(Array.from({ length: 2048 }, (_, index) => index % 251))
  ]);
  await writeFile(sourcePath, original);
  const events = [];
  const sender = new WifiSender({ onEvent: (event) => events.push(event) });
  context.after(async () => {
    await sender.stop();
    await rm(directory, { recursive: true, force: true });
  });

  const state = await sender.start({
    items: [{ path: sourcePath }],
    host: '127.0.0.1',
    advertisedAddress: '127.0.0.1'
  });
  assert.equal(state.running, true);
  assert.equal(state.files.length, 1);
  const url = new URL(state.url);
  const token = url.searchParams.get('token');

  const page = await fetch(state.url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Arquivos prontos para baixar/);

  const denied = await fetch(`http://127.0.0.1:${state.port}/api/files?token=inválido`);
  assert.equal(denied.status, 403);

  const list = await fetch(`http://127.0.0.1:${state.port}/api/files?token=${token}`).then((response) => response.json());
  assert.equal(list.files[0].name, 'vídeo original.bin');
  assert.equal(list.files[0].size, original.length);
  assert.equal('path' in list.files[0], false);

  const downloadUrl = `http://127.0.0.1:${state.port}/download/${list.files[0].id}?token=${token}`;
  const download = await fetch(downloadUrl);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('accept-ranges'), 'bytes');
  assert.match(download.headers.get('content-disposition'), /filename\*=UTF-8''v%C3%ADdeo%20original\.bin/);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), original);

  const ranged = await fetch(downloadUrl, { headers: { Range: 'bytes=10-99' } });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get('content-range'), `bytes 10-99/${original.length}`);
  assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), original.subarray(10, 100));

  const allResponse = await fetch(`http://127.0.0.1:${state.port}/download-all?token=${token}`);
  assert.equal(allResponse.status, 200);
  assert.equal(allResponse.headers.get('content-type'), 'application/zip');
  const zip = Buffer.from(await allResponse.arrayBuffer());
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt16LE(8), 0, 'os arquivos devem ser armazenados no ZIP sem recompressão');
  const nameLength = zip.readUInt16LE(26);
  const extraLength = zip.readUInt16LE(28);
  const entryName = zip.subarray(30, 30 + nameLength).toString('utf8');
  const entryStart = 30 + nameLength + extraLength;
  assert.equal(entryName, 'vídeo original.bin');
  assert.deepEqual(zip.subarray(entryStart, entryStart + original.length), original);

  assert.equal(events.filter((event) => event.type === 'download-completed').length, 3);
  assert.equal(sender.publicState().sentBytes, original.length + 90 + zip.length);
});
