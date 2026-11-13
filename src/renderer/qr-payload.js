/* arc.Studio — QR payloads: turns a form (Wi-Fi, contact, Pix, …) into the exact text a QR Code must carry.
   Pure and local; every format follows the convention phone cameras understand.
   Browser: window.ArcQrPayload · Node (tests): module.exports. */
(function register(root) {
  const text = (key, label, extra = {}) => ({ key, label, kind: 'text', ...extra });
  const area = (key, label, extra = {}) => ({ key, label, kind: 'textarea', ...extra });
  const select = (key, label, options, extra = {}) => ({ key, label, kind: 'select', options, ...extra });
  const check = (key, label, extra = {}) => ({ key, label, kind: 'checkbox', ...extra });

  const SOCIAL = {
    instagram: ['Instagram', 'https://instagram.com/', 'usuario'],
    tiktok: ['TikTok', 'https://www.tiktok.com/@', 'usuario'],
    x: ['X (Twitter)', 'https://x.com/', 'usuario'],
    youtube: ['YouTube', 'https://youtube.com/@', 'canal'],
    facebook: ['Facebook', 'https://facebook.com/', 'pagina'],
    linkedin: ['LinkedIn', 'https://www.linkedin.com/in/', 'seu-perfil'],
    github: ['GitHub', 'https://github.com/', 'usuario'],
    twitch: ['Twitch', 'https://twitch.tv/', 'canal'],
    telegram: ['Telegram', 'https://t.me/', 'usuario'],
    discord: ['Discord (convite)', 'https://discord.gg/', 'codigo-do-convite'],
    pinterest: ['Pinterest', 'https://pinterest.com/', 'usuario'],
    spotify: ['Spotify (artista)', 'https://open.spotify.com/artist/', 'id-do-artista'],
    threads: ['Threads', 'https://www.threads.net/@', 'usuario']
  };

  const TYPES = [
    { id: 'url', label: 'Link', icon: 'link', hint: 'Abre um site ao escanear.', example: 'https://arcxp.online',
      fields: [text('url', 'Endereço do site', { placeholder: 'arcxp.online', required: true, max: 2000 })] },
    { id: 'text', label: 'Texto', icon: 'file-text', hint: 'Mostra um texto livre.', example: 'Olá! Este texto está dentro de um QR Code.',
      fields: [area('text', 'Texto', { placeholder: 'Qualquer texto, até ≈ 2.000 caracteres', required: true, max: 2000, rows: 4 })] },
    { id: 'wifi', label: 'Wi-Fi', icon: 'wifi', hint: 'Conecta o celular à rede sem digitar a senha.', example: 'WIFI:T:WPA;S:MinhaRede;P:senha1234;;',
      fields: [
        text('ssid', 'Nome da rede (SSID)', { required: true, max: 32 }),
        text('password', 'Senha', { max: 63, secret: true }),
        select('security', 'Segurança', [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP (antiga)'], ['nopass', 'Sem senha']], { value: 'WPA' }),
        check('hidden', 'Rede oculta')
      ] },
    { id: 'vcard', label: 'Contato', icon: 'user', hint: 'Salva um contato (vCard) na agenda.', example: 'BEGIN:VCARD',
      fields: [
        text('first', 'Nome', { required: true, max: 60 }), text('last', 'Sobrenome', { max: 60 }),
        text('org', 'Empresa', { max: 80 }), text('title', 'Cargo', { max: 80 }),
        text('mobile', 'Celular', { placeholder: '+55 11 99999-9999', max: 30 }), text('phone', 'Telefone fixo', { max: 30 }),
        text('email', 'E-mail', { max: 120 }), text('website', 'Site', { max: 200 }),
        text('street', 'Rua e número', { max: 120 }), text('city', 'Cidade', { max: 60 }),
        text('state', 'Estado', { max: 40 }), text('zip', 'CEP', { max: 20 }), text('country', 'País', { max: 40 }),
        area('note', 'Observação', { max: 300, rows: 2 })
      ] },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'send', hint: 'Abre uma conversa já com a mensagem pronta.', example: 'https://wa.me/5511999999999',
      fields: [
        text('number', 'Número com DDI e DDD', { placeholder: '5511999999999', required: true, max: 20 }),
        area('message', 'Mensagem inicial (opcional)', { max: 500, rows: 3 })
      ] },
    { id: 'email', label: 'E-mail', icon: 'mail', hint: 'Abre um e-mail novo, já preenchido.', example: 'mailto:contato@exemplo.com',
      fields: [
        text('to', 'Para', { required: true, max: 160 }), text('subject', 'Assunto', { max: 200 }), area('body', 'Mensagem', { max: 800, rows: 3 })
      ] },
    { id: 'phone', label: 'Telefone', icon: 'smartphone', hint: 'Disca para um número.', example: 'tel:+5511999999999',
      fields: [text('number', 'Número', { placeholder: '+55 11 99999-9999', required: true, max: 30 })] },
    { id: 'sms', label: 'SMS', icon: 'send', hint: 'Abre uma mensagem de texto pronta.', example: 'sms:+5511999999999',
      fields: [text('number', 'Número', { required: true, max: 30 }), area('message', 'Mensagem', { max: 500, rows: 3 })] },
    { id: 'geo', label: 'Localização', icon: 'pin', hint: 'Abre um ponto no mapa.', example: 'https://maps.google.com/?q=-23.5505,-46.6333',
      fields: [
        text('lat', 'Latitude', { placeholder: '-23.5505', required: true, max: 20 }), text('lon', 'Longitude', { placeholder: '-46.6333', required: true, max: 20 }),
        text('label', 'Nome do local (opcional)', { max: 80 }),
        select('mode', 'Formato', [['maps', 'Link do Google Maps (funciona em qualquer celular)'], ['geo', 'Padrão geo: (abre o app de mapas escolhido)']], { value: 'maps' })
      ] },
    { id: 'event', label: 'Evento', icon: 'tag', hint: 'Adiciona um evento ao calendário.', example: 'BEGIN:VEVENT',
      fields: [
        text('title', 'Título', { required: true, max: 120 }), text('location', 'Local', { max: 160 }),
        { key: 'start', label: 'Início', kind: 'datetime', required: true }, { key: 'end', label: 'Fim', kind: 'datetime' },
        check('allDay', 'Dia inteiro'), area('description', 'Descrição', { max: 500, rows: 3 })
      ] },
    { id: 'pix', label: 'Pix', icon: 'zap', hint: 'Pagamento Pix estático (copia e cola).', example: '000201…',
      fields: [
        text('key', 'Chave Pix', { placeholder: 'e-mail, CPF/CNPJ, telefone ou chave aleatória', required: true, max: 77 }),
        text('name', 'Nome do recebedor', { required: true, max: 25 }), text('city', 'Cidade', { required: true, max: 15 }),
        text('amount', 'Valor (opcional)', { placeholder: '25,90', max: 12 }),
        text('txid', 'Identificador (opcional)', { placeholder: 'LOJA2026', max: 25 }),
        text('description', 'Mensagem (opcional)', { max: 40 })
      ] },
    { id: 'social', label: 'Rede social', icon: 'sparkles', hint: 'Abre um perfil ou canal.', example: 'https://instagram.com/arcanoxp',
      fields: [
        select('network', 'Rede', Object.entries(SOCIAL).map(([id, value]) => [id, value[0]]), { value: 'instagram' }),
        text('user', 'Usuário, canal ou código', { placeholder: 'arcanoxp', required: true, max: 120 })
      ] }
  ];

  const clean = (value, max = 2000) => String(value ?? '').replace(/\r\n?/g, '\n').slice(0, max);
  const trim = (value, max) => clean(value, max).trim();
  const digits = (value) => String(value ?? '').replace(/\D+/g, '');

  /* ───────── Pix (EMV BR Code, static) ───────── */
  function crc16(input) {
    let crc = 0xffff;
    for (let index = 0; index < input.length; index += 1) {
      crc ^= input.charCodeAt(index) << 8;
      for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  const emv = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;
  const ascii = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '');

  /* "1.250,50" (comma = decimal) and "25.90" (dot = decimal) both mean what they look like. */
  function parseAmount(raw) {
    const value = String(raw).trim();
    return Number(value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value);
  }

  function pixPayload({ key, name, city, amount, txid, description }) {
    const account = emv('00', 'br.gov.bcb.pix') + emv('01', key) + (description ? emv('02', description) : '');
    const value = amount ? parseAmount(amount) : 0;
    let body = emv('00', '01') + emv('01', value > 0 ? '12' : '11') + emv('26', account) + emv('52', '0000') + emv('53', '986');
    if (value > 0) body += emv('54', value.toFixed(2));
    body += emv('58', 'BR') + emv('59', name) + emv('60', city) + emv('62', emv('05', txid || '***'));
    body += '6304';
    return body + crc16(body);
  }

  /* ───────── helpers ───────── */
  const escapeWifi = (value) => String(value).replace(/([\\;,:"])/g, '\\$1');
  const escapeVcard = (value) => String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const escapeIcs = (value) => String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

  function normalizeUrl(value) {
    const raw = trim(value, 2000);
    if (!raw) return { url: '', added: false };
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^/]+:\d+(\/|$)/.test(raw)) return { url: raw, added: false };
    if (/^\/\//.test(raw)) return { url: `https:${raw}`, added: true };
    return { url: `https://${raw}`, added: true };
  }

  function icsStamp(value, allDay) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(value || ''));
    if (!match) return null;
    const [, year, month, day, hour = '00', minute = '00'] = match;
    return allDay ? `${year}${month}${day}` : `${year}${month}${day}T${hour}${minute}00`;
  }

  function typeById(id) { return TYPES.find((type) => type.id === id) || TYPES[0]; }

  function defaultFields(typeId) {
    const values = {};
    for (const field of typeById(typeId).fields) values[field.key] = field.kind === 'checkbox' ? false : field.value || '';
    return values;
  }

  /* → { text, errors[], warnings[], empty }  — `text` is '' while required data is missing. */
  function buildPayload(typeId, input = {}) {
    const type = typeById(typeId);
    const f = (key, max) => trim(input[key], max ?? 2000);
    const errors = [];
    const warnings = [];
    const need = (key) => { if (!f(key)) errors.push(`Preencha "${type.fields.find((field) => field.key === key)?.label || key}".`); };
    for (const field of type.fields) if (field.required) need(field.key);
    if (errors.length) return { text: '', errors, warnings, empty: errors.length === type.fields.filter((field) => field.required).length };

    let out = '';
    switch (type.id) {
      case 'url': {
        const { url, added } = normalizeUrl(input.url);
        if (added) warnings.push(`Adicionei "https://" ao endereço: ${url}`);
        if (/\s/.test(url)) errors.push('O endereço não pode ter espaços.');
        else if (!/^[a-z][a-z0-9+.-]*:\/\/[^/\s]+\.[^/\s]+/i.test(url) && !/^(mailto|tel|sms|geo|market|intent):/i.test(url)) warnings.push('O endereço parece incompleto (falta o domínio?). Confira antes de imprimir.');
        if (/^http:\/\//i.test(url)) warnings.push('Link sem HTTPS: alguns celulares avisam que o site não é seguro.');
        out = url;
        break;
      }
      case 'text': out = clean(input.text); break;
      case 'wifi': {
        const security = ['WPA', 'WEP', 'nopass'].includes(input.security) ? input.security : 'WPA';
        if (security !== 'nopass' && !f('password')) errors.push('Preencha a senha ou escolha "Sem senha".');
        if (f('ssid').length > 32) errors.push('O nome da rede passa de 32 caracteres.');
        out = `WIFI:T:${security};S:${escapeWifi(f('ssid'))};${security === 'nopass' ? '' : `P:${escapeWifi(clean(input.password, 63))};`}${input.hidden ? 'H:true;' : ''};`;
        if (security === 'WEP') warnings.push('WEP é uma segurança antiga e fraca; prefira WPA2/WPA3.');
        warnings.push('A senha fica visível para quem ler o QR Code: use só onde isso for aceitável (ex.: rede de visitantes).');
        break;
      }
      case 'vcard': {
        const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escapeVcard(f('last'))};${escapeVcard(f('first'))};;;`, `FN:${escapeVcard([f('first'), f('last')].filter(Boolean).join(' '))}`];
        if (f('org')) lines.push(`ORG:${escapeVcard(f('org'))}`);
        if (f('title')) lines.push(`TITLE:${escapeVcard(f('title'))}`);
        if (f('mobile')) lines.push(`TEL;TYPE=CELL:${f('mobile')}`);
        if (f('phone')) lines.push(`TEL;TYPE=WORK,VOICE:${f('phone')}`);
        if (f('email')) { lines.push(`EMAIL;TYPE=INTERNET:${f('email')}`); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f('email'))) warnings.push('O e-mail parece inválido.'); }
        if (f('website')) lines.push(`URL:${normalizeUrl(input.website).url}`);
        if (f('street') || f('city') || f('state') || f('zip') || f('country')) lines.push(`ADR;TYPE=WORK:;;${escapeVcard(f('street'))};${escapeVcard(f('city'))};${escapeVcard(f('state'))};${escapeVcard(f('zip'))};${escapeVcard(f('country'))}`);
        if (f('note')) lines.push(`NOTE:${escapeVcard(f('note'))}`);
        lines.push('END:VCARD');
        out = lines.join('\r\n');
        break;
      }
      case 'whatsapp': {
        const number = digits(input.number);
        if (number.length < 10 || number.length > 15) errors.push('Use o número com DDI e DDD, só dígitos (ex.: 5511999999999).');
        else if (number.length <= 11) warnings.push('Parece faltar o código do país (DDI). No Brasil, comece com 55.');
        out = `https://wa.me/${number}${f('message', 500) ? `?text=${encodeURIComponent(clean(input.message, 500).trim())}` : ''}`;
        break;
      }
      case 'email': {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f('to'))) errors.push('O e-mail de destino parece inválido.');
        const params = [];
        if (f('subject')) params.push(`subject=${encodeURIComponent(f('subject'))}`);
        if (f('body')) params.push(`body=${encodeURIComponent(clean(input.body, 800).trim())}`);
        out = `mailto:${f('to')}${params.length ? `?${params.join('&')}` : ''}`;
        break;
      }
      case 'phone': {
        const number = `${/^\s*\+/.test(input.number) ? '+' : ''}${digits(input.number)}`;
        if (digits(number).length < 8) errors.push('O número parece curto demais.');
        out = `tel:${number}`;
        break;
      }
      case 'sms': {
        const number = `${/^\s*\+/.test(input.number) ? '+' : ''}${digits(input.number)}`;
        if (digits(number).length < 3) errors.push('O número parece curto demais.');
        out = `sms:${number}${f('message', 500) ? `?body=${encodeURIComponent(clean(input.message, 500).trim())}` : ''}`;
        break;
      }
      case 'geo': {
        const lat = Number(f('lat').replace(',', '.'));
        const lon = Number(f('lon').replace(',', '.'));
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push('Latitude inválida (de -90 a 90).');
        if (!Number.isFinite(lon) || lon < -180 || lon > 180) errors.push('Longitude inválida (de -180 a 180).');
        const pair = `${lat},${lon}`;
        out = input.mode === 'geo' ? `geo:${pair}${f('label') ? `?q=${pair}(${encodeURIComponent(f('label'))})` : ''}` : `https://maps.google.com/?q=${pair}`;
        break;
      }
      case 'event': {
        const allDay = Boolean(input.allDay);
        const start = icsStamp(input.start, allDay);
        const end = icsStamp(input.end || input.start, allDay);
        if (!start) errors.push('Informe a data de início.');
        else if (end && end < start) errors.push('O fim do evento é antes do início.');
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `SUMMARY:${escapeIcs(f('title'))}`, `DTSTART${allDay ? ';VALUE=DATE' : ''}:${start}`, `DTEND${allDay ? ';VALUE=DATE' : ''}:${end}`];
        if (f('location')) lines.push(`LOCATION:${escapeIcs(f('location'))}`);
        if (f('description')) lines.push(`DESCRIPTION:${escapeIcs(clean(input.description, 500).trim())}`);
        lines.push('END:VEVENT', 'END:VCALENDAR');
        out = lines.join('\r\n');
        break;
      }
      case 'pix': {
        const key = ascii(f('key')).trim();
        const name = ascii(f('name')).slice(0, 25).trim();
        const city = ascii(f('city')).slice(0, 15).trim();
        if (!key) errors.push('A chave Pix tem caracteres inválidos.');
        if (!name) errors.push('Informe o nome do recebedor (sem acentos especiais).');
        if (!city) errors.push('Informe a cidade.');
        if (f('amount') && !(parseAmount(f('amount')) > 0)) errors.push('O valor precisa ser maior que zero (ex.: 25,90).');
        const txid = ascii(f('txid')).replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
        if (f('txid') && !txid) errors.push('O identificador aceita só letras e números.');
        out = errors.length ? '' : pixPayload({ key, name, city, amount: f('amount'), txid, description: ascii(f('description')).slice(0, 40).trim() });
        if (!f('amount')) warnings.push('Sem valor: quem paga digita o valor no app do banco.');
        warnings.push('Confira o nome e a chave no app do seu banco antes de imprimir. Este QR é estático: o dinheiro vai direto para a chave informada.');
        break;
      }
      case 'social': {
        const entry = SOCIAL[input.network] || SOCIAL.instagram;
        const user = f('user').replace(/^@+/, '').replace(/^https?:\/\/[^/]+\//i, '');
        out = `${entry[1]}${encodeURIComponent(user).replace(/%2F/gi, '/')}`;
        break;
      }
      default: out = '';
    }
    if (errors.length) return { text: '', errors, warnings, empty: false };
    return { text: out, errors, warnings, empty: false };
  }

  const api = { TYPES, SOCIAL, typeById, defaultFields, buildPayload, pixPayload, crc16, normalizeUrl };
  root.ArcQrPayload = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
