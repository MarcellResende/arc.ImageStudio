import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { buildPdf, createQrMatrix, decodeQr, listArt, normalizeImage } from '../src/qr.mjs';
import { SCHEMA } from '../src/settings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = {};
sandbox.globalThis = sandbox;
for (const file of ['qr-payload.js', 'qr-render.js', 'qr-templates.js']) vm.runInNewContext(await readFile(path.join(root, 'src/renderer', file), 'utf8'), sandbox);
const plain = (value) => JSON.parse(JSON.stringify(value));
const P = sandbox.ArcQrPayload;
const R = sandbox.ArcQrRender;
const T = sandbox.ArcQrTemplates;
const render = (design, info, assets) => R.render(design, info, assets);

async function scans(design, text, { ecl, assets } = {}) {
  const info = createQrMatrix({ text, ecl: ecl || R.chooseEcl(design) });
  const out = render(design, info, assets);
  const png = await sharp(Buffer.from(out.svg), { density: 72 }).resize({ width: 1000 }).png().toBuffer();
  return decodeQr(png);
}

/* ───────── payloads ───────── */
test('Pix: CRC16 matches the standard check value and the payload is a valid BR Code', () => {
  assert.equal(P.crc16('123456789'), '29B1');
  const { text, errors } = P.buildPayload('pix', { key: 'maria@exemplo.com', name: 'Maria Souza', city: 'São Paulo', amount: '25,90', txid: 'LOJA01' });
  assert.equal(errors.length, 0);
  assert.match(text, /^000201010212/);
  assert.match(text, /0014br\.gov\.bcb\.pix0117maria@exemplo\.com/);
  assert.match(text, /540525\.90/);
  assert.match(text, /5802BR5911Maria Souza6009Sao Paulo/, 'acentos saem do nome e da cidade');
  assert.equal(text.slice(-8, -4), '6304');
  assert.equal(text.slice(-4), P.crc16(text.slice(0, -4)));
  const noAmount = P.buildPayload('pix', { key: '11999999999', name: 'LOJA', city: 'RIO' });
  assert.match(noAmount.text, /^000201010211/, 'sem valor = QR estático reutilizável');
  assert.equal(P.buildPayload('pix', { key: 'a@b.com', name: 'X', city: 'Y', amount: '1.250,50' }).text.includes('5407' + '1250.50'), true);
  assert.equal(P.buildPayload('pix', { key: 'a@b.com', name: 'X', city: 'Y', amount: '25.90' }).text.includes('540525.90'), true, 'ponto decimal também vale');
});

test('Wi-Fi escapes the separators and respects security and hidden networks', () => {
  assert.equal(P.buildPayload('wifi', { ssid: 'Casa;do:ARC', password: 'a"b,c\\d', security: 'WPA', hidden: true }).text, 'WIFI:T:WPA;S:Casa\\;do\\:ARC;P:a\\"b\\,c\\\\d;H:true;;');
  assert.equal(P.buildPayload('wifi', { ssid: 'Aberta', security: 'nopass' }).text, 'WIFI:T:nopass;S:Aberta;;');
  assert.match(P.buildPayload('wifi', { ssid: 'X', password: '', security: 'WPA' }).errors[0], /senha/);
});

test('link, WhatsApp, e-mail, phone, SMS, geo and social follow the conventions phones understand', () => {
  assert.equal(P.buildPayload('url', { url: 'arcxp.online' }).text, 'https://arcxp.online');
  assert.match(P.buildPayload('url', { url: 'arcxp.online' }).warnings[0], /https/);
  assert.equal(P.buildPayload('url', { url: 'http://x.com/a b' }).errors.length, 1, 'espaço no link');
  assert.equal(P.buildPayload('whatsapp', { number: '+55 (11) 99999-9999', message: 'Olá, tudo bem?' }).text, 'https://wa.me/5511999999999?text=Ol%C3%A1%2C%20tudo%20bem%3F');
  assert.equal(P.buildPayload('email', { to: 'a@b.com', subject: 'Oi & tchau', body: 'Linha 1\nLinha 2' }).text, 'mailto:a@b.com?subject=Oi%20%26%20tchau&body=Linha%201%0ALinha%202');
  assert.equal(P.buildPayload('phone', { number: '+55 11 99999-9999' }).text, 'tel:+5511999999999');
  assert.equal(P.buildPayload('sms', { number: '11999999999', message: 'Oi' }).text, 'sms:11999999999?body=Oi');
  assert.equal(P.buildPayload('geo', { lat: '-23,5505', lon: '-46.6333', mode: 'maps' }).text, 'https://maps.google.com/?q=-23.5505,-46.6333');
  assert.equal(P.buildPayload('geo', { lat: '10', lon: '20', label: 'Casa', mode: 'geo' }).text, 'geo:10,20?q=10,20(Casa)');
  assert.equal(P.buildPayload('geo', { lat: '95', lon: '0' }).errors.length, 1);
  assert.equal(P.buildPayload('social', { network: 'instagram', user: '@arcanoxp' }).text, 'https://instagram.com/arcanoxp');
  assert.equal(P.buildPayload('social', { network: 'tiktok', user: 'arcanoxp' }).text, 'https://www.tiktok.com/@arcanoxp');
});

