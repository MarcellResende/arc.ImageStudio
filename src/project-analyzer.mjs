import { lstat, open, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { IGNORED_DIRECTORIES, looksLikeText } from './attachments.mjs';

/* Reads a project folder (locally, read-only) and returns FACTS about it: stack, commands, structure,
   tests, style, CI, environment variables, existing instruction files. It never returns file contents
   except short, bounded excerpts (README summary, existing CLAUDE.md), and never reads .env files or keys.
   The CLAUDE.md engine turns these facts into text. */

export const PROJECT_LIMITS = { maxScanned: 8000, maxDepth: 10, maxSourceSamples: 40, sampleBytes: 40 * 1024, maxLineCountBytes: 256 * 1024, maxExistingBytes: 60 * 1024 };

const CODE_EXTENSIONS = {
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript', py: 'Python', java: 'Java', cs: 'C#', cpp: 'C++', cc: 'C++', c: 'C', h: 'C/C++', hpp: 'C++',
  go: 'Go', rs: 'Rust', php: 'PHP', rb: 'Ruby', swift: 'Swift', kt: 'Kotlin', sql: 'SQL', sh: 'Shell', ps1: 'PowerShell', html: 'HTML', css: 'CSS', scss: 'SCSS', vue: 'Vue', svelte: 'Svelte', lua: 'Lua', dart: 'Dart'
};
const SAMPLE_LANGUAGES = new Set(['JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Kotlin', 'Swift', 'Vue', 'Svelte']);
const SECRET_NAME = /^(\.env(\..+)?|.*\.(pem|key|pfx|p12|keystore|jks|ppk)|id_(rsa|dsa|ecdsa|ed25519)|credentials(\.json)?|secrets?\.(json|ya?ml|toml)|\.npmrc|\.netrc|\.pypirc)$/i;
const ENV_TEMPLATE = /^\.env\.(example|sample|template|dist)$/i;

const DIRECTORY_ROLES = {
  src: 'source', lib: 'library code', app: 'application code', core: 'core logic', test: 'tests', tests: 'tests', __tests__: 'tests', spec: 'tests', e2e: 'end-to-end tests', docs: 'documentation', doc: 'documentation',
  scripts: 'utility scripts', tools: 'tooling', bin: 'executables', public: 'static files', static: 'static files', assets: 'assets', config: 'configuration', configs: 'configuration', migrations: 'database migrations',
  components: 'UI components', pages: 'pages/routes', routes: 'routes', api: 'API', controllers: 'controllers', models: 'data models', services: 'services', utils: 'utilities', helpers: 'helpers', types: 'type definitions',
  styles: 'styles', hooks: 'hooks', store: 'state store', middleware: 'middleware', views: 'views', templates: 'templates', fixtures: 'test fixtures', examples: 'examples', packages: 'monorepo packages', apps: 'monorepo apps',
  renderer: 'UI process (renderer)', main: 'main process', preload: 'preload bridge', vendor: 'bundled third-party', build: 'build resources', '.github': 'GitHub config and workflows', '.vscode': 'editor settings'
};

const readText = async (file, max = 256 * 1024) => {
  try {
    const handle = await open(file, 'r');
    try {
      const { size } = await handle.stat();
      const buffer = Buffer.alloc(Math.min(size, max));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const slice = buffer.subarray(0, bytesRead);
      return looksLikeText(slice) ? slice.toString('utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n') : null;
    } finally { await handle.close(); }
  } catch { return null; }
};
const readJson = async (file) => { const text = await readText(file); if (!text) return null; try { return JSON.parse(text); } catch { return null; } };
const exists = async (file) => lstat(file).then(() => true).catch(() => false);
const extensionOf = (name) => { const match = /\.([A-Za-z0-9]+)$/.exec(name); return match ? match[1].toLowerCase() : ''; };

async function walk(root, limits) {
  const files = []; const skipped = new Set();
  let scanned = 0; let limitReached = false;
  const visit = async (directory, relative, depth) => {
    if (depth > limits.maxDepth) return;
    let children;
    try { children = await readdir(directory, { withFileTypes: true }); } catch { return; }
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      if (scanned >= limits.maxScanned) { limitReached = true; return; }
      scanned += 1;
      if (child.isSymbolicLink()) continue;
      const rel = relative ? `${relative}/${child.name}` : child.name;
      if (child.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(child.name.toLowerCase()) && child.name !== '.github') { skipped.add(child.name); continue; }
        await visit(path.join(directory, child.name), rel, depth + 1);
      } else if (child.isFile()) {
        const info = await lstat(path.join(directory, child.name)).catch(() => null);
        if (info?.isFile()) files.push({ rel, name: child.name, size: info.size, ext: extensionOf(child.name) });
      }
    }
  };
  await visit(root, '', 0);
  return { files, skipped: [...skipped].sort(), limitReached };
}

