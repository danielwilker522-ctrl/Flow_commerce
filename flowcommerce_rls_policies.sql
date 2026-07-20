-- ================================================================
-- FlowCommerce - Políticas de Row Level Security (RLS)
-- Necessário para o frontend conseguir ler/escrever dados.
-- Modelo: cada utilizador só acede aos dados da sua própria empresa,
-- determinada através de profiles.company_id.
-- ================================================================

-- Função auxiliar (security definer) para evitar recursão de RLS
-- ao verificar a empresa do utilizador autenticado.
create or replace function public.get_my_company_id()
returns uuid
language sql
security definer
stable
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- ================================================================
-- COMPANIES
-- ================================================================
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select using (id = public.get_my_company_id() or id = auth.uid());

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert with check (id = auth.uid());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update using (id = public.get_my_company_id());

-- ================================================================
-- PROFILES
-- ================================================================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or company_id = public.get_my_company_id());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid());

-- ================================================================
-- CATEGORIES / SUPPLIERS / PRODUCTS / SALES / STOCK_MOVEMENTS /
-- CASH_REGISTER / DAILY_REPORTS / SETTINGS
-- Todas seguem o mesmo padrão: acesso total aos dados da própria empresa
-- ================================================================
do $$
declare
  t text;
begin
  foreach t in array array['categories','suppliers','products','sales','stock_movements','cash_register','daily_reports','settings']
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select using (company_id = public.get_my_company_id());', t, t);

    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (company_id = public.get_my_company_id());', t, t);

    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('create policy %I_update on public.%I for update using (company_id = public.get_my_company_id());', t, t);

    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format('create policy %I_delete on public.%I for delete using (company_id = public.get_my_company_id());', t, t);
  end loop;
end $$;

-- ================================================================
-- SALES_ITENS (não tem company_id direto — liga-se através de sales)
-- ================================================================
drop policy if exists sales_itens_select on public.sales_itens;
create policy sales_itens_select on public.sales_itens
  for select using (
    sales_id in (select id from public.sales where company_id = public.get_my_company_id())
  );

drop policy if exists sales_itens_insert on public.sales_itens;
create policy sales_itens_insert on public.sales_itens
  for insert with check (
    sales_id in (select id from public.sales where company_id = public.get_my_company_id())
  );

drop policy if exists sales_itens_update on public.sales_itens;
create policy sales_itens_update on public.sales_itens
  for update using (
    sales_id in (select id from public.sales where company_id = public.get_my_company_id())
  );

drop policy if exists sales_itens_delete on public.sales_itens;
create policy sales_itens_delete on public.sales_itens
  for delete using (
    sales_id in (select id from public.sales where company_id = public.get_my_company_id())
  );

-- ================================================================
-- Fim das políticas
-- ================================================================