test('vCard and calendar event are well-formed and escape special characters', () => {
  const card = P.buildPayload('vcard', { first: 'Maria', last: 'Silva', org: 'A, B; C', mobile: '+55 11 99999-9999', email: 'm@x.com', website: 'x.com' }).text;
  assert.match(card, /^BEGIN:VCARD\r\nVERSION:3\.0\r\nN:Silva;Maria;;;\r\nFN:Maria Silva\r\n/);
  assert.match(card, /ORG:A\\, B\\; C/);
  assert.match(card, /URL:https:\/\/x\.com\r\nEND:VCARD$/);
  const event = P.buildPayload('event', { title: 'Festa', start: '2027-03-20T20:00', end: '2027-03-21T00:00', location: 'Rua A, 1' }).text;
  assert.match(event, /DTSTART:20270320T200000\r\nDTEND:20270321T000000/);
  assert.match(event, /LOCATION:Rua A\\, 1/);
  assert.equal(P.buildPayload('event', { title: 'X', start: '2027-03-21T10:00', end: '2027-03-20T10:00' }).errors.length, 1, 'fim antes do início');
  assert.match(P.buildPayload('event', { title: 'Dia', start: '2027-03-20', allDay: true }).text, /DTSTART;VALUE=DATE:20270320/);
});

test('every payload type needs its required fields and never fabricates a code from nothing', () => {
  for (const type of P.TYPES) {
    const result = P.buildPayload(type.id, P.defaultFields(type.id));
    assert.equal(result.text, '', `${type.id}: vazio não gera código`);
    assert.ok(result.errors.length > 0 || type.id === 'text', `${type.id}: deve pedir o campo obrigatório`);
  }
});

/* ───────── matrix and render ───────── */
test('createQrMatrix validates input and reports a readable error when the content is too big', () => {
  const info = createQrMatrix({ text: 'https://arcxp.online', ecl: 'M' });
  assert.equal(info.size, 25);
  assert.equal(info.bits.length, 625);
  assert.equal(info.version, 2);
  assert.equal(createQrMatrix({ text: 'abc', ecl: 'L', version: 6 }).version, 6);
  assert.equal(createQrMatrix({ text: 'abc', mask: 5 }).mask, 5);
  assert.throws(() => createQrMatrix({ text: '' }), /conteúdo/i);
  assert.throws(() => createQrMatrix({ text: 'x'.repeat(5000) }), /grande demais/);
  assert.throws(() => createQrMatrix({ text: 'x'.repeat(2500), ecl: 'H' }), /grande demais|nível menor/);
  assert.throws(() => createQrMatrix({ text: 'abc', ecl: 'Z' }), /inválido/);
});

test('design sanitising keeps valid values, clamps numbers and drops anything unknown', () => {
  const defaults = R.sanitizeDesign({});
  assert.equal(defaults.layout.id, 'plain');
  const messy = R.sanitizeDesign({ fill: { c1: 'red', c2: '#ABCDEF', angle: 999 }, margin: -3, modules: { shape: 'banana', scale: 10 }, layout: { id: 'story', texts: { cta: { text: 'a'.repeat(500), size: 5 } } }, evil: { x: 1 } });
  assert.equal(messy.fill.c1, defaults.fill.c1);
  assert.equal(messy.fill.c2, '#abcdef');
  assert.equal(messy.fill.angle, 360);
  assert.equal(messy.margin, 0);
  assert.equal(messy.modules.shape, 'square');
  assert.equal(messy.modules.scale, 40);
  assert.equal(messy.layout.id, 'story');
  assert.equal(messy.layout.texts.cta.text.length, 120);
  assert.equal(messy.layout.texts.cta.size, 40);
  assert.equal('evil' in messy, false);
  assert.deepEqual(plain(R.sanitizeDesign(messy)), plain(messy), 'sanitizar é idempotente');
});

