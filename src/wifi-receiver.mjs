import { createHash, randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, stat, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MOBILE_ROOT = new URL('./receiver/mobile.html', import.meta.url);
const MOBILE_CSS = new URL('./receiver/mobile.css', import.meta.url);
const MOBILE_JS = new URL('./receiver/mobile.js', import.meta.url);
const MAX_FILE_BYTES = 20 * 1024 * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 4;
const MAX_SESSION_FILES = 10000;

function isPrivateIpv4(address) {
  const parts = String(address).split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254);
}

export function findLanAddresses(interfaces = networkInterfaces()) {
  const candidates = [];
  for (const [name, entries] of Object.entries(interfaces || {})) {
    for (const entry of entries || []) {
      const ipv4 = entry.family === 'IPv4' || entry.family === 4;
      if (!ipv4 || entry.internal || !isPrivateIpv4(entry.address)) continue;
      const interfaceScore = /wi-?fi|wlan|wireless/i.test(name) ? 0 : /ethernet|lan/i.test(name) ? 1 : 2;
      const addressScore = entry.address.startsWith('169.254.') ? 1 : 0;
      candidates.push({ address: entry.address, name, score: interfaceScore + addressScore * 10 });
    }
  }
  return [...new Map(candidates.sort((a, b) => a.score - b.score).map((item) => [item.address, item])).values()];
}

export function sanitizeFileName(input) {
  const base = path.basename(String(input || 'arquivo'))
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  const safe = base && !['.', '..'].includes(base) ? base : 'arquivo';
  const parsed = path.parse(safe);
  const extension = parsed.ext.slice(0, 32);
  const maxStemLength = Math.max(1, 180 - extension.length);
  const stem = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(parsed.name) ? `_${parsed.name}` : parsed.name;
  return `${stem.slice(0, maxStemLength)}${extension}`;
}

async function availableDestination(directory, requestedName, reservedPaths) {
  const parsed = path.parse(sanitizeFileName(requestedName));
  for (let index = 0; index < 10000; index += 1) {
    const suffix = index ? ` (${index + 1})` : '';
    const candidate = path.join(directory, `${parsed.name}${suffix}${parsed.ext}`);
    if (reservedPaths.has(candidate.toLowerCase())) continue;
    const exists = await stat(candidate).then(() => true).catch(() => false);
    if (!exists) {
      reservedPaths.add(candidate.toLowerCase());
      return candidate;
    }
  }
  throw new Error('Não foi possível criar um nome livre para o arquivo.');
}

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

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });
  response.end(body);
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value));
}

export class WifiReceiver {
  constructor({ onEvent = () => {}, maxFileBytes = MAX_FILE_BYTES } = {}) {
    this.onEvent = onEvent;
    this.maxFileBytes = maxFileBytes;
    this.server = null;
    this.token = '';
    this.destinationRoot = '';
    this.startedAt = '';
    this.addresses = [];
    this.port = 0;
    this.activeUploads = 0;
    this.received = [];
    this.receivedBytes = 0;
    this.reservedPaths = new Set();
    this.sockets = new Set();
    this.mobileAssets = null;
  }

  publicState() {
    const urls = this.addresses.map(({ address, name }) => ({ address, name, url: `http://${address}:${this.port}/?token=${this.token}` }));
    return {
      running: Boolean(this.server),
      destinationRoot: this.destinationRoot,
      startedAt: this.startedAt,
      port: this.port,
      url: urls[0]?.url || '',
      addresses: urls,
      activeUploads: this.activeUploads,
      receivedCount: this.received.length,
      receivedBytes: this.receivedBytes,
      received: this.received.slice(-100)
    };
  }

  async start({ destinationRoot, host = '0.0.0.0', advertisedAddress = '' } = {}) {
    if (this.server) return this.publicState();
    if (typeof destinationRoot !== 'string' || !destinationRoot.trim()) throw new Error('Escolha uma pasta para receber os arquivos.');
    const candidates = advertisedAddress
      ? [{ address: advertisedAddress, name: 'Rede local' }]
      : findLanAddresses();
    if (!candidates.length) throw new Error('Nenhuma rede local ativa foi encontrada. Conecte o PC ao Wi-Fi e tente novamente.');

    await mkdir(destinationRoot, { recursive: true });
    this.mobileAssets = this.mobileAssets || await Promise.all([
      readFile(MOBILE_ROOT, 'utf8'), readFile(MOBILE_CSS, 'utf8'), readFile(MOBILE_JS, 'utf8')
    ]);
    this.destinationRoot = path.resolve(destinationRoot);
    this.token = randomBytes(24).toString('base64url');
    this.startedAt = new Date().toISOString();
    this.addresses = candidates;
    this.received = [];
    this.receivedBytes = 0;
    this.reservedPaths.clear();

    const server = createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        if (!response.headersSent) sendJson(response, 500, { ok: false, error: error.message || 'Falha ao receber o arquivo.' });
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
    this.activeUploads = 0;
    const state = this.publicState();
    this.onEvent({ type: 'session-stopped', state });
    return state;
  }

