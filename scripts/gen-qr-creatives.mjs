/* Generates docs/QR-CREATIVOS.md from the art catalogue (src/renderer/qr-templates.js), so the brief for the image generator
   never drifts from what the app actually looks for.   Run: node scripts/gen-qr-creatives.mjs */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = {};
sandbox.globalThis = sandbox;
for (const file of ['qr-render.js', 'qr-templates.js']) vm.runInNewContext(readFileSync(path.join(root, 'src/renderer', file), 'utf8'), sandbox);
const { ART, TEMPLATES } = JSON.parse(JSON.stringify(sandbox.ArcQrTemplates));
const { LAYOUTS } = JSON.parse(JSON.stringify({ LAYOUTS: sandbox.ArcQrRender.LAYOUTS }));

/* id → what to ask for. The prompts are written to be pasted as they are. */
const BRIEF = {
  'bg-aurora': ['Aurora suave', 'Fundo abstrato de aurora boreal: faixas de luz fluidas e translúcidas em verde-água, violeta e azul sobre um céu azul-noite profundo, com grão fino de filme. Sem figuras, sem horizonte. A região central deve ser mais calma e de menor contraste.'],
  'bg-neon-grid': ['Grade neon (synthwave)', 'Cenário retrô anos 80 estilo synthwave: grade em perspectiva rosa-neon e ciano descendo até um horizonte, sol em degradê laranja-rosa semi-escondido atrás do horizonte, estrelas discretas no céu roxo-escuro. Sem texto, sem carros, sem palmeiras. Centro da imagem com menos detalhes.'],
  'bg-ocean': ['Oceano', 'Fundo submarino: raios de luz atravessando água azul-turquesa, pequenas bolhas flutuando, degradê de azul-claro no topo para azul-profundo na base. Sem peixes grandes, sem texto. Centro suave.'],
  'bg-forest': ['Floresta com neblina', 'Ilustração plana de floresta em camadas: silhuetas de pinheiros em verdes profundos com neblina entre as camadas e luz dourada suave vinda do topo. Sem animais, sem pessoas, sem texto. Parte central mais clara e calma.'],
  'bg-paper': ['Papel kraft', 'Textura fotográfica de papel kraft / papelão reciclado, fibras visíveis, tom bege-quente, iluminação perfeitamente uniforme, sem dobras fortes, sem objetos, sem manchas escuras.'],
  'bg-marble': ['Mármore', 'Textura de mármore branco com veios finos cinza-claro e dourado, elegante e luminosa, iluminação uniforme, sem objetos, sem reflexos fortes.'],
  'bg-sunset': ['Pôr do sol ilustrado', 'Ilustração plana (flat) de pôr do sol: grande sol laranja-rosado, colinas em camadas lavanda e roxo, céu em degradê do amarelo ao rosa e ao roxo. Sem pessoas, sem pássaros, sem texto. Centro com poucos detalhes.'],
  'bg-confetti': ['Confete', 'Confete colorido espalhado sobre fundo pastel muito claro: círculos, tiras e triângulos em rosa, azul, amarelo e verde-menta, densidade maior nas bordas e menor no centro. Sem balões, sem texto.'],
  'bg-blueprint': ['Planta técnica', 'Fundo de planta técnica (blueprint): azul-cobalto com grade fina branca, traços de régua, ângulos e arcos de compasso desenhados em linhas brancas translúcidas. Sem texto, sem números, sem cotas legíveis.'],
  'bg-geometric': ['Geométrico Memphis', 'Padrão geométrico estilo Memphis sobre fundo creme: círculos, semicírculos, zigue-zagues, pontos e quadrados em rosa, amarelo, turquesa e azul, formas planas. Sem texto. Centro com menos formas.'],
  'bg-chalk': ['Lousa de cafeteria', 'Lousa preta/verde-escura com textura de giz apagado e uma borda desenhada com giz branco: cantos com pequenos rabiscos (estrelas, folhas, xícara). Centro totalmente livre. Sem nenhuma letra ou palavra.'],
  'bg-wood': ['Madeira clara', 'Tábuas de madeira clara vistas de cima, veios visíveis, tom mel, luz suave de mesa de café, sem objetos sobre a madeira.'],
  'bg-space': ['Espaço profundo', 'Espaço sideral: nebulosa em roxo e azul, estrelas de tamanhos variados, poeira cósmica suave. Sem planetas no centro, sem naves, sem texto.'],
  'bg-tropical': ['Tropical', 'Folhas tropicais (monstera, palmeira, bananeira) em verde-escuro e esmeralda sobre fundo turquesa-escuro, ilustração plana; folhas densas nas bordas e centro mais livre. Sem flores chamativas, sem animais, sem texto.'],
  'bg-deco': ['Art déco', 'Padrão art déco simétrico: leques e arcos concêntricos com linhas douradas finas sobre preto fosco, luxuoso. Sem texto, sem figuras.'],
  'bg-pastel': ['Formas pastel', 'Formas orgânicas (blobs) sobrepostas em pêssego, lavanda, verde-menta e amarelo-manteiga, bem suaves e claras, com leve grão. Sem texto.'],
  'orn-sparkles': ['Brilhos', 'Aglomerado de brilhos de quatro pontas em dourado e branco, tamanhos variados, com pequenos pontos de luz, composto para o CANTO SUPERIOR ESQUERDO (a maior parte do conjunto encostada nesse canto, desaparecendo na diagonal oposta).'],
  'orn-confetti-burst': ['Explosão de confete', 'Explosão de confete e serpentinas coloridas (rosa, amarelo, azul, verde) saindo do CANTO SUPERIOR ESQUERDO e se espalhando pela diagonal.'],
  'orn-leaves': ['Folhagem', 'Ramos de folhas verdes (eucalipto e samambaia) estilo aquarela entrando pelo CANTO SUPERIOR ESQUERDO, deixando o resto da imagem vazio.'],
  'orn-floral': ['Floral', 'Arranjo floral em aquarela (rosas, peônias e folhas) no CANTO SUPERIOR ESQUERDO, com as flores maiores no canto e botões menores avançando pela diagonal.'],
  'orn-arrow': ['Seta desenhada', 'Uma única seta desenhada à mão com marcador preto grosso, curvada, apontando para a direita e para baixo, com dois pequenos riscos de ênfase ao lado. Objeto isolado e centralizado. Sem texto.'],
  'orn-stars': ['Estrelas', 'Grupo de estrelas de cinco pontas planas em amarelo, laranja e branco, com pequenas linhas de movimento, composto para o CANTO SUPERIOR ESQUERDO.'],
  'orn-wifi-waves': ['Ondas de sinal', 'Ondas de sinal concêntricas (como ícone de Wi-Fi/radar) em branco translúcido e azul-claro, partindo do CANTO SUPERIOR ESQUERDO e crescendo na diagonal. Sem texto.'],
  'orn-coffee': ['Café', 'Xícara de café fumegante vista em 3/4, com alguns grãos de café ao redor, ilustração plana em marrom e creme. Objeto isolado e centralizado, na vertical (a xícara em pé).'],
  'orn-balloons': ['Balões', 'Três balões de festa (rosa, azul e amarelo) com fitas encaracoladas, ilustração plana. Objeto isolado e centralizado, na vertical.'],
  'orn-ribbon': ['Fita de canto', 'Faixa/fita diagonal dourada cruzando o CANTO SUPERIOR ESQUERDO como uma etiqueta de canto, com dobras e sombreado suave. Sem nenhum texto na fita.'],
  'orn-deco-corner': ['Canto art déco', 'Ornamento de canto art déco dourado: linhas paralelas e leques saindo do CANTO SUPERIOR ESQUERDO, simétrico em relação à diagonal. Sem texto.'],
  'orn-halftone': ['Retícula pop', 'Explosão pop-art de retícula (halftone) em magenta e ciano, com pontos grandes no CANTO SUPERIOR ESQUERDO diminuindo ao longo da diagonal.'],
  'frame-floral': ['Moldura floral', 'Moldura QUADRADA em guirlanda floral: flores, folhas e botões ao longo das quatro bordas e dos cantos, ocupando no máximo 12% da largura em cada lado. O centro (os 76% do meio) deve ser totalmente vazio e transparente.'],
  'frame-gold': ['Moldura dourada', 'Moldura QUADRADA dourada ornamentada, estilo vitoriano, com cantos trabalhados, ocupando no máximo 10% da largura em cada lado. Interior totalmente vazio e transparente.'],
  'frame-neon': ['Moldura neon', 'Moldura QUADRADA de tubo de luz neon em ciano e magenta, com brilho suave (glow), cantos arredondados, ocupando no máximo 8% da largura em cada lado. Interior totalmente vazio e transparente.'],
  'frame-tape': ['Fita adesiva', 'Quatro pedaços de fita adesiva washi (listrada, em tons pastel) colados nos quatro cantos de uma área quadrada como se prendessem uma foto, ligeiramente inclinados. Todo o resto vazio e transparente.']
};

