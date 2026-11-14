/* arc.Studio — unit conversion engine. Pure and local (no network, no rates that expire).
   Every category converts through one base unit; temperature and fuel economy use explicit formulas because they are not proportional.
   Browser: window.ArcUnits · Node (tests): module.exports. */
(function register(root) {
  /* [id, label, symbol, factor to the base unit] — or { to, from } for non-proportional units. */
  const u = (id, label, symbol, factor) => ({ id, label, symbol, factor });
  const fx = (id, label, symbol, to, from) => ({ id, label, symbol, to, from });
  const PI = Math.PI;

  const CATEGORIES = [
    { id: 'length', label: 'Comprimento', base: 'm', from: 'km', to: 'mi', units: [
      u('km', 'Quilômetro', 'km', 1000), u('m', 'Metro', 'm', 1), u('dm', 'Decímetro', 'dm', 0.1), u('cm', 'Centímetro', 'cm', 0.01), u('mm', 'Milímetro', 'mm', 0.001),
      u('um', 'Micrômetro', 'µm', 1e-6), u('nm', 'Nanômetro', 'nm', 1e-9), u('mi', 'Milha', 'mi', 1609.344), u('yd', 'Jarda', 'yd', 0.9144), u('ft', 'Pé', 'ft', 0.3048),
      u('in', 'Polegada', 'in', 0.0254), u('nmi', 'Milha náutica', 'nmi', 1852), u('au', 'Unidade astronômica', 'UA', 149597870700), u('ly', 'Ano-luz', 'al', 9460730472580800)
    ] },
    { id: 'mass', label: 'Massa', base: 'kg', from: 'kg', to: 'lb', units: [
      u('t', 'Tonelada', 't', 1000), u('kg', 'Quilograma', 'kg', 1), u('g', 'Grama', 'g', 0.001), u('mg', 'Miligrama', 'mg', 1e-6), u('ug', 'Micrograma', 'µg', 1e-9),
      u('arroba', 'Arroba', '@', 15), u('lb', 'Libra', 'lb', 0.45359237), u('oz', 'Onça', 'oz', 0.028349523125), u('st', 'Stone', 'st', 6.35029318),
      u('ct', 'Quilate', 'ct', 0.0002), u('ton-us', 'Tonelada curta (EUA)', 'tn', 907.18474), u('ton-uk', 'Tonelada longa (Reino Unido)', 'LT', 1016.0469088)
    ] },
    { id: 'temperature', label: 'Temperatura', base: 'K', from: 'c', to: 'f', units: [
      fx('c', 'Celsius', '°C', (x) => x + 273.15, (k) => k - 273.15), fx('f', 'Fahrenheit', '°F', (x) => (x - 32) * 5 / 9 + 273.15, (k) => (k - 273.15) * 9 / 5 + 32),
      fx('k', 'Kelvin', 'K', (x) => x, (k) => k), fx('r', 'Rankine', '°R', (x) => x * 5 / 9, (k) => k * 9 / 5), fx('re', 'Réaumur', '°Ré', (x) => x * 5 / 4 + 273.15, (k) => (k - 273.15) * 4 / 5)
    ] },
    { id: 'area', label: 'Área', base: 'm²', from: 'm2', to: 'ft2', units: [
      u('km2', 'Quilômetro quadrado', 'km²', 1e6), u('ha', 'Hectare', 'ha', 1e4), u('m2', 'Metro quadrado', 'm²', 1), u('cm2', 'Centímetro quadrado', 'cm²', 1e-4), u('mm2', 'Milímetro quadrado', 'mm²', 1e-6),
      u('alq-sp', 'Alqueire paulista', 'alq. paulista', 24200), u('alq-mg', 'Alqueire mineiro', 'alq. mineiro', 48400),
      u('mi2', 'Milha quadrada', 'mi²', 2589988.110336), u('ac', 'Acre', 'ac', 4046.8564224), u('yd2', 'Jarda quadrada', 'yd²', 0.83612736), u('ft2', 'Pé quadrado', 'ft²', 0.09290304), u('in2', 'Polegada quadrada', 'in²', 0.00064516)
    ] },
    { id: 'volume', label: 'Volume', base: 'L', from: 'l', to: 'gal-us', units: [
      u('m3', 'Metro cúbico', 'm³', 1000), u('l', 'Litro', 'L', 1), u('ml', 'Mililitro', 'mL', 0.001), u('cm3', 'Centímetro cúbico', 'cm³', 0.001),
      u('xic-br', 'Xícara (BR, 240 mL)', 'xíc.', 0.24), u('col-sopa-br', 'Colher de sopa (BR, 15 mL)', 'c. sopa', 0.015), u('col-cha-br', 'Colher de chá (BR, 5 mL)', 'c. chá', 0.005),
      u('gal-us', 'Galão (EUA)', 'gal', 3.785411784), u('gal-uk', 'Galão (Reino Unido)', 'gal UK', 4.54609), u('qt-us', 'Quarto (EUA)', 'qt', 0.946352946), u('pt-us', 'Pinta (EUA)', 'pt', 0.473176473),
      u('cup-us', 'Xícara (EUA)', 'cup', 0.2365882365), u('floz-us', 'Onça fluida (EUA)', 'fl oz', 0.0295735295625), u('tbsp-us', 'Colher de sopa (EUA)', 'tbsp', 0.01478676478125),
      u('in3', 'Polegada cúbica', 'in³', 0.016387064), u('ft3', 'Pé cúbico', 'ft³', 28.316846592), u('bbl', 'Barril de petróleo', 'bbl', 158.987294928)
    ] },
    { id: 'speed', label: 'Velocidade', base: 'm/s', from: 'kmh', to: 'mph', units: [
      u('kmh', 'Quilômetro por hora', 'km/h', 1 / 3.6), u('ms', 'Metro por segundo', 'm/s', 1), u('mph', 'Milha por hora', 'mph', 0.44704), u('kn', 'Nó', 'nó', 1852 / 3600),
      u('fts', 'Pé por segundo', 'ft/s', 0.3048), u('mach', 'Mach (nível do mar, 15 °C)', 'Mach', 340.294), u('c', 'Velocidade da luz', 'c', 299792458)
    ] },
    { id: 'time', label: 'Tempo', base: 's', from: 'h', to: 'min', units: [
      u('ns', 'Nanossegundo', 'ns', 1e-9), u('us', 'Microssegundo', 'µs', 1e-6), u('ms', 'Milissegundo', 'ms', 0.001), u('s', 'Segundo', 's', 1), u('min', 'Minuto', 'min', 60), u('h', 'Hora', 'h', 3600),
      u('d', 'Dia', 'd', 86400), u('wk', 'Semana', 'sem', 604800), u('mo', 'Mês (30,4375 dias)', 'mês', 2629800), u('y', 'Ano (365,25 dias)', 'ano', 31557600), u('dec', 'Década', 'déc.', 315576000), u('cen', 'Século', 'séc.', 3155760000)
    ] },
    { id: 'data', label: 'Dados', base: 'bit', from: 'gb', to: 'mb', units: [
      u('bit', 'Bit', 'bit', 1), u('b', 'Byte', 'B', 8), u('kb', 'Quilobyte (1000 B)', 'kB', 8e3), u('mb', 'Megabyte (10⁶ B)', 'MB', 8e6), u('gb', 'Gigabyte (10⁹ B)', 'GB', 8e9), u('tb', 'Terabyte (10¹² B)', 'TB', 8e12), u('pb', 'Petabyte (10¹⁵ B)', 'PB', 8e15),
      u('kib', 'Kibibyte (1024 B)', 'KiB', 8 * 1024), u('mib', 'Mebibyte (1024² B)', 'MiB', 8 * 1024 ** 2), u('gib', 'Gibibyte (1024³ B)', 'GiB', 8 * 1024 ** 3), u('tib', 'Tebibyte (1024⁴ B)', 'TiB', 8 * 1024 ** 4), u('pib', 'Pebibyte (1024⁵ B)', 'PiB', 8 * 1024 ** 5),
      u('kbit', 'Quilobit', 'kbit', 1e3), u('mbit', 'Megabit', 'Mbit', 1e6), u('gbit', 'Gigabit', 'Gbit', 1e9)
    ] },
    { id: 'energy', label: 'Energia', base: 'J', from: 'kwh', to: 'kcal', units: [
      u('j', 'Joule', 'J', 1), u('kj', 'Quilojoule', 'kJ', 1e3), u('mj', 'Megajoule', 'MJ', 1e6), u('cal', 'Caloria', 'cal', 4.184), u('kcal', 'Quilocaloria', 'kcal', 4184), u('wh', 'Watt-hora', 'Wh', 3600),
      u('kwh', 'Quilowatt-hora', 'kWh', 3.6e6), u('ev', 'Elétron-volt', 'eV', 1.602176634e-19), u('btu', 'BTU', 'BTU', 1055.05585262), u('ftlbf', 'Libra-força pé', 'ft·lbf', 1.3558179483314004)
    ] },
    { id: 'power', label: 'Potência', base: 'W', from: 'kw', to: 'cv', units: [
      u('w', 'Watt', 'W', 1), u('kw', 'Quilowatt', 'kW', 1e3), u('mw', 'Megawatt', 'MW', 1e6), u('cv', 'Cavalo-vapor (métrico)', 'cv', 735.49875), u('hp', 'Horsepower (mecânico)', 'hp', 745.69987158227), u('btuh', 'BTU por hora', 'BTU/h', 0.29307107017)
    ] },
    { id: 'pressure', label: 'Pressão', base: 'Pa', from: 'bar', to: 'psi', units: [
      u('pa', 'Pascal', 'Pa', 1), u('kpa', 'Quilopascal', 'kPa', 1e3), u('mpa', 'Megapascal', 'MPa', 1e6), u('bar', 'Bar', 'bar', 1e5), u('mbar', 'Milibar', 'mbar', 100), u('atm', 'Atmosfera', 'atm', 101325),
      u('mmhg', 'Milímetro de mercúrio', 'mmHg', 133.322387415), u('torr', 'Torr', 'Torr', 101325 / 760), u('psi', 'Libra por polegada²', 'psi', 6894.757293168)
    ] },
    { id: 'angle', label: 'Ângulo', base: '°', from: 'deg', to: 'rad', units: [
      u('deg', 'Grau', '°', 1), u('rad', 'Radiano', 'rad', 180 / PI), u('grad', 'Grado', 'gon', 0.9), u('arcmin', 'Minuto de arco', '′', 1 / 60), u('arcsec', 'Segundo de arco', '″', 1 / 3600), u('turn', 'Volta completa', 'volta', 360)
    ] },
    { id: 'frequency', label: 'Frequência', base: 'Hz', from: 'mhz', to: 'ghz', units: [
      u('hz', 'Hertz', 'Hz', 1), u('khz', 'Quilohertz', 'kHz', 1e3), u('mhz', 'Megahertz', 'MHz', 1e6), u('ghz', 'Gigahertz', 'GHz', 1e9), u('rpm', 'Rotações por minuto', 'rpm', 1 / 60)
    ] },
    { id: 'fuel', label: 'Consumo', base: 'L/100 km', from: 'kml', to: 'l100', units: [
      fx('kml', 'Quilômetros por litro', 'km/L', (x) => 100 / x, (b) => 100 / b), fx('l100', 'Litros por 100 km', 'L/100 km', (x) => x, (b) => b),
      fx('mpg-us', 'Milhas por galão (EUA)', 'mpg', (x) => 235.2145833 / x, (b) => 235.2145833 / b), fx('mpg-uk', 'Milhas por galão (Reino Unido)', 'mpg UK', (x) => 282.4809363 / x, (b) => 282.4809363 / b)
    ] },
    { id: 'bases', label: 'Bases numéricas', base: '', from: 'dec', to: 'hex', special: 'bases', units: [
      { id: 'bin', label: 'Binário (base 2)', symbol: '₂', radix: 2 }, { id: 'oct', label: 'Octal (base 8)', symbol: '₈', radix: 8 }, { id: 'dec', label: 'Decimal (base 10)', symbol: '₁₀', radix: 10 },
      { id: 'hex', label: 'Hexadecimal (base 16)', symbol: '₁₆', radix: 16 }, { id: 'b32', label: 'Base 32', symbol: '₃₂', radix: 32 }, { id: 'b36', label: 'Base 36', symbol: '₃₆', radix: 36 }
    ] }
  ];

  const categoryById = (id) => CATEGORIES.find((category) => category.id === id) || CATEGORIES[0];
  const unitOf = (category, id) => category.units.find((unit) => unit.id === id) || category.units[0];

  /* ───────── number input: "1.234,56", "1,5e3", "2 * (3 + 4,5)", "10^3" — never eval() ───────── */
  /* A lone literal: dots are thousand separators only when a comma is also present, or when the dots form groups of 3 digits ("1.234.567"). */
  function parseLiteral(token) {
    let value = token;
    if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3}){2,}$/.test(value)) value = value.replace(/\./g, '');
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
  }

  function evaluate(expression) {
    const source = String(expression).replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    let position = 0;
    const fail = () => { throw new Error('Não entendi a expressão.'); };
    function number() {
      const match = /^(\d[\d.]*(?:,\d+)?(?:[eE][+-]?\d+)?|,\d+(?:[eE][+-]?\d+)?|\d*\.\d+(?:[eE][+-]?\d+)?)/.exec(source.slice(position));
      if (!match) fail();
      position += match[0].length;
      const parsed = parseLiteral(match[0]);
      if (Number.isNaN(parsed)) fail();
      return parsed;
    }
    function primary() {
      if (source[position] === '(') { position += 1; const inner = sum(); if (source[position] !== ')') fail(); position += 1; return inner; }
      if (source[position] === '-') { position += 1; return -power(); }
      if (source[position] === '+') { position += 1; return power(); }
      return number();
    }
    function power() {
      const base = primary();
      if (source[position] === '^') { position += 1; return base ** power(); }
      return base;
    }
    function product() {
      let value = power();
      while (source[position] === '*' || source[position] === '/') {
        const op = source[position]; position += 1;
        const right = power();
        value = op === '*' ? value * right : value / right;
      }
      return value;
    }
    function sum() {
      let value = product();
      while (source[position] === '+' || source[position] === '-') {
        const op = source[position]; position += 1;
        const right = product();
        value = op === '+' ? value + right : value - right;
      }
      return value;
    }
    if (!source) fail();
    const result = sum();
    if (position !== source.length) fail();
    if (!Number.isFinite(result)) throw new Error('O resultado da expressão não é um número válido.');
    return result;
  }

  /* → { ok, value } | { ok:false, error } */
  function parseInput(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return { ok: false, error: '', empty: true };
    try { return { ok: true, value: evaluate(raw) }; } catch (error) { return { ok: false, error: error.message }; }
  }

  /* ───────── conversion ───────── */
  function toBase(category, unit, value) { return unit.factor !== undefined ? value * unit.factor : unit.to(value); }
  function fromBase(category, unit, value) { return unit.factor !== undefined ? value / unit.factor : unit.from(value); }

  function convert(categoryId, value, fromId, toId) {
    const category = categoryById(categoryId);
    if (category.special) throw new Error('Use convertBase para bases numéricas.');
    const base = toBase(category, unitOf(category, fromId), value);
    const result = fromBase(category, unitOf(category, toId), base);
    return Number.isFinite(result) ? result : NaN;
  }
  function convertAll(categoryId, value, fromId) {
    const category = categoryById(categoryId);
    return category.units.map((unit) => ({ id: unit.id, value: convert(categoryId, value, fromId, unit.id) }));
  }

  const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
  function parseInteger(text, radix) {
    const clean = String(text).trim().toLowerCase().replace(/[\s_]/g, '').replace(radix === 16 ? /^0x/ : radix === 2 ? /^0b/ : radix === 8 ? /^0o/ : /^$/, '');
    if (!clean) return { ok: false, error: '', empty: true };
    const negative = clean.startsWith('-');
    const digits = negative ? clean.slice(1) : clean;
    if (!digits || [...digits].some((char) => DIGITS.indexOf(char) < 0 || DIGITS.indexOf(char) >= radix)) return { ok: false, error: `Dígito inválido para a base ${radix}.` };
    if (digits.length > 200) return { ok: false, error: 'Número grande demais.' };
    let value = 0n;
    const big = BigInt(radix);
    for (const char of digits) value = value * big + BigInt(DIGITS.indexOf(char));
    return { ok: true, value: negative ? -value : value };
  }
  const formatInteger = (value, radix) => value.toString(radix).toUpperCase();

  /* ───────── display ───────── */
  function formatNumber(value, { precision = 10, notation = 'auto', places = 4 } = {}) {
    if (!Number.isFinite(value)) return '—';
    if (value === 0) return '0';
    const p = Math.min(15, Math.max(1, Math.round(precision)));
    const abs = Math.abs(value);
    const scientific = () => value.toExponential(Math.max(0, p - 1)).replace(/\.?0+e/, 'e').replace('e+', ' × 10^').replace('e-', ' × 10^-').replace('.', ',');
    if (notation === 'scientific') return scientific();
    if (notation === 'fixed') return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: Math.min(12, places), maximumFractionDigits: Math.min(12, places) }).format(value);
    if (abs >= 1e15 || abs < 1e-6) return scientific();
    const rounded = Number(value.toPrecision(p));
    return new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: p, useGrouping: true }).format(rounded);
  }
  /* Plain machine-readable text for copying into a spreadsheet or a program (dot decimal, no grouping). */
  function plainNumber(value, precision = 12) {
    if (!Number.isFinite(value)) return '';
    return String(Number(value.toPrecision(Math.min(15, Math.max(1, precision)))));
  }

  const api = { CATEGORIES, categoryById, unitOf, parseInput, evaluate, convert, convertAll, parseInteger, formatInteger, formatNumber, plainNumber };
  root.ArcUnits = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
