# Ranking global e Mestre Pokémon — auditoria inicial

Status: implementação parcial; escolha da autoridade de identidade/resultados pendente. Não há ranking global, migration aplicada ou pagamento do bônus nesta etapa.

## Contratos atuais verificados

- Identidade: `webStore` persiste `trainer-profile` no IndexedDB com `playerId`, `displayName` e `avatarId`. Preservar esse ID e o save existente. `useTrainerProfile` usa a mesma identidade em `/perfil`.
- Estatísticas: `economy.progress.playerStats` é local, com agregados, modos e IDs processados. A normalização limita os recibos aos últimos 250 resultados; isso não constitui um ledger permanente para competição global.
- Recompensas: `rewardVictory` usa uma transação IndexedDB e os últimos 100 `rewardedMatchIds`. Journey e torneios têm liquidação própria. Não alterar valores nem reutilizar o limite de 100 para uma garantia permanente de bônus único.
- Resultados: `rewardFinishedBattle` observa a conclusão do motor no navegador. CPU é resolvida localmente; PvP usa o navegador host e Realtime. Não existe executor/verificador de partidas no servidor.
- Infraestrutura: os clientes de insígnias, torneios e Realtime usam a chave pública Supabase, com `persistSession: false`. Não existe vínculo autenticado entre a identidade pública e o cliente.
- Dados compartilhados: `competitive_players`, `competitive_battle_activity`, `badges`, `badge_history`, `badge_challenges`, `badge_challenge_battles`, `tournaments`, `tournament_players`, `tournament_matches`.
- Insígnias: `badges.code`/`type` únicos e `owner_player_id` são a posse atual. `BADGE_CONFIG` fornece as 18 definições; desafios novos exigem 3 vitórias. Defesa histórica deve usar `badge_history`, pois `badges.defense_count` reinicia na transferência.

## Limite de segurança concreto

`register_competitive_player`, `record_competitive_battle_activity` e `record_badge_battle_result` são funções SECURITY DEFINER executáveis por `anon`. O vencedor e IDs são argumentos enviados pelo navegador. As migrations de torneios também expõem liquidação pública; a migration inicial permite inserção/atualização pública das tabelas de torneio. RLS que bloqueia UPDATE direto não valida os argumentos de uma RPC pública.

Portanto, uma nova tabela com contadores bloqueados por RLS, mas alimentada por triggers desses resultados, ainda herdaria resultados falsificáveis. Autenticar o jogador isoladamente também não prova que venceu: a validação da partida precisa ocorrer no servidor. Não promover os totais locais nem backfill dos vencedores históricos a estatísticas verificadas sem essa distinção.

Essa auditoria é do código e migrations no checkout; políticas efetivamente instaladas no Supabase remoto não foram consultadas.

## Decisão solicitada

1. Vincular autenticação ao `playerId` existente e implementar validação de partidas no servidor. Isso muda o fluxo competitivo e exige endurecer as origens de resultados; o save privado permanece local. A vinculação de IDs antigos precisa de uma política de reivindicação, pois conhecer um ID público não prova sua posse.
2. Manter o jogo sem login e restringir estatísticas pontuáveis a fontes realmente verificadas. Na arquitetura atual CPU, PvP, torneios e desafios são client-authoritative; portanto não podem alimentar um ranking antifraude só por estarem no banco. Essa opção não satisfaz todos os modos pedidos até surgir uma autoridade confiável.

Não escolher silenciosamente uma dessas opções: a primeira muda a experiência de identidade; a segunda reduz o escopo competitivo solicitado.

## Trabalho independente realizado

- `src/lib/profile/pokemonMaster.js`: detecção central exige cada código de `BADGE_CONFIG` atualmente pertencente ao mesmo `playerId`. Duplicatas, códigos desconhecidos e contagem enviada pelo cliente não ativam o título.
- `selectBadgeProfile` expõe `isPokemonMaster` a partir da posse compartilhada, preservando a inscrição a mudanças já usada pelo perfil.
- `/perfil` apresenta o título dourado com a coroa existente quando os dados competitivos carregaram com sucesso. Oculta durante carregamento/erro, evitando apresentar título ativo baseado em uma falha de atualização.
- Sem novo ID, transferência do save, mudança no motor, valores de recompensa ou pagamento do bônus.
- Quatro testes cobrem 17/18, 18/18, duplicatas, códigos desconhecidos, outro dono, perda/recuperação e entrada inválida.

## Contratos propostos para a próxima etapa

- Ledger servidor permanente e único por `(match_id, player_id)`, aceitando apenas resultado verificado; atualização de estatísticas, streak e autorização do bônus em uma transação.
- Bônus 1.500, vitória ou derrota, para CPU padrão, PvP padrão e Journey completos; exclui abandono, cancelamento, desafios de insígnias e torneios. Checar as 18 posses atuais no momento da liquidação, com sincronização transacional com transferências.
- Entrega do recibo ao IndexedDB com aplicação única permanente, nunca pelo evento de abertura do modal. Precisará resolver recuperação em dispositivos diferentes para evitar aplicar o mesmo pagamento a carteiras locais independentes.
- Poder calculado centralmente a partir de agregados verificados, sem moedas; CPU com contribuição limitada, taxa de vitória suavizada e peso maior para competição/insígnias. Os pesos serão documentados na implementação, não ajustados a um vencedor predefinido.
- Ranking público somente com identidade canônica, nome/avatar e agregados permitidos. Nenhum inventário, instância, equipe, sala ou save.
- Índice composto na ordem do poder e desempates, página limitada, Top 3 e posição própria; sem coleções ou N+1. Entrada em `/perfil`, mantendo a barra móvel atual.
- Estatísticas sem histórico verificável iniciam numa baseline explícita; não inventar coleção, vitórias ou streaks a partir de dados não auditáveis.

## Validação desta etapa

Os quatro testes do título passaram. `git diff --check` passou. Build de produção executado nesta etapa; ver resultado comunicado na resposta. Ranking, segurança remota, bônus e QA de podium nos seis tamanhos continuam pendentes da decisão arquitetural; não são apresentados como concluídos.
