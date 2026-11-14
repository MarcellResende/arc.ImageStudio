/* arc.Studio — tool catalog: the single source of truth for navigation.

   To add a tool:
     1. add an entry here (status 'ready' once it exists, 'soon' while it is only announced);
     2. for a ready tool, add <section id="<id>-view" class="tool-view hidden"> in index.html;
     3. add its icon as a <symbol id="i-<icon>"> in the sprite.
   A 'soon' tool has no view and no code: it only appears in the menu, labelled "Em breve". */
(function register(root) {
  const catalog = [
    {
      id: 'image', label: 'Imagem', icon: 'image',
      tools: [
        { id: 'compressor', label: 'Compressor', icon: 'compress', status: 'ready', summary: 'Reduzir o peso dos arquivos', description: 'Reduz o peso de JPG e PNG em lote, sem enviar nada para a internet.' },
        { id: 'resizer', label: 'Resizer', icon: 'resize', status: 'ready', summary: 'Alterar dimensões', description: 'Redimensione por pixels, porcentagem ou formatos prontos para redes sociais.' },
        { id: 'converter', label: 'Conversor', icon: 'convert', status: 'ready', summary: 'Trocar de formato', description: 'Converta para JPG, PNG, WebP ou AVIF com controle de qualidade e transparência.' },
        { id: 'renamer', label: 'Renomeador', icon: 'rename', status: 'ready', summary: 'Nomes em lote', description: 'Aplique padrões, numeração e substituições, vendo o resultado antes de salvar.' },
        { id: 'metadata', label: 'Metadados', icon: 'shield', status: 'ready', summary: 'Proteger a privacidade', description: 'Inspecione e remova EXIF, localização e rastros de IA sem alterar a imagem.' }
      ]
    },
    {
      id: 'ai', label: 'IA', icon: 'sparkles',
      tools: [
        { id: 'prompt-gen', label: 'Prompt Gen', icon: 'sparkles', status: 'ready', summary: 'Montar prompts estruturados', title: 'Prompt Gen', description: 'Transforma uma ideia em um prompt estruturado, com contexto, formato e critérios, tudo no seu computador e sem usar outra IA.' },
        { id: 'claude-md', label: 'CLAUDE.md', icon: 'file-text', status: 'ready', summary: 'Criar instruções para projetos', title: 'CLAUDE.md', description: 'Analisa a pasta do projeto e monta o CLAUDE.md com o que encontrou, o que você informar e boas premissas, tudo no seu computador.' }
      ]
    },
    {
      id: 'pdf', label: 'PDF', icon: 'file-text',
      tools: [
        { id: 'pdf-compressor', label: 'Compressor', icon: 'compress', status: 'soon', summary: 'Reduzir o peso de PDFs' },
        { id: 'pdf-converter', label: 'Conversor', icon: 'convert', status: 'soon', summary: 'Converter de e para PDF' },
        { id: 'pdf-merge', label: 'Mesclar', icon: 'merge', status: 'soon', summary: 'Juntar vários PDFs' },
        { id: 'pdf-split', label: 'Dividir', icon: 'split', status: 'soon', summary: 'Separar páginas' }
      ]
    },
    {
      id: 'video', label: 'Vídeo', icon: 'video',
      tools: [
        { id: 'video-compressor', label: 'Compressor', icon: 'compress', status: 'soon', summary: 'Reduzir o peso de vídeos' },
        { id: 'video-converter', label: 'Conversor', icon: 'convert', status: 'soon', summary: 'Trocar de formato' },
        { id: 'video-audio', label: 'Extrair Áudio', icon: 'audio', status: 'soon', summary: 'Separar a trilha de áudio' }
      ]
    },
    {
      id: 'audio', label: 'Áudio', icon: 'audio',
      tools: [
        { id: 'audio-converter', label: 'Conversor', icon: 'convert', status: 'soon', summary: 'Trocar de formato' },
        { id: 'audio-compressor', label: 'Compressor', icon: 'compress', status: 'soon', summary: 'Reduzir o peso de áudios' },
        { id: 'audio-metadata', label: 'Editor de Metadados', icon: 'tag', status: 'soon', summary: 'Editar tags e capa' }
      ]
    },
    {
      id: 'utilities', label: 'Utilitários', icon: 'grid',
      tools: [
        { id: 'receiver', label: 'Receber', icon: 'wifi', status: 'ready', summary: 'Do celular para o PC pelo Wi-Fi', title: 'Receber arquivos', description: 'Transfira do celular pela mesma rede Wi-Fi, com os bytes e a qualidade original preservados.' },
        { id: 'sender', label: 'Enviar', icon: 'send', status: 'ready', summary: 'Do PC para outro dispositivo', title: 'Enviar arquivos', description: 'Compartilhe do PC para outro dispositivo pela rede local, sem reduzir a qualidade ou alterar os bytes.' },
        { id: 'qr-generator', label: 'Gerador de QR Code', icon: 'qr', status: 'ready', summary: 'Criar códigos QR personalizados', title: 'Gerador de QR Code', description: 'Crie QR Codes de links, Wi-Fi, contatos, Pix e mais, com formas, cores, logo, molduras e modelos prontos. Tudo no seu computador.' },
        { id: 'file-hash', label: 'Hash de Arquivos', icon: 'hash', status: 'ready', summary: 'Calcular e verificar hashes', title: 'Hash de Arquivos', description: 'Calcule CRC32, MD5, SHA-1, SHA-256, SHA-384 e SHA-512 de arquivos e pastas, compare com o hash publicado e verifique arquivos de checksums.' },
        { id: 'unit-converter', label: 'Conversor de Unidades', icon: 'ruler', status: 'ready', summary: 'Converter medidas', title: 'Conversor de Unidades', description: 'Converta comprimento, massa, temperatura, área, volume, velocidade, tempo, dados, energia e mais, com expressões e todas as unidades de uma vez.' }
      ]
    }
  ];

  root.ARC_CATALOG = catalog;
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
}(typeof globalThis !== 'undefined' ? globalThis : this));
