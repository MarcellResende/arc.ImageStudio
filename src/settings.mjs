import { mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/* Persistent preferences. They live in Electron's `userData` folder (outside the install
   directory), so updates, reinstalls and uninstalls that keep app data never replace them.
   Everything read from disk or received from the renderer is validated against this schema:
   unknown keys are dropped and invalid values fall back to the defaults. */

export const SETTINGS_VERSION = 1;
export const TOOL_PATH_KEYS = ['compressor', 'resizer', 'converter', 'renamer', 'metadata', 'receiver'];

const enumOf = (...values) => (value, fallback) => (values.includes(value) ? value : fallback);
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
const int = (min, max) => (value, fallback) => (Number.isInteger(value) && value >= min && value <= max ? value : fallback);
const text = (max) => (value, fallback) => (typeof value === 'string' && value.length <= max && !/[\u0000-\u001f]/.test(value) ? value : fallback);
/* Free text that may span lines (tab, CR and LF are fine; other control characters are not). */
const multiline = (max) => (value, fallback) => (typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ? value : fallback);
const idList = (allowed, max) => (value, fallback) => (Array.isArray(value) && value.length <= max && value.every((item) => allowed.includes(item)) ? [...new Set(value)] : fallback);
export const CLAUDE_MD_PREMISE_IDS = ['read-first', 'match-style', 'small-diffs', 'verify', 'tests-with-code', 'ask-destructive', 'no-deps', 'no-commit', 'no-docs', 'no-secrets', 'honest', 'concise', 'language'];
const color = (value, fallback) => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback);

export function isAbsoluteDirectory(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f]/.test(value)
    && (path.win32.isAbsolute(value) || path.posix.isAbsolute(value));
}
const directory = (value, fallback) => (value === '' || isAbsoluteDirectory(value) ? value : fallback);

/* Each section lists its keys with a sanitizer and a default. */
export const SCHEMA = {
  ui: {
    lastTool: [text(48), 'compressor']
  },
  window: {
    width: [int(800, 10000), 1240],
    height: [int(600, 10000), 900],
    maximized: [bool, false]
  },
  paths: Object.fromEntries(TOOL_PATH_KEYS.map((key) => [key, [directory, '']])),
  compressor: {
    level: [enumOf('lossless', 'compact'), 'lossless']
  },
  resizer: {
    mode: [enumOf('dimensions', 'percentage', 'template'), 'dimensions'],
    lockRatio: [bool, true],
    percentage: [int(1, 500), 50],
    platform: [enumOf('instagram', 'facebook', 'x', 'tiktok', 'linkedin', 'youtube'), 'instagram'],
    presetId: [text(48), 'instagram-square']
  },
  converter: {
    format: [enumOf('jpeg', 'png', 'webp', 'avif'), 'webp'],
    quality: [int(1, 100), 88],
    lossless: [bool, false],
    background: [color, '#ffffff'],
    preserveColorProfile: [bool, true],
    keepMetadata: [bool, false]
  },
  renamer: {
    pattern: [text(180), '{nome}-{n}'],
    caseMode: [enumOf('keep', 'lower', 'upper', 'title'), 'keep'],
    caseSensitive: [bool, false],
    digits: [int(1, 6), 3]
  },
  metadata: {
    preserveColorProfile: [bool, true]
  },
  /* Prompt Gen: strategy options, plus the draft so closing the app never loses what was typed.
     The pasted "material" and the examples are deliberately NOT saved: they are often large or sensitive. */
  promptGen: {
    target: [enumOf('universal', 'claude', 'gpt', 'gemini'), 'gpt'],
    style: [enumOf('xml', 'markdown', 'plain'), 'plain'],
    promptLanguage: [enumOf('pt', 'en'), 'pt'],
    responseLanguage: [enumOf('auto', 'same', 'pt', 'en', 'es'), 'auto'],
    clarify: [enumOf('assume', 'ask', 'none'), 'assume'],
    reasoning: [bool, false],
    grounding: [bool, true],
    verify: [bool, true],
    fileBudget: [int(0, 200000), 16000]
  },
  /* CLAUDE.md generator: only options are saved. What you type about a project stays in memory (it is project-specific). */
  claudeMd: {
    language: [enumOf('pt', 'en'), 'pt'],
    detail: [enumOf('compact', 'standard', 'detailed'), 'standard'],
    includeExisting: [bool, true],
    premisesOff: [idList(CLAUDE_MD_PREMISE_IDS, 20), []]
  },
  /* QR Code generator: the visual design and the saved templates only. What the code says (Wi-Fi passwords, phone numbers…) is never stored. */
  qrGen: {
    design: [multiline(24000), ''],
    templates: [multiline(60000), '[]'],
    exportFormat: [enumOf('png', 'svg', 'pdf'), 'png'],
    exportWidth: [int(256, 8192), 2048],
    printMm: [int(0, 2000), 0]
  },
  promptDraft: {
    idea: [multiline(20000), ''],
    context: [multiline(20000), ''],
    role: [text(300), ''],
    audience: [text(300), ''],
    constraints: [multiline(5000), ''],
    criteria: [multiline(5000), ''],
    fields: [text(500), '']
  }
};

