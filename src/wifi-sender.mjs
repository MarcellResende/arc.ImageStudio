import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import yazl from 'yazl';
import { findLanAddresses, isPrivateIpv4 } from './wifi-receiver.mjs';

const MOBILE_ROOT = new URL('./sender/mobile.html', import.meta.url);
const MOBILE_CSS = new URL('./sender/mobile.css', import.meta.url);
const MOBILE_JS = new URL('./sender/mobile.js', import.meta.url);
const MAX_SESSION_FILES = 10000;
const MAX_CONCURRENT_DOWNLOADS = 4;

function requestAddress(request) {
  return String(request.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function hasValidToken(url, expectedToken) {
  const provided = url.searchParams.get('token') || '';
  if (!provided || provided.length !== expectedToken.length) return false;
  let different = 0;
  for (let index = 0; index < expectedToken.length; index += 1) different |= provided.charCodeAt(index) ^ expectedToken.charCodeAt(index);
  return different === 0;
}

function securityHeaders(type, length) {
  return {
    'Content-Type': type,
    'Content-Length': length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };
}

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, securityHeaders(type, Buffer.byteLength(body)));
  response.end(body);
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value));
}

function encodedFileName(fileName) {
  const ascii = String(fileName).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii || 'arquivo'}"; filename*=UTF-8''${encoded}`;
}

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header).trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return { invalid: true };
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return { invalid: true };
  return { start, end: Math.min(end, size - 1) };
}

function uniqueArchiveName(fileName, usedNames) {
  const parsed = path.parse(fileName);
  for (let index = 0; index < 10000; index += 1) {
    const suffix = index ? ` (${index + 1})` : '';
    const candidate = `${parsed.name}${suffix}${parsed.ext}`;
    const key = candidate.toLowerCase();
    if (!usedNames.has(key)) {
      usedNames.add(key);
      return candidate;
    }
  }
  return `${randomBytes(6).toString('hex')}-${fileName}`;
}

export class WifiSender {
  constructor({ onEvent = () => {} } = {}) {
    this.onEvent = onEvent;
    this.server = null;
    this.token = '';
    this.startedAt = '';
    this.addresses = [];
    this.port = 0;
    this.files = [];
    this.activeDownloads = 0;
    this.downloadCount = 0;
    this.sentBytes = 0;
    this.downloads = [];
    this.sockets = new Set();
    this.mobileAssets = null;
  }

  publicState() {
    const urls = this.addresses.map(({ address, name }) => ({ address, name, url: `http://${address}:${this.port}/?token=${this.token}` }));
    return {
      running: Boolean(this.server),
      startedAt: this.startedAt,
      port: this.port,
      url: urls[0]?.url || '',
      addresses: urls,
      files: this.files.map(({ id, path: filePath, name, size }) => ({ id, path: filePath, name, relativePath: name, size })),
      activeDownloads: this.activeDownloads,
      downloadCount: this.downloadCount,
      sentBytes: this.sentBytes,
      downloads: this.downloads.slice(-100)
    };
  }

