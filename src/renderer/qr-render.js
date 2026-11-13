/* arc.Studio — QR design engine.
   Turns a QR matrix + a design (shapes, colours, logo, layout) into ONE SVG string. The preview, the PNG and the PDF are all
   rasterised from that same SVG, so what you see is exactly what you export.
   Pure and local. Browser: window.ArcQrRender · Node (tests): module.exports. */
(function register(root) {
  /* ───────── Catalogues ───────── */
  const SHAPES = [['square', 'Quadrado'], ['rounded', 'Arredondado'], ['liquid', 'Líquido (conectado)'], ['dots', 'Pontos'], ['diamond', 'Losango'], ['bars-v', 'Barras verticais'], ['bars-h', 'Barras horizontais'], ['cross', 'Cruz'], ['star', 'Estrela'], ['heart', 'Coração']];
  const EYE_OUTER = [['square', 'Quadrado'], ['rounded', 'Arredondado'], ['circle', 'Círculo'], ['leaf', 'Folha'], ['octagon', 'Octógono']];
  const EYE_INNER = [['square', 'Quadrado'], ['rounded', 'Arredondado'], ['circle', 'Círculo'], ['diamond', 'Losango'], ['leaf', 'Folha']];
  const FONTS = [
    ['inter', 'Inter', "'Inter','Segoe UI',Arial,sans-serif", 0.58], ['segoe', 'Segoe UI', "'Segoe UI',Arial,sans-serif", 0.55], ['arial', 'Arial', 'Arial,Helvetica,sans-serif', 0.55],
    ['bahnschrift', 'Bahnschrift', "Bahnschrift,'Segoe UI',Arial,sans-serif", 0.5], ['impact', 'Impact', "Impact,'Arial Narrow',sans-serif", 0.46], ['trebuchet', 'Trebuchet MS', "'Trebuchet MS',Arial,sans-serif", 0.55],
    ['verdana', 'Verdana', 'Verdana,Geneva,sans-serif', 0.62], ['georgia', 'Georgia', 'Georgia,serif', 0.58], ['times', 'Times New Roman', "'Times New Roman',Times,serif", 0.5],
    ['palatino', 'Palatino', "'Palatino Linotype',Palatino,serif", 0.54], ['consolas', 'Consolas', "Consolas,'Courier New',monospace", 0.55], ['courier', 'Courier New', "'Courier New',monospace", 0.6]
  ];
  const DECOS = [['none', 'Nenhum'], ['waves', 'Ondas'], ['circles', 'Círculos'], ['rings', 'Anéis'], ['stripes', 'Listras'], ['diagonal', 'Diagonais'], ['grid', 'Grade'], ['dots', 'Bolinhas'], ['blobs', 'Manchas'], ['triangles', 'Triângulos'], ['corners', 'Cantos']];
  const LAYOUTS = [
    { id: 'plain', name: 'Só o código', desc: 'O QR Code limpo, sem moldura.', w: 1000, h: 1000, mm: [60, 60], roles: [] },
    { id: 'label-bottom', name: 'Moldura com legenda (baixo)', desc: 'Moldura colorida com chamada embaixo.', w: 1000, h: 1240, mm: [60, 74], roles: ['cta'] },
    { id: 'label-top', name: 'Moldura com legenda (cima)', desc: 'Chamada em cima, código embaixo.', w: 1000, h: 1240, mm: [60, 74], roles: ['cta'] },
    { id: 'sticker-round', name: 'Adesivo redondo', desc: 'Selo circular com texto em volta.', w: 1100, h: 1100, mm: [70, 70], roles: ['cta'] },
    { id: 'square-post', name: 'Post quadrado', desc: 'Feed do Instagram (1080 × 1080).', w: 1080, h: 1080, mm: [100, 100], roles: ['title', 'subtitle', 'cta', 'footer'] },
    { id: 'card-portrait', name: 'Post vertical', desc: 'Feed 4:5 (1080 × 1350).', w: 1080, h: 1350, mm: [100, 125], roles: ['title', 'subtitle', 'cta', 'footer'] },
    { id: 'story', name: 'Story / Reels', desc: 'Tela cheia 9:16 (1080 × 1920).', w: 1080, h: 1920, mm: [90, 160], roles: ['title', 'subtitle', 'cta', 'footer'] },
    { id: 'poster', name: 'Cartaz A4', desc: 'Para imprimir e colar (210 × 297 mm).', w: 1240, h: 1754, mm: [210, 297], roles: ['title', 'subtitle', 'cta', 'footer'] },
    { id: 'card-side', name: 'Cartão de visita', desc: 'Código à esquerda, dados à direita (89 × 51 mm).', w: 1050, h: 600, mm: [89, 51], roles: ['title', 'subtitle', 'cta', 'footer'] },
    { id: 'banner', name: 'Banner largo', desc: 'Faixa horizontal para site e telas (16:6).', w: 1920, h: 720, mm: [240, 90], roles: ['title', 'subtitle', 'cta', 'footer'] },
    { id: 'ticket', name: 'Ingresso', desc: 'Com picote e recortes laterais.', w: 1500, h: 620, mm: [150, 62], roles: ['title', 'subtitle', 'cta', 'footer'] },
    { id: 'hang-tag', name: 'Etiqueta com furo', desc: 'Tag para pendurar (50 × 79 mm).', w: 700, h: 1100, mm: [50, 79], roles: ['title', 'cta', 'footer'] }
  ];
  const ICONS = {
    star: { fill: ['M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z'] },
    heart: { fill: ['M12 21.2l-1.5-1.3C5.4 15.4 2 12.4 2 8.7 2 5.7 4.3 3.5 7.2 3.5c1.7 0 3.3.8 4.8 2.3 1.5-1.5 3.1-2.3 4.8-2.3 2.9 0 5.2 2.2 5.2 5.2 0 3.700-3.400 6.700-8.500 11.200z'] },
    bolt: { fill: ['M13.5 2L4 13.5h6.500L9.500 22 20 9.500h-6.500z'] },
    home: { fill: ['M12 3l9.500 8.500H19V21h-5v-6h-4v6H5v-9.500H2.500z'] },
    mail: { fill: ['M2 5h20v14H2z M4.800 7.300L12 13l7.200-5.700z'], rule: 'evenodd' },
    phone: { fill: ['M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z M7 5v12h10V5z M12 20.500a1 1 0 100-2 1 1 0 000 2z'], rule: 'evenodd' },
    wifi: { stroke: ['M2 8.800a15 15 0 0120 0', 'M5 12.600a10.500 10.500 0 0114 0', 'M8.500 16.200a5.500 5.500 0 017 0'], fill: ['M12 20.500a1.500 1.500 0 100-3 1.500 1.500 0 000 3z'] },
    pin: { fill: ['M12 22s7-6.200 7-12a7 7 0 00-14 0c0 5.800 7 12 7 12z M12 12.500a2.700 2.700 0 100-5.400 2.700 2.700 0 000 5.400z'], rule: 'evenodd' },
    camera: { fill: ['M4 7h3l1.600-2.500h6.800L17 7h3a1 1 0 011 1v11H3V8a1 1 0 011-1z M12 17.500a4 4 0 100-8 4 4 0 000 8z'], rule: 'evenodd' },
    music: { stroke: ['M9 18V5l12-2v13'], fill: ['M6 21a3 3 0 100-6 3 3 0 000 6z', 'M18 19a3 3 0 100-6 3 3 0 000 6z'] },
    globe: { stroke: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M3 12h18', 'M12 3c2.500 2.500 3.700 5.500 3.700 9s-1.200 6.500-3.700 9c-2.500-2.500-3.700-5.500-3.700-9S9.500 5.500 12 3z'] },
    link: { stroke: ['M10 13a5 5 0 007.500.500l3-3a5 5 0 00-7-7l-1.700 1.700', 'M14 11a5 5 0 00-7.500-.500l-3 3a5 5 0 007 7l1.700-1.700'] },
    chat: { fill: ['M4 3h16a2 2 0 012 2v11a2 2 0 01-2 2H10l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2z'] },
    user: { fill: ['M12 12a4.500 4.500 0 100-9 4.500 4.500 0 000 9z', 'M3 21c0-4.500 4-7 9-7s9 2.500 9 7z'] },
    gift: { stroke: ['M20 12v9H4v-9', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.500a2.500 2.500 0 110-5C11 2 12 7 12 7z', 'M12 7h4.500a2.500 2.500 0 100-5C13 2 12 7 12 7z'] },
    coffee: { stroke: ['M3 8h14v7a5 5 0 01-5 5H8a5 5 0 01-5-5z', 'M17 10h2a3 3 0 010 6h-2', 'M7 2v3', 'M11 2v3', 'M15 2v3'] },
    calendar: { stroke: ['M4 5h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z', 'M3 10h18', 'M8 3v4', 'M16 3v4'] },
    shield: { fill: ['M12 2l8 3v6c0 5-3.400 9.400-8 11-4.600-1.600-8-6-8-11V5z'] },
    crown: { fill: ['M3 19L2 7l5.500 4L12 3l4.500 8L22 7l-1 12z'] },
    cart: { stroke: ['M2 3h3l2.500 12h11l2-8H6'], fill: ['M9 21a1.500 1.500 0 100-3 1.500 1.500 0 000 3z', 'M17 21a1.500 1.500 0 100-3 1.500 1.500 0 000 3z'] },
    scan: { stroke: ['M4 8V5a1 1 0 011-1h3', 'M16 4h3a1 1 0 011 1v3', 'M20 16v3a1 1 0 01-1 1h-3', 'M8 20H5a1 1 0 01-1-1v-3', 'M7 12h10'] }
  };
  const ICON_NAMES = { star: 'Estrela', heart: 'Coração', bolt: 'Raio', home: 'Casa', mail: 'E-mail', phone: 'Celular', wifi: 'Wi-Fi', pin: 'Local', camera: 'Câmera', music: 'Música', globe: 'Globo', link: 'Link', chat: 'Conversa', user: 'Pessoa', gift: 'Presente', coffee: 'Café', calendar: 'Calendário', shield: 'Escudo', crown: 'Coroa', cart: 'Carrinho', scan: 'Escanear' };

  /* Ornament art drawn as a corner piece (it rotates with the corner it is placed in). */
  const CORNER_ART = new Set(['orn-sparkles', 'orn-confetti-burst', 'orn-leaves', 'orn-floral', 'orn-stars', 'orn-wifi-waves', 'orn-ribbon', 'orn-deco-corner', 'orn-halftone']);
  const fontById = (id) => FONTS.find((font) => font[0] === id) || FONTS[0];

  const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

  /* ───────── Design schema (every control in the UI maps to a leaf here) ───────── */
  const B = (def) => ['bool', def];
  const I = (def, min, max) => ['int', def, min, max];
  const E = (def, list) => ['enum', def, list.map((item) => (Array.isArray(item) ? item[0] : isPlainObject(item) ? item.id : item))];
  const C = (def) => ['color', def];
  const T = (def, max = 80) => ['text', def, max];
  const textBlock = (on, text, color, extra = {}) => ({ on: B(on), text: T(text, 120), color: C(color), font: E(extra.font || 'inter', FONTS), weight: E(extra.weight || '700', ['400', '600', '700', '800']), size: I(100, 40, 220), caps: B(Boolean(extra.caps)), ...(extra.pill ? { pill: E(extra.pill, ['pill', 'outline', 'none']), pillColor: C(extra.pillColor || '#0f172a') } : {}) });
  const SPEC = {
    type: E('url', ['url', 'text', 'wifi', 'vcard', 'whatsapp', 'email', 'phone', 'sms', 'geo', 'event', 'pix', 'social']),
    ecl: E('auto', ['auto', 'L', 'M', 'Q', 'H']),
    mask: E('auto', ['auto', '0', '1', '2', '3', '4', '5', '6', '7']),
    version: I(0, 0, 40),
    margin: I(4, 0, 12),
    modules: { shape: E('square', SHAPES), scale: I(100, 40, 100) },
    eyes: { outer: E('square', EYE_OUTER), inner: E('square', EYE_INNER), custom: B(false), outerColor: C('#111827'), innerColor: C('#111827') },
    fill: { mode: E('solid', ['solid', 'linear', 'radial']), c1: C('#111827'), c2: C('#2563eb'), angle: I(45, 0, 360) },
    background: { mode: E('solid', ['solid', 'transparent', 'linear']), c1: C('#ffffff'), c2: C('#e0f2fe'), angle: I(90, 0, 360) },
    block: { radius: I(4, 0, 25), borderWidth: I(0, 0, 24), borderColor: C('#111827'), shadow: B(false) },
    logo: {
      kind: E('none', ['none', 'icon', 'text', 'image']), icon: E('star', Object.keys(ICONS)), text: T('ARC', 6), size: I(20, 8, 32), padding: I(12, 0, 40),
      shape: E('circle', ['circle', 'rounded', 'square']), plate: B(true), plateColor: C('#ffffff'), color: C('#111827'), borderWidth: I(0, 0, 12), borderColor: C('#111827'), clear: B(true)
    },
    layout: {
      id: E('plain', LAYOUTS), radius: I(0, 0, 30),
      bg: { mode: E('solid', ['solid', 'linear', 'radial', 'transparent']), c1: C('#0f172a'), c2: C('#2563eb'), angle: I(135, 0, 360), art: T('', 64), artFit: E('cover', ['cover', 'contain']), artOpacity: I(100, 0, 100), overlay: I(0, 0, 90), overlayColor: C('#000000') },
      deco: E('none', DECOS), decoColor: C('#ffffff'), decoOpacity: I(14, 0, 100),
      ornament: T('', 64), ornamentPos: E('corners', ['corners', 'tl', 'tr', 'bl', 'br', 'top', 'bottom', 'center']), ornamentScale: I(30, 8, 110), ornamentOpacity: I(100, 0, 100),
      texts: {
        title: textBlock(true, '', '#ffffff', { weight: '800' }), subtitle: textBlock(true, '', '#cbd5e1', { weight: '400' }),
        cta: textBlock(true, 'ESCANEIE-ME', '#0f172a', { weight: '800', caps: true, pill: 'pill', pillColor: '#ffffff' }), footer: textBlock(true, '', '#94a3b8', { weight: '600' })
      }
    }
  };

  const isLeaf = (node) => Array.isArray(node) && typeof node[0] === 'string';

  function defaultsOf(node) {
    if (isLeaf(node)) return node[1];
    const out = {};
    for (const key of Object.keys(node)) out[key] = defaultsOf(node[key]);
    return out;
  }
  function sanitizeNode(node, raw) {
    if (isLeaf(node)) {
      const [kind, def, a, b] = node;
      if (raw === undefined) return def;
      if (kind === 'bool') return typeof raw === 'boolean' ? raw : def;
      if (kind === 'int') { const number = Number(raw); return Number.isFinite(number) ? Math.min(b, Math.max(a, Math.round(number))) : def; }
      if (kind === 'enum') return a.includes(String(raw)) ? String(raw) : def;
      if (kind === 'color') return typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : def;
      if (kind === 'text') return typeof raw === 'string' ? raw.replace(/[\u0000-\u001f]/g, '').slice(0, a || 80) : def;
      return def;
    }
    const source = isPlainObject(raw) ? raw : {};
    const out = {};
    for (const key of Object.keys(node)) out[key] = sanitizeNode(node[key], source[key]);
    return out;
  }
  const DEFAULT_DESIGN = defaultsOf(SPEC);
  const sanitizeDesign = (raw) => sanitizeNode(SPEC, raw);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function mergeDeep(target, patch) {
    for (const key of Object.keys(patch || {})) {
      if (isPlainObject(patch[key]) && isPlainObject(target[key])) mergeDeep(target[key], patch[key]);
      else target[key] = patch[key];
    }
    return target;
  }
  /* A template/patch applied on top of a design: validated, never able to inject unknown keys. */
  function applyPatch(design, patch) {
    return sanitizeDesign(mergeDeep(clone(design), patch));
  }
  function getPath(object, pathText) { return pathText.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object); }
  function setPath(object, pathText, value) {
    const keys = pathText.split('.');
    let node = object;
    for (let index = 0; index < keys.length - 1; index += 1) node = node[keys[index]];
    node[keys[keys.length - 1]] = value;
    return object;
  }
  function specAt(pathText) { return pathText.split('.').reduce((node, key) => (node ? node[key] : undefined), SPEC); }

  /* ───────── Small helpers ───────── */
  const f = (value) => String(Math.round(value * 1000) / 1000);
  const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hexToRgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const luminance = (hex) => {
    const [r, g, b] = hexToRgb(hex).map((channel) => { const value = channel / 255; return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrastRatio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const mix = (a, b, amount) => `#${hexToRgb(a).map((value, index) => Math.round(value + (hexToRgb(b)[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`;
  const contrastText = (hex) => (luminance(hex) > 0.45 ? '#0f172a' : '#ffffff');

  function rr(x, y, w, h, radii) {
    const [tl, tr, br, bl] = radii.map((value) => Math.max(0, Math.min(value, w / 2, h / 2)));
    return `M${f(x + tl)} ${f(y)}H${f(x + w - tr)}${tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(x + w)} ${f(y + tr)}` : ''}V${f(y + h - br)}${br ? `A${f(br)} ${f(br)} 0 0 1 ${f(x + w - br)} ${f(y + h)}` : ''}H${f(x + bl)}${bl ? `A${f(bl)} ${f(bl)} 0 0 1 ${f(x)} ${f(y + h - bl)}` : ''}V${f(y + tl)}${tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(x + tl)} ${f(y)}` : ''}Z`;
  }
  const circle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  const poly = (points) => `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;

  /* ───────── Matrix ───────── */
  function matrixFrom(info) {
    const { size, bits } = info;
    return { size, get: (x, y) => (x >= 0 && y >= 0 && x < size && y < size && bits.charCodeAt(y * size + x) === 49) };
  }
  const inFinderZone = (x, y, n) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const inFinderPlusSeparator = (x, y, n) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);

  /* The central area a logo covers, in module units — shared by the renderer (to clear modules) and the checker. */
  function logoBox(design, n) {
    const logo = design.logo;
    if (logo.kind === 'none') return null;
    const side = n * logo.size / 100;
    const plateSide = logo.plate ? side : side * 0.94;
    return { cx: n / 2, cy: n / 2, side: plateSide, shape: logo.shape };
  }
  function insideLogo(box, px, py, grow) {
    const half = box.side / 2 + grow;
    const dx = Math.abs(px - box.cx);
    const dy = Math.abs(py - box.cy);
    if (box.shape === 'circle') return dx * dx + dy * dy <= half * half;
    if (box.shape === 'rounded') { const r = half * 0.4; const ex = Math.max(0, dx - (half - r)); const ey = Math.max(0, dy - (half - r)); return dx <= half && dy <= half && ex * ex + ey * ey <= r * r; }
    return dx <= half && dy <= half;
  }
  function clearedSet(design, matrix) {
    const box = design.logo.clear ? logoBox(design, matrix.size) : null;
    const cleared = new Set();
    if (!box) return cleared;
    for (let y = 0; y < matrix.size; y += 1) for (let x = 0; x < matrix.size; x += 1) {
      if (!inFinderPlusSeparator(x, y, matrix.size) && insideLogo(box, x + 0.5, y + 0.5, 0.35)) cleared.add(y * matrix.size + x);
    }
    return cleared;
  }

  /* ───────── Module shapes ───────── */
  function starPoints(cx, cy, outer, inner) {
    const points = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = (-90 + index * 36) * Math.PI / 180;
      const radius = index % 2 === 0 ? outer : inner;
      points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
    return points;
  }
  function heartPath(cx, cy, s) {
    const p = (x, y) => `${f(cx + (x - 0.5) * s)} ${f(cy + (y - 0.5) * s)}`;
    return `M${p(0.5, 0.92)}C${p(0.04, 0.58)} ${p(-0.02, 0.2)} ${p(0.25, 0.1)}C${p(0.38, 0.06)} ${p(0.47, 0.14)} ${p(0.5, 0.26)}C${p(0.53, 0.14)} ${p(0.62, 0.06)} ${p(0.75, 0.1)}C${p(1.02, 0.2)} ${p(0.96, 0.58)} ${p(0.5, 0.92)}Z`;
  }
  function plusPath(cx, cy, s) {
    const a = 0.5 * s;
    const t = 0.27 * s;
    return poly([[cx - t, cy - a], [cx + t, cy - a], [cx + t, cy - t], [cx + a, cy - t], [cx + a, cy + t], [cx + t, cy + t], [cx + t, cy + a], [cx - t, cy + a], [cx - t, cy + t], [cx - a, cy + t], [cx - a, cy - t], [cx - t, cy - t]]);
  }

  function modulesPath(shape, scale, on, n) {
    const s = scale / 100;
    const inset = (1 - s) / 2;
    let d = '';
    if (shape === 'square' && s >= 0.999) {
      for (let y = 0; y < n; y += 1) {
        let x = 0;
        while (x < n) {
          if (!on(x, y)) { x += 1; continue; }
          let end = x;
          while (end < n && on(end, y)) end += 1;
          d += `M${x} ${y}h${end - x}v1h${x - end}Z`;
          x = end;
        }
      }
      return d;
    }
    if (shape === 'bars-v' || shape === 'bars-h') {
      const vertical = shape === 'bars-v';
      for (let a = 0; a < n; a += 1) {
        let b = 0;
        while (b < n) {
          const has = (index) => (vertical ? on(a, index) : on(index, a));
          if (!has(b)) { b += 1; continue; }
          let end = b;
          while (end < n && has(end)) end += 1;
          const length = end - b;
          d += vertical ? rr(a + inset, b + (length === 1 ? inset : 0), s, length === 1 ? s : length, [s / 2, s / 2, s / 2, s / 2]) : rr(b + (length === 1 ? inset : 0), a + inset, length === 1 ? s : length, s, [s / 2, s / 2, s / 2, s / 2]);
          b = end;
        }
      }
      return d;
    }
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        if (!on(x, y)) continue;
        const cx = x + 0.5;
        const cy = y + 0.5;
        if (shape === 'square') d += rr(x + inset, y + inset, s, s, [0, 0, 0, 0]);
        else if (shape === 'rounded') d += rr(x + inset, y + inset, s, s, [0.3 * s, 0.3 * s, 0.3 * s, 0.3 * s]);
        else if (shape === 'liquid') {
          const up = on(x, y - 1); const down = on(x, y + 1); const left = on(x - 1, y); const right = on(x + 1, y);
          d += rr(x, y, 1, 1, [!up && !left ? 0.5 : 0, !up && !right ? 0.5 : 0, !down && !right ? 0.5 : 0, !down && !left ? 0.5 : 0]);
        } else if (shape === 'dots') d += circle(cx, cy, 0.5 * s);
        else if (shape === 'diamond') d += poly([[cx, cy - 0.5 * s * 1.3], [cx + 0.5 * s * 1.3, cy], [cx, cy + 0.5 * s * 1.3], [cx - 0.5 * s * 1.3, cy]]);
        else if (shape === 'cross') d += plusPath(cx, cy, s * 1.12);
        else if (shape === 'star') d += poly(starPoints(cx, cy, 0.78 * s, 0.4 * s));
        else if (shape === 'heart') d += heartPath(cx, cy, 1.25 * s);
      }
    }
    return d;
  }

  /* Finder patterns ("eyes"): the 7×7 ring and the 3×3 centre, each with its own shape. */
  function eyeOuter(shape, x, y, corner) {
    const flip = corner !== 0;
    const radii = (r) => (flip ? [0, r, 0, r] : [r, 0, r, 0]);
    if (shape === 'rounded') return rr(x, y, 7, 7, [1.9, 1.9, 1.9, 1.9]) + rr(x + 1, y + 1, 5, 5, [1.1, 1.1, 1.1, 1.1]);
    if (shape === 'circle') return circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5);
    if (shape === 'leaf') return rr(x, y, 7, 7, radii(3)) + rr(x + 1, y + 1, 5, 5, radii(2));
    if (shape === 'octagon') {
      const oct = (px, py, side, cut) => poly([[px + cut, py], [px + side - cut, py], [px + side, py + cut], [px + side, py + side - cut], [px + side - cut, py + side], [px + cut, py + side], [px, py + side - cut], [px, py + cut]]);
      return oct(x, y, 7, 2) + oct(x + 1, y + 1, 5, 1.2);
    }
    return rr(x, y, 7, 7, [0, 0, 0, 0]) + rr(x + 1, y + 1, 5, 5, [0, 0, 0, 0]);
  }
  function eyeInner(shape, x, y, corner) {
    const px = x + 2;
    const py = y + 2;
    if (shape === 'rounded') return rr(px, py, 3, 3, [0.9, 0.9, 0.9, 0.9]);
    if (shape === 'circle') return circle(px + 1.5, py + 1.5, 1.5);
    if (shape === 'diamond') return poly([[px + 1.5, py - 0.35], [px + 3.35, py + 1.5], [px + 1.5, py + 3.35], [px - 0.35, py + 1.5]]);
    if (shape === 'leaf') return rr(px, py, 3, 3, corner === 0 ? [1.5, 0, 1.5, 0] : [0, 1.5, 0, 1.5]);
    return rr(px, py, 3, 3, [0, 0, 0, 0]);
  }

  /* ───────── Paint (colour / gradient) ───────── */
  function gradientDef(id, mode, c1, c2, angle, span) {
    const stops = `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>`;
    if (mode === 'radial') return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(span.x + span.w / 2)}" cy="${f(span.y + span.h / 2)}" r="${f(Math.max(span.w, span.h) * 0.72)}">${stops}</radialGradient>`;
    const rad = angle * Math.PI / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const half = (Math.abs(dx) * span.w + Math.abs(dy) * span.h) / 2;
    const cx = span.x + span.w / 2;
    const cy = span.y + span.h / 2;
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(cx - dx * half)}" y1="${f(cy - dy * half)}" x2="${f(cx + dx * half)}" y2="${f(cy + dy * half)}">${stops}</linearGradient>`;
  }

  /* ───────── Text ───────── */
  function widthOf(text, size, font, weight, caps) {
    const factor = fontById(font)[3] * (Number(weight) >= 700 ? 1.07 : 1) * (caps ? 1.12 : 1);
    return text.length * size * factor;
  }
  function wrapText(text, size, maxWidth, maxLines, font, weight, caps) {
    const words = text.split(/\s+/).filter(Boolean);
    let current = size;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const lines = [];
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (widthOf(candidate, current, font, weight, caps) <= maxWidth || !line) line = candidate;
        else { lines.push(line); line = word; }
      }
      if (line) lines.push(line);
      if (lines.length <= maxLines && lines.every((entry) => widthOf(entry, current, font, weight, caps) <= maxWidth * 1.02)) return { lines, size: current };
      current *= 0.92;
      if (current < size * 0.45) { return { lines: lines.slice(0, maxLines), size: current }; }
    }
    return { lines: [text], size: size * 0.45 };
  }

  function layoutText(role, block, slot, extras) {
    if (!slot || !block.on || !block.text.trim()) return '';
    const raw = block.caps ? block.text.trim().toUpperCase() : block.text.trim();
    const baseSize = slot.size * block.size / 100;
    const fit = wrapText(raw, baseSize, slot.w, slot.lines, block.font, block.weight, block.caps);
    const lineHeight = fit.size * 1.18;
    const anchor = slot.anchor || 'middle';
    const family = fontById(block.font)[2];
    const spacing = block.caps ? ` letter-spacing="${f(fit.size * 0.06)}"` : '';
    const widest = Math.max(...fit.lines.map((entry) => widthOf(entry, fit.size, block.font, block.weight, block.caps)));
    let out = '';
    if (role === 'cta' && block.pill && block.pill !== 'none') {
      const padX = fit.size * 0.95;
      const pillW = Math.min(slot.w + padX * 2, widest + padX * 2);
      const pillH = fit.size * 1.95 + (fit.lines.length - 1) * lineHeight;
      const px = anchor === 'middle' ? slot.x - pillW / 2 : anchor === 'end' ? slot.x - pillW : slot.x - padX;
      const py = slot.y - pillH / 2;
      out += block.pill === 'outline'
        ? `<rect x="${f(px)}" y="${f(py)}" width="${f(pillW)}" height="${f(pillH)}" rx="${f(pillH / 2)}" fill="none" stroke="${block.pillColor}" stroke-width="${f(Math.max(3, fit.size * 0.09))}"/>`
        : `<rect x="${f(px)}" y="${f(py)}" width="${f(pillW)}" height="${f(pillH)}" rx="${f(pillH / 2)}" fill="${block.pillColor}"/>`;
      extras.used.add(block.font);
    }
    const startY = slot.y - ((fit.lines.length - 1) * lineHeight) / 2;
    const tspans = fit.lines.map((entry, index) => `<tspan x="${f(slot.x)}" y="${f(startY + index * lineHeight)}">${esc(entry)}</tspan>`).join('');
    out += `<text font-family="${esc(family)}" font-size="${f(fit.size)}" font-weight="${block.weight}" fill="${block.color}" text-anchor="${anchor}" dominant-baseline="central"${spacing}>${tspans}</text>`;
    extras.used.add(block.font);
    return out;
  }

  /* ───────── Layout geometry ───────── */
  function geometry(id) {
    const meta = LAYOUTS.find((layout) => layout.id === id) || LAYOUTS[0];
    const g = { W: meta.w, H: meta.h, shape: 'rect', slots: {}, mm: meta.mm };
    const mid = (x, y, w, size, lines = 1, anchor = 'middle') => ({ x, y, w, size, lines, anchor });
    switch (meta.id) {
      case 'label-bottom': g.qr = { x: 90, y: 90, s: 820 }; g.slots.cta = mid(500, 1075, 780, 78); break;
      case 'label-top': g.qr = { x: 90, y: 330, s: 820 }; g.slots.cta = mid(500, 165, 780, 78); break;
      case 'sticker-round': g.shape = 'circle'; g.qr = { x: 250, y: 250, s: 600 }; g.ring = { cx: 550, cy: 550, r: 470 }; break;
      case 'square-post': g.qr = { x: 250, y: 270, s: 580 }; g.slots = { title: mid(540, 125, 940, 76, 2), subtitle: mid(540, 205, 900, 36, 2), cta: mid(540, 935, 800, 54), footer: mid(540, 1030, 900, 30) }; break;
      case 'card-portrait': g.qr = { x: 200, y: 430, s: 680 }; g.slots = { title: mid(540, 175, 900, 84, 2), subtitle: mid(540, 335, 880, 40, 2), cta: mid(540, 1200, 820, 54), footer: mid(540, 1305, 900, 30) }; break;
      case 'story': g.qr = { x: 190, y: 720, s: 700 }; g.slots = { title: mid(540, 340, 900, 100, 3), subtitle: mid(540, 580, 860, 44, 2), cta: mid(540, 1560, 820, 62), footer: mid(540, 1760, 900, 34) }; break;
      case 'poster': g.qr = { x: 190, y: 640, s: 860 }; g.slots = { title: mid(620, 290, 1040, 128, 3), subtitle: mid(620, 520, 1000, 56, 2), cta: mid(620, 1620, 960, 66), footer: mid(620, 1718, 1000, 34) }; break;
      case 'card-side': g.qr = { x: 60, y: 60, s: 480 }; g.slots = { title: mid(590, 190, 410, 54, 2, 'start'), subtitle: mid(590, 320, 410, 30, 3, 'start'), cta: mid(590, 470, 410, 26, 1, 'start'), footer: mid(590, 545, 410, 22, 1, 'start') }; break;
      case 'banner': g.qr = { x: 1250, y: 110, s: 500 }; g.slots = { title: mid(110, 260, 1050, 104, 2, 'start'), subtitle: mid(110, 430, 1050, 46, 2, 'start'), cta: mid(110, 560, 900, 44, 1, 'start'), footer: mid(110, 650, 1050, 32, 1, 'start') }; break;
      case 'ticket': g.shape = 'ticket'; g.perf = 1040; g.qr = { x: 1085, y: 110, s: 400 }; g.slots = { title: mid(80, 220, 900, 84, 2, 'start'), subtitle: mid(80, 372, 900, 42, 2, 'start'), cta: mid(80, 495, 700, 40, 1, 'start'), footer: mid(80, 570, 900, 28, 1, 'start') }; break;
      case 'hang-tag': g.shape = 'tag'; g.hole = { cx: 350, cy: 92, r: 34 }; g.qr = { x: 100, y: 330, s: 500 }; g.slots = { title: mid(350, 235, 560, 56, 2), cta: mid(350, 905, 520, 40), footer: mid(350, 1010, 560, 26) }; break;
      default: g.qr = { x: 0, y: 0, s: 1000 };
    }
    return g;
  }

  /* ───────── Decorations (vector backgrounds) ───────── */
  function decoSvg(kind, W, H, color, opacity) {
    if (kind === 'none' || opacity <= 0) return '';
    const o = opacity / 100;
    const m = Math.max(W, H);
    let body = '';
    const seed = (n) => { const value = Math.sin(n * 12.9898) * 43758.5453; return value - Math.floor(value); };
    if (kind === 'waves') {
      for (let row = 0; row < 5; row += 1) {
        const y = H * (0.62 + row * 0.1);
        body += `<path d="M0 ${f(y)}C${f(W * 0.25)} ${f(y - H * 0.07)} ${f(W * 0.5)} ${f(y + H * 0.07)} ${f(W * 0.75)} ${f(y)}S${f(W * 0.95)} ${f(y - H * 0.03)} ${f(W)} ${f(y - H * 0.02)}V${f(H)}H0Z" fill="${color}" fill-opacity="${f(o * (0.5 + row * 0.12))}"/>`;
      }
    } else if (kind === 'circles') {
      for (let index = 0; index < 9; index += 1) body += `<circle cx="${f(seed(index + 1) * W)}" cy="${f(seed(index + 20) * H)}" r="${f(m * (0.05 + seed(index + 40) * 0.16))}" fill="${color}" fill-opacity="${f(o * (0.35 + seed(index + 60) * 0.65))}"/>`;
    } else if (kind === 'rings') {
      for (let index = 0; index < 6; index += 1) body += `<circle cx="${f(W * (0.15 + seed(index + 3) * 0.7))}" cy="${f(H * (0.1 + seed(index + 9) * 0.8))}" r="${f(m * (0.08 + seed(index + 15) * 0.14))}" fill="none" stroke="${color}" stroke-opacity="${f(o)}" stroke-width="${f(m * 0.012)}"/>`;
    } else if (kind === 'stripes') {
      const step = m / 14;
      for (let x = -H; x < W + H; x += step * 2) body += `<rect x="${f(x)}" y="0" width="${f(step)}" height="${f(H)}" fill="${color}" fill-opacity="${f(o)}"/>`;
    } else if (kind === 'diagonal') {
      const step = m / 12;
      for (let x = -H; x < W; x += step) body += `<path d="M${f(x)} ${f(H)}L${f(x + H)} 0" stroke="${color}" stroke-opacity="${f(o)}" stroke-width="${f(step * 0.18)}"/>`;
    } else if (kind === 'grid') {
      const step = m / 16;
      for (let x = 0; x <= W; x += step) body += `<path d="M${f(x)} 0V${f(H)}" stroke="${color}" stroke-opacity="${f(o)}" stroke-width="2"/>`;
      for (let y = 0; y <= H; y += step) body += `<path d="M0 ${f(y)}H${f(W)}" stroke="${color}" stroke-opacity="${f(o)}" stroke-width="2"/>`;
    } else if (kind === 'dots') {
      const step = m / 22;
      for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(step * 0.13)}" fill="${color}" fill-opacity="${f(o)}"/>`;
    } else if (kind === 'blobs') {
      body += `<path d="M${f(W * 0.62)} ${f(-H * 0.05)}C${f(W * 0.95)} ${f(H * 0.05)} ${f(W * 1.1)} ${f(H * 0.3)} ${f(W * 0.85)} ${f(H * 0.42)}C${f(W * 0.6)} ${f(H * 0.55)} ${f(W * 0.45)} ${f(H * 0.2)} ${f(W * 0.62)} ${f(-H * 0.05)}Z" fill="${color}" fill-opacity="${f(o)}"/><path d="M${f(-W * 0.05)} ${f(H * 0.72)}C${f(W * 0.25)} ${f(H * 0.62)} ${f(W * 0.45)} ${f(H * 0.85)} ${f(W * 0.3)} ${f(H * 1.05)}C${f(W * 0.1)} ${f(H * 1.15)} ${f(-W * 0.15)} ${f(H * 0.9)} ${f(-W * 0.05)} ${f(H * 0.72)}Z" fill="${color}" fill-opacity="${f(o * 0.8)}"/>`;
    } else if (kind === 'triangles') {
      for (let index = 0; index < 10; index += 1) {
        const cx = seed(index + 5) * W; const cy = seed(index + 30) * H; const r = m * (0.04 + seed(index + 55) * 0.09); const turn = seed(index + 70) * 6.28;
        body += `<path d="${poly([0, 1, 2].map((corner) => [cx + Math.cos(turn + corner * 2.094) * r, cy + Math.sin(turn + corner * 2.094) * r]))}" fill="${color}" fill-opacity="${f(o * (0.4 + seed(index + 90) * 0.6))}"/>`;
      }
    } else if (kind === 'corners') {
      const s = m * 0.16;
      body += `<path d="M0 0H${f(s)}L0 ${f(s)}Z" fill="${color}" fill-opacity="${f(o)}"/><path d="M${f(W)} ${f(H)}H${f(W - s)}L${f(W)} ${f(H - s)}Z" fill="${color}" fill-opacity="${f(o)}"/><path d="M${f(W)} 0H${f(W - s * 0.6)}L${f(W)} ${f(s * 0.6)}Z" fill="${color}" fill-opacity="${f(o * 0.6)}"/><path d="M0 ${f(H)}H${f(s * 0.6)}L0 ${f(H - s * 0.6)}Z" fill="${color}" fill-opacity="${f(o * 0.6)}"/>`;
    }
    return `<g>${body}</g>`;
  }

  /* ───────── Logo ───────── */
  function logoSvg(design, assets, n, u, qrCx, qrCy, ids) {
    const box = logoBox(design, n);
    if (!box) return '';
    const logo = design.logo;
    const side = box.side * u;
    const cx = qrCx;
    const cy = qrCy;
    const half = side / 2;
    const shapePath = (inset = 0) => {
      const h = half - inset;
      if (logo.shape === 'circle') return circle(cx, cy, h);
      if (logo.shape === 'rounded') return rr(cx - h, cy - h, h * 2, h * 2, [h * 0.4, h * 0.4, h * 0.4, h * 0.4]);
      return rr(cx - h, cy - h, h * 2, h * 2, [0, 0, 0, 0]);
    };
    let out = '';
    if (logo.plate) out += `<path d="${shapePath()}" fill="${logo.plateColor}"${logo.borderWidth ? ` stroke="${logo.borderColor}" stroke-width="${f(logo.borderWidth * u / 10)}"` : ''}/>`;
    else if (logo.borderWidth) out += `<path d="${shapePath()}" fill="none" stroke="${logo.borderColor}" stroke-width="${f(logo.borderWidth * u / 10)}"/>`;
    const content = half * 2 * (1 - logo.padding / 100) * (logo.shape === 'circle' ? 0.74 : 0.88);
    if (logo.kind === 'icon') {
      const icon = ICONS[logo.icon] || ICONS.star;
      const k = content / 24;
      out += `<g transform="translate(${f(cx - content / 2)} ${f(cy - content / 2)}) scale(${f(k)})" fill="none" stroke="${logo.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
      for (const d of icon.stroke || []) out += `<path d="${d}"/>`;
      for (const d of icon.fill || []) out += `<path d="${d}" fill="${logo.color}" stroke="none"${icon.rule ? ` fill-rule="${icon.rule}"` : ''}/>`;
      out += '</g>';
    } else if (logo.kind === 'text') {
      const label = logo.text.trim() || 'QR';
      const size = Math.min(content * 0.9, (content * 1.05) / Math.max(1.4, label.length * 0.62));
      out += `<text x="${f(cx)}" y="${f(cy)}" font-family="${esc(fontById('inter')[2])}" font-size="${f(size)}" font-weight="800" fill="${logo.color}" text-anchor="middle" dominant-baseline="central">${esc(label)}</text>`;
      ids.fonts.add('inter');
    } else if (logo.kind === 'image' && assets.logoImage) {
      const clipId = `logoclip${ids.next()}`;
      const inner = half * (1 - logo.padding / 200) ;
      const clip = logo.shape === 'circle' ? circle(cx, cy, inner) : logo.shape === 'rounded' ? rr(cx - inner, cy - inner, inner * 2, inner * 2, [inner * 0.4, inner * 0.4, inner * 0.4, inner * 0.4]) : rr(cx - inner, cy - inner, inner * 2, inner * 2, [0, 0, 0, 0]);
      out += `<clipPath id="${clipId}"><path d="${clip}"/></clipPath><image href="${assets.logoImage}" x="${f(cx - inner)}" y="${f(cy - inner)}" width="${f(inner * 2)}" height="${f(inner * 2)}" preserveAspectRatio="xMidYMid ${logo.plate ? 'meet' : 'slice'}" clip-path="url(#${clipId})"/>`;
    }
    return out;
  }

  /* ───────── Main renderer ───────── */
  function render(inputDesign, info, assets = {}) {
    const design = sanitizeDesign(inputDesign);
    const matrix = matrixFrom(info);
    const n = matrix.size;
    const geo = geometry(design.layout.id);
    const { W, H } = geo;
    const used = new Set();
    let counter = 0;
    const ids = { fonts: used, next: () => { counter += 1; return counter; } };
    const art = assets.art || {};
    const defs = [];
    const body = [];

    /* canvas background */
    const lay = design.layout;
    const span = { x: 0, y: 0, w: W, h: H };
    const shapeMask = [];
    const radius = Math.min(W, H) * lay.radius / 100;
    if (geo.shape === 'circle') shapeMask.push(`<circle cx="${f(W / 2)}" cy="${f(H / 2)}" r="${f(W / 2)}" fill="#fff"/>`);
    else shapeMask.push(`<rect width="${f(W)}" height="${f(H)}" rx="${f(radius)}" fill="#fff"/>`);
    if (geo.shape === 'ticket') shapeMask.push(`<circle cx="${f(geo.perf)}" cy="0" r="38" fill="#000"/><circle cx="${f(geo.perf)}" cy="${f(H)}" r="38" fill="#000"/><circle cx="0" cy="${f(H / 2)}" r="30" fill="#000"/><circle cx="${f(W)}" cy="${f(H / 2)}" r="30" fill="#000"/>`);
    if (geo.shape === 'tag') shapeMask.push(`<circle cx="${f(geo.hole.cx)}" cy="${f(geo.hole.cy)}" r="${geo.hole.r}" fill="#000"/>`);
    defs.push(`<mask id="shape" maskUnits="userSpaceOnUse" x="0" y="0" width="${f(W)}" height="${f(H)}">${shapeMask.join('')}</mask>`);

    const plain = design.layout.id === 'plain';
    if (!plain) {
      const bg = lay.bg;
      if (bg.mode === 'linear' || bg.mode === 'radial') { defs.push(gradientDef('bg', bg.mode, bg.c1, bg.c2, bg.angle, span)); body.push(`<rect width="${f(W)}" height="${f(H)}" fill="url(#bg)"/>`); }
      else if (bg.mode === 'solid') body.push(`<rect width="${f(W)}" height="${f(H)}" fill="${bg.c1}"/>`);
      const artItem = bg.art && art[bg.art];
      if (artItem && bg.artOpacity > 0) body.push(`<image href="${artItem.dataUrl}" x="0" y="0" width="${f(W)}" height="${f(H)}" preserveAspectRatio="xMidYMid ${bg.artFit === 'contain' ? 'meet' : 'slice'}"${bg.artOpacity < 100 ? ` opacity="${f(bg.artOpacity / 100)}"` : ''}/>`);
      if (bg.overlay > 0 && bg.mode !== 'transparent') body.push(`<rect width="${f(W)}" height="${f(H)}" fill="${bg.overlayColor}" fill-opacity="${f(bg.overlay / 100)}"/>`);
      if (!artItem) body.push(decoSvg(lay.deco, W, H, lay.decoColor, lay.decoOpacity)); // the vector pattern is the stand-in for a missing/unchosen art
      if (lay.ornament && art[lay.ornament] && lay.ornamentOpacity > 0) {
        const o = art[lay.ornament];
        const size = W * lay.ornamentScale / 100;
        /* Corner art ("enters from the top-left") is turned to each corner; object art (a cup, balloons…) stays upright and is only mirrored. */
        const corner = CORNER_ART.has(lay.ornament);
        const place = (x, y, turn = 0, mirror = false) => {
          const cx = x + size / 2;
          const cy = y + size / 2;
          const moves = [turn ? `rotate(${turn} ${f(cx)} ${f(cy)})` : '', mirror ? `translate(${f(2 * cx)} 0) scale(-1 1)` : ''].filter(Boolean).join(' ');
          return `<image href="${o.dataUrl}" x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" preserveAspectRatio="xMidYMid meet"${moves ? ` transform="${moves}"` : ''}${lay.ornamentOpacity < 100 ? ` opacity="${f(lay.ornamentOpacity / 100)}"` : ''}/>`;
        };
        const left = -size * 0.1;
        const right = W - size * 0.9;
        const topY = -size * 0.1;
        const bottomY = H - size * 0.9;
        const pos = lay.ornamentPos;
        if (pos === 'corners') body.push(place(-size * 0.12, -size * 0.12), corner ? place(W - size * 0.88, H - size * 0.88, 180) : place(W - size * 0.88, H - size * 0.88, 0, true));
        else if (pos === 'tl') body.push(place(left, topY));
        else if (pos === 'tr') body.push(corner ? place(right, topY, 90) : place(right, topY, 0, true));
        else if (pos === 'bl') body.push(corner ? place(left, bottomY, 270) : place(left, bottomY));
        else if (pos === 'br') body.push(corner ? place(right, bottomY, 180) : place(right, bottomY, 0, true));
        else if (pos === 'top') body.push(place((W - size) / 2, -size * 0.15));
        else if (pos === 'bottom') body.push(place((W - size) / 2, H - size * 0.85));
        else body.push(place((W - size) / 2, (H - size) / 2));
      }
      if (geo.shape === 'ticket') body.push(`<path d="M${geo.perf} 50V${f(H - 50)}" stroke="${lay.bg.mode === 'transparent' ? '#94a3b8' : mix(lay.bg.c1, contrastText(lay.bg.c1), 0.45)}" stroke-width="4" stroke-dasharray="4 14" stroke-linecap="round" fill="none"/>`);
      if (geo.ring) {
        const cta = lay.texts.cta;
        const phrase = (cta.on && cta.text.trim() ? cta.text.trim() : '').toUpperCase();
        if (phrase) {
          const ringId = 'ring';
          const r = geo.ring.r;
          defs.push(`<path id="${ringId}" d="M${f(geo.ring.cx - r)} ${f(geo.ring.cy)}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0"/>`);
          const size = 62 * cta.size / 100;
          const unit = `${phrase}  •  `;
          const circumference = 2 * Math.PI * r;
          const repeat = Math.max(1, Math.round(circumference / widthOf(unit, size, cta.font, cta.weight, true)));
          const text = unit.repeat(repeat);
          body.push(`<circle cx="${f(geo.ring.cx)}" cy="${f(geo.ring.cy)}" r="${f(r + size * 0.95)}" fill="none" stroke="${cta.color}" stroke-opacity="0.35" stroke-width="3"/><text font-family="${esc(fontById(cta.font)[2])}" font-size="${f(size)}" font-weight="${cta.weight}" fill="${cta.color}" letter-spacing="${f(size * 0.06)}" dominant-baseline="central"><textPath href="#${ringId}" textLength="${f(circumference - 4)}" lengthAdjust="spacing">${esc(text)}</textPath></text>`);
          used.add(cta.font);
        }
      }
    }

    /* QR block */
    const { x: qx, y: qy, s: qs } = geo.qr;
    const margin = design.margin;
    const u = qs / (n + 2 * margin);
    const origin = { x: qx + margin * u, y: qy + margin * u };
    const bgq = design.background;
    const blockRadius = qs * design.block.radius / 100;
    const blockSpan = { x: qx, y: qy, w: qs, h: qs };
    let blockPaint = bgq.c1;
    if (bgq.mode === 'linear') { defs.push(gradientDef('qbg', 'linear', bgq.c1, bgq.c2, bgq.angle, blockSpan)); blockPaint = 'url(#qbg)'; }
    if (design.block.shadow && bgq.mode !== 'transparent') defs.push('<filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.35"/></filter>');
    if (bgq.mode !== 'transparent' || design.block.borderWidth) {
      const strokeWidth = design.block.borderWidth * qs / 1000;
      body.push(`<rect x="${f(qx + strokeWidth / 2)}" y="${f(qy + strokeWidth / 2)}" width="${f(qs - strokeWidth)}" height="${f(qs - strokeWidth)}" rx="${f(Math.max(0, blockRadius - strokeWidth / 2))}" fill="${bgq.mode === 'transparent' ? 'none' : blockPaint}"${strokeWidth ? ` stroke="${design.block.borderColor}" stroke-width="${f(strokeWidth)}"` : ''}${design.block.shadow && bgq.mode !== 'transparent' ? ' filter="url(#shadow)"' : ''}/>`);
    }

    /* code */
    const cleared = clearedSet(design, matrix);
    const on = (x, y) => matrix.get(x, y) && !inFinderZone(x, y, n) && !cleared.has(y * n + x);
    const fillSpan = { x: 0, y: 0, w: n, h: n };
    let paint = design.fill.c1;
    if (design.fill.mode !== 'solid') { defs.push(gradientDef('fg', design.fill.mode, design.fill.c1, design.fill.c2, design.fill.angle, fillSpan)); paint = 'url(#fg)'; }
    const eyeOuterPaint = design.eyes.custom ? design.eyes.outerColor : paint;
    const eyeInnerPaint = design.eyes.custom ? design.eyes.innerColor : paint;
    const corners = [[0, 0, 0], [n - 7, 0, 1], [0, n - 7, 2]];
    let eyesOuter = '';
    let eyesInner = '';
    for (const [ex, ey, corner] of corners) { eyesOuter += eyeOuter(design.eyes.outer, ex, ey, corner); eyesInner += eyeInner(design.eyes.inner, ex, ey, corner); }
    const dataPath = modulesPath(design.modules.shape, design.modules.scale, on, n);
    body.push(`<g transform="translate(${f(origin.x)} ${f(origin.y)}) scale(${f(u)})"><path d="${dataPath}" fill="${paint}"/><path d="${eyesOuter}" fill="${eyeOuterPaint}" fill-rule="evenodd"/><path d="${eyesInner}" fill="${eyeInnerPaint}"/></g>`);
    body.push(logoSvg(design, assets, n, u, qx + qs / 2, qy + qs / 2, ids));

    /* texts */
    if (!plain) for (const role of geo.ring ? [] : ['title', 'subtitle', 'cta', 'footer']) body.push(layoutText(role, lay.texts[role], geo.slots[role], { used }));

    /* fonts: Inter ships with the app, so embed it when used (an SVG picture cannot load fonts by itself) */
    let fontCss = '';
    if (used.has('inter') && assets.fonts && assets.fonts.inter) fontCss = `<style>@font-face{font-family:'Inter';font-weight:100 900;src:url(data:font/woff2;base64,${assets.fonts.inter}) format('woff2');}</style>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${fontCss}${defs.join('')}</defs><g mask="url(#shape)">${body.join('')}</g></svg>`;
    return {
      svg, width: W, height: H, mm: geo.mm,
      module: { size: u, cells: n, margin, cleared: cleared.size, total: n * n, block: geo.qr }
    };
  }

  /* ───────── Quality / scan-ability checks ───────── */
  const ECC_RECOVERY = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 };
  function assess(inputDesign, info, extra = {}) {
    const design = sanitizeDesign(inputDesign);
    const items = [];
    const add = (level, text) => items.push({ level, text });
    const colors = [design.fill.c1, ...(design.fill.mode !== 'solid' ? [design.fill.c2] : []), ...(design.eyes.custom ? [design.eyes.outerColor, design.eyes.innerColor] : [])];
    const bgColors = design.background.mode === 'transparent' ? null : [design.background.c1, ...(design.background.mode === 'linear' ? [design.background.c2] : [])];
    if (!bgColors) add('warn', 'Fundo transparente: a leitura depende do que estiver atrás do código. Prefira um fundo claro sólido para imprimir.');
    else {
      let worst = Infinity;
      for (const fg of colors) for (const bg of bgColors) worst = Math.min(worst, contrastRatio(fg, bg));
      if (worst < 3) add('bad', `Contraste muito baixo (${worst.toFixed(1)}:1). Muitos celulares não vão ler. Escureça o código ou clareie o fundo.`);
      else if (worst < 4.5) add('warn', `Contraste moderado (${worst.toFixed(1)}:1). Funciona em boa luz, mas arrisca falhar em papel ou tela fraca. Ideal: 7:1 ou mais.`);
      else add('ok', `Bom contraste (${worst.toFixed(1)}:1).`);
      if (luminance(design.fill.c1) > luminance(design.background.c1) + 0.05) add('warn', 'Código claro sobre fundo escuro (invertido): alguns leitores antigos não reconhecem. Teste no celular antes de imprimir.');
    }
    if (design.margin < 2) add('bad', 'Margem (zona silenciosa) abaixo de 2 módulos: a leitura falha com frequência. O recomendado é 4.');
    else if (design.margin < 4) add('warn', `Margem de ${design.margin} módulos: o padrão é 4. Aumente se o código ficar colado em bordas.`);
    const roundish = ['dots', 'diamond', 'cross', 'star', 'heart'].includes(design.modules.shape);
    if (design.modules.scale < (roundish ? 88 : 70) && design.modules.shape !== 'bars-v' && design.modules.shape !== 'bars-h') add('warn', roundish ? 'Formas pequenas dentro de cada célula: deixe o tamanho em 90–100% para a leitura ser confiável.' : 'Módulos muito pequenos dentro de cada célula: pode dificultar a leitura.');
    if (['star', 'heart', 'cross', 'diamond'].includes(design.modules.shape)) add('warn', 'Forma decorativa: teste a leitura (botão "Testar leitura") e evite tamanhos pequenos.');
    if (design.fill.mode !== 'solid' && contrastRatio(design.fill.c1, design.fill.c2) > 6 && bgColors) add('warn', 'O degradê vai de um tom muito escuro a um muito claro: as partes claras podem perder contraste.');

    if (info) {
      const box = design.logo.kind !== 'none' && design.logo.clear ? clearedSet(design, matrixFrom(info)).size : 0;
      const eclUsed = info.ecl;
      if (design.logo.kind !== 'none') {
        const share = box / (info.size * info.size);
        const capacity = ECC_RECOVERY[eclUsed] || 0.15;
        if (design.logo.clear && share > capacity * 0.9) add('bad', `O logo apaga ${(share * 100).toFixed(0)}% do código e o nível ${eclUsed} só recupera ≈ ${(capacity * 100).toFixed(0)}%. Reduza o logo ou use o nível H.`);
        else if (design.logo.clear && share > capacity * 0.6) add('warn', `O logo cobre ${(share * 100).toFixed(0)}% do código (limite do nível ${eclUsed}: ≈ ${(capacity * 100).toFixed(0)}%). Confirme com "Testar leitura".`);
        else add('ok', `Logo cobre ${(share * 100).toFixed(1)}% do código, dentro da margem do nível ${eclUsed}.`);
        if (design.logo.size > 25) add('warn', 'Logo grande (acima de 25% da largura): quanto maior, mais difícil a leitura.');
        if (eclUsed !== 'H' && eclUsed !== 'Q' && design.logo.clear) add('warn', `Com logo, use correção de erro Q ou H (agora: ${eclUsed}).`);
      }
      if (info.version >= 12) add('warn', `Código denso (versão ${info.version}, ${info.size}×${info.size} módulos). Textos e links mais curtos geram códigos mais simples e fáceis de ler.`);
      if (extra.exportPx && extra.moduleCanvas) {
        const modulePx = extra.moduleCanvas * (extra.exportPx / (extra.canvasWidth || 1000));
        if (modulePx < 3) add('bad', `No tamanho de exportação escolhido, cada módulo tem ${modulePx.toFixed(1)} px: pequeno demais. Exporte maior.`);
        else if (modulePx < 6) add('warn', `Cada módulo terá ${modulePx.toFixed(1)} px na exportação; prefira 6 px ou mais.`);
      }
      if (extra.printMm && extra.moduleCanvas) {
        const moduleMm = extra.moduleCanvas * (extra.printMm / (extra.canvasWidth || 1000));
        if (moduleMm < 0.25) add('bad', `Impresso com ${extra.printMm} mm de largura, cada módulo fica com ${moduleMm.toFixed(2)} mm: ilegível. Aumente o tamanho impresso.`);
        else if (moduleMm < 0.35) add('warn', `Impresso com ${extra.printMm} mm de largura, cada módulo fica com ${moduleMm.toFixed(2)} mm. O mínimo seguro é ≈ 0,4 mm.`);
        else add('ok', `Impresso com ${extra.printMm} mm de largura, cada módulo fica com ${moduleMm.toFixed(2)} mm.`);
      }
    }
    return items;
  }

  function chooseEcl(design) {
    const value = sanitizeDesign(design);
    if (value.ecl !== 'auto') return value.ecl;
    return value.logo.kind !== 'none' && value.logo.clear ? 'H' : 'M';
  }

  const api = {
    SPEC, DEFAULT_DESIGN, SHAPES, EYE_OUTER, EYE_INNER, FONTS, DECOS, LAYOUTS, ICONS, ICON_NAMES,
    sanitizeDesign, applyPatch, mergeDeep, clone, getPath, setPath, specAt, defaultsOf,
    geometry, render, assess, chooseEcl, matrixFrom, clearedSet, logoBox, contrastRatio, luminance, mix, contrastText
  };
  root.ArcQrRender = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
