# Seletor de equipamentos agrupado — 2026-10-02

O seletor agora apresenta um card por `itemId`, mantendo cada cópia física e sua durabilidade. Nenhum registro de inventário foi apagado, mesclado ou reinicializado pela correção. Catálogo, efeitos, preços e regras de desgaste permanecem iguais.

## Origem e limites da auditoria

Fluxo: IndexedDB `player/economy` + `pokedex` → `webStore` → normalização/migração de equipamentos → snapshots do componente pai → `getEquipmentItemStates` → filtros de slot/tipo e reservas → `HeldItemDrawer.itemStates.map`.

Antes, `getEquipmentItemStates` agrupava as cópias em `byItem`, mas retornava `copies.map(...)` para cada item durável. O drawer renderizava esse array plano com `key=instanceId`. Portanto nove cópias distintas produziam nove cards iguais, mesmo sem duplicação de dados.

Não foi fornecido o backup do jogador da captura nem uma aba dessa ocorrência. Não é possível afirmar quantas cópias esse jogador realmente tinha, nem excluir corrupção específica daquele save. A causa de apresentação foi confirmada no código e reproduzida com nove cópias legítimas. Não houve reparo destrutivo de dados ambíguos.

## Relatório obrigatório

1. **Componente:** `src/components/HeldItemDrawer/HeldItemDrawer.jsx`, compartilhado pelos seletores estratégico e de relíquias.
2. **Array exato:** `itemStates`, memoizado a partir de `getEquipmentItemStates({ economy, collection, pokemon, slot, reservationIndex })` em `src/lib/economy/heldItems.js`.
3. **Cristal repetido:** cada registro de `economy.durableItems` daquele `itemId` virava um elemento do array e um card, via `copies.map` dentro do `flatMap` do catálogo.
4. **Legítimas versus acidentais:** na reprodução, nove registros com nove IDs canônicos distintos, todos 5/5. Save original indisponível; quantidade e legitimidade específicas não verificadas.
5. **Migração:** não foi encontrada criação repetida de cópias em migrações sucessivas. O banco persiste `durableEquipmentVersion=1`; o normalizador cria somente a diferença entre estoque agregado e cópias existentes. Nenhuma migração alterada.
6. **Legado + instâncias:** não eram concatenados. A quantidade em `inventory` é agregado de compatibilidade, não outro estoque. Agora contagens de duráveis vêm exclusivamente das instâncias utilizáveis.
7. **IDs duplicados:** nenhum encontrado na reprodução. O armazenamento é um dicionário com chaves únicas; o novo leitor usa a chave canônica como `instanceId`, tal como o normalizador persistente, evitando identidades embutidas conflitantes. O teste cobre essa entrada malformada. Chaves distintas não são apagadas por parecerem iguais.
8. **Agrupamento:** um índice `byItem`, com `instances`, `availableInstances`, `equippedInstances`; o resultado contém um estado por item. Visão derivada, sem escrita no inventário.
9. **Chave:** `item.id`/`itemId`; `selectionId=item.id` e a key do card usa `selectionId`. Nenhum agrupamento por nome ou índice de array.
10. **Quantidade total:** número de cópias físicas utilizáveis do item; single-use continua usando o agregado canônico.
11. **Disponibilidade:** cópias com durabilidade positiva e sem reserva em nenhum dos dois slots da coleção. A cópia atual está no total/equipados, mas não nas disponíveis.
12. **Reservas:** índice por identidade física e proprietário/slot; instâncias de outro Pokémon não entram nas candidatas. A transação de `webStore.setEquipmentItem` repete a validação antes de persistir.
13. **Durabilidades diferentes:** `Próximo: 1/5` mostra a cópia que a ação escolherá; quando equipado mostra `◆ 2/5` da cópia atual. O modal conserva a explicação completa e possui/disponíveis/equipados.
14. **Escolha:** menor durabilidade positiva disponível; empate resolvido por comparação estável do `instanceId`, independente da ordem de inserção. A UI envia o ID físico exato à operação persistente.
15. **Cópia atual:** prioridade explícita da instância ligada ao slot atual; nenhuma substituição por cópia mais nova. O planner também preserva o ID atual quando recebe novamente o mesmo item.
16. **Estratégicos:** browser com 279 cópias duráveis: 25 cards de tipos estratégicos, apenas um Cristal ×9. Equipou IDs diferentes em Bulbasaur e Ivysaur, confirmados após ler novamente IndexedDB.
17. **Relíquias:** browser Grass/Poison apresentou apenas Semente Ancestral ×10 e Presa Tóxica ×10; Semente foi equipada. Teste também cobre tipos repetidos, sem cards duplicados.
18. **Mochila:** o catálogo de equipamentos exclui itens Bag. Teste mantém Poção Vital ×99 fora do drawer; nenhuma alteração nos componentes ou limites de uso da mochila.
19. **Legado:** Cristal ×3 migrou para exatamente três cópias e permaneceu assim. Agregado + cópias presentes não contam como seis.
20. **Idempotência:** dez inicializações/migrações consecutivas mantêm IDs, contagem, durabilidade e coleção idênticos.
21. **Inventário grande:** teste com 280 instâncias/28 tipos; dez grupos duráveis estratégicos e dois grupos de relíquias compatíveis. Browser com 279 instâncias apresentou 25 cards estratégicos, incluindo tipos não possuídos do catálogo existente. Um sprite por card. Sem leitura de banco por card, nem reload total no equip; usa fluxo otimista existente. Não foi medido ganho de FPS ou latência em aparelho físico.
22. **Mobile:** Chrome em 320, 360, 375, 390, 412 e 430 px; `documentElement.scrollWidth == innerWidth` em todas. Três colunas, um card de Cristal e botões com altura mínima de 44 px. Durabilidade secundária `.68rem`; quantidade em badge; nomes em duas linhas e nome completo acessível no modal. Emulação de viewport, não seis aparelhos reais.
23. **Testes:** oito casos novos em `equipmentGrouping.test.mjs`, executáveis com `npm run test:equipment`: agrupamento 3/9, desgaste misto/zero/empate, reserva/proprietário atual, troca/desequipamento, single-use/Bag, migração repetida, 280 cópias/tipos, identidade canônica. Resultado: 8/8; suíte batalha existente: 178/178; gameplay audit: 10/10; total 196 testes aprovados.
24. **Build:** `npm run build` terminou com exit code 0. Avisos existentes: Browserslist desatualizado, cache webpack, autoprefixer e dependência opcional `debug` de follow-redirects.
25. **Diff:** `git diff --check` terminou com exit code 0; somente avisos de conversão LF/CRLF do Git. Não houve deploy.

## QA local

Foi usada uma rota temporária de QA com o **componente real**, estoque isolado em `localhost:3102` e persistência real no IndexedDB via `webStore`. A fixture recusava inicialização se já existissem Pokémon, estoque ou moedas. A rota foi removida antes do build de produção; não integra o produto.

Inventário: 279 cópias duráveis, incluindo nove Cristais Resistente frescos; Fruto Vital ×8 e Poção Vital ×99. Depois do primeiro equip, o modal do outro Pokémon mostrou possui 9/disponível 8/equipados 1. Depois do segundo, IDs persistidos: `equipment:1:resistance-crystal` e `equipment:2:resistance-crystal`. Desequipar Ivysaur liberou sua cópia; equipar Fruto Vital manteve um card e disponibilidade 7. Total físico permaneceu 279 e Cristais permaneceram nove. Durabilidade mista/reservas/zero também foram verificadas com testes de domínio, não através de desgaste de partidas no browser nesta tarefa.

Os logs de desenvolvimento `[equipment-selector]` registram `itemId`, `instanceId`, durabilidade/máximo, proprietário, slot e fonte somente ao abrir/mudar os snapshots; nenhum ID é exibido ao jogador. Em produção o log não executa.
