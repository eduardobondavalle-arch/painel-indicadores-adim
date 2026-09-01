# Painel de Indicadores — Adim Aluguéis

Aplicação web para coleta e gestão dos indicadores mensais das gestoras de carteira. O formulário público e o painel administrativo usam o mesmo banco Supabase, mas são isolados por Row Level Security (RLS) e por funções SQL com escopo mínimo.

## O que está entregue

- `/formulario`: formulário público responsivo, seis etapas, 55 indicadores aprovados, validação por etapa, máscara BRL, salvamento local temporário, revisão, alertas não bloqueantes, confirmação e protocolo.
- `/gestao`: autenticação Supabase e painel protegido.
- Visão geral mensal com recebidos, pendentes, alertas e principais volumes.
- Cadastro de gestoras ativas/inativas e controle de períodos.
- Lista filtrável de envios e resposta individual com os valores original e atual.
- Edição administrativa com justificativa obrigatória e histórico imutável.
- Reabertura com autorização de substituição e exclusão exclusivamente lógica.
- Comparativo lado a lado, média, maior/menor valor, ordenação e gráfico isolado por escala.
- Evolução mensal/trimestral e comparação com a média da equipe.
- Ranking individual sempre disponível; score geral e bônus ficam bloqueados até a configuração estar completa.
- Parâmetros para cinco pilares, pesos, metas, direção, travas, veto e faixas de R$ 300/R$ 500/R$ 800.
- Exportações de resposta em PDF/CSV e consolidação, comparativo, histórico e relatório restrito em XLSX.
- Campos 16 e 17 destacados como “Gerencial restrito”.
- Scripts seguros para criar/redefinir o administrador e inserir dados fictícios identificados.
- Testes unitários e testes E2E condicionais contra um Supabase real.

## Arquitetura e segurança

O navegador nunca recebe a `service_role`. A chave fica restrita aos scripts locais de configuração. Em produção, o formulário chama uma rota pública do Next.js que usa somente a chave `anon`; a escrita ocorre pela função SQL `submit_monthly_response`, marcada como `SECURITY DEFINER` e limitada às seguintes verificações:

1. gestora cadastrada e ativa;
2. período aberto e dentro do prazo;
3. exatamente 55 chaves únicas;
4. confirmação da conferência;
5. apenas uma resposta ativa por gestora/período, salvo substituição previamente autorizada.

Usuários anônimos não têm `SELECT`, `UPDATE` ou `DELETE` em nenhuma tabela. Usuários autenticados só enxergam os dados se tiverem um perfil ativo em `admin_users`. Mutações sensíveis de respostas passam por RPCs administrativas que registram usuário, data, valor anterior, valor novo e justificativa.

Principais tabelas:

- `admin_users`
- `managers`
- `submission_periods`
- `responses`
- `response_values`
- `consistency_alerts`
- `scoring_pillars`, `scoring_parameters`, `bonus_ranges`
- `change_history`
- `admin_logs`

A migração completa está em [`supabase/migrations/202609010001_initial_schema.sql`](supabase/migrations/202609010001_initial_schema.sql).

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Projeto Supabase ou Supabase CLI + Docker

## Configuração local com Supabase Cloud

