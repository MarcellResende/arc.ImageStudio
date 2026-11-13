/* arc.Studio — CLAUDE.md engine.

   Turns FACTS about a project (from project-analyzer.mjs: stack, commands, structure, tests, style, CI…)
   plus what the user typed into a CLAUDE.md. It is local and deterministic and uses no AI.
   When the user gives nothing, sensible DEFAULT PREMISES fill the "how to work here" section (each one can be switched off).
   Every section reports where it came from: detected in the project, informed by the user, or a default premise.

   Works in the browser (globalThis.ArcClaudeMd) and in Node (module.exports) for tests. */
(function register(root) {
  'use strict';

  const trim = (value) => String(value ?? '').trim();
  const lines = (text) => String(text ?? '').split(/\r?\n/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  const unique = (items) => [...new Set(items)];

  const PURPOSE_LABEL = {
    pt: { install: 'instalar dependências', dev: 'rodar em desenvolvimento', start: 'executar', build: 'gerar o build', test: 'rodar os testes', lint: 'verificar o estilo', format: 'formatar o código', typecheck: 'checar tipos', package: 'gerar o instalador/pacote' },
    en: { install: 'install dependencies', dev: 'run in development', start: 'run', build: 'build', test: 'run the tests', lint: 'check style', format: 'format the code', typecheck: 'type-check', package: 'build the installer/package' }
  };
  const ROLE = {
    pt: { source: 'código-fonte', 'library code': 'código de biblioteca', 'application code': 'código da aplicação', 'core logic': 'lógica central', tests: 'testes', 'end-to-end tests': 'testes de ponta a ponta', documentation: 'documentação', 'utility scripts': 'scripts utilitários', tooling: 'ferramentas', executables: 'executáveis', 'static files': 'arquivos estáticos', assets: 'recursos', configuration: 'configuração', 'database migrations': 'migrações do banco', 'UI components': 'componentes de interface', 'pages/routes': 'páginas e rotas', routes: 'rotas', API: 'API', controllers: 'controllers', 'data models': 'modelos de dados', services: 'serviços', utilities: 'utilitários', helpers: 'auxiliares', 'type definitions': 'definições de tipos', styles: 'estilos', hooks: 'hooks', 'state store': 'estado global', middleware: 'middleware', views: 'views', templates: 'templates', 'test fixtures': 'dados de teste', examples: 'exemplos', 'monorepo packages': 'pacotes do monorepo', 'monorepo apps': 'aplicações do monorepo', 'UI process (renderer)': 'interface (processo renderer)', 'main process': 'processo principal', 'preload bridge': 'ponte preload', 'bundled third-party': 'binários/terceiros incluídos', 'build resources': 'recursos de build', 'GitHub config and workflows': 'configuração e workflows do GitHub', 'editor settings': 'configuração do editor' },
    en: {}
  };

  /* Premises used when the user says nothing. Each can be switched off. */
  const PREMISES = [
    { id: 'read-first', pt: 'Leia o código relacionado antes de editar e confirme que arquivos, funções e flags existem antes de citá-los.', en: 'Read the related code before editing, and confirm that files, functions and flags exist before citing them.' },
    { id: 'match-style', pt: 'Siga o estilo e as convenções que já existem no código em vez de impor novos.', en: 'Follow the style and conventions already in the code instead of imposing new ones.' },
    { id: 'small-diffs', pt: 'Prefira mudanças pequenas e focadas. Não refatore nem "melhore" o que não foi pedido.', en: 'Prefer small, focused changes. Do not refactor or "improve" what was not asked.' },
    { id: 'verify', pt: 'Antes de dar uma tarefa como concluída, rode os testes e verificações relevantes e diga claramente o que foi e o que não foi verificado.', en: 'Before calling a task done, run the relevant tests and checks and say clearly what was and was not verified.' },
    { id: 'tests-with-code', pt: 'Ao corrigir um bug ou mudar um comportamento, adicione ou atualize testes quando o projeto já tiver testes.', en: 'When fixing a bug or changing behaviour, add or update tests if the project already has tests.' },
    { id: 'ask-destructive', pt: 'Pergunte antes de ações destrutivas ou difíceis de reverter (apagar, sobrescrever, force-push, migrações).', en: 'Ask before destructive or hard-to-reverse actions (deleting, overwriting, force-push, migrations).' },
    { id: 'no-deps', pt: 'Não adicione dependências novas sem perguntar; prefira o que o projeto já usa.', en: 'Do not add new dependencies without asking; prefer what the project already uses.' },
    { id: 'no-commit', pt: 'Não faça commit, push nem publique sem pedido explícito.', en: 'Do not commit, push or publish without an explicit request.' },
    { id: 'no-docs', pt: 'Não crie arquivos de documentação (README, .md) a menos que eu peça.', en: 'Do not create documentation files (README, .md) unless asked.' },
    { id: 'no-secrets', pt: 'Nunca coloque segredos em código ou logs, e não leia nem altere arquivos .env.', en: 'Never put secrets in code or logs, and do not read or modify .env files.' },
    { id: 'honest', pt: 'Se não souber ou não conseguir verificar algo, diga. Não invente APIs, caminhos ou resultados.', en: 'If you do not know or cannot verify something, say so. Do not invent APIs, paths or results.' },
    { id: 'concise', pt: 'Respostas objetivas: diga o que mudou e por quê em poucas linhas, sem repetir o código inteiro.', en: 'Keep answers concise: say what changed and why in a few lines, without repeating all the code.' },
    { id: 'language', pt: 'Responda no mesmo idioma em que eu escrever.', en: 'Answer in the same language I write in.' }
  ];

  const L = {
    pt: {
      stack: 'Stack', overview: 'Visão geral', commands: 'Comandos', structure: 'Estrutura do projeto', architecture: 'Arquitetura', conventions: 'Convenções de código', testing: 'Testes', workflow: 'Fluxo de trabalho (git e CI)',
      security: 'Segurança', env: 'Variáveis de ambiente', gotchas: 'Atenção', collab: 'Como trabalhar neste projeto', existing: 'Notas anteriores (do CLAUDE.md que já existia)',
      files: 'arquivos', always: 'Sempre', never: 'Nunca', detected: 'Detectado a partir do projeto',
      noPurpose: 'Descreva aqui, em uma ou duas frases, o objetivo do projeto e para quem ele é.'
    },
    en: {
      stack: 'Stack', overview: 'Overview', commands: 'Commands', structure: 'Project structure', architecture: 'Architecture', conventions: 'Code conventions', testing: 'Testing', workflow: 'Workflow (git and CI)',
      security: 'Security', env: 'Environment variables', gotchas: 'Heads-up', collab: 'How to work in this project', existing: 'Previous notes (from the existing CLAUDE.md)',
      files: 'files', always: 'Always', never: 'Never', detected: 'Detected from the project',
      noPurpose: 'Describe here, in one or two sentences, what the project is for and who it is for.'
    }
  };

  function parseCommandLines(text) {
    return lines(text).map((line) => {
      const match = /^(.{1,40}?)\s*[:=]\s+(.+)$/.exec(line);
      if (match && !/^(npm|npx|yarn|pnpm|node|python|pip|cargo|go|make|docker|git|dotnet|mvn|\.\/)/i.test(match[1])) return { purpose: match[1].trim(), command: match[2].trim().replace(/^`|`$/g, '') };
      return { purpose: '', command: line.replace(/^`|`$/g, '') };
    });
  }

  function commandBlock(entries) {
    const width = Math.min(34, Math.max(...entries.map((entry) => entry.command.length)) + 2);
    return `\`\`\`bash\n${entries.map((entry) => (entry.comment ? `${entry.command.padEnd(width)}# ${entry.comment}` : entry.command)).join('\n')}\n\`\`\``;
  }

  function generate(factsInput, rawInput = {}) {
    const facts = factsInput && typeof factsInput === 'object' ? factsInput : null;
    const input = { ...rawInput };
    const lang = input.language === 'en' ? 'en' : 'pt';
    const t = L[lang];
    const detail = ['compact', 'standard', 'detailed'].includes(input.detail) ? input.detail : 'standard';
    const off = new Set(Array.isArray(input.premisesOff) ? input.premisesOff : []);
    const sections = [];
    const add = (id, title, body, source) => { if (trim(body)) sections.push({ id, title, body: trim(body), source }); };
    const count = (n) => `${n} ${n === 1 ? (lang === 'pt' ? 'arquivo' : 'file') : (lang === 'pt' ? 'arquivos' : 'files')}`;
    const roleOf = (role) => (lang === 'pt' ? (ROLE.pt[role] || role) : role);
    const ecosystem = facts?.ecosystems?.[0];
    const name = trim(input.name) || (facts?.readme?.title && facts.readme.title.length <= 60 ? facts.readme.title : '') || facts?.name || (lang === 'pt' ? 'Projeto' : 'Project');

    /* ── overview ── */
    const purpose = trim(input.purpose);
    const detectedPurpose = trim(ecosystem?.description) || trim(facts?.readme?.summary);
    const stackNames = unique([...(facts?.ecosystems || []).filter((item) => item.id !== 'make').map((item) => item.name), ...(facts?.frameworks || []), ...(facts?.languages || []).slice(0, 3).map((item) => item.name)]).slice(0, 8);
    const overview = [purpose || detectedPurpose || t.noPurpose];
    if (trim(input.audience)) overview.push(lang === 'pt' ? `Público: ${trim(input.audience)}.` : `Audience: ${trim(input.audience)}.`);
    if (stackNames.length) overview.push(`**${t.stack}:** ${stackNames.join(', ')}.`);
    if (facts?.license) overview.push(`${lang === 'pt' ? 'Licença' : 'License'}: ${facts.license}.`);
    add('overview', t.overview, overview.join('\n\n'), purpose ? 'user' : detectedPurpose ? 'detected' : 'default');

    /* ── commands ── */
    const userCommands = parseCommandLines(input.commands);
    const detectedCommands = (facts?.commands || []).map((entry) => ({ command: entry.command, comment: PURPOSE_LABEL[lang][entry.purpose] || entry.purpose }));
    const makeTargets = facts?.ecosystems?.find((item) => item.id === 'make')?.targets;
    const commandEntries = [
      ...userCommands.map((entry) => ({ command: entry.command, comment: entry.purpose })),
      ...detectedCommands.filter((entry) => !userCommands.some((user) => user.command === entry.command))
    ];
    if (makeTargets?.length && detail !== 'compact') commandEntries.push({ command: `make <${lang === 'pt' ? 'alvo' : 'target'}>`, comment: `${lang === 'pt' ? 'alvos' : 'targets'}: ${makeTargets.slice(0, 6).join(', ')}` });
    if (commandEntries.length) add('commands', t.commands, commandBlock(commandEntries), userCommands.length ? (detectedCommands.length ? 'mixed' : 'user') : 'detected');

    /* ── structure ── */
    if (facts?.directories?.length) {
      const limit = detail === 'compact' ? 5 : detail === 'standard' ? 9 : 14;
      const out = [];
      for (const directory of facts.directories.slice(0, limit)) {
        const role = directory.role ? roleOf(directory.role) : (directory.languages?.[0] || '');
        out.push(`- \`${directory.path}\`${role ? ` — ${role}` : ''} (${count(directory.files)})`);
        if (detail === 'detailed') for (const child of directory.children.slice(0, 5)) out.push(`  - \`${child.name}\`${child.role ? ` — ${roleOf(child.role)}` : ''}`);
      }
      const roots = (facts.rootFiles || []).filter((file) => /^(package\.json|pyproject\.toml|cargo\.toml|go\.mod|pom\.xml|dockerfile|makefile|readme\.md|tsconfig\.json)$/i.test(file));
      if (roots.length && detail !== 'compact') out.push(`- ${lang === 'pt' ? 'Na raiz' : 'At the root'}: ${roots.map((file) => `\`${file}\``).join(', ')}`);
      add('structure', t.structure, out.join('\n'), 'detected');
    }

    /* ── architecture ── */
    const architecture = [];
    if (facts) {
      if (facts.frameworks?.includes('Electron')) {
        const main = ecosystem?.main || facts.entryPoints?.[0];
        const preload = facts.electron?.find((item) => item.label === 'preload')?.path;
        const renderer = facts.electron?.find((item) => item.label === 'renderer')?.path;
        architecture.push(lang === 'pt'
          ? `App Electron${main ? `: processo principal em \`${main}\`` : ''}${preload ? `, ponte \`${preload}\` (contextBridge)` : ''}${renderer ? `, interface em \`${renderer}\`` : ''}. Mantenha isolamento de contexto e a comunicação via IPC explícito entre a interface e o processo principal.`
          : `Electron app${main ? `: main process in \`${main}\`` : ''}${preload ? `, bridge \`${preload}\` (contextBridge)` : ''}${renderer ? `, UI in \`${renderer}\`` : ''}. Keep context isolation and explicit IPC between the UI and the main process.`);
      } else if (facts.entryPoints?.length) {
        architecture.push(lang === 'pt' ? `Ponto(s) de entrada: ${facts.entryPoints.map((entry) => `\`${entry}\``).join(', ')}.` : `Entry point(s): ${facts.entryPoints.map((entry) => `\`${entry}\``).join(', ')}.`);
      }
      if (facts.monorepo) architecture.push(lang === 'pt' ? 'Monorepo: confira em qual pacote a mudança deve ficar e rode os comandos no pacote certo.' : 'Monorepo: check which package a change belongs to and run commands in the right package.');
      if (facts.docker) architecture.push(lang === 'pt' ? 'O projeto tem configuração Docker.' : 'The project has Docker configuration.');
    }
    const userArchitecture = trim(input.architecture);
    if (userArchitecture) architecture.push(userArchitecture);
    if (architecture.length && (detail !== 'compact' || userArchitecture)) add('architecture', t.architecture, architecture.map((item) => (item.includes('\n') ? item : `- ${item}`)).join('\n'), userArchitecture ? (facts ? 'mixed' : 'user') : 'detected');

    /* ── conventions ── */
    const style = facts?.style || {};
    const conventions = [];
    const indent = style.editorconfig ? `${style.editorconfig.indentStyle}${style.editorconfig.indentSize ? ` (${style.editorconfig.indentSize})` : ''}` : style.indent;
    const indentText = lang === 'pt' ? String(indent || '').replace(/^(\d+) spaces$/, '$1 espaços').replace(/^tab/i, 'tabs').replace(/^space/i, 'espaços') : indent;
    if (indent) conventions.push(lang === 'pt' ? `Indentação: ${indentText}.` : `Indentation: ${indent}.`);
    if (style.quotes) conventions.push(lang === 'pt' ? `Aspas ${style.quotes === 'single' ? 'simples' : 'duplas'} em JS/TS.` : `${style.quotes === 'single' ? 'Single' : 'Double'} quotes in JS/TS.`);
    if (typeof style.semicolons === 'boolean') conventions.push(lang === 'pt' ? (style.semicolons ? 'Ponto e vírgula no fim das instruções.' : 'Sem ponto e vírgula no fim das instruções.') : (style.semicolons ? 'Semicolons at the end of statements.' : 'No semicolons.'));
    if (style.modules) conventions.push(lang === 'pt' ? `Módulos: ${style.modules}.` : `Modules: ${style.modules}.`);
    if (style.fileNaming) conventions.push(lang === 'pt' ? `Nomes de arquivo em ${style.fileNaming}.` : `File names in ${style.fileNaming}.`);
    if (style.typescriptStrict) conventions.push(lang === 'pt' ? 'TypeScript em modo `strict`: não use `any` para contornar erros.' : 'TypeScript in `strict` mode: do not use `any` to silence errors.');
    if (style.lineEndings === 'CRLF') conventions.push(lang === 'pt' ? 'Finais de linha CRLF (Windows): preserve ao editar.' : 'CRLF line endings (Windows): preserve them when editing.');
    const tools = (facts?.configs || []).filter((item) => ['ESLint', 'Prettier', 'Biome', 'Ruff', 'rustfmt', 'golangci-lint', 'EditorConfig'].includes(item));
    if (tools.length) conventions.push(lang === 'pt' ? `Ferramentas de estilo configuradas: ${tools.join(', ')}. Rode-as antes de concluir.` : `Style tools configured: ${tools.join(', ')}. Run them before finishing.`);
    const userRules = lines(input.rules);
    conventions.push(...userRules);
    if (conventions.length) add('conventions', t.conventions, conventions.map((item) => `- ${item}`).join('\n'), userRules.length ? (style.sampled || tools.length ? 'mixed' : 'user') : 'detected');

    /* ── testing ── */
    const tests = facts?.tests;
    const testLines = [];
    if (tests?.frameworks?.length) testLines.push(lang === 'pt' ? `Framework: ${tests.frameworks.join(', ')}.` : `Framework: ${tests.frameworks.join(', ')}.`);
    if (tests?.locations?.length) testLines.push(`${lang === 'pt' ? 'Testes em' : 'Tests in'} ${tests.locations.map((item) => `\`${item}\``).join(', ')} (${count(tests.files)}).`);
    if (facts && !tests?.files && !tests?.frameworks?.length) testLines.push(lang === 'pt' ? 'Nenhum teste automatizado foi detectado. Ao mudar comportamento, valide manualmente e diga como foi validado.' : 'No automated tests were detected. When changing behaviour, validate manually and say how.');
    if (testLines.length) add('testing', t.testing, testLines.map((item) => `- ${item}`).join('\n'), 'detected');

    /* ── workflow: git and CI ── */
    if (detail !== 'compact') {
      const workflow = [];
      if (facts?.git?.isRepo) workflow.push(lang === 'pt' ? `Branch atual: \`${facts.git.branch || '—'}\`${facts.git.remote ? `; remoto: ${facts.git.remote}` : ''}.` : `Current branch: \`${facts.git.branch || '—'}\`${facts.git.remote ? `; remote: ${facts.git.remote}` : ''}.`);
      if (facts?.git?.conventionalCommits) workflow.push(lang === 'pt' ? 'Mensagens de commit seguem Conventional Commits (commitlint configurado).' : 'Commit messages follow Conventional Commits (commitlint configured).');
      else if (facts?.git?.isRepo) workflow.push(lang === 'pt' ? 'Mensagens de commit curtas, no imperativo, explicando o porquê da mudança.' : 'Short, imperative commit messages that explain why the change was made.');
      for (const ci of (facts?.ci || []).slice(0, 3)) {
        const triggers = [ci.onTag && (lang === 'pt' ? 'tags' : 'tags'), ci.onPush && 'push', ci.onPullRequest && 'pull request'].filter(Boolean).join(', ');
        workflow.push(`CI: \`${ci.file}\` (${ci.name}${triggers ? `; ${lang === 'pt' ? 'dispara em' : 'runs on'} ${triggers}` : ''}).${ci.onTag ? (lang === 'pt' ? ' Publicar uma tag de versão dispara um release: não crie tags sem pedido.' : ' Pushing a version tag triggers a release: do not create tags unless asked.') : ''}`);
      }
      if (trim(input.workflow)) workflow.push(...lines(input.workflow));
      if (workflow.length) add('workflow', t.workflow, workflow.map((item) => `- ${item}`).join('\n'), trim(input.workflow) ? 'mixed' : 'detected');
    }

    /* ── security and environment ── */
    const security = [];
    if (facts?.secrets?.present?.length) security.push(lang === 'pt' ? `Arquivos com segredos presentes (${facts.secrets.present.map((item) => `\`${item}\``).join(', ')}): nunca leia, imprima ou faça commit deles.` : `Secret files present (${facts.secrets.present.map((item) => `\`${item}\``).join(', ')}): never read, print or commit them.`);
    if (facts?.secrets?.present?.length && facts.hasGitignore && !facts.secrets.ignoredByGit) security.push(lang === 'pt' ? 'O `.gitignore` não cobre `.env`: sugira adicioná-lo.' : 'The `.gitignore` does not cover `.env`: suggest adding it.');
    if (security.length) add('security', t.security, security.map((item) => `- ${item}`).join('\n'), 'detected');
    if (facts?.envVariables?.length && detail !== 'compact') add('env', t.env, `${facts.envVariables.map((variable) => `\`${variable}\``).join(', ')}\n\n${lang === 'pt' ? '(apenas os nomes; os valores ficam fora do repositório)' : '(names only; values stay out of the repository)'}`, 'detected');

    /* ── gotchas ── */
    const gotchas = lines(input.gotchas);
    if (facts?.limitReached) gotchas.push(lang === 'pt' ? 'A análise atingiu o limite de arquivos: a estrutura acima pode estar incompleta.' : 'The analysis reached the file limit: the structure above may be incomplete.');
    if (gotchas.length) add('gotchas', t.gotchas, gotchas.map((item) => `- ${item}`).join('\n'), lines(input.gotchas).length ? 'user' : 'detected');

    /* ── how to work (user rules + default premises) ── */
    const never = lines(input.prohibitions);
    const premises = PREMISES.filter((premise) => !off.has(premise.id));
    const collab = [];
    if (never.length) collab.push(`**${t.never}:**\n${never.map((item) => `- ${item}`).join('\n')}`);
    const alwaysUser = lines(input.workPreferences);
    const premiseList = [...alwaysUser, ...premises.map((premise) => premise[lang])];
    if (premiseList.length) collab.push(`${never.length || alwaysUser.length ? `**${t.always}:**\n` : ''}${premiseList.map((item) => `- ${item}`).join('\n')}`);
    if (collab.length) add('collab', t.collab, collab.join('\n\n'), (never.length || alwaysUser.length) ? (premises.length ? 'mixed' : 'user') : 'default');

    /* ── existing instructions ── */
    const existing = trim(facts?.existing?.claude);
    if (existing && input.includeExisting !== false) {
      const demoted = existing.replace(/^(#{1,4})\s/gm, (_, hashes) => `${hashes}### `.replace(/#+### /, `${'#'.repeat(Math.min(6, hashes.length + 2))} `));
      add('existing', t.existing, demoted, 'user');
    }

    const body = sections.map((section) => `## ${section.title}\n\n${section.body}`).join('\n\n');
    const markdown = `# ${name}\n\n${body}\n`;
    const lineCount = markdown.split('\n').length - 1;

    return {
      markdown, name, sections: sections.map((section) => ({ id: section.id, title: section.title, source: section.source, lines: section.body.split('\n').length })),
      stats: { lines: lineCount, chars: markdown.length, tokens: Math.ceil(markdown.length / 3.8) },
      premises: PREMISES.map((premise) => ({ id: premise.id, text: premise[lang], on: !off.has(premise.id) })),
      analysis: analyze(facts, input, sections, lineCount, detail),
      existing: { claude: Boolean(existing), agents: Boolean(facts?.existing?.agents), cursorrules: Boolean(facts?.existing?.cursorrules), copilot: Boolean(facts?.existing?.copilot) }
    };
  }

  function analyze(facts, input, sections, lineCount, detail) {
    const has = (id) => sections.some((section) => section.id === id);
    const userGave = (key) => Boolean(trim(input[key]));
    const items = [];
    const questions = [];
    const push = (id, label, weight, status, detail_, field) => items.push({ id, label, weight, status, detail: detail_, field });

    const purposeOk = userGave('purpose');
    const detectedPurpose = Boolean(trim(facts?.ecosystems?.[0]?.description) || trim(facts?.readme?.summary));
    push('purpose', 'Objetivo do projeto', 20, purposeOk ? 'ok' : detectedPurpose ? 'auto' : 'missing', purposeOk ? 'Informado por você.' : detectedPurpose ? 'Tirado do README/manifesto. Confirme ou reescreva.' : 'Sem objetivo: escreva uma ou duas frases.', 'purpose');
    push('commands', 'Comandos', 20, has('commands') ? (userGave('commands') ? 'ok' : 'auto') : 'missing', has('commands') ? 'Comandos de build, teste e execução presentes.' : 'Nenhum comando detectado: informe como instalar, rodar e testar.', 'commands');
    push('structure', 'Estrutura', 10, has('structure') ? 'auto' : facts ? 'warn' : 'missing', has('structure') ? 'Mapa das pastas principais detectado.' : 'Escolha a pasta do projeto para mapear a estrutura.', 'project');
    push('conventions', 'Convenções', 15, has('conventions') ? (userGave('rules') ? 'ok' : 'auto') : 'missing', has('conventions') ? 'Estilo detectado no código' + (userGave('rules') ? ' + regras suas.' : '. Acrescente regras suas.') : 'Sem convenções: diga como o código deve ser escrito.', 'rules');
    push('testing', 'Testes', 10, facts?.tests?.files || facts?.tests?.frameworks?.length ? 'auto' : has('testing') ? 'warn' : 'missing', facts?.tests?.files ? 'Testes detectados.' : 'Nenhum teste detectado.', 'commands');
    push('prohibitions', 'O que nunca fazer', 15, userGave('prohibitions') ? 'ok' : 'auto', userGave('prohibitions') ? 'Limites definidos por você.' : 'Premissas padrão aplicadas (sem commit, sem dependências novas…). Defina os seus.', 'prohibitions');
    push('gotchas', 'Armadilhas conhecidas', 10, userGave('gotchas') ? 'ok' : 'warn', userGave('gotchas') ? 'Armadilhas informadas.' : 'Conte o que costuma dar errado neste projeto: é o que mais ajuda.', 'gotchas');

    if (!purposeOk && !detectedPurpose) questions.push({ field: 'purpose', text: 'Em uma frase: para que serve este projeto?' });
    if (!userGave('prohibitions')) questions.push({ field: 'prohibitions', text: 'O que a IA nunca deve fazer aqui? (ex.: mexer em migrações, atualizar dependências)' });
    if (!userGave('gotchas')) questions.push({ field: 'gotchas', text: 'O que costuma dar errado ou confunde quem chega no projeto?' });
    if (!has('commands') && !userGave('commands')) questions.push({ field: 'commands', text: 'Quais comandos instalam, rodam e testam o projeto?' });
    if (!userGave('rules') && !has('conventions')) questions.push({ field: 'rules', text: 'Há convenções de código que a IA precisa seguir?' });

    const value = { ok: 1, auto: 0.6, warn: 0.4, missing: 0 };
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    const score = Math.round(items.reduce((sum, item) => sum + item.weight * value[item.status], 0) / total * 100);
    const alerts = [];
    if (lineCount > 200) alerts.push({ level: 'warn', text: `O arquivo tem ${lineCount} linhas. CLAUDE.md curto funciona melhor: use o nível "Compacto" ou remova seções.` });
    else if (detail === 'detailed' && lineCount > 120) alerts.push({ level: 'info', text: `${lineCount} linhas: considere o nível "Padrão" se a IA ignorar partes.` });
    if (facts?.existing?.claude && input.includeExisting === false) alerts.push({ level: 'warn', text: 'Já existe um CLAUDE.md neste projeto e ele NÃO será incluído: salvar por cima o substituirá.' });
    else if (facts?.existing?.claude) alerts.push({ level: 'info', text: 'Já existe um CLAUDE.md: o conteúdo dele foi preservado na seção "Notas anteriores".' });
    if (facts && (facts.existing?.agents || facts.existing?.cursorrules || facts.existing?.copilot)) alerts.push({ level: 'info', text: 'O projeto também tem AGENTS.md, .cursorrules ou instruções do Copilot. Revise se há regras a trazer para cá.' });
    if (facts?.secrets?.present?.length) alerts.push({ level: 'info', text: `Arquivos de segredos encontrados (${facts.secrets.present.join(', ')}); eles não foram lidos.` });
    return { score, label: score >= 85 ? 'Excelente' : score >= 70 ? 'Boa' : score >= 50 ? 'Razoável' : 'Incompleta', items, questions: questions.slice(0, 4), alerts };
  }

  const api = { generate, PREMISES, parseCommandLines };
  root.ArcClaudeMd = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
