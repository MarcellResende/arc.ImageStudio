import { createHash, getHashes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { crc32 } from 'node:zlib';

/* File hashes — main-process side. Files are streamed once and every selected algorithm is updated from the same read,
   so hashing four algorithms costs one pass over the disk, never the whole file in memory. */

export const HASH_LIMITS = { maxFiles: 50000, maxTextBytes: 8 * 1024 * 1024, chunk: 1024 * 1024 };

/* id → [label, Node hash name | null for CRC32, hex length] */
const CATALOGUE = [
  ['crc32', 'CRC32', null, 8], ['md5', 'MD5', 'md5', 32], ['sha1', 'SHA-1', 'sha1', 40],
  ['sha256', 'SHA-256', 'sha256', 64], ['sha384', 'SHA-384', 'sha384', 96], ['sha512', 'SHA-512', 'sha512', 128]
];

export function availableAlgorithms() {
  const supported = new Set(getHashes());
  return CATALOGUE.filter(([, , node]) => node === null || supported.has(node)).map(([id, label, , length]) => ({ id, label, length }));
}
export const ALGORITHM_IDS = CATALOGUE.map(([id]) => id);

export function sanitizeAlgorithms(value, fallback = ['sha256']) {
  const allowed = new Set(availableAlgorithms().map((item) => item.id));
  const list = Array.isArray(value) ? [...new Set(value.filter((id) => allowed.has(id)))] : [];
  return list.length ? list : fallback;
}

function createHashers(ids) {
  const hashers = [];
  for (const id of ids) {
    const entry = CATALOGUE.find(([key]) => key === id);
    if (!entry) throw new Error(`Algoritmo desconhecido: ${id}`);
    if (entry[2] === null) {
      let value = 0;
      hashers.push({ id, update: (chunk) => { value = crc32(chunk, value); }, digest: () => (value >>> 0).toString(16).padStart(8, '0') });
    } else {
      const hash = createHash(entry[2]);
      hashers.push({ id, update: (chunk) => hash.update(chunk), digest: () => hash.digest('hex') });
    }
  }
  return hashers;
}

export function hashBuffer(buffer, ids) {
  const hashers = createHashers(ids);
  const out = {};
  for (const hasher of hashers) { hasher.update(buffer); out[hasher.id] = hasher.digest(); }
  return out;
}

export function hashText(text, ids) {
  if (typeof text !== 'string') throw new Error('Texto inválido.');
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length > HASH_LIMITS.maxTextBytes) throw new Error('O texto passa de 8 MB. Salve em um arquivo e calcule o hash do arquivo.');
  return { bytes: buffer.length, hashes: hashBuffer(buffer, ids) };
}

export async function hashFile(filePath, ids, { signal, onProgress } = {}) {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error('Não é um arquivo.');
  const hashers = createHashers(ids);
  const started = Date.now();
  let read = 0;
  let lastReport = 0;
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { highWaterMark: HASH_LIMITS.chunk });
    const abort = () => { stream.destroy(Object.assign(new Error('Cancelado.'), { name: 'AbortError' })); };
    if (signal) { if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); }
    stream.on('data', (chunk) => {
      for (const hasher of hashers) hasher.update(chunk);
      read += chunk.length;
      const now = Date.now();
      if (onProgress && now - lastReport >= 80) { lastReport = now; onProgress(read, info.size); }
    });
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  if (onProgress) onProgress(read, info.size);
  return { size: read, hashes: Object.fromEntries(hashers.map((hasher) => [hasher.id, hasher.digest()])), ms: Date.now() - started };
}

/* Files and folders → a flat list of regular files. Symbolic links are not followed; unreadable entries are reported, not fatal. */
export async function collectFiles(inputs, { limit = HASH_LIMITS.maxFiles } = {}) {
  const files = [];
  const skipped = [];
  const seen = new Set();
  let truncated = false;

  async function addFile(filePath, relative, size) {
    const key = path.resolve(filePath).toLowerCase();
    if (seen.has(key)) return;
    if (files.length >= limit) { truncated = true; return; }
    seen.add(key);
    files.push({ path: path.resolve(filePath), name: path.basename(filePath), relative: relative.split(path.sep).join('/'), size });
  }
  async function walk(directory, rootName, relativeDir) {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { skipped.push({ path: directory, reason: error.code === 'EACCES' || error.code === 'EPERM' ? 'sem permissão' : 'não foi possível ler a pasta' }); return; }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    for (const entry of entries) {
      if (truncated) return;
      const full = path.join(directory, entry.name);
      const relative = path.join(relativeDir, entry.name);
      if (entry.isSymbolicLink()) { skipped.push({ path: full, reason: 'atalho/link simbólico ignorado' }); continue; }
      if (entry.isDirectory()) await walk(full, rootName, relative);
      else if (entry.isFile()) {
        try { await addFile(full, relative, (await stat(full)).size); } catch { skipped.push({ path: full, reason: 'não foi possível ler o arquivo' }); }
      }
    }
  }

  for (const input of Array.isArray(inputs) ? inputs : []) {
    if (typeof input !== 'string' || !input || !path.isAbsolute(input)) continue;
    try {
      const info = await lstat(input);
      if (info.isSymbolicLink()) { skipped.push({ path: input, reason: 'atalho/link simbólico ignorado' }); continue; }
      if (info.isDirectory()) await walk(input, path.basename(input), path.basename(input));
      else if (info.isFile()) await addFile(input, path.basename(input), info.size);
    } catch { skipped.push({ path: input, reason: 'não encontrado' }); }
  }
  return { files, skipped, truncated };
}

