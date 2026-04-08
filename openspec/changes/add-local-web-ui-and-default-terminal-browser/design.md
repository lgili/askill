## Context

Skillex já oferece:

- catálogo multi-source
- TUI de terminal
- install/update/remove
- sync multi-adapter
- status e source management

O próximo salto de produto não é inventar nova regra de negócio, e sim criar uma
camada visual local que torne essas capacidades mais acessíveis sem degradar a
experiência de terminal.

## Goals

- Tornar descoberta e gerenciamento de skills significativamente mais fáceis.
- Fazer `skillex ui` abrir uma Web UI local agradável e leve.
- Manter a TUI existente disponível e ainda mais acessível via `skillex` sem subcomando.
- Reusar o core existente em `src/` sem duplicação de lógica.
- Manter tudo local, sem dependência de backend remoto.

## Non-Goals

- Não hospedar dashboard remota.
- Não mover lógica de negócio para o frontend.
- Não substituir o fluxo CLI tradicional para automação.
- Não introduzir autenticação de conta, login ou armazenamento remoto.

## Command Model

### Proposed command behavior

- `skillex`
  - abre a TUI de terminal existente
- `skillex browse`
  - abre a mesma TUI explicitamente
- `skillex tui`
  - alias de `browse`
- `skillex ui`
  - inicia a Web UI local e abre o navegador

### Breaking change

- `skillex ui` deixa de abrir a TUI antiga
- scripts ou documentação existentes que dependam de `skillex ui` para o fluxo
  terminal devem migrar para `skillex` ou `skillex browse`

## Architecture

### 1. Keep the core in Node/TypeScript

Toda a lógica real continua no core já existente:

- catálogo: `src/catalog.ts`
- install/update/remove: `src/install.ts`
- source management: `src/install.ts`
- sync: `src/sync.ts`
- adapters e estado: `src/adapters.ts`, `src/config.ts`

A Web UI consome esses módulos por meio de um servidor HTTP local fino.

### 2. Add a local HTTP bridge

Adicionar um servidor local, por exemplo em `src/web-ui/server.ts`, com estas
características:

- bind apenas em `127.0.0.1`
- porta efêmera por padrão
- inicialização pelo comando `skillex ui`
- encerramento quando o processo termina

API mínima proposta:

- `GET /api/state`
  - lockfile atual, adapters detectados, status de sync, sources configuradas
- `GET /api/catalog`
  - catálogo agregado
- `GET /api/catalog/:skillId`
  - detalhes completos da skill, incluindo manifesto e corpo renderizável
- `POST /api/install`
- `POST /api/remove`
- `POST /api/update`
- `POST /api/sync`
- `GET /api/sources`
- `POST /api/sources`
- `DELETE /api/sources/:repo`

### 3. Frontend stack

Para MVP, a melhor escolha é:

- Vue 3
- Vite
- Tailwind CSS
- `shadcn-vue` ou componentes leves equivalentes

Racional:

- combina com a experiência prévia do usuário
- boa ergonomia para interface bonita e rápida
- bundle leve para distribuição via npm
- fácil de servir como assets estáticos

### 4. Packaging model

Estrutura proposta:

- `ui/`
  - app Vue/Vite
- `dist-ui/`
  - build estático incluído no pacote npm

Fluxo:

1. build do frontend gera `dist-ui/`
2. CLI serve `dist-ui/` como arquivos estáticos
3. navegador fala apenas com o servidor local do processo Skillex

Isso mantém a distribuição local e evita hospedar qualquer serviço externo.

### 5. UX model for the Web UI

Tela principal:

- sidebar ou header com:
  - sources configuradas
  - adapters detectados
  - estado local/global
- grade/lista de skills com:
  - nome
  - descrição curta
  - tags
  - compatibilidade
  - source
  - status instalada/não instalada

Painel de detalhe da skill:

- manifesto
- render de `SKILL.md`
- scripts disponíveis
- compatibilidade
- origem/source

Ações principais:

- install
- remove
- update
- sync
- add source
- remove source
- search/filter

### 6. Progress and operation model

Para MVP, manter request/response síncrono é suficiente:

- o browser dispara ação
- a API local chama o core
- a resposta traz resumo e estado atualizado

Não é necessário streaming de logs no primeiro corte. Se operações futuras
ficarem mais longas, podemos adicionar SSE depois.

### 7. Security model

Mesmo sendo local, a UI não deve ser aberta como servidor genérico:

- bind apenas em loopback
- sem CORS aberto para origens arbitrárias
- token de sessão efêmero incluído na URL inicial ou cabeçalho exigido pela API
- nenhuma exposição remota nem modo daemon persistente no MVP

## Implementation Plan

### Phase 1

- roteamento CLI
- servidor local mínimo
- shell Vue/Vite
- catálogo agregado
- detalhes de skill
- install/remove/update/sync
- source add/remove/list

### Phase 2

- preview de diffs de sync
- badges mais ricos por adapter/source
- renderização mais avançada de markdown e assets
- persistência de preferências de UI

## Risks

### Command migration confusion

Usuários atuais podem esperar a TUI em `skillex ui`.

Mitigação:

- help e README explícitos
- alias novo `browse`
- mensagem clara de migração nas release notes

### Duplicated business logic

Se o frontend começar a decidir comportamento de install/sync, a manutenção fica
cara.

Mitigação:

- centralizar decisões no core TypeScript
- manter o servidor local apenas como camada de transporte

### Package bloat

Uma UI web pode inflar o pacote npm.

Mitigação:

- Vite build estático
- componentes leves
- sem frameworks extras pesados no servidor
