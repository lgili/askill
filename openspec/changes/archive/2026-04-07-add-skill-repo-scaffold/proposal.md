## Why

Hoje a skill `create-skills` resolve apenas metade do problema: ela cria uma nova skill dentro deste repositório e atualiza o `catalog.json` local. O que ainda falta é o primeiro passo de vários usuários e times: criar um repositório novo de skills já no formato correto, com catálogo na raiz, estrutura compatível com o Skillex e a própria skill `create-skills` publicada dentro dele para que o repo continue se expandindo sozinho.

Sem isso, o bootstrap de um novo catálogo ainda depende de copiar arquivos manualmente, entender a convenção do repositório e lembrar de registrar cada skill nova no catálogo raiz. Isso aumenta atrito e introduz inconsistências evitáveis.

## What Changes

- Expandir a skill `create-skills` para também scaffoldar um novo repositório de catálogo de skills
- Fazer o scaffold de repositório criar a estrutura raiz mínima esperada pelo Skillex, incluindo `catalog.json` e `skills/`
- Fazer o scaffold de repositório copiar a própria skill `create-skills` para o novo repo e registrá-la no `catalog.json` da raiz
- Tornar explícito, na skill e na automação, que novas skills criadas nesse repo devem ser adicionadas automaticamente ao catálogo raiz
- Adicionar scripts utilitários chamáveis pela IA ou pelo usuário final quando isso simplificar bootstrap, validação ou manutenção do catálogo
- Atualizar documentação, referências e testes da skill para cobrir tanto o modo de criar skill quanto o modo de criar repositório

## Impact

- Affected specs: `repo-skills-catalog`
- Affected code: `skills/create-skills/SKILL.md`, `skills/create-skills/scripts/*`, `skills/create-skills/references/repo-format.md`, `test/create-skills.test.ts`, `catalog.json`, documentação relacionada