const missing = ART.filter((art) => !BRIEF[art.id]).map((art) => art.id);
const extra = Object.keys(BRIEF).filter((id) => !ART.some((art) => art.id === id));
if (missing.length || extra.length) throw new Error(`BRIEF fora de sincronia. Faltam: ${missing}. Sobram: ${extra}`);

const kindInfo = {
  bg: { label: 'Fundo', size: '1024 × 1536 px (retrato)', alpha: 'sem transparência (imagem cheia)' },
  orn: { label: 'Ornamento', size: '1024 × 1024 px (quadrado)', alpha: 'PNG com fundo TRANSPARENTE' },
  frame: { label: 'Moldura', size: '1024 × 1024 px (quadrado)', alpha: 'PNG com fundo TRANSPARENTE e centro vazio' }
};
const usedBy = (id) => TEMPLATES.filter((template) => JSON.stringify(template.patch).includes(`"${id}"`)).map((template) => template.name);
const fence = (text) => `\`\`\`text\n${text}\n\`\`\``;

const globalRules = [
  'REGRAS GERAIS (valem para TODAS as imagens):',
  '- Nenhuma letra, palavra, número, logotipo, marca registrada, assinatura, marca d\'água ou QR Code dentro das imagens.',
  '- Estilo: ilustração digital limpa e nítida (ou textura fotográfica, quando o item pedir). Sem mockups, sem molduras brancas em volta, sem cantos arredondados na imagem final, sem pessoas, sem rostos.',
  '- Itens "bg-" (fundos): 1024 × 1536 px, retrato, imagem cheia SEM transparência. A parte central (cerca de 55% do centro) deve ter menos detalhes e menos contraste, porque um QR Code será colocado ali.',
  '- Itens "orn-" (ornamentos) e "frame-" (molduras): 1024 × 1024 px, PNG com fundo realmente TRANSPARENTE (canal alfa), sem sombra projetada no chão e sem fundo colorido. Se você não conseguir exportar com transparência, desenhe sobre fundo verde puro #00FF00 liso, para eu remover depois.',
  '- Ornamentos que dizem "CANTO SUPERIOR ESQUERDO" devem ter o conjunto encostado nesse canto; o app gira a imagem para os outros cantos. Ornamentos "isolados e centralizados" ficam no meio da imagem, em pé.',
  '- Mantenha cores vivas, mas limpas; evite granulação pesada, desfoque e ruído, exceto onde o item pedir (grão fino de filme).'
].join('\n');