/* ───────── comparing ───────── */
export const normalizeHex = (value) => String(value ?? '').trim().replace(/^0x/i, '').replace(/[\s:_-]/g, '').toLowerCase();

/* Which algorithms could have produced this hex string (by length)? SHA-256 also matches 64-digit SHA3, but only SHA-256 is offered. */
export function detectAlgorithms(value) {
  const hex = normalizeHex(value);
  if (!/^[0-9a-f]+$/.test(hex)) return [];
  return CATALOGUE.filter(([, , , length]) => length === hex.length).map(([id]) => id);
}

/* → the algorithm id whose digest equals the expected value, or null. */
export function matchHash(expected, hashes) {
  const hex = normalizeHex(expected);
  if (!hex) return null;
  for (const id of detectAlgorithms(hex)) if (hashes[id] === hex) return id;
  return null;
}

/* GNU ("hash  name" / "hash *name") and BSD ("SHA256 (name) = hash") checksum files. */
export function parseChecksums(text) {
  const entries = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    let match = /^(?:MD5|SHA1|SHA-1|SHA256|SHA-256|SHA384|SHA-384|SHA512|SHA-512|CRC32)\s*\((.+)\)\s*=\s*([0-9a-fA-F]+)$/i.exec(line);
    let hash;
    let name;
    if (match) { name = match[1]; hash = match[2]; }
    else if ((match = /^([0-9a-fA-F]{8,128})\s+[* ]?(.+)$/.exec(line))) { hash = match[1]; name = match[2]; }
    else continue;
    const algorithms = detectAlgorithms(hash);
    if (!algorithms.length) continue;
    entries.push({ hash: normalizeHex(hash), name: name.trim(), algorithm: algorithms[0] });
  }
  return entries;
}

export function formatChecksums(rows, algorithm) {
  if (!ALGORITHM_IDS.includes(algorithm)) throw new Error('Algoritmo inválido.');
  const lines = rows.filter((row) => row?.hashes?.[algorithm]).map((row) => `${row.hashes[algorithm]} *${String(row.relative || row.name).replace(/\\/g, '/')}`);
  if (!lines.length) throw new Error('Não há hashes calculados para esse algoritmo.');
  return `${lines.join('\n')}\n`;
}

/* One job at a time: files are hashed sequentially (a disk is the bottleneck, not the CPU). */
export class HashJob {
  constructor() { this.controller = null; }
  get running() { return Boolean(this.controller); }
  cancel() { this.controller?.abort(); }

  async run(filePaths, algorithms, emit) {
    if (this.controller) throw new Error('Já existe um cálculo em andamento.');
    const ids = sanitizeAlgorithms(algorithms);
    const list = (Array.isArray(filePaths) ? filePaths : []).filter((item) => typeof item === 'string' && path.isAbsolute(item)).slice(0, HASH_LIMITS.maxFiles);
    if (!list.length) throw new Error('Nenhum arquivo para calcular.');
    this.controller = new AbortController();
    const { signal } = this.controller;
    const summary = { done: 0, failed: 0, cancelled: false, bytes: 0, ms: 0 };
    const started = Date.now();
    try {
      for (let index = 0; index < list.length; index += 1) {
        if (signal.aborted) { summary.cancelled = true; break; }
        emit({ type: 'file-start', index, path: list[index] });
        try {
          const result = await hashFile(list[index], ids, { signal, onProgress: (read, total) => emit({ type: 'progress', index, read, total }) });
          summary.done += 1; summary.bytes += result.size;
          emit({ type: 'file-done', index, size: result.size, hashes: result.hashes, ms: result.ms });
        } catch (error) {
          if (error?.name === 'AbortError' || signal.aborted) { summary.cancelled = true; emit({ type: 'file-cancelled', index }); break; }
          summary.failed += 1;
          emit({ type: 'file-error', index, error: error?.code === 'EBUSY' || error?.code === 'EPERM' || error?.code === 'EACCES' ? 'Arquivo em uso ou sem permissão de leitura.' : error?.code === 'ENOENT' ? 'Arquivo não encontrado.' : 'Não foi possível ler o arquivo.' });
        }
      }
    } finally {
      this.controller = null;
    }
    summary.ms = Date.now() - started;
    emit({ type: 'done', ...summary });
    return summary;
  }
}
