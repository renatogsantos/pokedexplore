# Regressão de início mobile — auditoria de 2026-10-02

Foram reproduzidos e corrigidos defeitos de normalização de equipamentos e dependências de APIs do navegador. **A causa exata no celular do jogador permanece sem confirmação:** não foi disponibilizado o save, modelo/navegador, erro ou trace desse dispositivo. Esta auditoria não declara que qualquer falha de mobile foi resolvida universalmente.

## Evidências principais

O código anterior de `getEquippedDurableInstances` foi executado diretamente a partir de `git show HEAD:src/lib/economy/durableEquipment.js`, com `{ id: 1, strategicItem: 'power-claw' }`. Resultado:

```text
TypeError: Cannot read properties of undefined (reading 'itemId')
getEquippedDurableInstances → EQUIPMENT_FIELDS.flatMap → copy.itemId
```

A condição `copy?.instanceId === pokemon[field.instance]` era verdadeira quando ambos eram `undefined`, permitindo o acesso seguinte ao objeto inexistente. O teste novo exige retorno vazio para esse registro legado. A preparação normal já migrava muitos desses registros antes dessa chamada; portanto essa exceção isolada **não prova** que o jogador chegou a ela.

Também foi reproduzida a ausência de `Crypto.randomUUID`: a chamada antiga lança `TypeError`; a nova usa `getRandomValues`, preservando geração criptográfica e IDs existentes. `structuredClone` ausente falhava no primeiro turno; o motor compartilhado agora possui clone de dados com preservação de `undefined` e referências. Documentação: [Crypto.randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone).

## Fluxo e mecanismos de saída

`readyTeam` → operações de persistência pendentes → `webStore.prepareBattleTeam` → normalização de três registros/equipamentos → validação → `toBattlePokemon` → `createBattleState` → `getEquippedDurableInstances` → `setBattle`/`setScreen('battle')` → `BattleArena` → countdown → primeiro turno.

Não há `router.back()` nem navegação automática no início da CPU. A arena usa estado React na mesma rota. As navegações localizadas para Jornada/Insígnias ocorrem em outros fluxos/resultados ou por ação do usuário. O estado antigo de falha de preparação permanecia no seletor com aviso; a arena não tinha uma boundary local com retry explícito.

Uma navegação observada **na fixture temporária** veio do menu inferior, porque aquela rota não tinha a política de navegação de `/batalha`. O teste foi repetido na rota real: `elementFromPoint` no centro do botão de início retornou o próprio botão, y=772, altura=58, viewport=390×844. O toque entrou na arena. Isso foi tratado como artefato da fixture, não como prova da falha do jogador, e não motivou mudança de CSS do jogo.

## Relatório obrigatório — 46 itens