function detectIndent(text) {
  let tabs = 0; const spaces = new Map();
  for (const line of text.split('\n')) {
    if (/^\t+\S/.test(line)) tabs += 1;
    const match = /^( +)\S/.exec(line);
    if (match && match[1].length % 2 === 0 && match[1].length <= 8) spaces.set(match[1].length, (spaces.get(match[1].length) || 0) + 1);
  }
  const twoMultiples = [...spaces.entries()].reduce((best, [width, count]) => (width === 2 || width === 4 || width === 8 ? [...best, [width, count]] : best), []);
  const small = Math.min(...[...spaces.keys()].filter((width) => width > 0), 99);
  return { tabs, spaces: [...spaces.values()].reduce((a, b) => a + b, 0), unit: small === 2 || small === 4 ? small : (twoMultiples.sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0) };
}

function caseOf(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/\.(test|spec|config|d)$/, '');
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(base)) return 'kebab-case';
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(base)) return 'snake_case';
  if (/^[A-Z][A-Za-z0-9]*$/.test(base) && /[a-z]/.test(base)) return 'PascalCase';
  if (/^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/.test(base)) return 'camelCase';
  return 'single-word';
}

function nodeCommands(manifest, packageManager) {
  const scripts = manifest.scripts || {};
  const run = (name) => (packageManager === 'yarn' ? `yarn ${name}` : packageManager === 'pnpm' ? `pnpm ${name}` : packageManager === 'bun' ? `bun run ${name}` : (name === 'test' || name === 'start' ? `npm ${name}` : `npm run ${name}`));
  const commands = [{ purpose: 'install', command: `${packageManager === 'npm' ? 'npm' : packageManager} install` }];
  const wanted = [['dev', ['dev', 'serve', 'watch']], ['start', ['start']], ['build', ['build']], ['test', ['test']], ['lint', ['lint']], ['format', ['format', 'prettier']], ['typecheck', ['typecheck', 'type-check', 'tsc']], ['package', ['dist', 'pack', 'package', 'release']]];
  for (const [purpose, names] of wanted) {
    const name = names.find((candidate) => scripts[candidate]);
    if (name) commands.push({ purpose, command: run(name), script: scripts[name] });
  }
  return commands;
}

