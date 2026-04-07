## Context

O projeto já tem um modelo simples de adapter baseado em `id`, detecção por markers e um único alvo de sync. Esse desenho funciona bem para `codex`, `copilot`, `cline` e `cursor`, mas a expansão para agentes adicionais exige duas correções:

1. mais renderizadores específicos por agente
2. uma detecção menos ingênua quando um marker pode servir a mais de um ecossistema

Também existe uma camada de compatibilidade no catálogo (`skill.compatibility`) que hoje depende de comparação textual exata. Isso não escala bem quando usuários filtram por nomes mais naturais, como `claude-code` em vez de `claude`.

## Goals / Non-Goals

- Goals:
  - Tornar `askill` compatível com Claude Code, Gemini CLI e Windsurf
  - Preservar o fluxo atual de `init`, `search`, `sync` e `status`
  - Reduzir erros de autodetecção em workspaces com markers ambíguos
  - Melhorar a ergonomia dos filtros de compatibilidade com aliases comuns
- Non-Goals:
  - Implementar sync simultâneo para todos os adapters detectados
  - Gerenciar settings proprietários ou credenciais de cada agente
  - Cobrir agentes sem alvo de instrução estável e documentado

## Decisions

- Decision: manter ids canônicos curtos para adapters
  - Canonical ids: `codex`, `copilot`, `cline`, `cursor`, `claude`, `gemini`, `windsurf`
  - Why: mantém `skill.json`, filtros e flags curtos e consistentes

- Decision: introduzir marker scoring na autodetecção
  - Why: `AGENTS.md` é um marker genérico demais para decidir entre `codex` e outros agentes que também o aceitam
  - Implementation direction:
    - markers específicos de diretório/arquivo recebem peso maior
    - markers compartilhados recebem peso menor
    - `resolveAdapterState()` escolhe o adapter detectado com maior score

- Decision: sincronizar Claude Code em `CLAUDE.md` com bloco gerenciado
  - Why: `CLAUDE.md` é um alvo oficial de instruções de projeto e permite preservar conteúdo manual

- Decision: sincronizar Gemini CLI em `GEMINI.md` com bloco gerenciado
  - Why: `GEMINI.md` é o arquivo oficial de contexto persistente do projeto

- Decision: sincronizar Windsurf em `.windsurf/rules/askill-skills.md`
  - Why: Windsurf possui regras de projeto dedicadas em `.windsurf/rules/`, o que permite ownership claro do arquivo gerado
  - Rendering:
    - frontmatter mínimo com `trigger: always_on`
    - corpo markdown consolidado das skills instaladas

- Decision: normalizar aliases de compatibilidade para ids canônicos
  - Examples:
    - `claude-code` -> `claude`
    - `gemini-cli` -> `gemini`
    - `github-copilot` -> `copilot`
    - `roo` / `roo-code` -> `cline`
  - Why: reduz atrito no `search --compatibility` e torna o catálogo mais tolerante

## Risks / Trade-offs

- Claude e Gemini também suportam estratégias modulares via imports
  - Mitigação: nesta mudança manteremos sync em um único arquivo oficial por agente, o que é mais previsível e menos invasivo

- Workspaces com múltiplos agentes continuarão exigindo escolha explícita de adapter ativo
  - Mitigação: melhorar a autodetecção e manter override por `--adapter`

- Ampliação da lista padrão de compatibilidade pode fazer maintainers aceitarem adapters sem validação manual
  - Mitigação: documentar que `compatibility` é declarativa e pode ser ajustada por skill

## Migration Plan

1. Expandir o registro de adapters com scoring e aliases
2. Implementar renderização e sync para os novos agentes
3. Atualizar filtragem de catálogo e help da CLI
4. Atualizar a skill `create-skills`, catálogo first-party e README
5. Cobrir os novos fluxos com testes

## Open Questions

- Devemos oferecer um modo futuro que gere `CLAUDE.md` e `GEMINI.md` como imports de um arquivo compilado comum?
- Devemos introduzir `askill sync --all-detected` em uma mudança separada?
