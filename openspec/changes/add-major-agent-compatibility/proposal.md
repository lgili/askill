## Why

O `askill` já cobre parte importante do ecossistema, mas ainda deixa de fora agentes amplamente usados como Claude Code, Gemini CLI e Windsurf. Isso reduz o valor da biblioteca como base aberta para distribuição de skills e força o usuário a manter instruções paralelas fora do fluxo de `install` e `sync`.

Além disso, a detecção atual de adapter é binária e baseada apenas em presença de arquivos. Com a expansão para mais agentes, alguns marcadores passam a ser compartilhados ou ambíguos, como `AGENTS.md`, o que pode ativar o adapter errado por padrão.

## What Changes

- Adicionar adapters de mercado para `claude`, `gemini` e `windsurf`
- Implementar sincronização para `CLAUDE.md`, `GEMINI.md` e `.windsurf/rules/askill-skills.md`
- Introduzir detecção com precedência por marker para priorizar sinais específicos sobre arquivos compartilhados
- Normalizar aliases de compatibilidade em busca e filtragem, aceitando termos como `claude-code` e `gemini-cli`
- Atualizar a skill first-party `create-skills` para refletir a matriz ampliada de adapters suportados
- Atualizar a documentação e a experiência de CLI para a nova cobertura de agentes

## Impact

- Affected specs: `skill-management-cli`, `adapter-sync`, `repo-skills-catalog`
- Affected code: `src/adapters.js`, `src/sync.js`, `src/catalog.js`, `src/cli.js`, `skills/create-skills/`, `README.md`, testes automatizados
