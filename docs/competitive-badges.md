# Sistema competitivo de Insígnias

## Arquitetura

O sistema é local-first: coleção, níveis, itens, moedas, Decks e progressão continuam no IndexedDB (`PokedExploreDB`). O perfil local `trainer-profile` fornece o `playerId` estável e o nome usados pela camada competitiva.

O Supabase armazena somente estado compartilhado: jogadores competitivos, as 18 Insígnias, desafios, resultados idempotentes de cada batalha, atividade válida e histórico. A interface usa uma consulta central e uma assinatura Realtime para a coleção; nenhuma carta cria sua própria assinatura.

O modo de Insígnia reutiliza `createBattleState`, `resolveAction`, `BattleArena`, `TeamSelector`, os Decks e o canal Realtime existentes. No PvP, o desafiante é o host autoritativo e o campeão é o guest. A equipe pode mudar antes de cada batalha.

## Banco e migração

Aplique, nesta ordem, `supabase/migrations/20260917_competitive_badges.sql` e `supabase/migrations/202609170001_badge_challenge_cancellation.sql` pelo fluxo de migrações do projeto antes de testar. As migrações criam:

- `competitive_players`
- `badges` e o seed idempotente dos 18 tipos
- `badge_challenges` e o índice parcial que permite um único desafio ativo por Insígnia
- `badge_challenge_battles`, usado para impedir resultado duplicado
- `competitive_battle_activity`, usado para atividade idempotente
- `badge_history`

As funções `start_badge_challenge` e `record_badge_battle_result` bloqueiam as linhas envolvidas e fazem criação, progresso, defesa e transferência em transações do Postgres. `release_expired_badge_state` usa `now()` do servidor, expira desafios abandonados e libera todas as Insígnias de jogadores sem batalha concluída há 48 horas. A migração agenda essa função a cada minuto com `pg_cron`; as leituras também a invocam, mantendo a regra verificável no servidor.

`cancel_badge_challenge` encerra explicitamente uma tentativa com bloqueio e revalidação das linhas do desafio e da Insígnia. CPU volta a `AVAILABLE`; PvP ainda não iniciado volta a `OWNED` sem defesa; abandono explícito após o início oficial mantém o campeão e soma exatamente uma defesa. A linha do desafio permanece como registro terminal e não são criados resultados de batalha fictícios. `accept_badge_challenge` registra a aceitação do campeão e `mark_badge_challenge_started` separa a espera PvP do início real da série.

## Regras e recompensas

As constantes e metadados ficam em `src/lib/badges/config.js`. As regras puras ficam em `src/lib/badges/rules.js`:

- equipe com exatamente 3 Pokémon;
- pelo menos um Pokémon do tipo da Insígnia, inclusive tipo secundário;
- Lendários e Míticos proibidos, inclusive customizados;
- quatro vitórias consecutivas; a primeira derrota encerra a série;
- bônus global de campeão de 25%, sem acumular por Insígnia.

O bônus é aplicado por `calculateBattleRewards` somente em CPU normal e PvP normal. Torneios e Desafios de Insígnia não o recebem. A concessão local continua idempotente por `matchId`.

## Atividade e ciclo do desafio

`recordCompetitiveBattleActivity` registra apenas batalhas concluídas de CPU, PvP e torneio. Desafios de Insígnia registram os participantes dentro da mesma função transacional que processa o resultado. Abrir o app, navegar, abandonar uma luta ou editar um Deck não atualiza atividade.

Fluxo: iniciar desafio -> preparar uma equipe válida -> concluir batalha -> host registra o resultado -> Postgres avança a série ou encerra -> ambos recebem a atualização -> nova equipe pode ser preparada. Em 4–0, a transferência e o histórico são gravados atomicamente; numa vitória do defensor, `defense_count` incrementa uma única vez. Fechar modal, navegar ou atualizar o navegador nunca cancela uma tentativa: cancelamento e abandono exigem confirmação explícita do desafiante.

## Arte

As 18 artes finais otimizadas ficam em `public/badges/`, com os nomes `badge-normal.png`, `badge-fire.png`, ..., `badge-fairy.png`. O mapa central está em `src/lib/badges/config.js` e mantém os SVGs de tipo existentes como fallback caso uma arte falhe ao carregar. Não há proprietário, histórico ou resultado fictício.

## Teste manual

CPU: abra Jornada -> Insígnias, escolha uma disponível, conquiste e vença quatro batalhas. Troque a equipe entre rodadas e confirme que uma derrota encerra o desafio.

Cancelamento CPU: inicie uma tentativa, volte ao detalhe e use `Cancelar desafio`. Confirme que o diálogo começa com foco em `Voltar`, que o X apenas fecha o detalhe e que atualizar a página preserva a tentativa. Após confirmar o cancelamento, verifique `badge_challenges.status = 'CANCELLED'`, a Insígnia em `AVAILABLE` e uma nova tentativa começando em 0/4.

PvP com dois clientes: o cliente A deve possuir a Insígnia. No cliente B, inicie o desafio; no cliente A, abra a mesma Insígnia e entre na disputa. Confirme equipes legais nos dois lados, jogue quatro batalhas e verifique o placar compartilhado. No 4–0, confira proprietário, bônus e histórico nos dois clientes. Depois repita com uma vitória do defensor e confirme uma única defesa.

Cancelamento PvP: antes do início oficial, confirme que apenas o desafiante vê `Cancelar desafio`, que o campeão permanece e nenhuma defesa é somada. Depois da aceitação e do início da primeira batalha oficial, confirme a mudança para `Abandonar desafio` e uma única defesa para o campeão, inclusive sob duplo envio.

Para validar expiração, altere timestamps apenas em um ambiente de teste e execute `select public.release_expired_badge_state();`. Não use o relógio do navegador como prova da regra.
