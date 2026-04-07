## Context

A skill `create-skills` já existe neste repositório e hoje consegue scaffoldar novas skills first-party dentro da estrutura local. O script associado atualiza o `catalog.json` automaticamente, mas assume que o repositório alvo já existe e já segue o formato esperado.

O pedido agora amplia o escopo da skill: além de criar skills, ela deve inicializar um repositório novo de catálogo já funcional, incluindo a própria skill `create-skills` dentro desse repositório para que o usuário possa continuar expandindo o catálogo sem setup manual adicional.

## Goals / Non-Goals

- Goals:
  - Permitir bootstrap de um novo repositório de skills com a convenção certa desde o primeiro commit
  - Incluir a skill `create-skills` no repositório recém-criado e registrá-la no catálogo raiz
  - Preservar o comportamento atual de auto-registro no `catalog.json` ao criar novas skills
  - Deixar o fluxo suficientemente determinístico para ser testado em automação
- Non-Goals:
  - Criar integração com API do GitHub para criar o repositório remoto
  - Publicar automaticamente o repositório scaffoldado
  - Generalizar o template para qualquer tipo de projeto fora do formato de catálogo de skills do Skillex

## Decisions

- Decision: expandir a automação existente de `create-skills` em vez de criar uma segunda skill separada
  - Why: o problema continua no mesmo domínio de authoring e bootstrap de catálogos; separar em duas skills aumentaria duplicação de contexto e instruções

- Decision: o modo de scaffold de repositório deve copiar a versão local da skill `create-skills` para o novo repo
  - Why: isso garante que o repositório criado já nasce com a automação correta e não depende de instalação posterior para continuar crescendo

- Decision: o catálogo da raiz do repo scaffoldado deve já conter a entrada de `create-skills`
  - Why: usuários precisam conseguir listar e instalar essa skill no novo catálogo desde o primeiro uso

- Decision: o auto-registro de skills no `catalog.json` continua sendo responsabilidade do script de scaffold
  - Why: a exigência do usuário é reduzir esquecimentos manuais; o comportamento deve permanecer automático e explícito na skill

- Decision: permitir scripts utilitários adicionais dentro da skill e do template scaffoldado quando eles melhorarem uso humano ou invocation por agente
  - Why: alguns passos como bootstrap, validação do catálogo ou sincronização de arquivos ficam mais confiáveis quando encapsulados em scripts determinísticos reutilizáveis

## Risks / Trade-offs

- Copiar a skill `create-skills` para um novo repo pode introduzir drift entre o template criado e a versão mais recente deste repositório
  - Mitigação: documentar que o scaffold embute a versão corrente local e manter os testes cobrindo a estrutura exportada

- Adicionar modo de scaffold de repositório no mesmo script pode tornar a CLI interna mais complexa
  - Mitigação: manter flags separadas e fluxo de validação explícito por modo

- Usuários podem interpretar o scaffold como criação de repositório remoto no GitHub
  - Mitigação: documentar claramente que o escopo é gerar a estrutura local pronta para commit e publicação

## Migration Plan

1. Definir o formato mínimo do repositório scaffoldado
2. Expandir o script da skill para suportar o modo de bootstrap de repositório
3. Copiar e registrar `create-skills` automaticamente no catálogo inicial
4. Adicionar scripts utilitários onde eles reduzirem passos manuais ou ambiguidades para usuário e IA
5. Atualizar instruções e referências da skill
6. Adicionar testes de scaffold de repositório e regressão de auto-registro no catálogo

## Open Questions

- O scaffold do novo repositório deve incluir apenas os arquivos mínimos de catálogo ou também um `README.md` inicial?
- O nome do repositório deve influenciar o campo `repo` do `catalog.json`, ou ele deve começar com um placeholder explícito?