# Régua de bonificação — planilha oficial

Referência matemática: `Controle_Bonificacao_Gestoras_1.xlsx` (abas `Cálculo`, `Lançamento` e `Parâmetros`). O formulário mantém seus 55 dados operacionais; os fatos complementares ficam em `response_bonus_inputs` e são auditados separadamente. Percentuais são representados em pontos de 0 a 100.

| KPI | Pilar (peso geral) | Dados de origem / cálculo | Meta 0% → 100% | Peso interno |
| --- | --- | --- | --- | --- |
| I1 taxa cobrada | 1 (35%) | `renovacoes_taxa_cobrada / eligible_renewals` | 0 → 50% | 40% |
| I2 migrações | 1 | `contratos_migrados_garantida` | 0 → 2 | 35% |
| I3 captação | 1 | `imoveis_locados_incorporados + imoveis_vagos_trazidos` | 0 → 1 | 25% |
| I4 renovação | 2 (25%) | `contratos_renovados / contratos_vencimento_mes` | 60 → 95% | 50% |
| I5 antecedência | 2 | `renovacoes_60_dias_ou_mais / (renovacoes_60_dias_ou_mais + renovacoes_menos_60_dias)` | 0 → 100% | 30% |
| I6 reajustes | 2 | `adjustments_on_time / adjustments_due` | 0 → 100% | 20% |
| I7 rescisões | 3 (15%) | `(rescisoes_sem_inconformidade + inconformidade_resolvida) / total_rescisoes` | 0 → 80% | 50% |
| I8 retenção | 3 | `desocupados_permaneceram_adim / eligible_vacancies` | 50 → 90% | 50% |
| I9 primeira resposta | 4 (15%) | `tempo_primeira_resposta_horas` | 24 → 4 h (menor é melhor) | 30% |
| I10 resolução | 4 | `tempo_resolucao_horas` | 96 → 48 h (menor é melhor) | 30% |
| I11 retrabalho | 4 | `chamados_reabertos / chamados_abertos` | 20 → 0% (menor é melhor) | 25% |
| I12 CSAT manutenção | 4 | `maintenance_csat` (escala própria 1–5, nunca NPS) | 3 → 4,5 | 15% |
| I13 resposta mensagens | 5 (10%) | `tempo_resposta_mensagens_horas` | 12 → 2 h (menor é melhor) | 35% |
| I14 proprietários | 5 | `nps_proprietarios`, pesquisa NPS 0–100 | 30 → 70 | 30% |
| I15 locatários | 5 | `nps_locatarios`, pesquisa NPS 0–100 | 30 → 70 | 20% |

O Pilar 5 soma ainda **15% ajustáveis para ausência de reclamação formal atribuível**, completando seus 100% internos. Reclamação válida oriunda de Google, Reclame Aqui ou Diretoria zera o *pilar inteiro*; não veta globalmente o bônus. Score geral = soma das notas dos cinco pilares ponderadas por 35/25/15/15/10%. Cada trava mínima começa em 70%. Score <50: R$0; ≥50: R$300; ≥70: R$500; ≥90 e todos os pilares ≥70: R$800; caso contrário o score ≥90 recebe R$500. Cash Go verificado = R$100 por adesão, fora do score. Bonificação de captação e comissão de migração permanecem rubricas à parte.

Quando o denominador de I1/I4/I6/I7/I8 é zero e o numerador também, o KPI recebe 100%, conforme a planilha; I5/I11 com volume zero recebem 0%. Dados não existentes não viram zero: score e bônus de performance ficam pendentes. As respostas antigas não tinham os fatos complementares; não se deve inventar CSAT, reajustes pontuais ou adesões verificadas a partir de NPS/percentuais antigos. Corrija com a interface administrativa, registrando responsável, justificativa e valores anterior/novo.

`src/lib/scoring.ts` centraliza as regras. Dashboard, ranking, comparativo e exportações chamam `src/lib/performance-data.ts`. A migração `202609160001_official_scoring.sql` preserva IDs e os 55 valores. Cada edição da régua cria uma versão; no primeiro fechamento o período é vinculado à versão e cada resposta recebe snapshot. Ao reabrir, conserva a régua fechada; correções administrativas após o fechamento geram novas revisões. As revisões não sobrescrevem snapshots anteriores.

Os cinco exemplos da aba `Cálculo`, colunas C–G, são exercícios de paridade em `tests/official-scoring.test.ts`: scores 88,7625; 57,7375; 71,5; 38,4; 68,213815789…; performance R$500/R$300/R$500/R$0/R$300 e Cash Go R$200/R$0/R$300/R$100/R$100.

## Implantação

As sete migrations antes ausentes (`202609020007`, `202609030001`–`202609030004`, `202609040001`, `202609090001`) foram recuperadas com `supabase migration fetch --linked`; nenhuma versão foi marcada como revertida ou recriada vazia. Elas pertencem ao histórico compartilhado do Supabase e não alteram a régua deste painel. O `supabase db push --dry-run` identificou **somente** `202609160001_official_scoring.sql` como pendente; ela foi aplicada em 16/09/2026. Depois, a inspeção do banco apontou 5 pilares, 15 parâmetros, 3 faixas e uma versão de regras, com os 4 envios e 220 valores operacionais preexistentes ainda presentes. As respostas antigas continuam sem backfill inferido para fatos inexistentes. A interface nova deve ser publicada em conjunto com o código que lê essas estruturas.
