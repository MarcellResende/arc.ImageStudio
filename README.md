<p align="center">
  <img src="src/renderer/assets/logos/logo.png" alt="arc.Studio" width="520">
</p>

# arc.Studio

Plataforma para Windows que reúne ferramentas locais organizadas por categoria. Hoje a categoria **Imagem** está completa: compressor, resizer, conversor de formatos, renomeador, limpeza de metadados e transferência de arquivos pela rede local. Na categoria **IA** já existe o **Prompt Gen**. PDF, Vídeo, Áudio e Utilitários têm lugar na navegação e o que ainda não existe aparece como **Em breve**. Todo o processamento é local: nenhum arquivo é enviado para a internet.

## Como usar

Na barra superior, escolha uma **categoria** (Imagem, IA, PDF, Vídeo, Áudio ou Utilitários). Cada categoria abre um menu com suas ferramentas; as que ainda não existem aparecem marcadas como **Em breve** e não fazem nada. Depois de escolher, a faixa ao lado do título troca rapidamente entre as ferramentas da mesma categoria. Atalhos: **Ctrl + 1…9** abre a n-ésima ferramenta da categoria atual; **← →** e **↓** navegam pelos menus; **Esc** fecha.

Em qualquer ferramenta, também é possível copiar uma imagem ou captura de tela e pressionar **Ctrl + V** dentro do arc.Studio. A imagem será adicionada diretamente ao lote da aba aberta, inclusive quando foi copiada como arquivo pelo Explorador do Windows.

### Compressor

1. Selecione imagens JPG, JPEG ou PNG — ou uma pasta completa.
2. Escolha **Sem perda** para preservar todos os pixels ou **Redução forte** para arquivos menores com alta qualidade.
3. Defina a pasta de saída e clique em **Otimizar imagens**.

### Resizer

1. Selecione as imagens ou uma pasta completa.
2. Escolha como redimensionar:
   - **Dimensões:** informe largura e altura em pixels.
   - **Porcentagem:** reduza ou amplie em relação ao tamanho original.
   - **Redes sociais:** use formatos prontos para Instagram, Facebook, X, TikTok, LinkedIn e YouTube.
3. Use o controle de proporção para preservar a imagem sem deformação ou liberar largura e altura independentes.
4. Clique em **Redimensionar**.

### Conversor

1. Selecione imagens JPG, JPEG, PNG, WebP, AVIF, TIFF ou SVG — ou uma pasta completa.
2. Escolha o formato de saída: **JPG**, **PNG**, **WebP** ou **AVIF**.
3. Ajuste a qualidade quando o formato permitir. Para WebP e AVIF, também é possível ativar o modo sem perda.
4. Se converter transparência para JPG, escolha a cor usada no fundo.
5. Decida se deseja preservar o perfil de cores e copiar os metadados do arquivo original.
6. Clique em **Converter imagens**.

### Renomeador em lote

1. Selecione imagens ou uma pasta completa. JPG, JPEG, PNG, WebP, AVIF, TIFF e SVG são aceitos.
2. Monte o padrão usando texto e os tokens **`{nome}`**, **`{n}`**, **`{data}`** e **`{hora}`**.
3. Se quiser, combine prefixo, sufixo, busca e substituição, numeração e transformação de maiúsculas/minúsculas.
4. Confira o preview dos nomes antes de aplicar. Caracteres inválidos e nomes repetidos são ajustados automaticamente.
5. Escolha entre **Criar cópias renomeadas**, que preserva os originais, ou **Renomear os originais**, que altera apenas os nomes nos locais atuais.
6. Clique em **Criar cópias renomeadas** ou **Renomear originais**.

Ao renomear os originais, o ARC utiliza uma etapa temporária segura para permitir trocas de nomes e evitar sobrescritas. Se algo falhar antes da conclusão, ele tenta restaurar os nomes anteriores.

### Limpeza de metadados

1. Selecione imagens JPG, JPEG ou PNG — ou uma pasta completa.
2. Selecione uma imagem do lote para consultar todos os metadados encontrados, organizados por grupo e com pesquisa por nome ou valor.
3. Confira o resumo de origem: localização GPS, dispositivo, data, software e possíveis sinais de geração por inteligência artificial.
4. Mantenha **Preservar perfil de cores** ativado para proteger a privacidade sem alterar a aparência das cores.
5. Clique em **Limpar todos os metadados**. O app verifica o arquivo final, confirma quando rastros de IA foram removidos e neutraliza nomes de arquivo que revelem diretamente geradores como ChatGPT, Gemini ou Midjourney.

O diagnóstico de IA utiliza informações presentes no próprio arquivo, como Content Credentials/C2PA, `DigitalSourceType`, software gerador, prompts e parâmetros. A ausência desses sinais não comprova que uma imagem não foi gerada por IA, pois metadados podem ser removidos.

Se EXIF, GPS ou modelo da câmera já não existirem, o painel explica isso claramente. Serviços como WhatsApp e redes sociais podem reprocessar a imagem e apagar esses dados antes do download; o arc.Studio consegue ler e limpar o que ainda existe, mas não reconstruir informações já removidas. Para tentar preservar o arquivo original durante uma transferência, envie a foto como documento/arquivo.

