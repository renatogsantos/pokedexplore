# Relatório do sistema de durabilidade

1. **Itens antes permanentes:** os 28 equipamentos reutilizáveis estão identificados individualmente na [auditoria](item-durability-audit.md), com categoria, consumo, slot, descrição canônica e novo ciclo.
2. **Ciclo anterior:** quantidade por item no inventário; equipamento por ID de catálogo; reutilizáveis apresentados como PERMANENTE.
3. **Novo ciclo:** BAG, SINGLE_USE e DURABLE explícitos no catálogo. DURABLE usa `durabilityMax` central, atualmente 5 batalhas.
4. **Mantidos de uso único:** Fruto Vital, Núcleo de Cura, Folha Regeneradora, Amuleto de Sobrevivência, Placa Guardiã, Espelho Arcano, Purificador, Cristal de Impacto, Símbolo de Retorno, Fragmento Especial, Coração da Fênix, Fragmento do Vazio, Relógio Celestial, Espelho Prismático e Ampulheta Quebrada. As 15 unidades de Mochila continuam baseadas em quantidade.
5. **Estratégicos convertidos:** Cristal Resistente, Garra de Poder, Núcleo Elemental, Carga Instável, Botas de Impulso, Olho do Estrategista, Espinho Venenoso, Cristal Vampírico, Coroa do Desafiante e Cristal da Fúria.
6. **Relíquias convertidas:** todas as 18; nomes, tipos e efeitos na auditoria. TMs mantêm seu aprendizado permanente.
7. **Durabilidade:** `durability` e `maxDurability` por cópia, limitadas pelo catálogo. Ativação, ataque e preview não decrementam.
8. **Cópias físicas:** `economy.durableItems[instanceId]`, com itemId, durabilidade e máximo; identificador persistido e contador monotônico que não reutiliza IDs de cópias quebradas.
9. **Inventário:** quantidade permanece como agregado compatível do número de cópias utilizáveis. Compra e concessão criam novas cópias, sem reparar as antigas.
10. **Equipamento persistido:** preserva IDs de catálogo/heldItem legado e acrescenta referências de cópia e snapshot de durabilidade. Um mesmo instanceId não pode ocupar dois Pokémon.
11. **Estratégico:** `strategicItemInstanceId`; consumíveis continuam consumidos no gatilho canônico.
12. **Relíquia:** `elementalRelicInstanceId`, independente do slot estratégico e com compatibilidade de tipo preservada.
13. **Compra:** transação de compra gera cópia nova 5/5, retorna economia atualizada e mantém preço. Quantidades maiores geram cópias independentes.
14. **Migração:** transação única em player+pokedex nos stores existentes; marcador `durableEquipmentVersion=1`, catálogo v3 e Pokémon/save v7. Converte quantidades existentes em cópias e vincula equipamento a uma dessas cópias, sem unidade extra. Save moderno não recebe reposição automática. Referências inválidas são ignoradas/reparadas; equipamento legado sem estoque suficiente não gera novas unidades.
15. **Testes da migração:** quantidades 1 e 3, aliases heldItemId/strategicItemId/elementalRelicId/held_item, duas posições, itens vazios, consumíveis e reaplicação passaram. Null explícito não ressuscita aliases antigos.
16. **Batalha elegível:** matchId, estado finished, vencedor host/guest, startedAt/endedAt válidos e snapshot do jogador humano. Vitória e derrota contam. Pré-batalha, countdown abandonado e falha antes do início não contam. O código atual não cria um resultado final novo só por desconectar; sem resultado canônico não há desgaste.
17. **Liquidação:** `settleEquipmentWear` central, persistido por `webStore.settleBattleEquipmentWear`. O snapshot é capturado antes do countdown e registrado localmente; desgaste usa cópias comprometidas, não equipamento pós-batalha. Todos os integrantes da equipe contam, inclusive quem não entrou em campo.
18. **Idempotência:** recibo persistente por matchId+jogador, contendo todas as cópias liquidadas; duplicatas no snapshot são deduplicadas por instanceId. Recibo, desgaste, estoque e alterações nos Pokémon são atômicos. Resultado pendente é registrado antes da liquidação e pode ser retomado; falha mostra erro/repetição e impede confirmar nova equipe enquanto a pendência não for salva.
19. **CPU:** testes de domínio e motor passaram; navegador com IndexedDB real validou cinco partidas pelo fixture e uma derrota pelo fluxo normal /batalha. Derrota também produziu 5/5 → 4/5, confirmado depois na página /inventario.
20. **PvP:** teste de duas economias independentes passou. Persistência valida playerId local e nunca escreve inventário do adversário. QA de dois clientes reais conectados ao Supabase não foi executado.
21. **Torneio H×H:** reutiliza a arena e liquidação central; teste de duas identidades de partida descontou 2. Sem torneio remoto ao vivo nesta sessão.
22. **Torneio H×CPU:** mesmo caminho; teste por partida passou. CPU×CPU não passa pelo inventário humano. Sem torneio remoto ao vivo nesta sessão.
23. **Insígnias:** cada matchId da série tem recibo próprio; teste de três partidas descontou 3. Sem série remota completa no navegador.
24. **Jornada:** estrutura atual tem três batalhas independentes por etapa; /batalha usa o mesmo adaptador. Teste de três matchIds descontou 3. Sem expedição completa no navegador.
25. **Revanche:** novo matchId significa novo desgaste. Teste de duas partidas e partidas sequenciais no navegador passaram.
26. **Quebra:** ao concluir a quinta batalha, 1/5 vira 0/5; cópia removida, quantidade reduzida e todas as referências àquela cópia limpas atomicamente. Ela funciona durante toda a última partida.
27. **Reserva:** navegador confirmou reserva 5/5 intocada quando a cópia equipada quebrou; slot ficou vazio. Outra cópia só foi equipada após escolha explícita.
28. **Loja:** DURÁVEL e número de batalhas nos cartões; ×N continua disponível. Nenhuma mudança de preço.
29. **Modal:** durabilidade da cópia selecionada, máximo em batalhas e explicação do desgaste; descrições de efeito preservadas.
30. **Preparação/seletor:** cópia atual primeiro; outras por menor durabilidade e ID estável. Cópias distinguíveis, atual continua visível mesmo sem estoque livre, aviso ÚLTIMA BATALHA em 1/5. Pré-batalha normal validada no navegador.
31. **HUD:** indicador compacto de durabilidade junto ao item. Snapshot não diminui no gatilho; nova informação de desgaste só aparece no resultado.
32. **Pós-batalha:** painel compacto de mudanças, de X/5 para Y/5, inclusive derrota.
33. **Quebra na UI:** ITEM QUEBRADO, nome, 1/5 → 0/5 e EQUIPAR OUTRA; ação retorna à preparação, sem compra ou equipamento automático. Validado no navegador.
34. **Desempenho:** índices de reservas/cópias construídos por snapshot, sem DB por cartão; migração verifica marcador e só varre coleção uma vez. Liquidação usa uma transação para todos os equipamentos e devolve apenas Pokémon alterados para atualizar a memória. Foi alinhado o saveVersion para evitar a regravação recorrente da coleção. Teste existente de 1.500 registros passou; profiler mobile não executado.
35. **Regressões novas:** 28 testes de durabilidade, incluindo preservação de metadados por hash do catálogo anterior, migração, cópias, reservas, cinco partidas, quebra, replay, dois slots, snapshot, derrota, cancelamento, modos, 1/5 no motor real, preview, limites e aliases. Expectativas antigas de rótulo/saveVersion foram atualizadas.
36. **Total:** 172 testes relevantes passaram, sem falhas.
37. **Build:** produção aprovada; avisos existentes de Browserslist, cache webpack, CSS e dependência debug opcional.
38. **Diff:** `git diff --check` aprovado.
39. **Limites:** não houve deploy nem migração de saves de produção. Migração é local e ocorre ao abrir a versão atualizada. Teste visual usou origem localhost:3112 separada do save habitual; página fixture removida. PvP/torneios/insígnias/jornada ao vivo, reconexão entre dois clientes, quota/aborto forçado de IndexedDB e profiler mobile permanecem sem QA. Recibos não são descartados para preservar a garantia contra replay histórico.
40. **Ambiguidades:** nenhuma classificação ficou pendente. A Placa Guardiã citada como possível durável no exemplo é consumível no catálogo/motor e foi mantida de uso único. Coração da Fênix também permanece consumível. Nenhum efeito, percentual, preço, raridade, limite ou condição de ativação foi alterado.

