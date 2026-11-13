-- =============================================================================
-- 156_budgets.sql — 예산 한도·초과 알림 (9-23, D-267)
-- 사용자 결정(2026-11-13): 회사 전체 월 예산 + 계정과목별 예산(넣고 싶은 것만). 예산을 안 넣으면 쓴 만큼만 보여 주고 알림 없음.
-- - 세는 것: 사용일 기준 그 달, 결재 올린 것(submitted) + 승인(approved) + 지급(paid). 임시 저장·반려 제외. 회사 부담액 기준
-- - 알림: 80%·100%를 넘는 순간 관리자 [알림]방 카드(+ 앱 알림은 기존 알림 푸시가 가져감). 같은 달·같은 예산·같은 단계는 한 번
-- - 막지 않는다(알려 주기만). 직원에게는 예산을 보여 주지 않는다(관리자 함수만)
-- - 플랜: 프로·비즈니스(billing_plans.budget_alerts). 결제 연동 전 = private.effective_plan()(프로)
-- =============================================================================

alter table public.billing_plans add column budget_alerts boolean not null default false;
update public.billing_plans set budget_alerts = (code in ('standard', 'pro')), updated_at = now() where code in ('starter', 'standard', 'pro');

-- 예산: account_title_id null = 회사 전체
create table public.company_budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  account_title_id uuid,
  monthly_amount integer not null check (monthly_amount between 1 and 2000000000),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (account_title_id, company_id) references public.account_titles (id, company_id) on delete cascade,
  unique nulls not distinct (company_id, account_title_id)
);
alter table public.company_budgets enable row level security;
alter table public.company_budgets force row level security;
revoke all on public.company_budgets from anon, authenticated;

