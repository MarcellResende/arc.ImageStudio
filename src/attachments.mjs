import { randomUUID } from 'node:crypto';
import { lstat, open, readdir } from 'node:fs/promises';
import path from 'node:path';

/* Reads the files and folders the user picked or dropped into Prompt Gen.
   Only paths the user chose are touched. Everything stays on this computer.
   Safety rules: symlinks are never followed; dependency/build folders, generated files and
   files that usually hold secrets (.env, keys) are not read; binaries are only listed. */

export const LIMITS = {
  maxFiles: 400,            // entries kept
  maxScanned: 6000,         // directory entries visited
  maxDepth: 12,
  maxReadBytes: 400 * 1024, // per file; larger files are read up to this point and flagged as truncated
  maxTotalBytes: 12 * 1024 * 1024
};

export const IGNORED_DIRECTORIES = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', 'release', '.next', '.nuxt', '.cache', '__pycache__', '.venv', 'venv',
  'target', 'bin', 'obj', '.idea', 'coverage', '.gradle', 'pods', 'vendor', '.pytest_cache', '.mypy_cache', '.terraform', '.parcel-cache', '.turbo'
]);

const TEXT_EXTENSIONS = new Set([
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'java', 'cs', 'cpp', 'cc', 'c', 'h', 'hpp', 'go', 'rs', 'php', 'rb', 'swift', 'kt', 'kts', 'sql', 'sh', 'bash', 'ps1', 'bat', 'cmd',
  'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'lua', 'dart', 'r', 'scala', 'pl', 'json', 'yml', 'yaml', 'toml', 'xml', 'svg', 'md', 'mdx', 'txt', 'rst', 'csv', 'tsv',
  'ini', 'cfg', 'conf', 'log', 'gradle', 'tf', 'proto', 'graphql', 'gitignore', 'editorconfig', 'env.example'
]);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'tif', 'tiff', 'bmp', 'ico']);
const BINARY_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib', 'zip', 'rar', '7z', 'gz', 'tar', 'tgz', 'bz2', 'xz', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
  'mp3', 'mp4', 'mov', 'avi', 'wav', 'flac', 'ogg', 'mkv', 'webm', 'm4a', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'icns', 'psd', 'ai', 'class', 'jar', 'bin', 'dat', 'db', 'sqlite', 'pyc', 'o', 'obj', 'iso', 'dmg', 'msi'
]);
const GENERATED_FILE = /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json|composer\.lock|cargo\.lock|poetry\.lock|pipfile\.lock|gemfile\.lock|.*\.min\.(js|css)|.*\.map|.*\.bundle\.js)$/i;
const SECRET_FILE = /^(\.env(\..+)?|.*\.(pem|key|pfx|p12|keystore|jks|ppk|kdbx)|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|credentials(\.json)?|secrets?\.(json|ya?ml|toml)|\.npmrc|\.netrc|\.pypirc)$/i;
const SECRET_FILE_SAFE_SUFFIX = /\.(example|sample|template|dist)$/i;
const KNOWN_TEXT_NAMES = new Set(['dockerfile', 'makefile', 'license', 'readme', 'procfile', 'gemfile', 'rakefile', '.gitignore', '.editorconfig', '.gitattributes', '.dockerignore']);

const extensionOf = (name) => { const match = /\.([A-Za-z0-9]+)$/.exec(name); return match ? match[1].toLowerCase() : ''; };

export function classifyByName(name) {
  const lower = name.toLowerCase();
  if (SECRET_FILE.test(lower)) return SECRET_FILE_SAFE_SUFFIX.test(lower) ? { kind: 'text' } : { kind: 'secret', reason: 'costuma guardar segredos' };
  if (GENERATED_FILE.test(lower)) return { kind: 'ignored', reason: 'arquivo gerado' };
  const extension = extensionOf(lower);
  if (IMAGE_EXTENSIONS.has(extension)) return { kind: 'image' };
  if (BINARY_EXTENSIONS.has(extension)) return { kind: 'binary', reason: 'formato binário' };
  if (TEXT_EXTENSIONS.has(extension) || KNOWN_TEXT_NAMES.has(lower) || KNOWN_TEXT_NAMES.has(lower.split('.')[0])) return { kind: 'text' };
  return { kind: 'unknown' };
}