### Receber arquivos pelo Wi-Fi

1. Conecte o computador e o celular à mesma rede Wi-Fi.
2. Abra **Receber** e escolha a pasta de destino.
3. Clique em **Iniciar recebimento** e escaneie o QR Code com a câmera do celular.
4. Na página aberta no celular, escolha fotos, vídeos, documentos ou outros arquivos e aguarde a conclusão.
5. Encerre a sessão quando terminar.

O envio copia os bytes originais diretamente para o disco, sem recompressão, mudança de formato ou upload para a internet. Cada sessão usa um endereço com chave aleatória, aceita conexões apenas da rede local e deixa de funcionar assim que for encerrada. O Windows pode solicitar autorização de firewall na primeira utilização; permita o acesso em redes privadas para que o celular encontre o computador.

### Enviar arquivos pelo Wi-Fi

1. Abra **Enviar** e selecione arquivos ou arraste arquivos e pastas para a área indicada.
2. Clique em **Iniciar envio** para criar uma sessão temporária.
3. Escaneie o QR Code no celular, tablet ou outro computador conectado à mesma rede — ou copie o endereço exibido.
4. No outro dispositivo, baixe arquivos individualmente ou use **Baixar tudo** para receber um único ZIP.
5. Mantenha o ARC aberto até os downloads terminarem e encerre a sessão quando concluir.

O ZIP de **Baixar tudo** apenas agrupa os arquivos: as mídias são armazenadas com os bytes originais, sem recompressão ou redução de qualidade.

Os downloads usam o conteúdo binário original, com suporte a intervalos de bytes para arquivos grandes e navegadores de mídia. O ARC não recodifica fotos ou vídeos e não utiliza WhatsApp, nuvem, CDN ou servidor externo. A página de download e todos os recursos necessários são servidos diretamente pelo computador.

Cada execução que gera novos arquivos cria uma subpasta exclusiva, como `Lote 2026-11-05 14-30-12`, `Redimensionado 2026-11-05 14-30-12`, `Convertido 2026-11-05 14-30-12`, `Renomeado 2026-11-05 14-30-12` ou `Metadados removidos 2026-11-05 14-30-12`. Ao terminar, o app mostra o caminho completo e oferece um botão para abrir a pasta.

### Prompt Gen

Monta um prompt bem estruturado a partir de uma ideia, **sem usar outra IA e sem enviar nada para a internet**. O motor (`src/renderer/prompt-engine.js`) é local e determinístico: o mesmo pedido gera sempre o mesmo prompt.

1. **Detecta o tipo de tarefa** (15 tipos: escrever código, corrigir erro, revisar código, explicar, escrever texto, reescrever, resumir, traduzir, analisar, extrair dados, planejar, gerar ideias, responder, prompt de imagem, geral) por palavras-chave ponderadas, e você pode trocar o tipo.
2. **Extrai sinais do seu texto**: formato pedido (JSON, tabela, tópicos…), tamanho ("até 120 palavras", "entre 100 e 200"), público, tom, idioma da resposta ou de destino, linguagens de programação.
3. **Monta o prompt** com papel, contexto, tarefa, material de entrada delimitado, restrições, como proceder, formato da resposta, exemplos, critérios de sucesso, política para informação faltante e conferência final. Tudo o que o motor acrescenta sozinho aparece como "automático"; o que você preenche sempre vence.
4. **Três estruturas** (XML, Markdown, texto simples), ordem adaptada ao modelo (Claude e Gemini: material antes, tarefa por último) e prompt em português ou inglês.
5. **Avalia a qualidade** (0–100) com checklist: objetivo claro, contexto, formato, restrições, público/tom, material, critérios, termos vagos, contradições e lacunas por preencher; sugere "o que perguntar a si mesmo" e leva direto ao campo a melhorar.
6. **Protege você**: avisa sobre dados sensíveis (e-mail, CPF, CNPJ, telefone, cartão válido por Luhn, chaves de API, senhas, chaves privadas) sem repetir o valor; delimita o material colado e instrui a IA a tratá-lo só como dado; texto digitado não consegue fechar a própria seção XML.

7. **Anexa arquivos e pastas** (botões Arquivos/Pasta ou arrastar): código, textos e configurações são lidos localmente e entram no prompt com resumo (linhas, linguagens, tecnologias detectadas), estrutura de pastas e conteúdo, dentro de um limite de tokens que você escolhe (do "só listar" a ≈ 128 mil). Os arquivos mais importantes entram primeiro e nenhum arquivo sozinho consome todo o limite. Imagens e binários só são listados; `.env`, chaves e senhas **nunca** são lidos; `node_modules`, `.git`, builds e arquivos gerados são ignorados; links simbólicos não são seguidos. Os anexos não são gravados pelo aplicativo.
8. **Restaurar padrão** (barra inferior) volta às configurações mais comuns: ChatGPT, mensagem de texto simples, em português.

Copiar (Ctrl + Enter) ou salvar como `.md`/`.txt` (UTF-8, sem BOM). O motor organiza o que você escreveu e preenche lacunas com padrões do tipo de tarefa; ele **não entende** o assunto, e por isso mostra o que deduziu para você corrigir.

