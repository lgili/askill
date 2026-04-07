# Open Agent Skills

[![CI](https://github.com/lgili/askill/actions/workflows/ci.yml/badge.svg)](https://github.com/lgili/askill/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40lgili%2Faskill)](https://www.npmjs.com/package/@lgili/askill)

CLI inicial para distribuir, listar e instalar skills hospedadas em um repositório GitHub.

## Por que usar Node + `npx`

`npx` é a melhor base para esse projeto porque:

- funciona em macOS, Linux e Windows sem depender de bash;
- permite publicar uma única CLI com versionamento sem pedir instalação global;
- facilita evolução para adapters, cache e update sem quebrar o fluxo do usuário.

Se depois você quiser atingir quem não usa Node, dá para empacotar a mesma CLI em binários standalone com `pkg` ou `nexe`. Mas o melhor ponto de partida é `npx`.

## Como o usuario instala

Hoje, a convencao escolhida e:

- nome do projeto/repo: `open-agent-skills`
- nome do pacote npm: `@lgili/askill`
- comando instalado: `askill`

### 1. Usar sem instalar globalmente

Depois de publicar no npm:

```bash
npx @lgili/askill@latest init --repo seu-user/seu-repo
npx @lgili/askill@latest install --all
npx @lgili/askill@latest sync
```

Esse e o fluxo que eu recomendo para a maioria dos usuarios.

### 2. Instalar globalmente

```bash
npm install -g @lgili/askill
askill init --repo seu-user/seu-repo
askill install git-master
askill sync
```

Bom para quem vai usar o CLI com frequencia.

### 3. Instalar no projeto como dependencia de desenvolvimento

```bash
npm install -D @lgili/askill
npx askill init --repo seu-user/seu-repo
npx askill install --all
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
askill help
```

## Nome do pacote vs comando

- nome do projeto/repo: `open-agent-skills`
- nome do pacote no npm: `@lgili/askill`
- comando instalado: `askill`

Assim, o fluxo final fica simples e direto:

```bash
npx @lgili/askill@latest init --repo seu-user/seu-repo
```

## First-Party Skills

Este mesmo repositório também funciona como catálogo first-party de skills.

- catálogo na raiz: `catalog.json`
- skills publicadas: `skills/<skill-id>/`
- primeira skill: `create-skills`

Listar skills publicadas neste repositório:

```bash
npx @lgili/askill@latest list --repo lgili/askill
```

Instalar a skill de autoria:

```bash
npx @lgili/askill@latest install create-skills --repo lgili/askill
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

- `askill init`: cria ou atualiza `.agent-skills/skills.json` e detecta o adapter do workspace
- `askill list`: lê um catálogo remoto no GitHub e lista as skills disponíveis
- `askill search`: filtra skills remotas por texto, compatibilidade e tag
- `askill install <id>`: baixa uma ou mais skills
- `askill install --all`: baixa todas as skills do catálogo
- `askill update [id]`: atualiza uma skill instalada ou todas
- `askill remove <id>`: remove uma ou mais skills instaladas
- `askill sync`: materializa as skills instaladas no arquivo de instruções do adapter ativo
- `askill sync --dry-run`: mostra o diff antes de escrever
- `askill status`: mostra o estado local

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
- `cline`: gera `.clinerules/askill-skills.md`
- `cursor`: gera `.cursor/rules/askill-skills.mdc`
- `claude`: atualiza um bloco gerenciado em `CLAUDE.md`
- `gemini`: atualiza um bloco gerenciado em `GEMINI.md`
- `windsurf`: gera `.windsurf/rules/askill-skills.md`

Os arquivos compartilhados preservam conteúdo manual fora do bloco gerenciado pelo `askill`.

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
  "files": ["SKILL.md", "tools/git-cleanup.js"]
}
```

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
npm run start -- install --all --repo seu-user/seu-repo
npm run start -- update
npm run start -- update git-master
npm run start -- remove git-master
npm run start -- sync
npm run start -- sync --dry-run
npm run start -- sync --adapter cursor
npm run start -- status
```

Depois do `init`, o CLI passa a reutilizar o catálogo salvo no lockfile. Então comandos como `search`, `install`, `update` e `remove` podem rodar sem repetir `--repo`.

## Estrutura local gerenciada

```text
.agent-skills/
  skills.json
  git-master/
    SKILL.md
    skill.json
    tools/
```

O `skills.json` funciona como lockfile e guarda:

- catálogo remoto configurado;
- adapter ativo e adapters detectados;
- configuração local como `autoSync`;
- último sync executado;
- skills instaladas e suas versões;
- timestamps de criação e atualização.

## Auto-sync

Se você ativar `--auto-sync` no `init`, o CLI passa a executar `sync` automaticamente após:

- `install`
- `update`
- `remove`

Isso mantém o arquivo do agente sempre atualizado sem precisar chamar `askill sync` manualmente.

## Como publicar para `npx`

1. Crie o secret `NPM_TOKEN` no repositório GitHub.
2. Atualize a versão em `package.json`.
3. Faça commit e push para `main`.
4. Crie uma tag `vX.Y.Z` que bata com a versão do `package.json`.
5. Faça push da tag.
6. O GitHub Actions publica `@lgili/askill` no npm.

Exemplo:

```bash
git tag v0.1.0
git push origin main --tags
```

O workflow de release valida:

- se a tag bate com a versão do `package.json`
- se os testes passam
- se o pacote empacota corretamente antes do `npm publish`
- e cria uma GitHub Release com notas automáticas para a tag

## Segredo necessario no GitHub

No repositório `lgili/askill`, configure:

- `NPM_TOKEN`: token de publicação do npm com permissão para publicar `@lgili/askill`

## Melhorias que valem a pena na sua lib

- usar `SKILL.md` como arquivo principal para compatibilidade com o ecossistema atual;
- manter `skill.json` como manifesto de distribuição, não como substituto do padrão da skill;
- adicionar checksums no catálogo para integridade;
- evoluir os adapters para suportarem `inject()` e sincronização com cada agente;
- adicionar preview com diff mais compacto por hunks;
- adicionar `askill doctor` para validar catálogo, adapters e estado local;
- adicionar cache local e instalação concorrente;
- assinar releases ou manifests se quiser confiança maior no catálogo.