export function defaultSettings() {
  const result = { version: SETTINGS_VERSION };
  for (const [section, keys] of Object.entries(SCHEMA)) {
    result[section] = Object.fromEntries(Object.entries(keys).map(([key, [, fallback]]) => [key, fallback]));
  }
  return result;
}

/* Merge `input` over `base`, keeping only known keys with valid values. */
export function sanitizeSettings(input, base = defaultSettings()) {
  const result = structuredClone(base);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  for (const [section, keys] of Object.entries(SCHEMA)) {
    const incoming = input[section];
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) continue;
    for (const [key, [sanitize]] of Object.entries(keys)) {
      if (Object.hasOwn(incoming, key)) result[section][key] = sanitize(incoming[key], result[section][key]);
    }
  }
  return result;
}

export class SettingsStore {
  constructor({ filePath, onError = () => {}, debounceMs = 350 }) {
    this.filePath = filePath;
    this.onError = onError;
    this.debounceMs = debounceMs;
    this.data = defaultSettings();
    this.timer = null;
    this.dirty = false;
    this.writing = Promise.resolve();
  }

  /* Synchronous: called once before the window exists. A damaged file is kept aside, never deleted. */
  load() {
    let raw;
    try {
      raw = readFileSync(this.filePath, 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') this.onError(error);
      this.data = defaultSettings();
      return { firstRun: error?.code === 'ENOENT', recovered: false };
    }
    try {
      this.data = sanitizeSettings(JSON.parse(raw));
      return { firstRun: false, recovered: false };
    } catch (error) {
      this.onError(error);
      try { renameSync(this.filePath, `${this.filePath}.corrupt-${Date.now()}`); } catch { /* best effort */ }
      this.data = defaultSettings();
      return { firstRun: false, recovered: true };
    }
  }

  get() {
    return structuredClone(this.data);
  }

  /* Apply a partial update (validated) and schedule a debounced atomic write. */
  update(patch) {
    this.data = sanitizeSettings(patch, this.data);
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.save().catch((error) => this.onError(error)); }, this.debounceMs);
    this.timer.unref?.();
    return this.get();
  }

  async save() {
    clearTimeout(this.timer);
    this.dirty = false;
    const snapshot = JSON.stringify({ ...this.data, version: SETTINGS_VERSION }, null, 2);
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    // Serialise writes so two quick saves can never interleave.
    this.writing = this.writing.catch(() => {}).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await writeFile(temporaryPath, snapshot, 'utf8');
      await rename(temporaryPath, this.filePath);
    });
    return this.writing;
  }

  /* Synchronous flush for the quit path, where async work may not get to finish. */
  flushSync() {
    clearTimeout(this.timer);
    if (!this.dirty) return;
    this.dirty = false;
    const temporaryPath = `${this.filePath}.${process.pid}.sync.tmp`;
    try {
      mkdirSync(path.dirname(this.filePath), { recursive: true });
      writeFileSync(temporaryPath, JSON.stringify({ ...this.data, version: SETTINGS_VERSION }, null, 2), 'utf8');
      renameSync(temporaryPath, this.filePath);
    } catch (error) {
      try { unlinkSync(temporaryPath); } catch { /* nothing to clean */ }
      this.onError(error);
    }
  }
}