test('every module shape, eye style and layout still decodes with a real QR reader', async () => {
  const text = 'https://arcxp.online/promo?x=1';
  for (const [shape] of R.SHAPES) assert.equal((await scans(R.applyPatch(R.sanitizeDesign({}), { modules: { shape } }), text)).text, text, `forma ${shape}`);
  for (const [outer] of R.EYE_OUTER) for (const [inner] of R.EYE_INNER) assert.equal((await scans(R.applyPatch(R.sanitizeDesign({}), { eyes: { outer, inner } }), text)).text, text, `olhos ${outer}/${inner}`);
  for (const layout of R.LAYOUTS) assert.equal((await scans(R.applyPatch(R.sanitizeDesign({}), { layout: { id: layout.id, texts: { title: { text: 'Título de teste' }, subtitle: { text: 'Subtítulo' } } } }), text)).text, text, `moldura ${layout.id}`);
});

test('gradients, logo (icon, text and image) and transparent backgrounds keep the code readable', async () => {
  const text = 'WIFI:T:WPA;S:Casa do ARC;P:minha-senha-123;;';
  const base = R.sanitizeDesign({});
  assert.equal((await scans(R.applyPatch(base, { fill: { mode: 'linear', c1: '#7c3aed', c2: '#0e7490' } }), text)).text, text);
  assert.equal((await scans(R.applyPatch(base, { fill: { mode: 'radial', c1: '#be123c', c2: '#1e1b4b' } }), text)).text, text);
  for (const icon of Object.keys(R.ICONS)) assert.equal((await scans(R.applyPatch(base, { logo: { kind: 'icon', icon } }), text, { ecl: 'H' })).text, text, `ícone ${icon}`);
  assert.equal((await scans(R.applyPatch(base, { logo: { kind: 'text', text: 'ARC', shape: 'rounded' } }), text, { ecl: 'H' })).text, text);
  const logo = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#e11d48' } }).png().toBuffer();
  const image = await normalizeImage(logo);
  assert.equal((await scans(R.applyPatch(base, { logo: { kind: 'image', shape: 'circle' } }), text, { ecl: 'H', assets: { logoImage: image.dataUrl } })).text, text);
  assert.equal((await scans(R.applyPatch(base, { background: { mode: 'transparent' } }), text)).text, text);
});

test('every template is valid, renders, and its code reads back', async () => {
  const text = 'https://arcxp.online/promo?x=1';
  assert.ok(T.TEMPLATES.length >= 30);
  assert.equal(new Set(T.TEMPLATES.map((template) => template.id)).size, T.TEMPLATES.length, 'ids únicos');
  for (const template of T.TEMPLATES) {
    assert.ok(T.CATEGORIES.some(([id]) => id === template.cat), `${template.id}: categoria`);
    const design = R.sanitizeDesign(R.mergeDeep(R.clone(R.DEFAULT_DESIGN), template.patch));
    // a patch must survive sanitising untouched: otherwise it carries a typo or an invalid value
    const merged = R.mergeDeep(R.clone(R.DEFAULT_DESIGN), template.patch);
    assert.deepEqual(plain(design), plain(R.sanitizeDesign(design)));
    for (const key of ['layout.id', 'modules.shape', 'eyes.outer', 'eyes.inner', 'fill.mode', 'ecl']) {
      const wanted = R.getPath(merged, key);
      if (wanted !== undefined && key !== 'ecl') assert.equal(R.getPath(design, key), wanted, `${template.id}: ${key} inválido no modelo`);
    }
    const result = await scans(design, text);
    assert.equal(result.text, text, `modelo ${template.id} não lê`);
    const report = R.assess(design, createQrMatrix({ text, ecl: R.chooseEcl(design) }), {});
    assert.equal(report.some((item) => item.level === 'bad'), false, `${template.id}: o próprio modelo tem um alerta grave (${report.filter((item) => item.level === 'bad').map((item) => item.text)})`);
  }
  for (const [id] of [['plain']]) assert.ok(R.LAYOUTS.some((layout) => layout.id === id));
});