  async start({ items, host = '0.0.0.0', advertisedAddress = '' } = {}) {
    if (this.server) return this.publicState();
    if (!Array.isArray(items) || !items.length) throw new Error('Escolha pelo menos um arquivo para enviar.');
    if (items.length > MAX_SESSION_FILES) throw new Error('A sessão aceita até 10.000 arquivos.');
    const candidates = advertisedAddress ? [{ address: advertisedAddress, name: 'Rede local' }] : findLanAddresses();
    if (!candidates.length) throw new Error('Nenhuma rede local ativa foi encontrada. Conecte o PC ao Wi-Fi e tente novamente.');

    const seen = new Set();
    const files = [];
    for (const item of items) {
      if (typeof item?.path !== 'string' || !item.path) continue;
      const resolvedPath = path.resolve(item.path);
      const key = resolvedPath.toLowerCase();
      if (seen.has(key)) continue;
      const info = await stat(resolvedPath).catch(() => null);
      if (!info?.isFile()) continue;
      seen.add(key);
      files.push({ id: randomBytes(12).toString('hex'), path: resolvedPath, name: path.basename(resolvedPath), size: info.size });
    }
    if (!files.length) throw new Error('Os arquivos selecionados não estão mais disponíveis.');

    this.mobileAssets = this.mobileAssets || await Promise.all([
      readFile(MOBILE_ROOT, 'utf8'), readFile(MOBILE_CSS, 'utf8'), readFile(MOBILE_JS, 'utf8')
    ]);
    this.files = files;
    this.token = randomBytes(24).toString('base64url');
    this.startedAt = new Date().toISOString();
    this.addresses = candidates;
    this.activeDownloads = 0;
    this.downloadCount = 0;
    this.sentBytes = 0;
    this.downloads = [];

    const server = createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        if (!response.headersSent) sendJson(response, 500, { ok: false, error: error.message || 'Falha ao enviar o arquivo.' });
        else response.destroy(error);
      });
    });
    server.requestTimeout = 0;
    server.headersTimeout = 30000;
    server.maxHeadersCount = 32;
    server.on('connection', (socket) => {
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
    });

    await new Promise((resolve, reject) => {
      const fail = (error) => { server.off('listening', ready); reject(error); };
      const ready = () => { server.off('error', fail); resolve(); };
      server.once('error', fail);
      server.once('listening', ready);
      server.listen(0, host);
    });
    this.server = server;
    this.port = server.address().port;
    const state = this.publicState();
    this.onEvent({ type: 'session-started', state });
    return state;
  }

  async stop() {
    const server = this.server;
    if (!server) return this.publicState();
    this.server = null;
    for (const socket of this.sockets) socket.destroy();
    await new Promise((resolve) => server.close(() => resolve())).catch(() => {});
    this.sockets.clear();
    this.token = '';
    this.port = 0;
    this.addresses = [];
    this.activeDownloads = 0;
    const state = this.publicState();
    this.onEvent({ type: 'session-stopped', state });
    return state;
  }

  async handleRequest(request, response) {
    const address = requestAddress(request);
    if (!isPrivateIpv4(address)) return sendJson(response, 403, { ok: false, error: 'Acesso permitido somente pela rede local.' });
    const url = new URL(request.url || '/', 'http://arc.local');
    if (request.method === 'GET' && url.pathname === '/sender.css') return send(response, 200, this.mobileAssets[1], 'text/css; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/sender.js') return send(response, 200, this.mobileAssets[2], 'text/javascript; charset=utf-8');
    if (!hasValidToken(url, this.token)) return sendJson(response, 403, { ok: false, error: 'Esta sessão expirou ou o código é inválido.' });

    if (request.method === 'GET' && url.pathname === '/') {
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
      return send(response, 200, this.mobileAssets[0], 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && url.pathname === '/api/files') {
      const offset = Math.max(0, Math.min(this.files.length, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0));
      const limit = Math.max(1, Math.min(200, Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100));
      const files = this.files.slice(offset, offset + limit).map(({ id, name, size }) => ({ id, name, size }));
      return sendJson(response, 200, { ok: true, files, total: this.files.length, nextOffset: offset + files.length });
    }
    if (request.method === 'GET' && url.pathname === '/download-all') return this.sendAllFiles(request, response, address);
    const match = /^\/download\/([a-f0-9]{24})$/.exec(url.pathname);
    if ((request.method === 'GET' || request.method === 'HEAD') && match) return this.sendFile(request, response, match[1], address);
    return sendJson(response, 404, { ok: false, error: 'Endereço não encontrado.' });
  }

  async sendFile(request, response, fileId, sourceAddress) {
    const file = this.files.find((item) => item.id === fileId);
    if (!file) return sendJson(response, 404, { ok: false, error: 'Arquivo não encontrado nesta sessão.' });
    if (this.activeDownloads >= MAX_CONCURRENT_DOWNLOADS) return sendJson(response, 429, { ok: false, error: 'Há muitos downloads simultâneos. Tente novamente em instantes.' });
    const info = await stat(file.path).catch(() => null);
    if (!info?.isFile()) return sendJson(response, 410, { ok: false, error: 'O arquivo não está mais disponível no computador.' });
    const range = parseRange(request.headers.range, info.size);
    if (range?.invalid) {
      response.writeHead(416, { 'Content-Range': `bytes */${info.size}`, 'Content-Length': 0, 'Cache-Control': 'no-store' });
      return response.end();
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? Math.max(0, info.size - 1);
    const length = info.size ? end - start + 1 : 0;
    const headers = {
      ...securityHeaders('application/octet-stream', length),
      'Content-Disposition': encodedFileName(file.name),
      'Accept-Ranges': 'bytes'
    };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === 'HEAD' || length === 0) return response.end();

    const id = randomBytes(10).toString('hex');
    let transferredBytes = 0;
    let lastProgressAt = 0;
    this.activeDownloads += 1;
    this.onEvent({ type: 'download-started', id, fileId, name: file.name, size: length, fileSize: info.size, sourceAddress });
    const stream = createReadStream(file.path, { start, end });
    stream.on('data', (chunk) => {
      transferredBytes += chunk.length;
      const now = Date.now();
      if (now - lastProgressAt >= 120 || transferredBytes === length) {
        lastProgressAt = now;
        this.onEvent({ type: 'download-progress', id, fileId, name: file.name, transferredBytes, size: length });
      }
    });
    request.on('aborted', () => stream.destroy(new Error('Download interrompido pelo outro dispositivo.')));

    try {
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = () => { if (!settled) { settled = true; resolve(); } };
        const fail = (error) => { if (!settled) { settled = true; reject(error); } };
        stream.once('error', fail);
        response.once('finish', finish);
        response.once('close', () => {
          if (!response.writableFinished) {
            stream.destroy();
            fail(new Error('Download interrompido pelo outro dispositivo.'));
          }
        });
        stream.pipe(response);
      });
      this.downloadCount += 1;
      this.sentBytes += transferredBytes;
      const item = { id, fileId, name: file.name, size: transferredBytes, sourceAddress, completedAt: new Date().toISOString() };
      this.downloads.push(item);
      this.onEvent({ type: 'download-completed', item });
    } catch (error) {
      this.onEvent({ type: 'download-error', id, fileId, name: file.name, error: error.message || 'Download interrompido.' });
      if (!response.destroyed) response.destroy(error);
    } finally {
      this.activeDownloads = Math.max(0, this.activeDownloads - 1);
    }
  }

  async sendAllFiles(request, response, sourceAddress) {
    if (this.activeDownloads >= MAX_CONCURRENT_DOWNLOADS) return sendJson(response, 429, { ok: false, error: 'Há muitos downloads simultâneos. Tente novamente em instantes.' });
    const availableFiles = [];
    for (const file of this.files) {
      const info = await stat(file.path).catch(() => null);
      if (!info?.isFile()) return sendJson(response, 410, { ok: false, error: `O arquivo “${file.name}” não está mais disponível no computador.` });
      availableFiles.push({ ...file, size: info.size });
    }
    if (!availableFiles.length) return sendJson(response, 404, { ok: false, error: 'Não há arquivos disponíveis nesta sessão.' });

    const id = randomBytes(10).toString('hex');
    const archiveName = 'ARC-Image-Studio-arquivos.zip';
    const totalSourceBytes = availableFiles.reduce((total, file) => total + file.size, 0);
    this.activeDownloads += 1;
    this.onEvent({ type: 'download-started', id, name: archiveName, size: totalSourceBytes, fileSize: totalSourceBytes, sourceAddress });
    response.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': encodedFileName(archiveName),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin'
    });

    const archive = new yazl.ZipFile();
    const usedNames = new Set();
    let archiveBytes = 0;
    let lastProgressAt = 0;
    archive.outputStream.on('data', (chunk) => {
      archiveBytes += chunk.length;
      const now = Date.now();
      if (now - lastProgressAt < 120) return;
      lastProgressAt = now;
      this.onEvent({
        type: 'download-progress', id, name: archiveName,
        transferredBytes: Math.min(archiveBytes, totalSourceBytes),
        size: totalSourceBytes
      });
    });

    try {
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = () => { if (!settled) { settled = true; resolve(); } };
        const fail = (error) => { if (!settled) { settled = true; reject(error); } };
        archive.outputStream.once('error', fail);
        response.once('finish', finish);
        response.once('close', () => {
          if (!response.writableFinished) {
            archive.outputStream.destroy();
            fail(new Error('Download interrompido pelo outro dispositivo.'));
          }
        });
        archive.outputStream.pipe(response);
        for (const file of availableFiles) {
          archive.addFile(file.path, uniqueArchiveName(file.name, usedNames), {
            compress: false,
            forceZip64Format: file.size >= 0xffffffff
          });
        }
        archive.end({ forceZip64Format: totalSourceBytes >= 0xffffffff });
      });
      this.onEvent({ type: 'download-progress', id, name: archiveName, transferredBytes: totalSourceBytes, size: totalSourceBytes });
      this.downloadCount += 1;
      this.sentBytes += archiveBytes;
      const item = { id, name: archiveName, size: archiveBytes, sourceAddress, completedAt: new Date().toISOString() };
      this.downloads.push(item);
      this.onEvent({ type: 'download-completed', item });
    } catch (error) {
      this.onEvent({ type: 'download-error', id, name: archiveName, error: error.message || 'Download interrompido.' });
      if (!response.destroyed) response.destroy(error);
    } finally {
      this.activeDownloads = Math.max(0, this.activeDownloads - 1);
    }
  }
}