## Evidência do cenário Pérola Abissal

- Compra via purchaseUpgrade criou duas cópias 5/5 no IndexedDB isolado.
- Seletor real vinculou uma a Wartortle.
- A cópia vinculada passou por 5/5 → 4/5 → 3/5 → 2/5 → 1/5 → quebra.
- Repetição do resultado não descontou novamente.
- Cartão PÉROLA ABISSAL / EM EFEITO apareceu e desapareceu sem outro ataque; HUD conservou 4/5 durante aquela partida.
- Em 1/5, a ativação continuou funcionando e o seletor/HUD mostraram ÚLTIMA BATALHA.
- Após quebra: apenas a reserva 5/5 permaneceu; slot vazio; ITEM QUEBRADO / EQUIPAR OUTRA visíveis.
- Reposição exigiu seleção explícita.
- Depois, a página normal /batalha concluiu uma derrota e confirmou desgaste 5/5 → 4/5; navegação a /inventario confirmou persistência, Possui 1 / Equipados 1 / Disponíveis 0.

## Preços para avaliação futura

Os preços atuais foram preservados. Uma Pérola Abissal de 330 moedas representa 66 moedas por batalha ao usar suas cinco durabilidades; uma Coroa do Desafiante de 2.550 representa 510 moedas por batalha. Isso aumenta o custo recorrente de levar equipamentos em relação ao modelo anterior e merece análise de economia antes de qualquer ajuste futuro. Não foi introduzido reparo ou recompra automática.