test('art backgrounds and ornaments are drawn when present and ignored when missing', async () => {
  const text = 'https://arcxp.online';
  const art = await sharp({ create: { width: 200, height: 300, channels: 4, background: '#14b8a6' } }).png().toBuffer();
  const normalized = await normalizeImage(art);
  const design = R.applyPatch(R.sanitizeDesign({}), { layout: { id: 'card-portrait', bg: { art: 'bg-test', artOpacity: 80 }, ornament: 'orn-test', ornamentPos: 'corners' } });
  const without = render(design, createQrMatrix({ text }), { art: {} });
  const withArt = render(design, createQrMatrix({ text }), { art: { 'bg-test': { dataUrl: normalized.dataUrl }, 'orn-test': { dataUrl: normalized.dataUrl } } });
  assert.equal(without.svg.includes('<image'), false, 'arte ausente não gera <image>');
  assert.equal((withArt.svg.match(/<image /g) || []).length, 3, 'fundo + 2 ornamentos nos cantos');
  const png = await sharp(Buffer.from(withArt.svg)).resize({ width: 1000 }).png().toBuffer();
  assert.equal((await decodeQr(png)).text, text);
});

test('assess warns about low contrast, inverted colours, tight margins and oversized logos', () => {
  const info = createQrMatrix({ text: 'https://arcxp.online', ecl: 'M' });
  const level = (patch, extra) => R.assess(R.applyPatch(R.sanitizeDesign({}), patch), info, extra).map((item) => `${item.level}:${item.text}`);
  assert.ok(level({ fill: { c1: '#94a3b8' }, background: { c1: '#e2e8f0' } }).some((line) => line.startsWith('bad:Contraste muito baixo')));
  assert.ok(level({ fill: { c1: '#ffffff' }, background: { c1: '#111827' } }).some((line) => /invertido/.test(line)));
  assert.ok(level({ margin: 1 }).some((line) => line.startsWith('bad:Margem')));
  assert.ok(level({ margin: 3 }).some((line) => line.startsWith('warn:Margem')));
  assert.ok(level({ background: { mode: 'transparent' } }).some((line) => /transparente/.test(line)));
  assert.ok(level({ logo: { kind: 'icon', size: 32 } }).some((line) => /Logo grande|apaga|cobre/.test(line)));
  assert.ok(level({}, { printMm: 8, moduleCanvas: 1000 / 33, canvasWidth: 1000 }).some((line) => line.startsWith('bad:Impresso')));
  assert.ok(level({}, { printMm: 10, moduleCanvas: 1000 / 33, canvasWidth: 1000 }).some((line) => line.startsWith('warn:Impresso')));
  assert.ok(level({}, { printMm: 100, moduleCanvas: 1000 / 33, canvasWidth: 1000 }).some((line) => line.startsWith('ok:Impresso')));
  assert.equal(R.chooseEcl(R.sanitizeDesign({})), 'M');
  assert.equal(R.chooseEcl(R.applyPatch(R.sanitizeDesign({}), { logo: { kind: 'text' } })), 'H');
});

/* ───────── files ───────── */
test('PDF has a valid cross-reference table, the physical page size and the picture', async () => {
  const png = await sharp({ create: { width: 120, height: 80, channels: 4, background: '#2563eb' } }).png().toBuffer();
  const pdf = await buildPdf({ png, widthMm: 90, heightMm: 60, title: 'Teste (QR)' });
  const text = pdf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)[1]);
  assert.equal(text.slice(startxref, startxref + 4), 'xref');
  const entries = [...text.slice(startxref).matchAll(/^(\d{10}) \d{5} n $/gm)].map((match) => Number(match[1]));
  assert.equal(entries.length, 6);
  entries.forEach((offset, index) => assert.ok(text.slice(offset).startsWith(`${index + 1} 0 obj`), `objeto ${index + 1} no offset certo`));
  assert.match(text, /\/MediaBox \[0 0 255\.118 170\.079\]/);
  assert.match(text, /\/Width 120 \/Height 80 \/ColorSpace \/DeviceRGB/);
  assert.match(text, /\/Title \(Teste QR\)/, 'parênteses saem do título');
  await assert.rejects(buildPdf({ png, widthMm: 1, heightMm: 60 }), /tamanho/i);
  await assert.rejects(buildPdf({ png: Buffer.alloc(0), widthMm: 90, heightMm: 60 }), /inválida/i);
});