const itemLines = ART.map((art, index) => {
  const [name, prompt] = BRIEF[art.id];
  const kind = kindInfo[art.kind];
  return `${index + 1}. id: ${art.id} · ${kind.label} "${name}" · ${kind.size} · ${kind.alpha}\n   Descrição: ${prompt}`;
}).join('\n');

const masterPrompt = [
  'Você é um diretor de arte e vai produzir os criativos de um gerador de QR Code personalizado. Gere TODAS as 32 imagens da lista abaixo, uma de cada vez e na ordem. Depois de cada imagem escreva apenas o "id" dela e siga para a próxima, sem pedir confirmação; se o limite de mensagens interromper, eu escreverei "continue do número N".',
  '',
  globalRules,
  '',
  'LISTA DE IMAGENS (gere cada uma conforme o tamanho e a descrição indicados):',
  itemLines,
  '',
  'AO FINAL: mostre uma tabela com duas colunas (número, id) para eu renomear os arquivos exatamente como o id (ex.: bg-aurora.png).'
].join('\n');

const sections = [];
sections.push(`# Criativos do Gerador de QR Code

Este documento lista **todas as imagens** que o gerador de QR Code do arc.Studio sabe usar (fundos, ornamentos e molduras) e traz o **prompt de cada uma** para o gerador de imagens do ChatGPT. As imagens são **opcionais**: sem elas, os modelos usam as decorações vetoriais embutidas (ondas, círculos, listras…) e continuam funcionando. Com elas, os modelos ficam muito mais ricos.

> Este arquivo é gerado por \`node scripts/gen-qr-creatives.mjs\` a partir do catálogo do app (\`src/renderer/qr-templates.js\`): os ids abaixo são exatamente os que o app procura.

## Como usar (3 passos)

1. Gere as imagens no ChatGPT com o **[Prompt único](#prompt-único-copie-e-cole-tudo)** (ou use os prompts individuais da seção [Catálogo](#catálogo-de-criativos)).
2. Renomeie cada arquivo para o **id** (ex.: \`bg-aurora.png\`). Aceita \`.png\`, \`.webp\`, \`.jpg\` e \`.jpeg\`; o nome precisa ter só letras minúsculas, números e hífen.
3. Coloque os arquivos na **pasta de artes** do app: no arc.Studio, aba **Moldura → Abrir pasta de artes** (é \`%APPDATA%\\arc.Studio\\qr-art\`). Depois clique em **Recarregar artes**. Quem compila o app também pode colocar os arquivos em \`src/renderer/assets/qr-art/\` para que vão dentro do instalador.

A pasta do usuário tem prioridade sobre a que vem no instalador. Você também pode importar qualquer imagem avulsa direto no app (**Moldura → Importar imagem de fundo / ornamento**) sem renomear nada.

## Como o app usa cada tipo

| Tipo | Prefixo | Tamanho | Transparência | Como aparece |
|---|---|---|---|---|
| Fundo | \`bg-\` | 1024 × 1536 | não | Preenche o cartão inteiro (cobre qualquer proporção; o centro fica sob o QR) |
| Ornamento de canto | \`orn-\` (brilhos, folhas, flores, confete…) | 1024 × 1024 | **sim** | Composto para o canto superior esquerdo; o app gira para os outros cantos |
| Ornamento de objeto | \`orn-arrow\`, \`orn-coffee\`, \`orn-balloons\` | 1024 × 1024 | **sim** | Objeto isolado em pé; no lado direito só é espelhado |
| Moldura | \`frame-\` | 1024 × 1024 | **sim** | Borda decorativa com o centro vazio, para molduras quadradas (posição "Centro") |

Quando há um fundo de arte, o padrão vetorial do modelo some automaticamente (a arte o substitui). Se o arquivo não existir, o modelo cai de volta no padrão vetorial.

## Molduras (layouts) do gerador

| Moldura | Tamanho (px) | Tamanho impresso | Textos usados | Descrição |
|---|---|---|---|---|
${LAYOUTS.map((layout) => `| ${layout.name} | ${layout.w} × ${layout.h} | ${layout.mm[0]} × ${layout.mm[1]} mm | ${layout.roles.length ? layout.roles.join(', ') : '—'} | ${layout.desc} |`).join('\n')}

## Modelos prontos e as artes que usam

${TEMPLATES.map((template) => `- **${template.name}** (${template.cat}) — ${template.desc}${(() => { const ids = ART.filter((art) => JSON.stringify(template.patch).includes(`"${art.id}"`)).map((art) => `\`${art.id}\``); return ids.length ? ` Usa: ${ids.join(', ')}.` : ''; })()}`).join('\n')}

## Prompt único (copie e cole tudo)

Cole o bloco abaixo, inteiro, no ChatGPT (modo de geração de imagens). Ele já contém as regras e as 32 descrições.

${fence(masterPrompt)}
`);