export async function analyzeProject(rootInput, { limits = PROJECT_LIMITS } = {}) {
  const root = path.resolve(rootInput);
  const info = await lstat(root).catch(() => null);
  if (!info?.isDirectory() || info.isSymbolicLink()) throw new Error('Escolha uma pasta de projeto.');

  const { files, skipped, limitReached } = await walk(root, limits);
  const byName = new Map();
  for (const file of files) { const key = file.name.toLowerCase(); if (!byName.has(key)) byName.set(key, file); }
  const has = (name) => byName.has(name.toLowerCase());
  const at = (rel) => path.join(root, ...rel.split('/'));

  const facts = {
    name: path.basename(root), root, scanned: files.length, limitReached, skippedDirectories: skipped,
    ecosystems: [], languages: [], commands: [], frameworks: [], entryPoints: [], directories: [], tests: { frameworks: [], locations: [], files: 0 },
    configs: [], ci: [], envVariables: [], style: {}, existing: {}, git: {}, readme: null, license: '', docker: false, monorepo: false, secrets: { present: [], ignoredByGit: false }
  };
  const addFramework = (name) => { if (name && !facts.frameworks.includes(name)) facts.frameworks.push(name); };

  /* ── languages and lines ── */
  const stats = new Map();
  const sources = [];
  for (const file of files) {
    const language = CODE_EXTENSIONS[file.ext];
    if (!language || file.size > 4 * 1024 * 1024) continue;
    const text = await readText(at(file.rel), limits.maxLineCountBytes);
    if (text === null) continue;
    const lines = text ? text.split('\n').length * Math.max(1, file.size / Math.max(1, Buffer.byteLength(text))) : 0;
    const entry = stats.get(language) || { name: language, files: 0, lines: 0 };
    entry.files += 1; entry.lines += Math.round(lines);
    stats.set(language, entry);
    if (SAMPLE_LANGUAGES.has(language) && !/(^|\/)(test|tests|__tests__|spec)\//i.test(file.rel) && !/\.(test|spec|min)\./i.test(file.name)) sources.push({ file, text });
  }
  facts.languages = [...stats.values()].sort((a, b) => b.lines - a.lines).slice(0, 8);

  /* ── Node / JavaScript ── */
  const pkg = has('package.json') ? await readJson(at(byName.get('package.json').rel)) : null;
  if (pkg) {
    const lockfile = has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : (has('bun.lockb') || has('bun.lock')) ? 'bun' : 'npm';
    const dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const manager = /^(pnpm|yarn|bun)@/.exec(pkg.packageManager || '')?.[1] || lockfile;
    facts.ecosystems.push({ id: 'node', name: 'Node.js', packageManager: manager, type: pkg.type || 'commonjs', description: pkg.description || '', version: pkg.version || '', engines: pkg.engines || null, dependencies: dependencies.length, main: pkg.main || '', bin: typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin || {}) });
    facts.commands.push(...nodeCommands(pkg, manager));
    const known = { react: 'React', 'react-dom': 'React', vue: 'Vue', '@angular/core': 'Angular', svelte: 'Svelte', next: 'Next.js', nuxt: 'Nuxt', electron: 'Electron', express: 'Express', fastify: 'Fastify', koa: 'Koa', '@nestjs/core': 'NestJS', vite: 'Vite', webpack: 'Webpack', typescript: 'TypeScript', tailwindcss: 'Tailwind CSS', prisma: 'Prisma', sharp: 'sharp', 'electron-builder': 'electron-builder', 'discord.js': 'discord.js', 'react-native': 'React Native' };
    for (const dependency of dependencies) addFramework(known[dependency]);
    const tests = { jest: 'Jest', vitest: 'Vitest', mocha: 'Mocha', ava: 'AVA', '@playwright/test': 'Playwright', cypress: 'Cypress' };
    for (const dependency of dependencies) if (tests[dependency]) facts.tests.frameworks.push(tests[dependency]);
    if (/node(\.exe)?\s+--test\b/.test(pkg.scripts?.test || '')) facts.tests.frameworks.push('node:test');
    if (pkg.workspaces) facts.monorepo = true;
    for (const candidate of [pkg.main, ...(facts.ecosystems.at(-1).bin)]) if (candidate && await exists(at(candidate))) facts.entryPoints.push(candidate);
  }

  /* ── Python ── */
  const pyproject = has('pyproject.toml') ? await readText(at(byName.get('pyproject.toml').rel)) : null;
  const requirements = has('requirements.txt') ? await readText(at(byName.get('requirements.txt').rel)) : null;
  if (pyproject || requirements || has('setup.py') || has('pipfile')) {
    const blob = `${pyproject || ''}\n${requirements || ''}`.toLowerCase();
    facts.ecosystems.push({ id: 'python', name: 'Python', packageManager: /\[tool\.poetry\]/.test(blob) ? 'poetry' : has('pipfile') ? 'pipenv' : /\[tool\.uv\]|uv\.lock/.test(blob) || has('uv.lock') ? 'uv' : 'pip' });
    const manager = facts.ecosystems.at(-1).packageManager;
    facts.commands.push({ purpose: 'install', command: manager === 'poetry' ? 'poetry install' : manager === 'pipenv' ? 'pipenv install' : manager === 'uv' ? 'uv sync' : requirements ? 'pip install -r requirements.txt' : 'pip install -e .' });
    const pythonFrameworks = { django: 'Django', flask: 'Flask', fastapi: 'FastAPI', pandas: 'pandas', numpy: 'NumPy', torch: 'PyTorch', tensorflow: 'TensorFlow', sqlalchemy: 'SQLAlchemy' };
    for (const [key, label] of Object.entries(pythonFrameworks)) if (blob.includes(key)) addFramework(label);
    if (/pytest/.test(blob) || files.some((file) => /^test_.*\.py$|_test\.py$/.test(file.name))) { facts.tests.frameworks.push('pytest'); facts.commands.push({ purpose: 'test', command: 'pytest' }); }
    if (/\[tool\.ruff\]|ruff/.test(blob) || has('ruff.toml')) facts.commands.push({ purpose: 'lint', command: 'ruff check .' });
    if (/\[tool\.black\]|\bblack\b/.test(blob)) facts.commands.push({ purpose: 'format', command: 'black .' });
    for (const candidate of ['manage.py', 'main.py', 'app.py', 'wsgi.py', '__main__.py']) if (has(candidate)) facts.entryPoints.push(byName.get(candidate).rel);
  }

  /* ── Rust, Go, Java, PHP, Ruby, .NET, Make ── */
  if (has('cargo.toml')) {
    facts.ecosystems.push({ id: 'rust', name: 'Rust', packageManager: 'cargo' });
    facts.commands.push({ purpose: 'build', command: 'cargo build' }, { purpose: 'test', command: 'cargo test' }, { purpose: 'lint', command: 'cargo clippy' }, { purpose: 'format', command: 'cargo fmt' });
    facts.tests.frameworks.push('cargo test');
    if (await exists(at('src/main.rs'))) facts.entryPoints.push('src/main.rs');
    const cargo = await readText(at(byName.get('cargo.toml').rel));
    if (cargo && /\[workspace\]/.test(cargo)) facts.monorepo = true;
  }
  if (has('go.mod')) {
    const goMod = await readText(at(byName.get('go.mod').rel));
    facts.ecosystems.push({ id: 'go', name: 'Go', packageManager: 'go', module: /^module\s+(\S+)/m.exec(goMod || '')?.[1] || '', version: /^go\s+(\S+)/m.exec(goMod || '')?.[1] || '' });
    facts.commands.push({ purpose: 'build', command: 'go build ./...' }, { purpose: 'test', command: 'go test ./...' }, { purpose: 'lint', command: 'go vet ./...' });
    facts.tests.frameworks.push('go test');
    if (has('main.go')) facts.entryPoints.push(byName.get('main.go').rel);
  }
  if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) {
    const maven = has('pom.xml');
    facts.ecosystems.push({ id: 'jvm', name: maven ? 'Java (Maven)' : 'Java/Kotlin (Gradle)', packageManager: maven ? 'maven' : 'gradle' });
    facts.commands.push({ purpose: 'build', command: maven ? 'mvn package' : './gradlew build' }, { purpose: 'test', command: maven ? 'mvn test' : './gradlew test' });
    if (maven && /spring-boot/i.test(await readText(at(byName.get('pom.xml').rel)) || '')) addFramework('Spring Boot');
  }
  if (has('composer.json')) { facts.ecosystems.push({ id: 'php', name: 'PHP', packageManager: 'composer' }); facts.commands.push({ purpose: 'install', command: 'composer install' }); }
  if (has('gemfile')) { facts.ecosystems.push({ id: 'ruby', name: 'Ruby', packageManager: 'bundler' }); facts.commands.push({ purpose: 'install', command: 'bundle install' }); }
  if (files.some((file) => /\.(csproj|sln)$/i.test(file.name))) { facts.ecosystems.push({ id: 'dotnet', name: '.NET', packageManager: 'dotnet' }); facts.commands.push({ purpose: 'build', command: 'dotnet build' }, { purpose: 'test', command: 'dotnet test' }); }
  if (has('makefile')) {
    const make = await readText(at(byName.get('makefile').rel));
    const targets = [...(make || '').matchAll(/^([A-Za-z][A-Za-z0-9_.-]*):(?!=)/gm)].map((match) => match[1]).filter((name) => !name.startsWith('.')).slice(0, 12);
    if (targets.length) facts.ecosystems.push({ id: 'make', name: 'Make', targets });
  }
  facts.docker = has('dockerfile') || has('docker-compose.yml') || has('docker-compose.yaml');
  if (facts.docker) facts.configs.push(has('docker-compose.yml') || has('docker-compose.yaml') ? 'Docker Compose' : 'Dockerfile');

  /* ── entry points common to many stacks ── */
  for (const candidate of ['src/main.ts', 'src/main.js', 'src/main.mjs', 'src/index.ts', 'src/index.js', 'src/index.tsx', 'src/app.js', 'src/app.ts', 'index.js', 'server.js', 'app.js', 'cmd/main.go', 'Program.cs']) {
    if (await exists(at(candidate)) && !facts.entryPoints.includes(candidate)) facts.entryPoints.push(candidate);
  }
  facts.entryPoints = facts.entryPoints.slice(0, 6);
  if (facts.frameworks.includes('Electron')) {
    const parts = [];
    for (const [label, rels] of [['preload', ['src/preload.cjs', 'src/preload.js', 'preload.js', 'src/preload.ts']], ['renderer', ['src/renderer/index.html', 'renderer/index.html', 'src/index.html']]]) {
      for (const rel of rels) if (await exists(at(rel))) { parts.push({ label, path: rel }); break; }
    }
    facts.electron = parts;
  }

  /* ── structure ── */
  const topLevel = new Map();
  for (const file of files) {
    const parts = file.rel.split('/');
    if (parts.length < 2) continue;
    const entry = topLevel.get(parts[0]) || { path: parts[0], files: 0, children: new Map(), languages: new Map() };
    entry.files += 1;
    if (parts.length > 2) entry.children.set(parts[1], (entry.children.get(parts[1]) || 0) + 1);
    const language = CODE_EXTENSIONS[file.ext];
    if (language) entry.languages.set(language, (entry.languages.get(language) || 0) + 1);
    topLevel.set(parts[0], entry);
  }
  facts.directories = [...topLevel.values()].sort((a, b) => b.files - a.files).slice(0, 14).map((entry) => ({
    path: `${entry.path}/`, files: entry.files, role: DIRECTORY_ROLES[entry.path.toLowerCase()] || '',
    languages: [...entry.languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name]) => name),
    children: [...entry.children.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: `${name}/`, files: count, role: DIRECTORY_ROLES[name.toLowerCase()] || '' }))
  }));
  if (facts.directories.some((directory) => ['packages/', 'apps/'].includes(directory.path))) facts.monorepo = true;
  facts.rootFiles = files.filter((file) => !file.rel.includes('/')).map((file) => file.name).slice(0, 30);

  /* ── tests ── */
  const testFiles = files.filter((file) => /\.(test|spec)\.[a-z]+$/i.test(file.name) || /^test_.*\.py$|_test\.(py|go)$/.test(file.name) || /(^|\/)(test|tests|__tests__|spec)\//i.test(file.rel));
  facts.tests.files = testFiles.length;
  facts.tests.locations = [...new Set(testFiles.map((file) => (/(^|\/)(test|tests|__tests__|spec)\//i.test(file.rel) ? file.rel.split('/').slice(0, file.rel.split('/').findIndex((part) => /^(test|tests|__tests__|spec)$/i.test(part)) + 1).join('/') + '/' : 'ao lado do código')))].slice(0, 4);
  facts.tests.frameworks = [...new Set(facts.tests.frameworks)];

  /* ── config files, style, CI ── */
  const configNames = [['eslint', /^(\.eslintrc(\..+)?|eslint\.config\.[cm]?js|eslint\.config\.ts)$/i, 'ESLint'], ['prettier', /^(\.prettierrc(\..+)?|prettier\.config\.[cm]?js)$/i, 'Prettier'], ['editorconfig', /^\.editorconfig$/i, 'EditorConfig'], ['biome', /^biome\.jsonc?$/i, 'Biome'], ['tsconfig', /^tsconfig(\..+)?\.json$/i, 'TypeScript'], ['ruff', /^(ruff|\.ruff)\.toml$/i, 'Ruff'], ['rustfmt', /^\.?rustfmt\.toml$/i, 'rustfmt'], ['golangci', /^\.golangci\.ya?ml$/i, 'golangci-lint'], ['commitlint', /^(\.commitlintrc(\..+)?|commitlint\.config\.[cm]?js)$/i, 'commitlint'], ['husky', /^\.husky$/i, 'Husky']];
  for (const [, pattern, label] of configNames) if (files.some((file) => pattern.test(file.name) && !file.rel.includes('node_modules'))) facts.configs.push(label);
  if (files.some((file) => file.rel.startsWith('.husky/'))) facts.configs.push('Husky');
  facts.configs = [...new Set(facts.configs)];

  if (has('tsconfig.json')) {
    const tsconfig = await readText(at(byName.get('tsconfig.json').rel));
    facts.style.typescriptStrict = Boolean(tsconfig && /"strict"\s*:\s*true/.test(tsconfig));
  }
  if (has('.editorconfig')) {
    const editorconfig = await readText(at(byName.get('.editorconfig').rel));
    const style = /indent_style\s*=\s*(\w+)/.exec(editorconfig || '')?.[1]; const size = /indent_size\s*=\s*(\d+)/.exec(editorconfig || '')?.[1];
    if (style) facts.style.editorconfig = { indentStyle: style, indentSize: size ? Number(size) : null };
  }

  const picked = sources.sort((a, b) => b.file.size - a.file.size).filter((_, index) => index % Math.max(1, Math.ceil(sources.length / limits.maxSourceSamples)) === 0).slice(0, limits.maxSourceSamples);
  let tabs = 0; let spaces = 0; let crlf = 0; const units = new Map(); let single = 0; let double = 0; let semicolons = 0; let jsLines = 0; let esm = 0; let cjs = 0;
  const casing = new Map(); const envNames = new Set();
  for (const { file, text } of picked) {
    const sample = text.slice(0, limits.sampleBytes);
    const indent = detectIndent(sample);
    tabs += indent.tabs; spaces += indent.spaces;
    if (indent.unit) units.set(indent.unit, (units.get(indent.unit) || 0) + 1);
    if (/\r/.test(sample)) crlf += 1;
    const language = CODE_EXTENSIONS[file.ext];
    if (language === 'JavaScript' || language === 'TypeScript') {
      single += (sample.match(/'[^'\n]*'/g) || []).length; double += (sample.match(/"[^"\n]*"/g) || []).length;
      for (const line of sample.split('\n')) { const trimmed = line.trim(); if (!trimmed || /^(\/\/|\/\*|\*|\}|\{|\)|\]|else|if\b|for\b|while\b)/.test(trimmed)) continue; jsLines += 1; if (trimmed.endsWith(';')) semicolons += 1; }
      if (/^\s*(import|export)\s/m.test(sample)) esm += 1; if (/\brequire\(|module\.exports/.test(sample)) cjs += 1;
      for (const match of sample.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) envNames.add(match[1]);
    }
    for (const match of sample.matchAll(/os\.environ(?:\.get)?\(?\[?['"]([A-Z][A-Z0-9_]+)['"]/g)) envNames.add(match[1]);
    casing.set(caseOf(file.name), (casing.get(caseOf(file.name)) || 0) + 1);
  }
  if (picked.length) {
    const unit = [...units.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
    facts.style.indent = tabs > spaces ? 'tabs' : spaces ? `${unit || 2} spaces` : '';
    facts.style.lineEndings = crlf > picked.length / 2 ? 'CRLF' : 'LF';
    if (single + double > 10) facts.style.quotes = single >= double ? 'single' : 'double';
    if (jsLines > 30) facts.style.semicolons = semicolons / jsLines > 0.5;
    if (esm || cjs) facts.style.modules = esm >= cjs ? 'ESM (import/export)' : 'CommonJS (require)';
    const topCase = [...casing.entries()].filter(([name]) => name !== 'single-word').sort((a, b) => b[1] - a[1])[0];
    if (topCase && topCase[1] >= 3) facts.style.fileNaming = topCase[0];
    facts.style.sampled = picked.length;
  }

  for (const file of files.filter((candidate) => ENV_TEMPLATE.test(candidate.name)).slice(0, 3)) {
    const text = await readText(at(file.rel), 32 * 1024);
    for (const line of (text || '').split('\n')) { const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]+)\s*=/.exec(line); if (match) envNames.add(match[1]); }
  }
  facts.envVariables = [...envNames].sort().slice(0, 30);

  const workflows = files.filter((file) => /^\.github\/workflows\/.+\.ya?ml$/i.test(file.rel));
  for (const file of workflows.slice(0, 6)) {
    const text = await readText(at(file.rel), 32 * 1024);
    const name = /^name:\s*(.+)$/m.exec(text || '')?.[1]?.trim().replace(/^["']|["']$/g, '');
    facts.ci.push({ file: file.rel, name: name || file.name, onTag: /tags:/.test(text || ''), onPush: /\bpush:/.test(text || ''), onPullRequest: /pull_request/.test(text || '') });
  }
  for (const [name, label] of [['.gitlab-ci.yml', 'GitLab CI'], ['azure-pipelines.yml', 'Azure Pipelines'], ['jenkinsfile', 'Jenkins'], ['.travis.yml', 'Travis CI'], ['.circleci/config.yml', 'CircleCI']]) {
    if (files.some((file) => file.rel.toLowerCase() === name)) facts.ci.push({ file: name, name: label });
  }

  /* ── README, license, existing instruction files ── */
  const readmeFile = files.find((file) => /^readme(\.(md|markdown|txt))?$/i.test(file.name) && !file.rel.includes('/'));
  if (readmeFile) {
    const text = (await readText(at(readmeFile.rel), 24 * 1024)) || '';
    const lines = text.split('\n');
    const title = lines.find((line) => /^#\s+\S/.test(line))?.replace(/^#\s+/, '').trim() || '';
    const paragraph = lines.map((line) => line.trim()).filter((line) => line && !/^(#|!\[|\[!\[|<|>|```|[-*]\s|\||=+$|-+$)/.test(line) && !/^\[.*\]\(.*\)$/.test(line))[0] || '';
    facts.readme = { file: readmeFile.rel, title, summary: paragraph.slice(0, 400) };
  }
  const licenseFile = files.find((file) => /^licen[sc]e(\.(md|txt))?$/i.test(file.name) && !file.rel.includes('/'));
  if (licenseFile) {
    const text = ((await readText(at(licenseFile.rel), 4096)) || '').toLowerCase();
    facts.license = /mit license|permission is hereby granted, free of charge/.test(text) ? 'MIT' : /apache license/.test(text) ? 'Apache-2.0' : /gnu general public license/.test(text) ? 'GPL' : /bsd/.test(text) ? 'BSD' : /isc license/.test(text) ? 'ISC' : 'ver arquivo LICENSE';
  }
  for (const [key, rel] of [['claude', 'CLAUDE.md'], ['agents', 'AGENTS.md'], ['cursorrules', '.cursorrules'], ['copilot', '.github/copilot-instructions.md']]) {
    const file = files.find((candidate) => candidate.rel === rel);
    if (file) facts.existing[key] = ((await readText(at(rel), limits.maxExistingBytes)) || '').trim();
  }

  /* ── secrets and git ── */
  facts.secrets.present = files.filter((file) => SECRET_NAME.test(file.name) && !ENV_TEMPLATE.test(file.name)).map((file) => file.rel).slice(0, 8);
  const gitignore = await readText(at('.gitignore'), 32 * 1024);
  facts.secrets.ignoredByGit = Boolean(gitignore && /^\/?\.env/m.test(gitignore));
  facts.hasGitignore = gitignore !== null;
  const head = await readText(at('.git/HEAD'), 512);
  if (head !== null) {
    facts.git.isRepo = true;
    facts.git.branch = /ref:\s*refs\/heads\/(\S+)/.exec(head)?.[1] || '';
    const config = await readText(at('.git/config'), 16 * 1024);
    const url = /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/s.exec(config || '')?.[1] || '';
    facts.git.remote = url.replace(/\/\/[^@/]+@/, '//'); // never keep credentials embedded in a URL
  }
  if (facts.configs.includes('commitlint')) facts.git.conventionalCommits = true;
  if (has('contributing.md')) facts.git.contributing = true;

  return facts;
}
