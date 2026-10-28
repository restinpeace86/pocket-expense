-- =============================================================================
-- 082_card_reconcile_saved.sql — 법인카드 대조 보완 (D-154, D-111·D-112 변경)
-- 사용자 결정(2026-10-28): 대조 결과를 달별로 저장하고, 맞지 않는 건마다 처리를 골라(결의서 작성 요청·개인 사용·
-- 세무사 확인 필요·취소/환불·고침), 세무 마감 화면·세무 엑셀/ZIP·세무사무소에 함께 보여 준다. 막지는 않는다.
-- 올린 카드 내역 파일 자체는 여전히 저장하지 않는다(맞지 않는 건의 날짜·가맹점·금액·카드 끝 4자리만 남김).
-- =============================================================================

create table public.card_reconciliations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  period_from date,
  period_to date,
  matched integer not null default 0,
  personal integer not null default 0,
  missing integer not null default 0,
  extra integer not null default 0,
  cancelled integer not null default 0,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, month)
);

create table public.card_reconcile_issues (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references public.card_reconciliations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('missing', 'personal', 'extra')),
  fingerprint text not null check (char_length(fingerprint) <= 300),
  expense_date date,
  merchant text check (merchant is null or char_length(merchant) <= 100),
  amount bigint check (amount is null or amount >= 0),
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  item_id uuid references public.expense_items (id) on delete set null,
  claim_title text check (claim_title is null or char_length(claim_title) <= 200),
  member_name text check (member_name is null or char_length(member_name) <= 50),
  status text not null default 'open' check (status in ('open', 'claim_requested', 'personal_use', 'fixed', 'refunded', 'tax_review')),
  memo text check (memo is null or char_length(memo) <= 300),
  resolved_by_name text,
  resolved_at timestamptz,
  unique (reconciliation_id, fingerprint),
  -- 구분별로 고를 수 있는 처리
  check (status = 'open'
      or (kind = 'missing' and status in ('claim_requested', 'personal_use', 'tax_review'))
      or (kind = 'personal' and status in ('fixed', 'tax_review'))
      or (kind = 'extra' and status in ('refunded', 'fixed', 'tax_review')))
);
create index card_reconcile_issues_rec_idx on public.card_reconcile_issues (reconciliation_id);

do $$
declare t text;
begin
  foreach t in array array['card_reconciliations', 'card_reconcile_issues'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    -- 회사 관리자, 그리고 그 회사를 볼 수 있는 세무사무소 구성원이 읽는다. 쓰기는 함수로만
    execute format('create policy %I on public.%I for select to authenticated using ((company_id = (select private.current_company_id()) and (select private.is_admin())) or company_id in (select private.tax_office_company_ids()))', t || '_select', t);
  end loop;
end;
$$;

-- 대조 결과 저장(회사 관리자): 같은 달을 다시 대조하면 덮어쓰되, 같은 건(지문)에 고른 처리·메모는 그대로 옮긴다
create or replace function public.save_card_reconciliation(p_month text, p_file_name text, p_from date, p_to date, p_counts jsonb, p_issues jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_id uuid;
  v_old jsonb;
  i jsonb;
  v_prev jsonb;
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  if p_issues is null or jsonb_typeof(p_issues) <> 'array' or jsonb_array_length(p_issues) > 3000 then raise exception 'INVALID_RECONCILE'; end if;
  select id into v_id from public.card_reconciliations where company_id = v_admin.company_id and month = p_month for update;
  if v_id is not null then
    select coalesce(jsonb_object_agg(fingerprint, jsonb_build_object('status', status, 'memo', memo, 'by', resolved_by_name, 'at', resolved_at)), '{}'::jsonb)
      into v_old from public.card_reconcile_issues where reconciliation_id = v_id;
    delete from public.card_reconcile_issues where reconciliation_id = v_id;
    update public.card_reconciliations
       set file_name = left(p_file_name, 200), period_from = p_from, period_to = p_to,
           matched = coalesce((p_counts->>'matched')::int, 0), personal = coalesce((p_counts->>'personal')::int, 0),
           missing = coalesce((p_counts->>'missing')::int, 0), extra = coalesce((p_counts->>'extra')::int, 0),
           cancelled = coalesce((p_counts->>'cancelled')::int, 0), created_by_name = v_admin.name, updated_at = now()
     where id = v_id;
  else
    v_old := '{}'::jsonb;
    insert into public.card_reconciliations (company_id, month, file_name, period_from, period_to, matched, personal, missing, extra, cancelled, created_by_name)
    values (v_admin.company_id, p_month, left(p_file_name, 200), p_from, p_to,
            coalesce((p_counts->>'matched')::int, 0), coalesce((p_counts->>'personal')::int, 0), coalesce((p_counts->>'missing')::int, 0),
            coalesce((p_counts->>'extra')::int, 0), coalesce((p_counts->>'cancelled')::int, 0), v_admin.name)
    returning id into v_id;
  end if;
  for i in select * from jsonb_array_elements(p_issues) loop
    v_prev := v_old -> (i->>'fingerprint');
    begin
      insert into public.card_reconcile_issues (reconciliation_id, company_id, kind, fingerprint, expense_date, merchant, amount, last4, item_id, claim_title, member_name, status, memo, resolved_by_name, resolved_at)
      values (v_id, v_admin.company_id, i->>'kind', i->>'fingerprint', nullif(i->>'date', '')::date, left(nullif(i->>'merchant', ''), 100), nullif(i->>'amount', '')::bigint,
              nullif(i->>'last4', ''),
              -- 영수증은 우리 회사 것만 연결
              (select e.id from public.expense_items e where e.id = nullif(i->>'item_id', '')::uuid and e.company_id = v_admin.company_id),
              left(nullif(i->>'claim_title', ''), 200), left(nullif(i->>'member_name', ''), 50),
              coalesce(v_prev->>'status', 'open'), v_prev->>'memo', v_prev->>'by', (v_prev->>'at')::timestamptz)
      on conflict (reconciliation_id, fingerprint) do nothing;
    exception when check_violation or invalid_text_representation then
      raise exception 'INVALID_RECONCILE';
    end;
  end loop;
  return v_id;
end;
$$;

-- 건별 처리(회사 관리자). 세무사 확인 필요는 메모 필수
create or replace function public.set_card_issue_status(p_issue_id uuid, p_status text, p_memo text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  r public.card_reconcile_issues;
begin
  if p_status = 'tax_review' and v_memo is null then raise exception 'MEMO_REQUIRED'; end if;
  if v_memo is not null and char_length(v_memo) > 300 then raise exception 'INVALID_RECONCILE'; end if;
  begin
    update public.card_reconcile_issues
       set status = p_status, memo = v_memo,
           resolved_by_name = case when p_status = 'open' then null else v_admin.name end,
           resolved_at = case when p_status = 'open' then null else now() end
     where id = p_issue_id and company_id = v_admin.company_id
    returning * into r;
  exception when check_violation then
    raise exception 'INVALID_RECONCILE';
  end;
  if r.id is null then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('kind', r.kind, 'last4', r.last4, 'date', r.expense_date, 'merchant', r.merchant, 'amount', r.amount);
end;
$$;
revoke all on function public.save_card_reconciliation(text, text, date, date, jsonb, jsonb), public.set_card_issue_status(uuid, text, text) from public, anon;
grant execute on function public.save_card_reconciliation(text, text, date, date, jsonb, jsonb), public.set_card_issue_status(uuid, text, text) to authenticated;
