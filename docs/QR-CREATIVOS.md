# Criativos do Gerador de QR Code

Este documento lista **todas as imagens** que o gerador de QR Code do arc.Studio sabe usar (fundos, ornamentos e molduras) e traz o **prompt de cada uma** para o gerador de imagens do ChatGPT. As imagens são **opcionais**: sem elas, os modelos usam as decorações vetoriais embutidas (ondas, círculos, listras…) e continuam funcionando. Com elas, os modelos ficam muito mais ricos.

> Este arquivo é gerado por `node scripts/gen-qr-creatives.mjs` a partir do catálogo do app (`src/renderer/qr-templates.js`): os ids abaixo são exatamente os que o app procura.

## Como usar (3 passos)

1. Gere as imagens no ChatGPT com o **[Prompt único](#prompt-único-copie-e-cole-tudo)** (ou use os prompts individuais da seção [Catálogo](#catálogo-de-criativos)).
2. Renomeie cada arquivo para o **id** (ex.: `bg-aurora.png`). Aceita `.png`, `.webp`, `.jpg` e `.jpeg`; o nome precisa ter só letras minúsculas, números e hífen.
3. Coloque os arquivos na **pasta de artes** do app: no arc.Studio, aba **Moldura → Abrir pasta de artes** (é `%APPDATA%\arc.Studio\qr-art`). Depois clique em **Recarregar artes**. Quem compila o app também pode colocar os arquivos em `src/renderer/assets/qr-art/` para que vão dentro do instalador.

A pasta do usuário tem prioridade sobre a que vem no instalador. Você também pode importar qualquer imagem avulsa direto no app (**Moldura → Importar imagem de fundo / ornamento**) sem renomear nada.

## Como o app usa cada tipo

| Tipo | Prefixo | Tamanho | Transparência | Como aparece |
|---|---|---|---|---|
| Fundo | `bg-` | 1024 × 1536 | não | Preenche o cartão inteiro (cobre qualquer proporção; o centro fica sob o QR) |
| Ornamento de canto | `orn-` (brilhos, folhas, flores, confete…) | 1024 × 1024 | **sim** | Composto para o canto superior esquerdo; o app gira para os outros cantos |
| Ornamento de objeto | `orn-arrow`, `orn-coffee`, `orn-balloons` | 1024 × 1024 | **sim** | Objeto isolado em pé; no lado direito só é espelhado |
| Moldura | `frame-` | 1024 × 1024 | **sim** | Borda decorativa com o centro vazio, para molduras quadradas (posição "Centro") |

Quando há um fundo de arte, o padrão vetorial do modelo some automaticamente (a arte o substitui). Se o arquivo não existir, o modelo cai de volta no padrão vetorial.

## Molduras (layouts) do gerador

| Moldura | Tamanho (px) | Tamanho impresso | Textos usados | Descrição |
|---|---|---|---|---|
| Só o código | 1000 × 1000 | 60 × 60 mm | — | O QR Code limpo, sem moldura. |
| Moldura com legenda (baixo) | 1000 × 1240 | 60 × 74 mm | cta | Moldura colorida com chamada embaixo. |
| Moldura com legenda (cima) | 1000 × 1240 | 60 × 74 mm | cta | Chamada em cima, código embaixo. |
| Adesivo redondo | 1100 × 1100 | 70 × 70 mm | cta | Selo circular com texto em volta. |
| Post quadrado | 1080 × 1080 | 100 × 100 mm | title, subtitle, cta, footer | Feed do Instagram (1080 × 1080). |
| Post vertical | 1080 × 1350 | 100 × 125 mm | title, subtitle, cta, footer | Feed 4:5 (1080 × 1350). |
| Story / Reels | 1080 × 1920 | 90 × 160 mm | title, subtitle, cta, footer | Tela cheia 9:16 (1080 × 1920). |
| Cartaz A4 | 1240 × 1754 | 210 × 297 mm | title, subtitle, cta, footer | Para imprimir e colar (210 × 297 mm). |
| Cartão de visita | 1050 × 600 | 89 × 51 mm | title, subtitle, cta, footer | Código à esquerda, dados à direita (89 × 51 mm). |
| Banner largo | 1920 × 720 | 240 × 90 mm | title, subtitle, cta, footer | Faixa horizontal para site e telas (16:6). |
| Ingresso | 1500 × 620 | 150 × 62 mm | title, subtitle, cta, footer | Com picote e recortes laterais. |
| Etiqueta com furo | 700 × 1100 | 50 × 79 mm | title, cta, footer | Tag para pendurar (50 × 79 mm). |

## Modelos prontos e as artes que usam

- **Clássico** (essenciais) — Preto sobre branco: o mais compatível.
- **Suave** (essenciais) — Cantos arredondados, grafite.
- **Pontos índigo** (essenciais) — Pontos redondos com olhos circulares.
- **Líquido azul** (essenciais) — Módulos conectados com degradê.
- **Barras** (essenciais) — Barras verticais arredondadas.
- **Oceano** (essenciais) — Azul profundo para ciano.
- **Pôr do sol** (essenciais) — Laranja queimado para vinho.
- **Floresta** (essenciais) — Verdes profundos em fundo creme.
- **Grafite e ouro** (essenciais) — Elegante: grafite com olhos dourados.
- **Corações** (essenciais) — Módulos em coração, degradê rosa.
- **Estrelas** (essenciais) — Módulos em estrela, roxo profundo.
- **Retrô** (essenciais) — Marrom sobre papel amarelado.
- **Com logo no centro** (essenciais) — Espaço central para a sua marca (correção H).
- **Escaneie-me** (molduras) — Moldura escura com chamada embaixo.
- **Chamada em cima (azul)** (molduras) — Azul vivo, chamada acima do código.
- **Adesivo amarelo** (molduras) — Selo redondo com texto em volta.
- **Selo verde** (molduras) — Adesivo redondo, tom natural.
- **Cartão de visita claro** (negocios) — Nome e cargo à direita, vCard à esquerda.
- **Cartão de visita escuro** (negocios) — Fundo grafite, código em placa branca.
- **Cartaz de promoção** (negocios) — A4 colorido para chamar atenção. Usa: `orn-confetti-burst`.
- **Cartaz minimalista** (negocios) — Branco, tipografia grande, sem ruído.
- **Cardápio de mesa** (negocios) — Lousa de cafeteria com chamada para o menu. Usa: `bg-chalk`, `orn-coffee`.
- **Banner para o site** (negocios) — Faixa larga, texto à esquerda.
- **Etiqueta de produto** (negocios) — Tag com furo para pendurar. Usa: `bg-paper`.
- **Wi-Fi para visitas** (casa) — Cartão azul com ondas e ícone de Wi-Fi. Usa: `orn-wifi-waves`.
- **Wi-Fi da casa** (casa) — Post quadrado pastel, simpático. Usa: `bg-pastel`.
- **Ingresso** (eventos) — Com picote e recortes, para entrada.
- **Convite de festa** (eventos) — Confete e cores vivas. Usa: `bg-confetti`, `orn-balloons`.
- **Story "Me siga"** (social) — Degradê de rede social em tela cheia. Usa: `orn-sparkles`.
- **Fale comigo (WhatsApp)** (social) — Verde, com balão de conversa.
- **Pague com Pix** (social) — Cartão verde-água para cobrança.
- **Cartaz neon** (social) — Grade synthwave: código claro em placa. Usa: `bg-neon-grid`.

## Prompt único (copie e cole tudo)

Cole o bloco abaixo, inteiro, no ChatGPT (modo de geração de imagens). Ele já contém as regras e as 32 descrições.

```text
Você é um diretor de arte e vai produzir os criativos de um gerador de QR Code personalizado. Gere TODAS as 32 imagens da lista abaixo, uma de cada vez e na ordem. Depois de cada imagem escreva apenas o "id" dela e siga para a próxima, sem pedir confirmação; se o limite de mensagens interromper, eu escreverei "continue do número N".

REGRAS GERAIS (valem para TODAS as imagens):
- Nenhuma letra, palavra, número, logotipo, marca registrada, assinatura, marca d'água ou QR Code dentro das imagens.
- Estilo: ilustração digital limpa e nítida (ou textura fotográfica, quando o item pedir). Sem mockups, sem molduras brancas em volta, sem cantos arredondados na imagem final, sem pessoas, sem rostos.
- Itens "bg-" (fundos): 1024 × 1536 px, retrato, imagem cheia SEM transparência. A parte central (cerca de 55% do centro) deve ter menos detalhes e menos contraste, porque um QR Code será colocado ali.
- Itens "orn-" (ornamentos) e "frame-" (molduras): 1024 × 1024 px, PNG com fundo realmente TRANSPARENTE (canal alfa), sem sombra projetada no chão e sem fundo colorido. Se você não conseguir exportar com transparência, desenhe sobre fundo verde puro #00FF00 liso, para eu remover depois.
- Ornamentos que dizem "CANTO SUPERIOR ESQUERDO" devem ter o conjunto encostado nesse canto; o app gira a imagem para os outros cantos. Ornamentos "isolados e centralizados" ficam no meio da imagem, em pé.
- Mantenha cores vivas, mas limpas; evite granulação pesada, desfoque e ruído, exceto onde o item pedir (grão fino de filme).

LISTA DE IMAGENS (gere cada uma conforme o tamanho e a descrição indicados):
1. id: bg-aurora · Fundo "Aurora suave" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Fundo abstrato de aurora boreal: faixas de luz fluidas e translúcidas em verde-água, violeta e azul sobre um céu azul-noite profundo, com grão fino de filme. Sem figuras, sem horizonte. A região central deve ser mais calma e de menor contraste.
2. id: bg-neon-grid · Fundo "Grade neon (synthwave)" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Cenário retrô anos 80 estilo synthwave: grade em perspectiva rosa-neon e ciano descendo até um horizonte, sol em degradê laranja-rosa semi-escondido atrás do horizonte, estrelas discretas no céu roxo-escuro. Sem texto, sem carros, sem palmeiras. Centro da imagem com menos detalhes.
3. id: bg-ocean · Fundo "Oceano" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Fundo submarino: raios de luz atravessando água azul-turquesa, pequenas bolhas flutuando, degradê de azul-claro no topo para azul-profundo na base. Sem peixes grandes, sem texto. Centro suave.
4. id: bg-forest · Fundo "Floresta com neblina" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Ilustração plana de floresta em camadas: silhuetas de pinheiros em verdes profundos com neblina entre as camadas e luz dourada suave vinda do topo. Sem animais, sem pessoas, sem texto. Parte central mais clara e calma.
5. id: bg-paper · Fundo "Papel kraft" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Textura fotográfica de papel kraft / papelão reciclado, fibras visíveis, tom bege-quente, iluminação perfeitamente uniforme, sem dobras fortes, sem objetos, sem manchas escuras.
6. id: bg-marble · Fundo "Mármore" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Textura de mármore branco com veios finos cinza-claro e dourado, elegante e luminosa, iluminação uniforme, sem objetos, sem reflexos fortes.
7. id: bg-sunset · Fundo "Pôr do sol ilustrado" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Ilustração plana (flat) de pôr do sol: grande sol laranja-rosado, colinas em camadas lavanda e roxo, céu em degradê do amarelo ao rosa e ao roxo. Sem pessoas, sem pássaros, sem texto. Centro com poucos detalhes.
8. id: bg-confetti · Fundo "Confete" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Confete colorido espalhado sobre fundo pastel muito claro: círculos, tiras e triângulos em rosa, azul, amarelo e verde-menta, densidade maior nas bordas e menor no centro. Sem balões, sem texto.
9. id: bg-blueprint · Fundo "Planta técnica" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Fundo de planta técnica (blueprint): azul-cobalto com grade fina branca, traços de régua, ângulos e arcos de compasso desenhados em linhas brancas translúcidas. Sem texto, sem números, sem cotas legíveis.
10. id: bg-geometric · Fundo "Geométrico Memphis" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Padrão geométrico estilo Memphis sobre fundo creme: círculos, semicírculos, zigue-zagues, pontos e quadrados em rosa, amarelo, turquesa e azul, formas planas. Sem texto. Centro com menos formas.
11. id: bg-chalk · Fundo "Lousa de cafeteria" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Lousa preta/verde-escura com textura de giz apagado e uma borda desenhada com giz branco: cantos com pequenos rabiscos (estrelas, folhas, xícara). Centro totalmente livre. Sem nenhuma letra ou palavra.
12. id: bg-wood · Fundo "Madeira clara" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Tábuas de madeira clara vistas de cima, veios visíveis, tom mel, luz suave de mesa de café, sem objetos sobre a madeira.
13. id: bg-space · Fundo "Espaço profundo" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Espaço sideral: nebulosa em roxo e azul, estrelas de tamanhos variados, poeira cósmica suave. Sem planetas no centro, sem naves, sem texto.
14. id: bg-tropical · Fundo "Tropical" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Folhas tropicais (monstera, palmeira, bananeira) em verde-escuro e esmeralda sobre fundo turquesa-escuro, ilustração plana; folhas densas nas bordas e centro mais livre. Sem flores chamativas, sem animais, sem texto.
15. id: bg-deco · Fundo "Art déco" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Padrão art déco simétrico: leques e arcos concêntricos com linhas douradas finas sobre preto fosco, luxuoso. Sem texto, sem figuras.
16. id: bg-pastel · Fundo "Formas pastel" · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
   Descrição: Formas orgânicas (blobs) sobrepostas em pêssego, lavanda, verde-menta e amarelo-manteiga, bem suaves e claras, com leve grão. Sem texto.
17. id: orn-sparkles · Ornamento "Brilhos" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Aglomerado de brilhos de quatro pontas em dourado e branco, tamanhos variados, com pequenos pontos de luz, composto para o CANTO SUPERIOR ESQUERDO (a maior parte do conjunto encostada nesse canto, desaparecendo na diagonal oposta).
18. id: orn-confetti-burst · Ornamento "Explosão de confete" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Explosão de confete e serpentinas coloridas (rosa, amarelo, azul, verde) saindo do CANTO SUPERIOR ESQUERDO e se espalhando pela diagonal.
19. id: orn-leaves · Ornamento "Folhagem" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Ramos de folhas verdes (eucalipto e samambaia) estilo aquarela entrando pelo CANTO SUPERIOR ESQUERDO, deixando o resto da imagem vazio.
20. id: orn-floral · Ornamento "Floral" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Arranjo floral em aquarela (rosas, peônias e folhas) no CANTO SUPERIOR ESQUERDO, com as flores maiores no canto e botões menores avançando pela diagonal.
21. id: orn-arrow · Ornamento "Seta desenhada" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Uma única seta desenhada à mão com marcador preto grosso, curvada, apontando para a direita e para baixo, com dois pequenos riscos de ênfase ao lado. Objeto isolado e centralizado. Sem texto.
22. id: orn-stars · Ornamento "Estrelas" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Grupo de estrelas de cinco pontas planas em amarelo, laranja e branco, com pequenas linhas de movimento, composto para o CANTO SUPERIOR ESQUERDO.
23. id: orn-wifi-waves · Ornamento "Ondas de sinal" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Ondas de sinal concêntricas (como ícone de Wi-Fi/radar) em branco translúcido e azul-claro, partindo do CANTO SUPERIOR ESQUERDO e crescendo na diagonal. Sem texto.
24. id: orn-coffee · Ornamento "Café" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Xícara de café fumegante vista em 3/4, com alguns grãos de café ao redor, ilustração plana em marrom e creme. Objeto isolado e centralizado, na vertical (a xícara em pé).
25. id: orn-balloons · Ornamento "Balões" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Três balões de festa (rosa, azul e amarelo) com fitas encaracoladas, ilustração plana. Objeto isolado e centralizado, na vertical.
26. id: orn-ribbon · Ornamento "Fita de canto" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Faixa/fita diagonal dourada cruzando o CANTO SUPERIOR ESQUERDO como uma etiqueta de canto, com dobras e sombreado suave. Sem nenhum texto na fita.
27. id: orn-deco-corner · Ornamento "Canto art déco" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Ornamento de canto art déco dourado: linhas paralelas e leques saindo do CANTO SUPERIOR ESQUERDO, simétrico em relação à diagonal. Sem texto.
28. id: orn-halftone · Ornamento "Retícula pop" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
   Descrição: Explosão pop-art de retícula (halftone) em magenta e ciano, com pontos grandes no CANTO SUPERIOR ESQUERDO diminuindo ao longo da diagonal.
29. id: frame-floral · Moldura "Moldura floral" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE e centro vazio
   Descrição: Moldura QUADRADA em guirlanda floral: flores, folhas e botões ao longo das quatro bordas e dos cantos, ocupando no máximo 12% da largura em cada lado. O centro (os 76% do meio) deve ser totalmente vazio e transparente.
30. id: frame-gold · Moldura "Moldura dourada" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE e centro vazio
   Descrição: Moldura QUADRADA dourada ornamentada, estilo vitoriano, com cantos trabalhados, ocupando no máximo 10% da largura em cada lado. Interior totalmente vazio e transparente.
31. id: frame-neon · Moldura "Moldura neon" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE e centro vazio
   Descrição: Moldura QUADRADA de tubo de luz neon em ciano e magenta, com brilho suave (glow), cantos arredondados, ocupando no máximo 8% da largura em cada lado. Interior totalmente vazio e transparente.
32. id: frame-tape · Moldura "Fita adesiva" · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE e centro vazio
   Descrição: Quatro pedaços de fita adesiva washi (listrada, em tons pastel) colados nos quatro cantos de uma área quadrada como se prendessem uma foto, ligeiramente inclinados. Todo o resto vazio e transparente.

AO FINAL: mostre uma tabela com duas colunas (número, id) para eu renomear os arquivos exatamente como o id (ex.: bg-aurora.png).
```

## Catálogo de criativos

Cada item traz o id (nome do arquivo), onde é usado e o prompt individual (o mesmo texto do Prompt único), caso você prefira gerar uma imagem por vez.

Se for gerar uma a uma, comece cada pedido com as **regras gerais**:

```text
REGRAS GERAIS (valem para TODAS as imagens):
- Nenhuma letra, palavra, número, logotipo, marca registrada, assinatura, marca d'água ou QR Code dentro das imagens.
- Estilo: ilustração digital limpa e nítida (ou textura fotográfica, quando o item pedir). Sem mockups, sem molduras brancas em volta, sem cantos arredondados na imagem final, sem pessoas, sem rostos.
- Itens "bg-" (fundos): 1024 × 1536 px, retrato, imagem cheia SEM transparência. A parte central (cerca de 55% do centro) deve ter menos detalhes e menos contraste, porque um QR Code será colocado ali.
- Itens "orn-" (ornamentos) e "frame-" (molduras): 1024 × 1024 px, PNG com fundo realmente TRANSPARENTE (canal alfa), sem sombra projetada no chão e sem fundo colorido. Se você não conseguir exportar com transparência, desenhe sobre fundo verde puro #00FF00 liso, para eu remover depois.
- Ornamentos que dizem "CANTO SUPERIOR ESQUERDO" devem ter o conjunto encostado nesse canto; o app gira a imagem para os outros cantos. Ornamentos "isolados e centralizados" ficam no meio da imagem, em pé.
- Mantenha cores vivas, mas limpas; evite granulação pesada, desfoque e ruído, exceto onde o item pedir (grão fino de filme).
```

### Fundos (16)

#### `bg-aurora` — Aurora suave

- Arquivo: `bg-aurora.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Fundo abstrato de aurora boreal: faixas de luz fluidas e translúcidas em verde-água, violeta e azul sobre um céu azul-noite profundo, com grão fino de filme. Sem figuras, sem horizonte. A região central deve ser mais calma e de menor contraste.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-neon-grid` — Grade neon (synthwave)

- Arquivo: `bg-neon-grid.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: Cartaz neon

```text
Cenário retrô anos 80 estilo synthwave: grade em perspectiva rosa-neon e ciano descendo até um horizonte, sol em degradê laranja-rosa semi-escondido atrás do horizonte, estrelas discretas no céu roxo-escuro. Sem texto, sem carros, sem palmeiras. Centro da imagem com menos detalhes.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-ocean` — Oceano

- Arquivo: `bg-ocean.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Fundo submarino: raios de luz atravessando água azul-turquesa, pequenas bolhas flutuando, degradê de azul-claro no topo para azul-profundo na base. Sem peixes grandes, sem texto. Centro suave.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-forest` — Floresta com neblina

- Arquivo: `bg-forest.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Ilustração plana de floresta em camadas: silhuetas de pinheiros em verdes profundos com neblina entre as camadas e luz dourada suave vinda do topo. Sem animais, sem pessoas, sem texto. Parte central mais clara e calma.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-paper` — Papel kraft

- Arquivo: `bg-paper.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: Etiqueta de produto

```text
Textura fotográfica de papel kraft / papelão reciclado, fibras visíveis, tom bege-quente, iluminação perfeitamente uniforme, sem dobras fortes, sem objetos, sem manchas escuras.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-marble` — Mármore

- Arquivo: `bg-marble.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Textura de mármore branco com veios finos cinza-claro e dourado, elegante e luminosa, iluminação uniforme, sem objetos, sem reflexos fortes.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-sunset` — Pôr do sol ilustrado

- Arquivo: `bg-sunset.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Ilustração plana (flat) de pôr do sol: grande sol laranja-rosado, colinas em camadas lavanda e roxo, céu em degradê do amarelo ao rosa e ao roxo. Sem pessoas, sem pássaros, sem texto. Centro com poucos detalhes.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-confetti` — Confete

- Arquivo: `bg-confetti.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: Convite de festa

```text
Confete colorido espalhado sobre fundo pastel muito claro: círculos, tiras e triângulos em rosa, azul, amarelo e verde-menta, densidade maior nas bordas e menor no centro. Sem balões, sem texto.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-blueprint` — Planta técnica

- Arquivo: `bg-blueprint.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Fundo de planta técnica (blueprint): azul-cobalto com grade fina branca, traços de régua, ângulos e arcos de compasso desenhados em linhas brancas translúcidas. Sem texto, sem números, sem cotas legíveis.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-geometric` — Geométrico Memphis

- Arquivo: `bg-geometric.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Padrão geométrico estilo Memphis sobre fundo creme: círculos, semicírculos, zigue-zagues, pontos e quadrados em rosa, amarelo, turquesa e azul, formas planas. Sem texto. Centro com menos formas.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-chalk` — Lousa de cafeteria

- Arquivo: `bg-chalk.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: Cardápio de mesa

```text
Lousa preta/verde-escura com textura de giz apagado e uma borda desenhada com giz branco: cantos com pequenos rabiscos (estrelas, folhas, xícara). Centro totalmente livre. Sem nenhuma letra ou palavra.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-wood` — Madeira clara

- Arquivo: `bg-wood.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Tábuas de madeira clara vistas de cima, veios visíveis, tom mel, luz suave de mesa de café, sem objetos sobre a madeira.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-space` — Espaço profundo

- Arquivo: `bg-space.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Espaço sideral: nebulosa em roxo e azul, estrelas de tamanhos variados, poeira cósmica suave. Sem planetas no centro, sem naves, sem texto.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-tropical` — Tropical

- Arquivo: `bg-tropical.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Folhas tropicais (monstera, palmeira, bananeira) em verde-escuro e esmeralda sobre fundo turquesa-escuro, ilustração plana; folhas densas nas bordas e centro mais livre. Sem flores chamativas, sem animais, sem texto.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-deco` — Art déco

- Arquivo: `bg-deco.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Padrão art déco simétrico: leques e arcos concêntricos com linhas douradas finas sobre preto fosco, luxuoso. Sem texto, sem figuras.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `bg-pastel` — Formas pastel

- Arquivo: `bg-pastel.png` · 1024 × 1536 px (retrato) · sem transparência (imagem cheia)
- Usado por: Wi-Fi da casa

```text
Formas orgânicas (blobs) sobrepostas em pêssego, lavanda, verde-menta e amarelo-manteiga, bem suaves e claras, com leve grão. Sem texto.
Formato: 1024 × 1536 px (retrato), sem transparência (imagem cheia). Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

### Ornamentos (12)

#### `orn-sparkles` — Brilhos

- Arquivo: `orn-sparkles.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: Story "Me siga"

```text
Aglomerado de brilhos de quatro pontas em dourado e branco, tamanhos variados, com pequenos pontos de luz, composto para o CANTO SUPERIOR ESQUERDO (a maior parte do conjunto encostada nesse canto, desaparecendo na diagonal oposta).
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-confetti-burst` — Explosão de confete

- Arquivo: `orn-confetti-burst.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: Cartaz de promoção

```text
Explosão de confete e serpentinas coloridas (rosa, amarelo, azul, verde) saindo do CANTO SUPERIOR ESQUERDO e se espalhando pela diagonal.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-leaves` — Folhagem

- Arquivo: `orn-leaves.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Ramos de folhas verdes (eucalipto e samambaia) estilo aquarela entrando pelo CANTO SUPERIOR ESQUERDO, deixando o resto da imagem vazio.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-floral` — Floral

- Arquivo: `orn-floral.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Arranjo floral em aquarela (rosas, peônias e folhas) no CANTO SUPERIOR ESQUERDO, com as flores maiores no canto e botões menores avançando pela diagonal.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-arrow` — Seta desenhada

- Arquivo: `orn-arrow.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Uma única seta desenhada à mão com marcador preto grosso, curvada, apontando para a direita e para baixo, com dois pequenos riscos de ênfase ao lado. Objeto isolado e centralizado. Sem texto.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-stars` — Estrelas

- Arquivo: `orn-stars.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Grupo de estrelas de cinco pontas planas em amarelo, laranja e branco, com pequenas linhas de movimento, composto para o CANTO SUPERIOR ESQUERDO.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-wifi-waves` — Ondas de sinal

- Arquivo: `orn-wifi-waves.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: Wi-Fi para visitas

```text
Ondas de sinal concêntricas (como ícone de Wi-Fi/radar) em branco translúcido e azul-claro, partindo do CANTO SUPERIOR ESQUERDO e crescendo na diagonal. Sem texto.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-coffee` — Café

- Arquivo: `orn-coffee.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: Cardápio de mesa

```text
Xícara de café fumegante vista em 3/4, com alguns grãos de café ao redor, ilustração plana em marrom e creme. Objeto isolado e centralizado, na vertical (a xícara em pé).
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-balloons` — Balões

- Arquivo: `orn-balloons.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: Convite de festa

```text
Três balões de festa (rosa, azul e amarelo) com fitas encaracoladas, ilustração plana. Objeto isolado e centralizado, na vertical.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-ribbon` — Fita de canto

- Arquivo: `orn-ribbon.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Faixa/fita diagonal dourada cruzando o CANTO SUPERIOR ESQUERDO como uma etiqueta de canto, com dobras e sombreado suave. Sem nenhum texto na fita.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-deco-corner` — Canto art déco

- Arquivo: `orn-deco-corner.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Ornamento de canto art déco dourado: linhas paralelas e leques saindo do CANTO SUPERIOR ESQUERDO, simétrico em relação à diagonal. Sem texto.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `orn-halftone` — Retícula pop

- Arquivo: `orn-halftone.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Explosão pop-art de retícula (halftone) em magenta e ciano, com pontos grandes no CANTO SUPERIOR ESQUERDO diminuindo ao longo da diagonal.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

### Molduras (4)

#### `frame-floral` — Moldura floral

- Arquivo: `frame-floral.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE e centro vazio
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Moldura QUADRADA em guirlanda floral: flores, folhas e botões ao longo das quatro bordas e dos cantos, ocupando no máximo 12% da largura em cada lado. O centro (os 76% do meio) deve ser totalmente vazio e transparente.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE e centro vazio. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `frame-gold` — Moldura dourada

- Arquivo: `frame-gold.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE e centro vazio
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Moldura QUADRADA dourada ornamentada, estilo vitoriano, com cantos trabalhados, ocupando no máximo 10% da largura em cada lado. Interior totalmente vazio e transparente.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE e centro vazio. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `frame-neon` — Moldura neon

- Arquivo: `frame-neon.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE e centro vazio
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Moldura QUADRADA de tubo de luz neon em ciano e magenta, com brilho suave (glow), cantos arredondados, ocupando no máximo 8% da largura em cada lado. Interior totalmente vazio e transparente.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE e centro vazio. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

#### `frame-tape` — Fita adesiva

- Arquivo: `frame-tape.png` · 1024 × 1024 px (quadrado) · PNG com fundo TRANSPARENTE e centro vazio
- Usado por: nenhum modelo por padrão (disponível para você escolher na aba Moldura)

```text
Quatro pedaços de fita adesiva washi (listrada, em tons pastel) colados nos quatro cantos de uma área quadrada como se prendessem uma foto, ligeiramente inclinados. Todo o resto vazio e transparente.
Formato: 1024 × 1024 px (quadrado), PNG com fundo TRANSPARENTE e centro vazio. Sem texto, letras, números, logotipos, marca d'água ou QR Code.
```

## Checklist de conferência

- [ ] Nenhuma imagem tem texto, números, logotipo ou QR Code.
- [ ] Fundos (`bg-`) sem transparência e com o centro calmo.
- [ ] Ornamentos e molduras com transparência real (abra no navegador sobre fundo escuro: não pode haver quadrado branco/verde atrás).
- [ ] Nomes exatamente iguais aos ids, em minúsculas.
- [ ] No app: aba **Moldura → Recarregar artes** mostra "32 de 32 artes encontradas".
- [ ] Teste um modelo com cada arte e confira que o chip da prévia continua dizendo **✓ lê corretamente**.