-- 알림 보낸 기록(달·예산·단계마다 한 번)
create table public.budget_alert_logs (
  company_id uuid not null references public.companies (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  account_title_id uuid,
  level integer not null check (level in (80, 100)),
  created_at timestamptz not null default now(),
  unique nulls not distinct (company_id, month, account_title_id, level)
);
alter table public.budget_alert_logs enable row level security;
alter table public.budget_alert_logs force row level security;
revoke all on public.budget_alert_logs from anon, authenticated;

-- 그 달 쓴 돈(계정과목별 + 전체). 회사 부담액(없으면 금액)
create or replace function private.budget_spent(p_company uuid, p_month text)
returns table (account_title_id uuid, account_title_name text, spent bigint)
language sql stable security definer
set search_path = ''
as $$
  select i.account_title_id, max(coalesce(t.name, i.account_title_name)), sum(coalesce(i.company_supported_amount, i.amount, 0))::bigint
  from public.expense_items i
  join public.expense_claims c on c.id = i.claim_id and c.company_id = i.company_id
  left join public.account_titles t on t.id = i.account_title_id and t.company_id = i.company_id
  where i.company_id = p_company
    and c.status in ('submitted', 'approved', 'paid')
    and to_char(coalesce(i.expense_date, c.submitted_at::date), 'YYYY-MM') = p_month
  group by i.account_title_id
$$;
revoke all on function private.budget_spent(uuid, text) from public, anon, authenticated;

-- 관리자: 그 달 예산 현황(쓴 만큼 + 예산이 있으면 비율)
create or replace function public.budget_status(p_month text default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_month text := coalesce(p_month, private.kst_month(now()));
  v_total bigint;
begin
  if v_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  select coalesce(sum(spent), 0) into v_total from private.budget_spent(v_admin.company_id, v_month);
  return jsonb_build_object(
    'month', v_month,
    'enabled', (private.effective_plan(v_admin.company_id)).budget_alerts,
    'plan', (private.effective_plan(v_admin.company_id)).name,
    'total_spent', v_total,
    'total_budget', (select monthly_amount from public.company_budgets where company_id = v_admin.company_id and account_title_id is null),
    'titles', coalesce((
      select jsonb_agg(jsonb_build_object('account_title_id', x.id, 'name', x.name, 'spent', x.spent, 'budget', x.budget) order by x.budget is null, x.spent desc, x.name)
      from (
        select t.id, t.name, coalesce(s.spent, 0) as spent, b.monthly_amount as budget
        from public.account_titles t
        left join private.budget_spent(v_admin.company_id, v_month) s on s.account_title_id = t.id
        left join public.company_budgets b on b.company_id = t.company_id and b.account_title_id = t.id
        where t.company_id = v_admin.company_id and (coalesce(s.spent, 0) > 0 or b.monthly_amount is not null)
      ) x
    ), '[]'::jsonb),
    'unmapped_spent', coalesce((select spent from private.budget_spent(v_admin.company_id, v_month) where account_title_id is null), 0)
  );
end;
$$;

-- 관리자: 예산 저장(전체 + 계정과목별 통째로). 빈 값 = 그 예산 없음
create or replace function public.budget_save(p_total integer, p_titles jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  r record;
begin
  if not (private.effective_plan(v_admin.company_id)).budget_alerts then raise exception 'PLAN_REQUIRED'; end if;
  if p_total is not null and p_total not between 1 and 2000000000 then raise exception 'INVALID_AMOUNT'; end if;
  if p_titles is not null and jsonb_typeof(p_titles) <> 'array' then raise exception 'INVALID_AMOUNT'; end if;
  delete from public.company_budgets where company_id = v_admin.company_id;
  if p_total is not null then
    insert into public.company_budgets (company_id, account_title_id, monthly_amount, updated_by) values (v_admin.company_id, null, p_total, v_admin.id);
  end if;
  for r in select (e ->> 'account_title_id')::uuid as tid, (e ->> 'amount')::integer as amount from jsonb_array_elements(coalesce(p_titles, '[]'::jsonb)) e loop
    if r.amount is null then continue; end if;
    if r.amount not between 1 and 2000000000 then raise exception 'INVALID_AMOUNT'; end if;
    if not exists (select 1 from public.account_titles where id = r.tid and company_id = v_admin.company_id) then raise exception 'NOT_FOUND'; end if;
    insert into public.company_budgets (company_id, account_title_id, monthly_amount, updated_by) values (v_admin.company_id, r.tid, r.amount, v_admin.id)
    on conflict (company_id, account_title_id) do update set monthly_amount = excluded.monthly_amount, updated_by = excluded.updated_by, updated_at = now();
  end loop;
end;
$$;

-- 관리자 결재 화면: 이 결의서가 들어간 달·계정과목의 예산 중 80%를 넘은 것.
-- 관리자가 보는 결의서는 이미 올라온 것(submitted 이상)이라 쓴 돈에 들어가 있다
create or replace function public.budget_claim_impact(p_claim uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
begin
  if not exists (select 1 from public.expense_claims where id = p_claim and company_id = v_admin.company_id) then raise exception 'NOT_FOUND'; end if;
  if not (private.effective_plan(v_admin.company_id)).budget_alerts then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(x order by x.pct desc)
    from (
      select distinct on (k.month, b.id) k.month, coalesce(t.name, '회사 전체') as name, b.monthly_amount as budget, sp.total as spent,
             round(sp.total * 100.0 / b.monthly_amount)::int as pct
      from (
        select distinct to_char(coalesce(i.expense_date, c.submitted_at::date, current_date), 'YYYY-MM') as month, i.account_title_id
        from public.expense_items i join public.expense_claims c on c.id = i.claim_id
        where i.claim_id = p_claim and i.company_id = v_admin.company_id
      ) k
      join public.company_budgets b on b.company_id = v_admin.company_id and (b.account_title_id is null or b.account_title_id = k.account_title_id)
      left join public.account_titles t on t.id = b.account_title_id
      cross join lateral (
        select coalesce(sum(s.spent), 0) as total from private.budget_spent(v_admin.company_id, k.month) s
        where b.account_title_id is null or s.account_title_id = b.account_title_id
      ) sp
      where sp.total * 100 >= b.monthly_amount * 80
    ) x
  ), '[]'::jsonb);
end;
$$;

-- 결재가 올라가거나 바로 승인되면(관리자 본인 결재) 그 달 예산 80·100%를 넘었는지 보고 관리자 [알림]방으로(한 번씩)
create or replace function private.budget_check(p_company uuid, p_month text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  b record;
  v_spent bigint;
  v_level integer;
  v_name text;
  v_body text;
  r record;
begin
  if not (private.effective_plan(p_company)).budget_alerts then return; end if;
  for b in select * from public.company_budgets where company_id = p_company loop
    select coalesce(sum(spent), 0) into v_spent from private.budget_spent(p_company, p_month) s
     where b.account_title_id is null or s.account_title_id = b.account_title_id;
    v_level := case when v_spent * 100 >= b.monthly_amount * 100 then 100 when v_spent * 100 >= b.monthly_amount * 80 then 80 else null end;
    if v_level is null then continue; end if;
    -- 100%를 넘으면 80% 기록도 같이 남겨 나중에 80% 알림이 따로 오지 않게
    if v_level = 100 then
      insert into public.budget_alert_logs (company_id, month, account_title_id, level) values (p_company, p_month, b.account_title_id, 80) on conflict do nothing;
    end if;
    insert into public.budget_alert_logs (company_id, month, account_title_id, level) values (p_company, p_month, b.account_title_id, v_level) on conflict do nothing;
    if not found then continue; end if;
    if not private.feature_enabled(p_company, 'messenger') then continue; end if;
    v_name := coalesce((select name from public.account_titles where id = b.account_title_id), '회사 전체');
    v_body := case when v_level = 100 then format('%s 예산을 넘었어요 (%s%%)', v_name, round(v_spent * 100.0 / b.monthly_amount))
                   else format('%s 예산의 %s%%를 썼어요', v_name, round(v_spent * 100.0 / b.monthly_amount)) end
      || E'\n' || format('%s월 %s원 중 %s원 · 결재 올린 것 포함', ltrim(split_part(p_month, '-', 2), '0'), to_char(b.monthly_amount, 'FM999,999,999,990'), to_char(v_spent, 'FM999,999,999,990'))
      || E'\n' || '막지는 않아요. 예산은 설정 › 경비 정책 › 예산에서 바꿀 수 있어요.';
    for r in select id from public.members where company_id = p_company and status = 'approved' and role in ('admin', 'super_admin') loop
      insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link)
      values (private.chat_notice_room(p_company, r.id), p_company, null, 'notice', v_body, '/workspace/' || p_company || '/admin/settings/budget');
    end loop;
  end loop;
end;
$$;
revoke all on function private.budget_check(uuid, text) from public, anon, authenticated;

create or replace function private.budget_claim_trg()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare v_month text;
begin
  if new.status in ('submitted', 'approved') and old.status not in ('submitted', 'approved', 'paid') then
    begin
      for v_month in
        select distinct to_char(coalesce(i.expense_date, new.submitted_at::date, current_date), 'YYYY-MM')
        from public.expense_items i where i.claim_id = new.id
      loop
        perform private.budget_check(new.company_id, v_month);
      end loop;
    exception when others then
      -- 예산 알림이 실패해도 결재는 그대로(알림은 보조)
      raise warning 'budget_check failed: %', sqlerrm;
    end;
  end if;
  return null;
end;
$$;
revoke all on function private.budget_claim_trg() from public, anon, authenticated;
create trigger expense_claims_budget_check
after update of status on public.expense_claims
for each row execute function private.budget_claim_trg();

revoke all on function public.budget_status(text), public.budget_save(integer, jsonb), public.budget_claim_impact(uuid) from public, anon;
grant execute on function public.budget_status(text), public.budget_save(integer, jsonb), public.budget_claim_impact(uuid) to authenticated;