sections.push(`## Catálogo de criativos

Cada item traz o id (nome do arquivo), onde é usado e o prompt individual (o mesmo texto do Prompt único), caso você prefira gerar uma imagem por vez.

Se for gerar uma a uma, comece cada pedido com as **regras gerais**:

${fence(globalRules)}
`);

for (const [kind, title] of [['bg', 'Fundos (16)'], ['orn', 'Ornamentos (12)'], ['frame', 'Molduras (4)']]) {
  sections.push(`### ${title}\n`);
  for (const art of ART.filter((item) => item.kind === kind)) {
    const [name, prompt] = BRIEF[art.id];
    const users = usedBy(art.id);
    sections.push(`#### \`${art.id}\` — ${name}

- Arquivo: \`${art.id}.png\` · ${kindInfo[kind].size} · ${kindInfo[kind].alpha}
- Usado por: ${users.length ? users.join(', ') : 'nenhum modelo por padrão (disponível para você escolher na aba Moldura)'}

${fence(`${prompt}\nFormato: ${kindInfo[kind].size}, ${kindInfo[kind].alpha}. Sem texto, letras, números, logotipos, marca d'água ou QR Code.`)}
`);
  }
}

sections.push(`## Checklist de conferência

- [ ] Nenhuma imagem tem texto, números, logotipo ou QR Code.
- [ ] Fundos (\`bg-\`) sem transparência e com o centro calmo.
- [ ] Ornamentos e molduras com transparência real (abra no navegador sobre fundo escuro: não pode haver quadrado branco/verde atrás).
- [ ] Nomes exatamente iguais aos ids, em minúsculas.
- [ ] No app: aba **Moldura → Recarregar artes** mostra "32 de 32 artes encontradas".
- [ ] Teste um modelo com cada arte e confira que o chip da prévia continua dizendo **✓ lê corretamente**.
`);

mkdirSync(path.join(root, 'docs'), { recursive: true });
writeFileSync(path.join(root, 'docs', 'QR-CREATIVOS.md'), `${sections.join('\n')}\n`, 'utf8');
console.log(`docs/QR-CREATIVOS.md: ${ART.length} artes, ${TEMPLATES.length} modelos, ${LAYOUTS.length} molduras`);