/* Looks like text if the first bytes hold no NUL and (almost) no invalid UTF-8. */
export function looksLikeText(buffer) {
  if (!buffer.length) return true;
  if (buffer.includes(0)) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8');
  const replacements = (sample.match(/�/g) || []).length;
  return replacements <= Math.max(1, sample.length * 0.01);
}

async function imageDimensions(filePath) {
  try {
    const { default: sharp } = await import('sharp');
    const { width, height } = await sharp(filePath, { failOn: 'none' }).metadata();
    return { width, height };
  } catch {
    return {};
  }
}

async function readEntry(filePath, size, relativePath, budget) {
  const name = path.basename(filePath);
  const base = { id: randomUUID(), path: filePath, relativePath, name, size };
  const byName = classifyByName(name);
  if (byName.kind === 'secret' || byName.kind === 'ignored' || byName.kind === 'binary') return { ...base, ...byName };
  if (byName.kind === 'image') return { ...base, kind: 'image', ...(await imageDimensions(filePath)) };

  if (budget.remaining <= 0) return { ...base, kind: 'ignored', reason: 'limite total de leitura atingido' };
  const handle = await open(filePath, 'r');
  try {
    const wanted = Math.min(size, LIMITS.maxReadBytes, budget.remaining);
    const buffer = Buffer.alloc(wanted);
    const { bytesRead } = await handle.read(buffer, 0, wanted, 0);
    const slice = buffer.subarray(0, bytesRead);
    if (!looksLikeText(slice)) return { ...base, kind: 'binary', reason: 'conteúdo binário' };
    budget.remaining -= bytesRead;
    let content = slice.toString('utf8').replace(/^﻿/, '');
    const truncated = bytesRead < size;
    if (truncated) content = content.replace(/�$/, ''); // a multi-byte character cut in half
    content = content.replace(/\r\n?/g, '\n');
    return { ...base, kind: 'text', content, truncated, lines: content ? content.split('\n').length : 0 };
  } finally {
    await handle.close();
  }
}

/* paths: files and/or folders chosen by the user. Returns the entries (sorted) and what was skipped. */
export async function collectAttachments(paths, { limits = LIMITS } = {}) {
  const entries = [];
  const skippedDirectories = new Set();
  const budget = { remaining: limits.maxTotalBytes };
  const state = { scanned: 0, limitReached: false };
  const seen = new Set();

  const add = async (filePath, size, relativePath) => {
    const key = path.resolve(filePath).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (entries.length >= limits.maxFiles) { state.limitReached = true; return; }
    try { entries.push(await readEntry(filePath, size, relativePath, budget)); } catch { /* unreadable file: skip silently */ }
  };

  const walk = async (directory, relativeRoot, depth) => {
    if (depth > limits.maxDepth) return;
    let children;
    try { children = await readdir(directory, { withFileTypes: true }); } catch { return; }
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      if (state.scanned >= limits.maxScanned || entries.length >= limits.maxFiles) { state.limitReached = true; return; }
      state.scanned += 1;
      if (child.isSymbolicLink()) continue;
      const full = path.join(directory, child.name);
      const relative = `${relativeRoot}/${child.name}`;
      if (child.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(child.name.toLowerCase())) { skippedDirectories.add(child.name); continue; }
        await walk(full, relative, depth + 1);
      } else if (child.isFile()) {
        const info = await lstat(full).catch(() => null);
        if (info?.isFile()) await add(full, info.size, relative);
      }
    }
  };

  for (const candidate of Array.isArray(paths) ? paths.slice(0, 200) : []) {
    if (typeof candidate !== 'string' || !candidate) continue;
    const info = await lstat(candidate).catch(() => null);
    if (!info || info.isSymbolicLink()) continue;
    if (info.isDirectory()) await walk(candidate, path.basename(candidate), 0);
    else if (info.isFile()) await add(candidate, info.size, path.basename(candidate));
  }

  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return { entries, skippedDirectories: [...skippedDirectories].sort(), limitReached: state.limitReached, scanned: state.scanned };
}