  async handleRequest(request, response) {
    const address = requestAddress(request);
    if (!isPrivateIpv4(address)) return sendJson(response, 403, { ok: false, error: 'Acesso permitido somente pela rede local.' });

    const url = new URL(request.url || '/', 'http://arc.local');
    if (request.method === 'GET' && url.pathname === '/mobile.css') return send(response, 200, this.mobileAssets[1], 'text/css; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/mobile.js') return send(response, 200, this.mobileAssets[2], 'text/javascript; charset=utf-8');
    if (!hasValidToken(url, this.token)) return sendJson(response, 403, { ok: false, error: 'Esta sessão expirou ou o código é inválido.' });

    if (request.method === 'GET' && url.pathname === '/') {
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
      return send(response, 200, this.mobileAssets[0], 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && url.pathname === '/health') return sendJson(response, 200, { ok: true, receivedCount: this.received.length });
    if (request.method === 'POST' && url.pathname === '/upload') return this.receiveUpload(request, response, address);
    return sendJson(response, 404, { ok: false, error: 'Endereço não encontrado.' });
  }

  async receiveUpload(request, response, sourceAddress) {
    if (this.received.length >= MAX_SESSION_FILES) return sendJson(response, 429, { ok: false, error: 'O limite de 10.000 arquivos desta sessão foi atingido.' });
    if (this.activeUploads >= MAX_CONCURRENT_UPLOADS) return sendJson(response, 429, { ok: false, error: 'Há muitos envios simultâneos. Tente novamente em instantes.' });
    const declaredSize = Number(request.headers['content-length']);
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) return sendJson(response, 411, { ok: false, error: 'O tamanho do arquivo não foi informado.' });
    if (declaredSize > this.maxFileBytes) return sendJson(response, 413, { ok: false, error: 'O arquivo excede o limite de 20 GB.' });

    let decodedName = 'arquivo';
    try { decodedName = decodeURIComponent(String(request.headers['x-arc-file-name'] || 'arquivo')); } catch {}
    const fileName = sanitizeFileName(decodedName);
    const transferId = randomBytes(10).toString('hex');
    const destinationPath = await availableDestination(this.destinationRoot, fileName, this.reservedPaths);
    const temporaryPath = path.join(this.destinationRoot, `.arc-receiving-${transferId}.part`);
    const hash = createHash('sha256');
    let receivedBytes = 0;
    let lastProgressAt = 0;
    this.activeUploads += 1;
    this.onEvent({ type: 'upload-started', id: transferId, name: path.basename(destinationPath), size: declaredSize, sourceAddress });

    const counter = new Transform({
      transform: (chunk, _encoding, callback) => {
        receivedBytes += chunk.length;
        if (receivedBytes > this.maxFileBytes || receivedBytes > declaredSize) return callback(new Error('O arquivo recebido é maior que o tamanho informado.'));
        hash.update(chunk);
        const now = Date.now();
        if (now - lastProgressAt >= 120 || receivedBytes === declaredSize) {
          lastProgressAt = now;
          this.onEvent({ type: 'upload-progress', id: transferId, name: path.basename(destinationPath), receivedBytes, size: declaredSize });
        }
        callback(null, chunk);
      }
    });

    try {
      await pipeline(request, counter, createWriteStream(temporaryPath, { flags: 'wx' }));
      if (receivedBytes !== declaredSize) throw new Error('A transferência foi interrompida antes do fim.');
      await rename(temporaryPath, destinationPath);
      const sha256 = hash.digest('hex');
      const item = {
        id: transferId,
        name: path.basename(destinationPath),
        path: destinationPath,
        size: receivedBytes,
        sha256,
        sourceAddress,
        receivedAt: new Date().toISOString()
      };
      this.received.push(item);
      this.receivedBytes += receivedBytes;
      this.onEvent({ type: 'upload-completed', item });
      sendJson(response, 201, { ok: true, name: item.name, size: item.size, sha256 });
    } catch (error) {
      await unlink(temporaryPath).catch(() => {});
      this.onEvent({ type: 'upload-error', id: transferId, name: path.basename(destinationPath), error: error.message || 'Transferência interrompida.' });
      if (!response.headersSent) sendJson(response, 400, { ok: false, error: error.message || 'Transferência interrompida.' });
    } finally {
      this.activeUploads = Math.max(0, this.activeUploads - 1);
      this.reservedPaths.delete(destinationPath.toLowerCase());
    }
  }
}