1. Crie um projeto em [Supabase](https://supabase.com/dashboard).
2. No SQL Editor, execute `supabase/migrations/202609010001_initial_schema.sql`. Alternativamente, vincule o CLI e rode `npx supabase link` seguido de `npx supabase db push`.
3. Em **Authentication > Providers > Email**, mantenha o provedor de e-mail ativo. O cadastro público deve permanecer desabilitado.
4. Copie `.env.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=chave-anon
SUPABASE_SERVICE_ROLE_KEY=chave-service-role
ADMIN_INITIAL_EMAIL=gestao@adimimoveis.com.br
ADMIN_INITIAL_PASSWORD=uma-senha-forte-temporaria
ADMIN_INITIAL_NAME="Direção Adim"
```

`SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_INITIAL_PASSWORD` nunca podem usar o prefixo `NEXT_PUBLIC_`.

5. Instale e configure a conta administrativa:

```bash
npm install
npm run admin:create
```

Para reproduzir a credencial inicial especificada no briefing, use `Adim2016!` apenas como valor temporário de `ADMIN_INITIAL_PASSWORD`, execute o script e altere a senha no primeiro acesso em **Minha conta**. Depois, remova a variável de senha do ambiente. O script também redefine de forma segura a senha de um administrador existente; nenhuma senha é salva na tabela `admin_users`.

6. Cadastre pelo painel as gestoras reais e abra um período. Opcionalmente, carregue dois cadastros fictícios e uma resposta claramente marcada:

```bash
npm run demo:seed
```

7. Inicie a aplicação:

```bash
npm run dev
```

- Formulário: <http://localhost:3000/formulario>
- Gestão: <http://localhost:3000/gestao>

## Supabase local

Com Docker e o Supabase CLI:

```bash
npx supabase start
npx supabase db reset
```

Copie a URL, a chave `anon` e a `service_role` exibidas pelo CLI para `.env.local`; em seguida execute `npm run admin:create` e, se desejado, `npm run demo:seed`.

## Fluxos operacionais

### Envio público

A gestora precisa estar ativa e usar exatamente o e-mail cadastrado. O período precisa estar aberto. O rascunho é salvo apenas no dispositivo até o envio; o registro definitivo é persistido no Postgres e o rascunho é apagado após a confirmação.

As divergências aritméticas aparecem na revisão, mas não substituem nem bloqueiam os valores informados. Os alertas aceitos são salvos junto da resposta.

### Correção ou substituição

- **Editar valor:** abre a resposta no painel, altera o indicador e informa a justificativa. O original nunca é sobrescrito na coluna `original_*`.
- **Substituir formulário:** usa **Reabrir**. O envio seguinte marca o anterior como `replaced` e cria uma nova resposta permanente.
- **Excluir:** usa exclusão lógica (`status = deleted`); não existe exclusão física na interface.

### Pontuação

O score só aparece quando:

- os cinco pilares têm pesos e travas;
- os pesos dos pilares somam 100%;
- todos os indicadores habilitados têm pilar, peso, metas e direção;
- os pesos dos indicadores de cada pilar usado somam 100%;
- as três faixas de bônus têm nota mínima.

Qualquer lacuna mantém score e bônus ocultos. Rankings individuais não dependem dessa configuração.

## Testes e validação

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Os testes unitários cobrem o catálogo dos 55 campos, validação condicional, números brasileiros, alertas, cálculos, exportação e trava da pontuação.

Para testar login, envio completo, isolamento, duplicidade e exportação contra um banco real, preencha as variáveis `E2E_*` de `.env.example`, rode a aplicação e execute:

```bash
npm run test:e2e
```

O teste de envio cria/atualiza uma gestora marcada como demonstração, abre o período atual, envia os 55 campos, confirma o protocolo e tenta um segundo envio para validar o bloqueio de duplicidade.

## Deploy na Vercel

1. Envie o repositório para seu provedor Git e importe-o na Vercel como projeto Next.js.
2. Configure somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no ambiente de execução da aplicação.
3. Não configure `SUPABASE_SERVICE_ROLE_KEY` na Vercel: ela é necessária apenas nos scripts locais de administração e demonstração.
4. No Supabase, adicione o domínio da Vercel em **Authentication > URL Configuration**.
5. Aplique as migrações antes do primeiro deploy e crie o administrador por uma máquina confiável.
6. Faça o deploy e valide `/formulario`, `/gestao`, uma exportação e o bloqueio anônimo de `/gestao/visao-geral`.

O projeto usa o preset padrão de Next.js da Vercel e não requer armazenamento efêmero: todos os dados definitivos ficam no Supabase Postgres.

## Comandos úteis

| Comando | Finalidade |
|---|---|
| `npm run dev` | servidor local |
| `npm run admin:create` | criar ou redefinir o administrador inicial |
| `npm run demo:seed` | dados fictícios identificados |
| `npm test` | testes unitários |
| `npm run test:e2e` | testes de integração no navegador |
| `npm run build` | build de produção |

## Tratamento de segredos

- `.env.local` está no `.gitignore`.
- Nunca copie a `service_role` para código do navegador, Vercel ou logs.
- Troque a senha temporária no primeiro acesso.
- Em caso de vazamento, rotacione a chave no Supabase e redefina a senha administrativa pelo script.
