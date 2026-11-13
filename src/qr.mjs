import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import sharp from 'sharp';

/* QR Code generator — main-process side.
   The renderer designs the code (shapes, colours, layout); this module does what needs Node:
   the QR matrix itself, art discovery, image normalisation, PDF output and a real decode check. */

export const QR_LIMITS = { maxText: 4000, maxArtEdge: 2000, maxImportBytes: 25 * 1024 * 1024, maxExportBytes: 120 * 1024 * 1024 };
const ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
const ART_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg']);

/* The matrix as a string of '0'/'1' (row by row): compact over IPC and trivial to rebuild. */
export function createQrMatrix({ text, ecl = 'M', mask = 'auto', version = 'auto' } = {}) {
  if (typeof text !== 'string' || text.length === 0) throw new Error('Digite o conteúdo do QR Code.');
  if (text.length > QR_LIMITS.maxText) throw new Error('O conteúdo é grande demais para um QR Code.');
  if (!(ecl in ECL_BITS)) throw new Error('Nível de correção de erro inválido.');
  const options = { errorCorrectionLevel: ecl };
  if (Number.isInteger(mask) && mask >= 0 && mask <= 7) options.maskPattern = mask;
  if (Number.isInteger(version) && version >= 1 && version <= 40) options.version = version;
  let code;
  try {
    code = QRCode.create(text, options);
  } catch (error) {
    if (/too big/i.test(error?.message || '')) {
      throw new Error(options.version
        ? `O conteúdo não cabe na versão ${options.version}. Use "Automática" ou reduza o texto.`
        : 'O conteúdo é grande demais para esse nível de correção. Reduza o texto ou use um nível menor (L ou M).');
    }
    throw new Error('Não foi possível gerar o QR Code com essas opções.');
  }
  const { size, data } = code.modules;
  let bits = '';
  for (let index = 0; index < data.length; index += 1) bits += data[index] ? '1' : '0';
  return {
    size, version: code.version, ecl: Object.keys(ECL_BITS).find((key) => ECL_BITS[key] === code.errorCorrectionLevel.bit) || ecl,
    mask: code.maskPattern, bits, bytes: Buffer.byteLength(text, 'utf8')
  };
}

/* ───────── Images (art library and user logos/backgrounds) ───────── */

/* Normalise any supported image to a size the SVG can carry: honours EXIF rotation, caps the longest edge,
   keeps transparency (PNG) and otherwise saves space (JPEG). */
export async function normalizeImage(input, { maxEdge = QR_LIMITS.maxArtEdge } = {}) {
  const base = sharp(input, { failOn: 'none', limitInputPixels: 120_000_000 }).rotate();
  const meta = await base.metadata();
  const resized = base.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
  if (meta.hasAlpha) {
    const { data, info } = await resized.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
    return { dataUrl: `data:image/png;base64,${data.toString('base64')}`, width: info.width, height: info.height, hasAlpha: true, bytes: data.length };
  }
  const { data, info } = await resized.jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { dataUrl: `data:image/jpeg;base64,${data.toString('base64')}`, width: info.width, height: info.height, hasAlpha: false, bytes: data.length };
}

export async function importImageFile(filePath) {
  if (typeof filePath !== 'string' || !filePath) throw new Error('Arquivo inválido.');
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error('Escolha um arquivo de imagem.');
  if (info.size > QR_LIMITS.maxImportBytes) throw new Error('A imagem passa de 25 MB.');
  try {
    return { name: path.basename(filePath), ...(await normalizeImage(await readFile(filePath))) };
  } catch {
    throw new Error('Não foi possível ler essa imagem. Use PNG, JPG, WebP, GIF, AVIF ou SVG.');
  }
}

const artCache = new Map();

