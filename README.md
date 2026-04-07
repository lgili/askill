# Skillex

[![CI](https://github.com/lgili/skillex/actions/workflows/ci.yml/badge.svg)](https://github.com/lgili/skillex/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/skillex)](https://www.npmjs.com/package/skillex)

CLI inicial para distribuir, listar e instalar skills hospedadas em um repositório GitHub.

## Por que usar Node + `npx`

`npx` é a melhor base para esse projeto porque:

- funciona em macOS, Linux e Windows sem depender de bash;
- permite publicar uma única CLI com versionamento sem pedir instalação global;
- facilita evolução para adapters, cache e update sem quebrar o fluxo do usuário.

Se depois você quiser atingir quem não usa Node, dá para empacotar a mesma CLI em binários standalone com `pkg` ou `nexe`. Mas o melhor ponto de partida é `npx`.

## Como o usuario instala

Hoje, a convencao escolhida e:

- nome do projeto/repo: `skillex`
- nome do pacote npm: `skillex`
- comando instalado: `skillex`

### 1. Usar sem instalar globalmente

Depois de publicar no npm:

```bash
npx skillex@latest init --repo seu-user/seu-repo
npx skillex@latest install --all
npx skillex@latest sync
```

Esse e o fluxo que eu recomendo para a maioria dos usuarios.

### 2. Instalar globalmente

```bash
npm install -g skillex
skillex init --repo seu-user/seu-repo
skillex install git-master
skillex sync
```

Bom para quem vai usar o CLI com frequencia.

### 3. Instalar no projeto como dependencia de desenvolvimento

```bash
npm install -D skillex
npx skillex init --repo seu-user/seu-repo
npx skillex install --all
```

Bom quando voce quer fixar a versao do CLI no proprio repositório.

### 4. Usar localmente antes de publicar

Dentro deste repositório:

```bash
npm install
npm run start -- init --repo seu-user/seu-repo
```

Ou, para testar como comando global localmente:

```bash
npm link
skillex help
```

## Nome do pacote vs comando

- nome do projeto/repo: `skillex`
- nome do pacote no npm: `skillex`
- comando instalado: `skillex`

Assim, o fluxo final fica simples e direto:

```bash
npx skillex@latest init --repo seu-user/seu-repo
```

## First-Party Skills

Este mesmo repositório também funciona como catálogo first-party de skills.

- catálogo na raiz: `catalog.json`
- skills publicadas: `skills/<skill-id>/`
- primeira skill: `create-skills`

Listar skills publicadas neste repositório:

```bash
npx skillex@latest list --repo lgili/skillex
```

Instalar a skill de autoria:

```bash
npx skillex@latest install create-skills --repo lgili/skillex
```

Scaffold local de uma nova skill no formato do repositório:

```bash
node skills/create-skills/scripts/init_repo_skill.js \
  --root . \
  --skill-id my-skill \
  --name "My Skill" \
  --description "Describe what the skill does and when to use it."
```

## CLI implementado

- `skillex init`: cria ou atualiza `.agent-skills/skills.json` e detecta o adapter do workspace
- `skillex list`: lê um catálogo remoto no GitHub e lista as skills disponíveis
- `skillex search`: filtra skills remotas por texto, compatibilidade e tag
- `skillex install <id>`: baixa uma ou mais skills
- `skillex install <owner/repo[@ref]>`: instala uma skill direto de um repositório GitHub
- `skillex install --all`: baixa todas as skills do catálogo
- `skillex update [id]`: atualiza uma skill instalada ou todas
- `skillex remove <id>`: remove uma ou mais skills instaladas
- `skillex sync`: materializa as skills instaladas no arquivo de instruções do adapter ativo
- `skillex sync --dry-run`: mostra o diff antes de escrever
- `skillex sync --mode copy`: desativa symlink para adapters de arquivo dedicado
- `skillex run <skill-id:comando>`: executa scripts declarados no `skill.json` local da skill
- `skillex ui`: abre o seletor interativo no terminal
- `skillex status`: mostra o estado local

## Adapters detectados

O CLI já detecta e persiste um adapter ativo com base no workspace:

- `codex`: `AGENTS.md`, `.codex/`, `.codex/skills`
- `copilot`: `.github/copilot-instructions.md`
- `cline`: `.cline/`, `.roo/`, `.clinerules`
- `cursor`: `.cursor/`, `.cursorrules`
- `claude`: `CLAUDE.md`, `.claude/`
- `gemini`: `GEMINI.md`, `.gemini/`
- `windsurf`: `.windsurf/`, `.windsurf/rules/`

Quando há markers ambíguos, o CLI prioriza markers específicos do agente sobre arquivos compartilhados.

## Alvos de sync por adapter

- `codex`: atualiza um bloco gerenciado em `AGENTS.md`
- `copilot`: atualiza um bloco gerenciado em `.github/copilot-instructions.md`
- `cline`: gera `.clinerules/skillex-skills.md`
- `cursor`: gera `.cursor/rules/skillex-skills.mdc`
- `claude`: atualiza um bloco gerenciado em `CLAUDE.md`
- `gemini`: atualiza um bloco gerenciado em `GEMINI.md`
- `windsurf`: gera `.windsurf/rules/skillex-skills.md`

Os arquivos compartilhados preservam conteúdo manual fora do bloco gerenciado pelo `skillex`.
Para adapters de arquivo dedicado (`cline`, `cursor`, `windsurf`), o padrão agora é gerar o arquivo central em `.agent-skills/generated/` e criar um symlink relativo para o alvo do adapter. Use `skillex sync --mode copy` para forçar cópia direta.

Você também pode forçar um adapter:

```bash
npm run start -- init --repo seu-user/seu-repo --adapter codex
npm run start -- init --repo seu-user/seu-repo --adapter codex --auto-sync
```

## Estrutura recomendada do catálogo remoto

```text
skills/
  git-master/
    SKILL.md
    skill.json
    tools/
      git-cleanup.js
catalog.json
```

## Formato recomendado de `skill.json`

```json
{
  "id": "git-master",
  "name": "Git Master",
  "version": "1.0.0",
  "description": "Ensina o agente a fazer commits semanticos e gerenciar branches.",
  "author": "SeuNome",
  "tags": ["git", "workflow", "vscode"],
  "compatibility": ["codex", "copilot", "cline", "cursor", "claude", "gemini", "windsurf"],
  "entry": "SKILL.md",
  "files": ["SKILL.md", "tools/git-cleanup.js"],
  "scripts": {
    "cleanup": "node tools/git-cleanup.js"
  }
}
```

## Frontmatter opcional de `SKILL.md`

O `SKILL.md` pode declarar campos extras para injeção automática de contexto:

```yaml
---
name: "git-master"
description: "Fluxo Git"
autoInject: true
activationPrompt: "Sempre aplique as regras da skill Git Master quando o usuario pedir ajuda com Git."
---
```

Se `autoInject: true` e `activationPrompt` estiverem presentes, o `skillex sync` injeta esse prompt em um bloco gerenciado separado no arquivo principal do adapter.

## Formato recomendado de `catalog.json`

```json
{
  "formatVersion": 1,
  "repo": "seu-user/seu-repo",
  "ref": "main",
  "skills": [
    {
      "id": "git-master",
      "name": "Git Master",
      "version": "1.0.0",
      "description": "Ensina o agente a trabalhar melhor com Git.",
      "path": "skills/git-master",
      "entry": "SKILL.md",
      "files": ["SKILL.md", "tools/git-cleanup.js"],
      "compatibility": ["codex", "copilot", "cline", "cursor", "claude", "gemini", "windsurf"],
      "tags": ["git", "workflow"]
    }
  ]
}
```

O CLI tenta usar `catalog.json` primeiro. Se ele não existir, faz fallback e escaneia `skills/*/skill.json` no GitHub.
Nos filtros de busca, aliases como `claude-code`, `gemini-cli`, `github-copilot` e `roo-code` sao normalizados automaticamente.

## Uso local

```bash
npm install
npm run start -- init --repo seu-user/seu-repo
npm run start -- list --repo seu-user/seu-repo
npm run start -- search git --repo seu-user/seu-repo
npm run start -- search pdf --repo seu-user/seu-repo --compatibility codex
npm run start -- search review --repo seu-user/seu-repo --compatibility claude-code
npm run start -- install git-master --repo seu-user/seu-repo
npm run start -- install lgili/skillex-create-skill@main --trust
npm run start -- install --all --repo seu-user/seu-repo
npm run start -- update
npm run start -- update git-master
npm run start -- remove git-master
npm run start -- sync
npm run start -- sync --dry-run
npm run start -- sync --adapter cursor
npm run start -- sync --adapter cline --mode copy
npm run start -- run git-master:cleanup --yes
npm run start -- ui --repo seu-user/seu-repo
npm run start -- status
```

Depois do `init`, o CLI passa a reutilizar o catálogo salvo no lockfile. Então comandos como `search`, `install`, `update` e `remove` podem rodar sem repetir `--repo`.

## Estrutura local gerenciada

```text
.agent-skills/
  skills.json
  skills/
    git-master/
      SKILL.md
      skill.json
      tools/
  generated/
    cline/
      skillex-skills.md
```

O `skills.json` funciona como lockfile e guarda:

- catálogo remoto configurado;
- adapter ativo e adapters detectados;
- configuração local como `autoSync`;
- último sync executado;
- modo do último sync (`symlink` ou `copy`);
- skills instaladas e suas versões;
- origem da instalação, incluindo `github:owner/repo@ref` em installs diretos;
- timestamps de criação e atualização.

## Auto-sync

Se você ativar `--auto-sync` no `init`, o CLI passa a executar `sync` automaticamente após:

- `install`
- `update`
- `remove`

Isso mantém o arquivo do agente sempre atualizado sem precisar chamar `skillex sync` manualmente.

## Como publicar para `npx`

1. Crie o secret `NPM_TOKEN` no repositório GitHub.
2. Atualize a versão em `package.json`.
3. Faça commit e push para `main`.
4. Crie uma tag `vX.Y.Z` que bata com a versão do `package.json`.
5. Faça push da tag.
6. O GitHub Actions publica `skillex` no npm.

Exemplo:

```bash
git tag v0.2.0
git push origin main --tags
```

O workflow de release valida:

- se a tag bate com a versão do `package.json`
- se os testes passam
- se o pacote empacota corretamente antes do `npm publish`
- e cria uma GitHub Release com notas automáticas para a tag

## Segredo necessario no GitHub

No repositório `lgili/skillex`, configure:

- `NPM_TOKEN`: token de publicação do npm com permissão para publicar `skillex`

## Melhorias que valem a pena na sua lib

- usar `SKILL.md` como arquivo principal para compatibilidade com o ecossistema atual;
- manter `skill.json` como manifesto de distribuição, não como substituto do padrão da skill;
- adicionar checksums no catálogo para integridade;
- evoluir os adapters para suportarem `inject()` e sincronização com cada agente;
- adicionar preview com diff mais compacto por hunks;
- adicionar `skillex doctor` para validar catálogo, adapters e estado local;
- adicionar cache local e instalação concorrente;
- assinar releases ou manifests se quiser confiança maior no catálogo.