1. **Ponto de falha:** coletor de snapshots duráveis reproduzido com registro incompleto; APIs ausentes reproduzidas na geração de ID e primeiro turno. Ponto do jogador real desconhecido.
2. **Por que retornava:** não foi identificado um redirect automático no início. O retorno do jogador não foi reproduzido com seu save; não afirmar que era a exceção demonstrada. Fixture teve navegação pelo menu, distinguida acima.
3. **Exceção:** sim, no código anterior do coletor, e em chamadas sem `randomUUID`/`structuredClone`; nenhuma dessas foi capturada no aparelho afetado.
4. **Detalhes:** `TypeError: Cannot read properties of undefined (reading 'itemId')`; comparação de identidades ausentes seguida de dereferência. Traces registram nome, mensagem, stack e etapa em desenvolvimento.
5. **Novo sistema causou?** O defeito do coletor pertence ao sistema de cópias duráveis. Relação causal com o incidente real não confirmada; APIs de navegador não são específicas de itens.
6. **Dependência:** `getEquippedDurableInstances` em `durableEquipment.js`; `makeMatchId`/identidades em `page.jsx`, `webStore.js` e `realtime.js`; clone em `resolveAction`.
7. **IndexedDB legado:** suportado na reprodução real com save bruto anterior a itens duráveis. Contribuição no incidente real não confirmada.
8. **Migração parcial:** marker de durabilidade sozinho antes encerrava a migração; nova versão de reparo executa uma passagem atômica para reparar reservas duplicadas e referências inválidas mesmo em saves de versão 1.
9. **heldItemId:** continua normalizado para o slot correto; o Deck de teste entrou com Garra de Poder originalmente salva como `heldItemId`.
10. **Dual equipment:** mantido pelo normalizador canônico e pelo teste de matriz; ambos os slots usam o mesmo coletor compacto. Não atribuir a dualidade ao incidente sem evidência.
11. **Instâncias duráveis:** referência ausente não é dereferenciada; desgaste por cópia é preservado, inclusive 1/5. 5/5 e 4/5 cobertos pela suíte existente.
12. **Duplicadas:** reservas de uma instância em dois Pokémon são reparadas mantendo o primeiro vínculo e soltando o conflitante, sem apagar inventário. Identidades canônicas são as chaves do dicionário. Não foi provada duplicação de compras no save afetado.
13. **Tamanho do inventário:** 500 cópias exercitadas em browser e domínio. Não foi comprovado crash por memória; preparação só interpreta as cópias ligadas aos três escolhidos.
14. **Tamanho da coleção:** 130 Pokémon exercitados; preparo de partida não faz `pokedex.getAll`. Carregamento inicial/migração única ainda lê a coleção para apresentar e reparar o save.
15. **BattleState grande:** não continha todas as instâncias. Foram removidos o agregado `inventory` redundante do jogador no estado do motor, histórico de sprites e campos arbitrários de durabilidade dos snapshots. Bag canônica continua disponível em `bag`/`initialBag`.
16. **Imagens:** caminhos ausentes/fallback exercitados; não bloqueiam o início. `ItemSprite` agora trata também rejeição da resolução visual. Sprite preloading é assíncrono, limitado à equipe relevante e não aguardado para inicializar.
17. **Áudio:** `HTMLMediaElement.play` rejeitado artificialmente durante QA; partida e primeiro turno funcionaram. Web Audio/preload já tratam rejeições e não são pré-condições do motor.
18. **VFX/WebGL:** não há Pixi/WebGL no caminho de início auditado; overlays/aura são CSS/React. Parallax agora verifica APIs opcionais e converte exceção síncrona de solicitação de orientação em rejeição tratada. Não foram testados GPU/iOS reais.
19. **Rotas:** não carregam BattleState serializado na URL. Transição principal permanece via estado React; nenhum redirect de erro foi adicionado.
20. **Lifecycle/races:** lock síncrono de preparação e generation existentes foram preservados; unmount invalida tentativa e limpa timers. Countdown antigo não pode instalar estado numa sessão posterior. Boundary retry remonta a arena preservando a partida.
21. **Migração implementada:** `durableRepairVersion=1` além de DB v4/save v7/durable v1. Transação conjunta de player/pokedex, abort e rejeição observável em erro; não limpa stores. Não rebinda instância desaparecida de save já durável a uma reserva nova.
22. **Legado normalizado:** inventário em array `{itemId, quantity}`, aliases de equipamentos, tipos legados e slots vazios. Durabilidade ausente fica marcada para revisão com valor desconhecido, cópia/quantidade preservadas; não é convertida para 5/5.
23. **Pokémon snapshot:** `toBattlePokemon` é compartilhado; tipos reutilizam a normalização de equipamentos; visuais conservam somente fontes necessárias, sem `sprites.versions` completo.
24. **Item snapshot:** somente `itemId`, `instanceId`, `durability`, `maxDurability` dos dois slots válidos; catálogo permanece estático fora do save/BattleState.
25. **Erros:** trace de etapas 01–17, captura global dev, boundary da arena, mensagem “Não foi possível iniciar a batalha / Seus dados continuam salvos”, retry e voltar. Erro bruto permanece no diagnóstico de desenvolvimento, não no fluxo de falha de preparação normal.
26. **Performance:** uma transação de preparo lê três Pokémon e uma economia; snapshot interpreta somente suas cópias. A economia está em um único registro, então IndexedDB ainda precisa desserializar esse registro com o estoque completo. Não se promete custo zero proporcional ao inventário nesse formato persistente.
27. **CPU Easy:** produção, save migrado, erro de leitura artificial, retry → arena; match `cbaee4fa-407e-4b47-a1f0-711a35f6d690`. Domínio inicia e executa primeira ação.
28. **CPU Medium:** rota real `/batalha`, 390×844, match `5db2beff-d2dc-44f8-8e6d-60e01417c2bf`, ataque + ação CPU → revisão 2, APIs modernas ausentes e áudio rejeitado no mesmo documento SPA.
29. **CPU Hard:** produção na rota real, match `5c8f4149-1433-48bd-aca5-1fb92b13fae2`, primeiro turno acionável e revisão 2. Controle desktop do mesmo match também ativo.
30. **PvP:** validação/serialização e criação/primeira ação no motor com as variantes de save; suíte de protocolo/Realtime aprovada. Nesta tarefa não houve nova partida completa entre dois clientes independentes.
31. **Torneio H×H:** contrato de snapshot e motor aprovado; remoto/freeze/start entre dois humanos não exercitado nesta tarefa.
32. **Torneio H×CPU:** contrato/motor e testes existentes do adapter aprovados; novo fluxo remoto de torneio não exercitado nesta tarefa.
33. **Badge:** snapshots de variantes de save e início/primeira ação de CPU de Badge no motor aprovados; série remota/transferência não exercitada nesta tarefa.
34. **Journey:** snapshots e início/primeira ação no motor aprovados; novo caminho de recompensas remotas não exercitado nesta tarefa.
35. **Save antigo:** fixture persistida antes da migração, 130 Pokémon, inventário array com 500 Garras + 99 Poções, três `heldItemId`, um Deck; migração → selecionar Deck → PLAY → arena → primeiro turno. Depois: 130 Pokémon, 2.400 moedas, 42 vitórias, 500 cópias 5/5, um Deck.
36. **Migração parcial:** testes preservam cópia de desgaste desconhecido sem substituir/resetar; ausência de instância e dupla reserva reparadas idempotentemente. Não foi simulado corte de energia durante commit IndexedDB; atomicidade usada pela transação.
37. **Inventário grande:** 100/250/500 cópias em domínio, 500 em produção com viewport móvel. Nenhum estoque completo foi embutido na equipe de três.
38. **Coleção grande:** 130 registros; snapshots contêm apenas três. Teste mediu BattleState com exatamente 13.258 caracteres serializados em todos os tamanhos de inventário (equipes idênticas, sem estoque agregado redundante).
39. **Mobile:** Chrome com viewport 390×844; seleção por Deck, início e ação. Isso não equivale a Android físico ou Safari/iOS; dispositivo afetado não disponível.
40. **Lentidão:** atraso artificial de 60 ms por abertura de banco, APIs de UUID/clone removidas, rejeição de autoplay; retry e início passam. Não havia ferramenta de CPU throttling físico/CDP anunciada; não alegar medição em CPU de celular lento.
41. **Antes/depois:** mesma fixture, build de produção e atraso de storage: caminho antigo `getData + getEconomy` 258,5 ms / 1 `pokedex.getAll`; novo `prepareBattleTeam` 65 ms / 0 `getAll`. Ambos registraram 5 `get`, incluindo a checagem de migração. Medida única controlada, não percentil ou benchmark real de telefone. Domínio para 3/100/250/500 cópias: 0,75/0,68/0,72/0,97 ms; tamanho serializado constante, três cópias equipadas.
42. **Testes novos:** 15 em `mobileStart.test.mjs`, com `npm run test:mobile-start`: API UUID ausente, clone ausente/primeira ação/imutabilidade, coletor legado sem cópia, desgaste desconhecido preservado, vínculo duplicado/stale, oito variantes de save × oito caminhos de equipe/motor, stress e compactação.
43. **Total:** 211 aprovados: batalha 178 + gameplay-audit 10 + equipment 8 + mobile-start 15.
44. **Build:** build de produção final concluído com exit code 0. Fixture temporária de QA removida. Smoke adicional no build final pela rota `/batalha`, 390×844, Deck antigo: match `35b0a8bf-9544-41af-b8fc-3b365a233996`, `BATTLE_ACTIVE`, revisão 2 após a primeira ação. Evidência em `docs/qa/mobile-start-production.png`. Avisos já presentes de Browserslist/cache webpack/autoprefixer/follow-redirects; nenhum erro de compilação.
45. **Diff:** `git diff --check` aprovado; Git pode emitir aviso de LF/CRLF. Não houve deploy, limpeza de save nem migração remota.
46. **Riscos restantes:** causa do aparelho real não confirmada; Safari/Android físicos e CPU throttling real ausentes; novos E2E remotos de PvP/torneio/Badge/Journey pendentes; durabilidade desconhecida requer revisão segura para voltar a equipar aquela cópia, mantida no estoque. Crash de processo por memória do aparelho não é capturável por boundary React.

## Commit paralelo

Durante a tarefa entrou `bf90eb7` (`feat: enhance healing item effectiveness in ITEM_CATALOG`), alterando Cristal Vampírico de 10% para 15% e incluindo o fallback de clone já desenvolvido nesta auditoria. O commit foi preservado. Três testes antigos ainda esperavam o balanceamento anterior; foram atualizados para o contrato 15% e novo hash do catálogo. Esta correção não altera efeitos/preços/recompensas além dessa mudança externa já commitada.

## Reprodução e observabilidade

O trace de desenvolvimento `[BATTLE_START]` registra tentativa, modo, jogador, IDs dos três Pokémon, metadados de schema/reparo, slots/cópias relevantes, etapas, tamanho de snapshot/estado e erro com stack. Não registra credenciais nem inventário completo; fica desativado em produção.

QA utilizou uma rota temporária que montava o **BattlePage real** e semeava apenas origem isolada vazia `localhost:3103`; recusava semear se existissem coleção/estoque/moedas. O save não foi limpo entre testes. A rota foi removida antes do build final. O relatório não transforma testes de domínio em evidência de rede/servidor/dispositivo real.
