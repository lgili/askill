## Why

Skillex já tem um core sólido para catálogo, install, remove, update, sync e
multi-source, mas a experiência de descoberta ainda é centrada em CLI/TUI. Isso
é suficiente para power users, porém cria atrito para onboarding, exploração de
skills e gerenciamento visual de múltiplas sources.

Uma Web UI local melhora descoberta, confiança e percepção de produto sem exigir
serviço hospedado. Ao mesmo tempo, faz sentido reposicionar a TUI atual como o
fluxo padrão sem subcomando, mantendo um caminho rápido para usuários que querem
ficar totalmente no terminal.

## What Changes

- Adicionar uma Web UI local lançada por `skillex ui`, servida via servidor local e aberta no navegador.
- **BREAKING:** mover a TUI atual de `skillex ui` para o fluxo padrão sem subcomando.
- Adicionar um comando explícito para a TUI, como `skillex browse`, com alias `skillex tui`.
- Expor na Web UI:
  - catálogo agregado por source
  - detalhes renderizados de cada skill
  - install, remove, update e sync
  - add/remove/list de sources
  - estado dos adapters detectados e sincronizados
- Reutilizar o core existente de catálogo, install, source e sync via API local, sem duplicar regra de negócio no frontend.

## Impact

- Affected specs:
  - `interactive-ui`
  - `cli`
- Affected code:
  - `src/cli.ts`
  - novo servidor/API local para Web UI
  - novo frontend local empacotado com a CLI
  - testes de roteamento de comando, API local e fluxos UI
