import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

async function loadCatalog() {
  const sandbox = { globalThis: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(await read('src/renderer/catalog.js'), sandbox);
  return JSON.parse(JSON.stringify(sandbox.ARC_CATALOG)); // leave the vm realm so deepEqual compares plain values
}

test('the catalog follows the requested structure', async () => {
  const catalog = await loadCatalog();
  const summary = Object.fromEntries(catalog.map((category) => [category.label, category.tools.map((tool) => tool.label)]));
  assert.deepEqual(summary, {
    Imagem: ['Compressor', 'Resizer', 'Conversor', 'Renomeador', 'Metadados', 'Receber', 'Enviar'],
    IA: ['Prompt Gen', 'CLAUDE.md'],
    PDF: ['Compressor', 'Conversor', 'Mesclar', 'Dividir'],
    Vídeo: ['Compressor', 'Conversor', 'Extrair Áudio'],
    Áudio: ['Conversor', 'Compressor', 'Editor de Metadados'],
    Utilitários: ['Gerador de QR Code', 'Hash de Arquivos', 'Conversor de Unidades']
  });
});

test('only the existing image tools are ready; every other tool is announced as "soon"', async () => {
  const catalog = await loadCatalog();
  for (const category of catalog) {
    for (const tool of category.tools) {
      assert.ok(['ready', 'soon'].includes(tool.status), `${tool.id}: status inválido`);
      const expectedReady = category.id === 'image' || tool.id === 'prompt-gen';
      assert.equal(tool.status === 'ready', expectedReady, `${tool.id}: só as ferramentas de Imagem e o Prompt Gen estão prontos`);
    }
  }
});

test('tool ids are unique and each ready tool has exactly one view; soon tools have none', async () => {
  const catalog = await loadCatalog();
  const html = await read('src/renderer/index.html');
  const ids = catalog.flatMap((category) => category.tools.map((tool) => tool.id));
  assert.equal(new Set(ids).size, ids.length, 'ids duplicados no catálogo');
  for (const category of catalog) {
    for (const tool of category.tools) {
      const views = (html.match(new RegExp(`<section id="${tool.id}-view"`, 'g')) || []).length;
      assert.equal(views, tool.status === 'ready' ? 1 : 0, `${tool.id}: número de telas inesperado`);
    }
  }
  const declaredViews = [...html.matchAll(/<section id="([a-z-]+)-view"/g)].map((match) => match[1]);
  const readyIds = catalog.flatMap((category) => category.tools.filter((tool) => tool.status === 'ready').map((tool) => tool.id));
  assert.deepEqual(declaredViews.sort(), readyIds.sort(), 'toda tela existente precisa estar no catálogo');
});

test('every icon used by the catalog exists in the sprite', async () => {
  const catalog = await loadCatalog();
  const html = await read('src/renderer/index.html');
  const icons = new Set(catalog.flatMap((category) => [category.icon, ...category.tools.map((tool) => tool.icon)]));
  for (const icon of ['chevron', 'check', 'x']) icons.add(icon);
  for (const icon of icons) assert.ok(html.includes(`<symbol id="i-${icon}"`), `ícone ausente: i-${icon}`);
});

test('soon tools never carry a description that pretends they work', async () => {
  const catalog = await loadCatalog();
  for (const tool of catalog.flatMap((category) => category.tools).filter((candidate) => candidate.status === 'soon')) {
    assert.equal(tool.description, undefined, `${tool.id}: ferramenta futura não deve ter tela nem descrição de uso`);
  }
});

test('rebranding: identity is arc.Studio and the old logo is gone', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.name, 'arc-studio');
  assert.equal(pkg.build.productName, 'arc.Studio');
  assert.equal(pkg.build.nsis.shortcutName, 'arc.Studio');
  assert.match(pkg.build.artifactName, /^arc\.Studio-Setup-/);
  assert.equal(pkg.build.appId, 'com.arc.imagestudio', 'o appId deve continuar o mesmo para as atualizações substituírem a instalação existente');
  assert.equal(existsSync(path.join(root, 'src/renderer/assets/logos/logo-image-studio.png')), false);
  assert.equal(existsSync(path.join(root, 'src/renderer/assets/logos/logo.png')), true);

  const visibleFiles = ['src/renderer/index.html', 'src/renderer/app.js', 'src/renderer/nav.js', 'src/receiver/mobile.html', 'src/receiver/mobile.js', 'src/sender/mobile.html', '.github/workflows/release.yml', 'README.md'];
  for (const file of visibleFiles) {
    const content = await read(file);
    assert.doesNotMatch(content, /logo-image-studio/, `${file}: referência ao logo removido`);
    assert.doesNotMatch(content, /ARC Image Studio|Image Studio/, `${file}: nome antigo ainda visível`);
  }
});

test('no source file keeps an inline style attribute (the CSP forbids them)', async () => {
  for (const file of ['src/renderer/index.html', 'src/renderer/nav.js', 'src/receiver/mobile.html', 'src/sender/mobile.html']) {
    assert.doesNotMatch(await read(file), /\sstyle="/, `${file}: style inline é bloqueado pela CSP`);
  }
  const app = await read('src/renderer/app.js');
  assert.doesNotMatch(app, /<[a-z]+[^>]*\sstyle="/, 'app.js: markup com style inline é bloqueado pela CSP');
  const styles = await readdir(path.join(root, 'src/renderer/styles'));
  assert.ok(styles.includes('tokens.css'));
});