/* Art = loose image files named after an art id (see docs/QR-CREATIVOS.md). The user folder wins over the bundled one. */
export async function listArt({ bundledDirectory, userDirectory } = {}) {
  const found = new Map();
  for (const [source, directory] of [['bundled', bundledDirectory], ['user', userDirectory]]) {
    if (!directory || !existsSync(directory)) continue;
    let names;
    try { names = await readdir(directory); } catch { continue; }
    for (const name of names) {
      const extension = path.extname(name).toLowerCase();
      if (!ART_EXTENSIONS.has(extension)) continue;
      const id = path.basename(name, extension).toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) continue;
      found.set(id, { id, source, file: path.join(directory, name) });
    }
  }
  const result = [];
  for (const entry of found.values()) {
    try {
      const info = await stat(entry.file);
      const key = `${entry.file}|${info.mtimeMs}|${info.size}`;
      let normalized = artCache.get(key);
      if (!normalized) {
        normalized = await normalizeImage(await readFile(entry.file));
        artCache.set(key, normalized);
      }
      result.push({ id: entry.id, source: entry.source, width: normalized.width, height: normalized.height, hasAlpha: normalized.hasAlpha, dataUrl: normalized.dataUrl });
    } catch { /* an unreadable file is simply not offered */ }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

export async function ensureDirectory(directory) {
  await mkdir(directory, { recursive: true });
  return directory;
}

/* ───────── PDF ───────── */

/* A one-page PDF whose page is the physical size of the artwork, with the picture drawn full-bleed.
   The raster is flattened onto the given background (PDF viewers differ on soft masks) and Flate-compressed. */
export async function buildPdf({ png, widthMm, heightMm, background = '#ffffff', title = 'QR Code' }) {
  if (!Buffer.isBuffer(png) || png.length === 0) throw new Error('Imagem inválida para o PDF.');
  if (!(widthMm > 5 && widthMm <= 2000 && heightMm > 5 && heightMm <= 2000)) throw new Error('Tamanho de página inválido para o PDF.');
  const flat = sharp(png, { failOn: 'none' }).flatten({ background });
  const { data, info } = await flat.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const compressed = deflateSync(data, { level: 9 });
  const pageWidth = (widthMm * 72) / 25.4;
  const pageHeight = (heightMm * 72) / 25.4;
  const number = (value) => Number(value.toFixed(3));
  const content = Buffer.from(`q ${number(pageWidth)} 0 0 ${number(pageHeight)} 0 0 cm /Im0 Do Q`, 'latin1');
  const safeTitle = String(title).replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '').slice(0, 80) || 'QR Code';

  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (buffer) => { chunks.push(buffer); length += buffer.length; };
  const object = (id, body, stream) => {
    offsets[id] = length;
    push(Buffer.from(`${id} 0 obj\n${body}${stream ? '\nstream\n' : '\n'}`, 'latin1'));
    if (stream) { push(stream); push(Buffer.from('\nendstream\n', 'latin1')); }
    push(Buffer.from('endobj\n', 'latin1'));
  };
  push(Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1'));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(pageWidth)} ${number(pageHeight)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  object(4, `<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>`, compressed);
  object(5, `<< /Length ${content.length} >>`, content);
  object(6, `<< /Title (${safeTitle}) /Producer (arc.Studio) >>`);
  const xrefAt = length;
  let table = `xref\n0 7\n0000000000 65535 f \n`;
  for (let id = 1; id <= 6; id += 1) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  table += `trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  push(Buffer.from(table, 'latin1'));
  return Buffer.concat(chunks);
}

/* ───────── Real decode check ───────── */

/* Decodes the rendered picture the way a phone camera app would (jsQR), so "does it scan?" is measured, not guessed. */
export async function decodeQr(png) {
  if (!Buffer.isBuffer(png) || png.length === 0) throw new Error('Imagem inválida.');
  const base = sharp(png, { failOn: 'none' }).flatten({ background: '#ffffff' });
  const meta = await base.metadata();
  const longest = Math.max(meta.width, meta.height);
  const scale = longest > 700 ? 700 / longest : 1; // a camera sees the code at modest resolution; modules of 5–15 px decode best
  const prepared = scale < 1 ? base.resize({ width: Math.round(meta.width * scale), height: Math.round(meta.height * scale) }) : base;
  /* A phone camera sees a slightly soft picture; stylised modules (dots, stars…) decode best after a little blur,
     so the check tries the sharp picture first and then softer versions. */
  const variants = [{ label: 'normal', sigma: 0 }, { label: 'suave', sigma: 1.2 }, { label: 'suave+', sigma: 2.2 }, { label: 'suave++', sigma: 3.4 }, { label: 'contraste', sigma: 1.2, normalise: true }];
  for (const variant of variants) {
    let pipeline = prepared.clone();
    if (variant.normalise) pipeline = pipeline.greyscale().normalise().toColourspace('srgb');
    if (variant.sigma > 0) pipeline = pipeline.blur(variant.sigma);
    const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) continue;
    let found = null;
    try {
      found = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, { inversionAttempts: 'attemptBoth' });
    } catch { found = null; }
    if (found) return { ok: true, text: found.data, attempt: variant.label };
  }
  return { ok: false, text: '' };
}

export function pngBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  return null;
}