test('art library: loads valid ids, lets the user folder override, ignores junk', async () => {
  const bundled = await mkdtemp(path.join(tmpdir(), 'arc-art-b-'));
  const user = await mkdtemp(path.join(tmpdir(), 'arc-art-u-'));
  try {
    const red = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const blue = await sharp({ create: { width: 60, height: 30, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 0.5 } } }).png().toBuffer();
    await writeFile(path.join(bundled, 'bg-aurora.png'), red);
    await writeFile(path.join(bundled, 'orn-stars.png'), blue);
    await writeFile(path.join(user, 'bg-aurora.png'), blue);
    await writeFile(path.join(user, 'Nome Inválido!.png'), red);
    await writeFile(path.join(user, 'notas.txt'), 'x');
    await writeFile(path.join(user, 'quebrado.png'), 'not an image');
    const art = await listArt({ bundledDirectory: bundled, userDirectory: user });
    assert.deepEqual(art.map((item) => item.id), ['bg-aurora', 'orn-stars']);
    const aurora = art.find((item) => item.id === 'bg-aurora');
    assert.equal(aurora.source, 'user');
    assert.equal(aurora.width, 60);
    assert.equal(aurora.hasAlpha, true);
    assert.match(aurora.dataUrl, /^data:image\/png;base64,/);
    assert.deepEqual(await listArt({ bundledDirectory: path.join(bundled, 'nao-existe'), userDirectory: '' }), []);
  } finally { await rm(bundled, { recursive: true, force: true }); await rm(user, { recursive: true, force: true }); }
});

test('normalizeImage caps the size and keeps transparency only when the image has it', async () => {
  const wide = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#00ff00' } }).jpeg().toBuffer();
  const normalized = await normalizeImage(wide);
  assert.equal(normalized.width, 2000);
  assert.equal(normalized.hasAlpha, false);
  assert.match(normalized.dataUrl, /^data:image\/jpeg;base64,/);
  await assert.rejects(normalizeImage(Buffer.from('nada')));
});

test('decodeQr says "no" for a picture without a code', async () => {
  const blank = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#ffffff' } }).png().toBuffer();
  assert.deepEqual(await decodeQr(blank), { ok: false, text: '' });
});

test('QR settings persist only the look, with sane defaults', () => {
  const entry = SCHEMA.qrGen;
  assert.deepEqual(Object.keys(entry).sort(), ['design', 'exportFormat', 'exportWidth', 'printMm', 'templates']);
  assert.equal(entry.exportFormat[1], 'png');
  assert.equal(entry.exportFormat[0]('exe', 'png'), 'png');
  assert.equal(entry.exportWidth[0](999999, 2048), 2048);
  assert.equal(entry.design[0]('x'.repeat(30000), ''), '');
});

test('the creatives brief lists every art the app looks for, with a prompt, and nothing else', async () => {
  const doc = await readFile(path.join(root, 'docs/QR-CREATIVOS.md'), 'utf8');
  assert.equal(T.ART.length, 32);
  for (const art of T.ART) {
    assert.ok(doc.includes(`#### \`${art.id}\``), `${art.id}: sem prompt individual`);
    assert.ok(doc.includes(`id: ${art.id} ·`), `${art.id}: ausente do prompt único`);
  }
  const headings = [...doc.matchAll(/^#### `([a-z0-9-]+)`/gm)].map((match) => match[1]);
  assert.deepEqual(headings.sort(), plain(T.ART.map((art) => art.id)).sort(), 'o documento não pode citar arte que o app não conhece');
  assert.match(doc, /TRANSPARENTE/);
  assert.match(doc, /Nenhuma letra, palavra, número/);
  // every art referenced by a template must be in the catalogue (a typo would silently fall back to the vector pattern)
  const known = new Set(T.ART.map((art) => art.id));
  for (const template of T.TEMPLATES) {
    const layout = template.patch.layout || {};
    for (const id of [layout.bg?.art, layout.ornament].filter(Boolean)) assert.ok(known.has(id), `${template.id}: arte desconhecida ${id}`);
  }
});
