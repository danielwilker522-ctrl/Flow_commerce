# FlowCommerce — Frontend

Frontend em React + Vite ligado ao Supabase (projeto `eruccljcqorllmaddieg`).

## ⚠️ Antes de correr o projeto

1. Corre primeiro o ficheiro `flowcommerce_rls_policies.sql` no **SQL Editor** do Supabase (fora deste projeto). Sem isso, o RLS bloqueia todas as queries e a app não mostra dados.
2. As credenciais do Supabase já estão no ficheiro `.env`.

## Correr no StackBlitz

1. Cria um novo projeto Node/Vite no StackBlitz (ou faz upload desta pasta).
2. `npm install`
3. `npm run dev`

## Primeiro acesso

Na página de login, clica em "Criar conta" — isto cria automaticamente:
- Um utilizador de autenticação (Supabase Auth)
- Uma empresa (`companies`) com o nome que indicares
- Um perfil (`profiles`) com `role = 'admin'`, ligado a essa empresa

Dependendo das definições do projeto, pode ser pedida confirmação por email antes do primeiro login.

## Estrutura

- `src/lib/supabaseClient.js` — cliente Supabase
- `src/context/AuthContext.jsx` — sessão, perfil, empresa, login/signup/logout
- `src/pages/Dashboard.jsx` — indicadores do dia
- `src/pages/PDV.jsx` — ponto de venda (carrinho, pagamento, atualização de stock)
- `src/pages/CashRegister.jsx` — abertura/fecho de caixa
- `src/pages/Products.jsx`, `Categories.jsx`, `Suppliers.jsx` — CRUD

## Próximos passos sugeridos

- Página de Relatórios diários (`daily_reports`) com exportação PDF
- Página de Definições (`settings`)
- Gestão de utilizadores/funcionários por empresa
