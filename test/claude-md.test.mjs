import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { analyzeProject } from '../src/project-analyzer.mjs';

const engineFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/renderer/claude-md-engine.js');
const sandbox = {}; sandbox.globalThis = sandbox;
vm.runInNewContext(await readFile(engineFile, 'utf8'), sandbox);
const engine = sandbox.ArcClaudeMd;
const plain = (value) => JSON.parse(JSON.stringify(value));
const generate = (facts, input) => plain(engine.generate(facts, input));

async function nodeProject() {
  const root = await mkdtemp(path.join(tmpdir(), 'arc-claude-'));
  const project = path.join(root, 'meu-app');
  await mkdir(path.join(project, 'src', 'components'), { recursive: true });
  await mkdir(path.join(project, 'tests'), { recursive: true });
  await mkdir(path.join(project, '.github', 'workflows'), { recursive: true });
  await mkdir(path.join(project, 'node_modules', 'x'), { recursive: true });
  await mkdir(path.join(project, '.git'), { recursive: true });
  await writeFile(path.join(project, 'package.json'), JSON.stringify({
    name: 'meu-app', version: '1.2.0', description: 'Painel de vendas para lojistas', type: 'module', main: 'src/index.js',
    scripts: { dev: 'vite', build: 'vite build', test: 'vitest run', lint: 'eslint .', typecheck: 'tsc --noEmit' },
    dependencies: { react: '^18', 'react-dom': '^18' }, devDependencies: { vite: '^5', vitest: '^1', typescript: '^5', eslint: '^9' }
  }));
  await writeFile(path.join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
  await writeFile(path.join(project, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }');
  await writeFile(path.join(project, 'eslint.config.js'), 'export default [];');
  await writeFile(path.join(project, '.prettierrc'), '{}');
  await writeFile(path.join(project, 'README.md'), '# Painel de Vendas\n\n[![ci](x)](y)\n\nAcompanhe vendas em tempo real.\n\n## Uso\n');
  await writeFile(path.join(project, 'LICENSE'), 'MIT License\n\nPermission is hereby granted, free of charge');
  const component = (name) => `import React from 'react';\n\nexport function ${name}() {\n  const label = 'oi'; const a = 'x'; const b = 'y';\n  return <div>{label}</div>;\n}\n`;
  for (const name of ['botao-principal', 'cartao-venda', 'grafico-linha', 'menu-lateral']) await writeFile(path.join(project, 'src', 'components', `${name}.tsx`), component('Item'));
  await writeFile(path.join(project, 'src', 'index.js'), `import { app } from './app.js';\nconst key = process.env.API_URL;\nconst other = process.env.SESSION_SECRET;\napp(key, other);\n`);
  await writeFile(path.join(project, 'tests', 'app.test.js'), "import { test } from 'vitest';\n");
  await writeFile(path.join(project, '.github', 'workflows', 'ci.yml'), 'name: CI\non:\n  push:\n  pull_request:\njobs: {}\n');
  await writeFile(path.join(project, '.env'), 'SESSION_SECRET=valor-super-secreto-123');
  await writeFile(path.join(project, '.env.example'), 'API_URL=\nSTRIPE_KEY=\n');
  await writeFile(path.join(project, '.gitignore'), 'node_modules\ndist\n');
  await writeFile(path.join(project, 'node_modules', 'x', 'index.js'), 'module.exports = 1;');
  await writeFile(path.join(project, '.git', 'HEAD'), 'ref: refs/heads/develop\n');
  await writeFile(path.join(project, '.git', 'config'), '[remote "origin"]\n\turl = https://usuario:token-secreto@github.com/acme/meu-app.git\n');
  await writeFile(path.join(project, 'CLAUDE.md'), '# Notas antigas\n\n## Regra\n\nNão mexa em src/legado.\n');
  return { root, project, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('analyses a Node/React project: stack, commands (pnpm), tests, style, CI, env names, git', async () => {
  const box = await nodeProject();
  try {
    const facts = plain(await analyzeProject(box.project));
    assert.equal(facts.ecosystems[0].packageManager, 'pnpm');
    assert.deepEqual(facts.frameworks.filter((name) => ['React', 'Vite', 'TypeScript'].includes(name)).sort(), ['React', 'TypeScript', 'Vite']);
    const commands = Object.fromEntries(facts.commands.map((entry) => [entry.purpose, entry.command]));
    assert.equal(commands.install, 'pnpm install');
    assert.equal(commands.dev, 'pnpm dev');
    assert.equal(commands.test, 'pnpm test');
    assert.equal(commands.typecheck, 'pnpm typecheck');
    assert.deepEqual(facts.tests.frameworks, ['Vitest']);
    assert.equal(facts.tests.files, 1);
    assert.equal(facts.style.typescriptStrict, true);
    assert.equal(facts.style.indent, '2 spaces');
    assert.equal(facts.style.quotes, 'single');
    assert.equal(facts.style.fileNaming, 'kebab-case');
    assert.ok(facts.configs.includes('ESLint') && facts.configs.includes('Prettier'));
    assert.deepEqual(facts.envVariables, ['API_URL', 'SESSION_SECRET', 'STRIPE_KEY']);
    assert.equal(facts.ci[0].name, 'CI');
    assert.equal(facts.ci[0].onPullRequest, true);
    assert.equal(facts.git.branch, 'develop');
    assert.equal(facts.git.remote, 'https://github.com/acme/meu-app.git', 'credenciais na URL do remoto são removidas');
    assert.equal(facts.license, 'MIT');
    assert.equal(facts.readme.title, 'Painel de Vendas');
    assert.equal(facts.readme.summary, 'Acompanhe vendas em tempo real.');
    assert.ok(facts.skippedDirectories.includes('node_modules'));
    assert.match(facts.existing.claude, /Não mexa em src\/legado/);
  } finally { await box.cleanup(); }
});

test('secrets are never read: .env content does not appear anywhere in the facts', async () => {
  const box = await nodeProject();
  try {
    const facts = await analyzeProject(box.project);
    const dump = JSON.stringify(facts);
    assert.ok(!dump.includes('valor-super-secreto-123'));
    assert.ok(!dump.includes('token-secreto'));
    assert.deepEqual(facts.secrets.present, ['.env']);
    assert.equal(facts.secrets.ignoredByGit, false);
  } finally { await box.cleanup(); }
});

test('detects a Python project and handles an empty folder', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'arc-claude-py-'));
  try {
    await writeFile(path.join(root, 'requirements.txt'), 'flask==3.0\npytest\n');
    await writeFile(path.join(root, 'app.py'), 'import os\nprint(os.environ.get("DATABASE_URL"))\n');
    await writeFile(path.join(root, 'test_app.py'), 'def test_x():\n    pass\n');
    const facts = plain(await analyzeProject(root));
    assert.equal(facts.ecosystems[0].name, 'Python');
    assert.ok(facts.frameworks.includes('Flask'));
    assert.ok(facts.commands.some((entry) => entry.command === 'pytest'));
    assert.ok(facts.entryPoints.includes('app.py'));
    assert.deepEqual(facts.envVariables, ['DATABASE_URL']);

    const empty = await mkdtemp(path.join(tmpdir(), 'arc-claude-empty-'));
    try {
      const nothing = plain(await analyzeProject(empty));
      assert.deepEqual(nothing.ecosystems, []);
      assert.equal(generate(nothing, {}).sections.some((section) => section.id === 'collab'), true);
    } finally { await rm(empty, { recursive: true, force: true }); }
    await assert.rejects(analyzeProject(path.join(root, 'app.py')), /pasta de projeto/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('with no information at all, default premises still produce a useful CLAUDE.md', () => {
  const result = generate(null, {});
  assert.match(result.markdown, /^# Projeto\n/);
  assert.match(result.markdown, /Descreva aqui/);
  assert.match(result.markdown, /## Como trabalhar neste projeto/);
  assert.match(result.markdown, /Não faça commit, push nem publique sem pedido explícito/);
  assert.match(result.markdown, /Pergunte antes de ações destrutivas/);
  assert.equal(result.premises.length, 13);
  assert.ok(result.premises.every((premise) => premise.on));
  assert.equal(result.sections.find((section) => section.id === 'collab').source, 'default');
});

test('builds the document from a real project and marks each section with its origin', async () => {
  const box = await nodeProject();
  try {
    const facts = plain(await analyzeProject(box.project));
    const result = generate(facts, {});
    for (const heading of ['## Visão geral', '## Comandos', '## Estrutura do projeto', '## Convenções de código', '## Testes', '## Fluxo de trabalho', '## Variáveis de ambiente', '## Segurança']) {
      assert.ok(result.markdown.includes(heading), heading);
    }
    assert.match(result.markdown, /Painel de vendas para lojistas/);
    assert.match(result.markdown, /pnpm install\s+# instalar dependências/);
    assert.match(result.markdown, /Indentação: 2 espaços\./);
    assert.match(result.markdown, /TypeScript em modo `strict`/);
    assert.match(result.markdown, /\.env`\): nunca leia/);
    assert.match(result.markdown, /`\.gitignore` não cobre `\.env`/);
    assert.match(result.markdown, /Notas antigas|Não mexa em src\/legado/, 'o CLAUDE.md existente é preservado');
    assert.match(result.markdown, /#### Regra|### Notas antigas/, 'títulos do arquivo antigo são rebaixados');
    assert.equal(result.sections.find((section) => section.id === 'commands').source, 'detected');
    assert.ok(!result.markdown.includes('valor-super-secreto'));
    assert.ok(result.existing.claude);
    assert.ok(result.analysis.alerts.some((alert) => /preservado/.test(alert.text)));
    const without = generate(facts, { includeExisting: false });
    assert.ok(!without.markdown.includes('Não mexa em src/legado'));
    assert.ok(without.analysis.alerts.some((alert) => alert.level === 'warn' && /substituirá/.test(alert.text)));
  } finally { await box.cleanup(); }
});

test('what the user informs always wins and is marked as user content', async () => {
  const box = await nodeProject();
  try {
    const facts = plain(await analyzeProject(box.project));
    const result = generate(facts, {
      name: 'Vendas Pro', purpose: 'Dashboard interno do time comercial.', audience: 'time comercial',
      commands: 'subir ambiente: docker compose up\nnpm run seed', rules: 'Componentes sempre em PascalCase\nUse hooks, nunca classes',
      prohibitions: 'Alterar migrações\nAtualizar dependências sozinho', gotchas: 'O build falha sem a variável API_URL', architecture: 'Dados vêm da API REST em /v1.',
      workPreferences: 'Explique decisões de design em 2 frases', workflow: 'Branches no formato feat/nome'
    });
    assert.match(result.markdown, /^# Vendas Pro\n/);
    assert.match(result.markdown, /Dashboard interno do time comercial\./);
    assert.doesNotMatch(result.markdown, /Painel de vendas para lojistas/);
    assert.match(result.markdown, /docker compose up\s+# subir ambiente/);
    assert.match(result.markdown, /^npm run seed$/m);
    assert.match(result.markdown, /- Componentes sempre em PascalCase/);
    assert.match(result.markdown, /\*\*Nunca:\*\*\n- Alterar migrações\n- Atualizar dependências sozinho/);
    assert.match(result.markdown, /\*\*Sempre:\*\*\n- Explique decisões de design em 2 frases/);
    assert.match(result.markdown, /O build falha sem a variável API_URL/);
    assert.match(result.markdown, /Dados vêm da API REST/);
    assert.match(result.markdown, /Branches no formato feat\/nome/);
    const overview = result.sections.find((section) => section.id === 'overview');
    assert.equal(overview.source, 'user');
    assert.equal(result.sections.find((section) => section.id === 'gotchas').source, 'user');
    assert.ok(result.analysis.score > generate(facts, {}).analysis.score + 15);
  } finally { await box.cleanup(); }
});

test('premises can be switched off one by one', () => {
  const result = generate(null, { premisesOff: ['no-commit', 'no-docs', 'concise'] });
  assert.doesNotMatch(result.markdown, /Não faça commit/);
  assert.doesNotMatch(result.markdown, /documentação/);
  assert.doesNotMatch(result.markdown, /Respostas objetivas/);
  assert.match(result.markdown, /Leia o código relacionado/);
  assert.equal(result.premises.filter((premise) => !premise.on).length, 3);
  const none = generate(null, { premisesOff: engine.PREMISES.map((premise) => premise.id) });
  assert.doesNotMatch(none.markdown, /Como trabalhar neste projeto/);
});

test('detail levels change the size, and English output is fully translated', async () => {
  const box = await nodeProject();
  try {
    const facts = plain(await analyzeProject(box.project));
    const compact = generate(facts, { detail: 'compact' });
    const standard = generate(facts, { detail: 'standard' });
    const detailed = generate(facts, { detail: 'detailed' });
    assert.ok(compact.stats.lines < standard.stats.lines && standard.stats.lines <= detailed.stats.lines);
    assert.ok(!compact.markdown.includes('## Variáveis de ambiente'));
    assert.ok(!compact.markdown.includes('## Fluxo de trabalho'));
    const english = generate(facts, { language: 'en', purpose: 'Internal sales dashboard.' });
    assert.match(english.markdown, /## Overview/);
    assert.match(english.markdown, /## How to work in this project/);
    assert.match(english.markdown, /Indentation: 2 spaces\./);
    assert.match(english.markdown, /Do not commit, push or publish without an explicit request\./);
    assert.doesNotMatch(english.markdown, /Visão geral|Comandos|Como trabalhar/);
  } finally { await box.cleanup(); }
});

test('warns when the document gets long, and asks the questions that matter', () => {
  const long = generate(null, { gotchas: Array.from({ length: 220 }, (_, i) => `Cuidado número ${i + 1}`).join('\n') });
  assert.ok(long.analysis.alerts.some((alert) => alert.level === 'warn' && /linhas/.test(alert.text)));
  const bare = generate(null, {});
  assert.ok(bare.analysis.questions.some((question) => question.field === 'purpose'));
  assert.ok(bare.analysis.questions.some((question) => question.field === 'prohibitions'));
  assert.ok(bare.analysis.score < 50);
});

test('command lines: "label: command" and bare commands are both understood', () => {
  const parsed = plain(engine.parseCommandLines('rodar testes: npm test\nnpm run build\nsubir: docker compose up\nnpm run x: y'));
  assert.deepEqual(parsed[0], { purpose: 'rodar testes', command: 'npm test' });
  assert.deepEqual(parsed[1], { purpose: '', command: 'npm run build' });
  assert.deepEqual(parsed[2], { purpose: 'subir', command: 'docker compose up' });
  assert.deepEqual(parsed[3], { purpose: '', command: 'npm run x: y' }, 'um comando com dois-pontos não é confundido com rótulo');
});

test('the settings schema knows exactly the premises the engine offers', async () => {
  const { CLAUDE_MD_PREMISE_IDS } = await import('../src/settings.mjs');
  assert.deepEqual([...CLAUDE_MD_PREMISE_IDS].sort(), plain(engine.PREMISES).map((premise) => premise.id).sort());
});

test('the view is wired: ids used by app.js exist in index.html', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const html = await readFile(path.join(root, 'src/renderer/index.html'), 'utf8');
  const app = await readFile(path.join(root, 'src/renderer/app.js'), 'utf8');
  const block = app.slice(app.indexOf('const cm = {'), app.indexOf('const CM_TEXT_FIELDS'));
  const ids = [...block.matchAll(/\$\('#(cm-[a-z-]+)'\)/g)].map((match) => match[1]);
  assert.ok(ids.length > 30);
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `${id}: elemento ausente no HTML`);
  assert.ok(html.indexOf('claude-md-engine.js') < html.indexOf('app.js'), 'o motor precisa carregar antes do app.js');
});