## Recursos

- Processamento de até quatro imagens simultaneamente.
- Conversão em lote de JPG, JPEG, PNG, WebP, AVIF, TIFF e SVG para JPG, PNG, WebP ou AVIF.
- Controle de qualidade, modo sem perda, fundo para JPG, perfil de cores e cópia opcional de metadados.
- Preview grande da imagem selecionada e atualização imediata do formato de destino.
- Renomeação em lote com preview instantâneo, tokens de nome, data, hora e sequência numérica.
- Prefixo, sufixo, busca e substituição, controle de caixa e proteção automática contra nomes inválidos ou repetidos.
- Escolha entre cópias organizadas em nova pasta ou renomeação transacional dos arquivos originais.
- Presets para posts, capas, perfis, anúncios, stories, reels, shorts e thumbnails.
- Preview grande e selecionável no resizer, com miniaturas leves no compressor.
- Simulação instantânea do resultado no preview ao alterar dimensões, proporção ou preset.
- Análise e remoção em lote de EXIF, localização, câmera, XMP, IPTC, comentários, software gerador, prompts e Content Credentials/C2PA.
- Inspetor completo de EXIF, GPS, IPTC, XMP, ICC, dados do fabricante, Photoshop, JFIF e estruturas específicas de cada formato.
- Diagnóstico de origem com evidências de IA, dispositivo, software, autor, data e coordenadas, além de aviso quando o arquivo já chegou sem EXIF.
- Verificação posterior da remoção de rastros de IA no arquivo resultante.
- Pesquisa e filtros por grupos de metadados.
- Opção de preservar o perfil de cores durante a limpeza de metadados.
- Alta qualidade para JPG e PNG.
- Navegação por categorias com menus, preparada para novas ferramentas; o lote de cada ferramenta é preservado ao trocar de aba.
- Preferências salvas entre uma abertura e outra: pasta de cada ferramenta, pasta de recebimento, opções (nível de compressão, formato e qualidade, modo do resizer, padrão do renomeador, perfil de cores), última ferramenta usada e tamanho da janela. Ficam em `%APPDATA%\arc.Studio\settings.json`, fora da pasta do programa, e sobrevivem a atualizações. No Prompt Gen são salvos as opções e o rascunho (pedido, contexto, papel, público, restrições e critérios); o **material colado e os exemplos nunca são gravados**. Não são salvos: o modo "renomear originais" (destrutivo) e textos específicos de cada lote.
- Ao fechar o aplicativo, as sessões de Receber e Enviar são encerradas: as portas fecham, transferências em andamento são interrompidas e arquivos parciais são apagados. Apenas uma janela do arc.Studio pode ficar aberta por vez.
- Recebimento de qualquer tipo de arquivo do celular pelo Wi-Fi, com QR Code, progresso real e verificação SHA-256.
- Transferência binária sem recompressão, nomes preservados e proteção automática contra sobrescrita.
- Envio de arquivos do PC para celulares, tablets e outros computadores por QR Code ou endereço local.
- Downloads com bytes originais, nomes preservados, progresso real e suporte a retomada por intervalos.
- Funcionamento offline e originais protegidos.
- Atualizações pelo próprio aplicativo: ele consulta os releases públicos do GitHub e instala uma versão nova com um clique.

## Adicionar uma nova ferramenta

A navegação é gerada por `src/renderer/catalog.js`:

1. Inclua a ferramenta na categoria certa (`status: 'soon'` enquanto for só um anúncio; `'ready'` quando existir).
2. Para uma ferramenta `ready`, crie `<section id="<id>-view" class="tool-view hidden">` em `index.html` (o título e a descrição vêm do catálogo).
3. Se precisar de um ícone novo, adicione `<symbol id="i-<nome>">` ao sprite.

Ferramentas `soon` não têm tela nem código: aparecem apenas no menu, com a etiqueta "Em breve".

## Desenvolvimento

Requer [Node.js](https://nodejs.org/) 22 ou superior.

```powershell
npm install
npm start
```

Para testar e gerar o instalador do Windows:

```powershell
npm test
npm run dist
```

O instalador será criado na pasta `release`.

## Publicar uma atualização

O aplicativo procura releases públicos em `MarcellResende/arc.ImageStudio` (se o repositório for renomeado no GitHub, atualize `build.publish.repo` no `package.json`). O `appId` (`com.arc.imagestudio`) foi mantido de propósito: é o identificador interno do instalador, e mudá-lo faria o Windows tratar o arc.Studio como outro programa, deixando a versão antiga instalada ao lado da nova. Para publicar corretamente, atualize o campo `version` do `package.json`, faça o commit e envie uma tag com a mesma versão:

```powershell
git tag v<versão>
git push origin v<versão>
```

O workflow do GitHub executa os testes, cria o instalador NSIS e publica automaticamente o `.exe`, o `.blockmap` e o `latest.yml` no release. Esses três arquivos precisam ser gerados juntos; não substitua apenas o instalador manualmente.

## Licença

Distribuído sob a licença MIT.
