-- =============================================================================
-- 042_condolence_target.sql — 경조사비 내부(임직원) / 외부(거래처) (D-123, migration 062)
-- =============================================================================
begin;

create function public._t_raises(p_sql text, p_code text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_code or sqlstate = p_code then return; end if;
    raise exception 'FAIL [%] expected % but got % (%)', p_label, p_code, sqlerrm, sqlstate;
  end;
  raise exception 'FAIL [%] expected % but succeeded', p_label, p_code;
end;
$$;
grant execute on function public._t_raises(text, text, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u::text || '@test.local'
from unnest(array['a4200000-0000-0000-0000-000000000001', 'a4200000-0000-0000-0000-000000000002']::uuid[]) u;
insert into public.companies (id, name, invite_code, business_number) values ('c4200000-0000-0000-0000-00000000000a', '경조사회사', 'CNDLNCTA', '1000000421');
select private.seed_account_defaults('c4200000-0000-0000-0000-00000000000a');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a4210000-0000-0000-0000-000000000001', 'a4200000-0000-0000-0000-000000000001', 'c4200000-0000-0000-0000-00000000000a', '관리자', '01094201001', 'super_admin', 'approved', now()),
  ('a4210000-0000-0000-0000-000000000002', 'a4200000-0000-0000-0000-000000000002', 'c4200000-0000-0000-0000-00000000000a', '직원', '01094201002', 'employee', 'approved', now());
insert into public.expense_claims (id, company_id, member_id, title, description) values
  ('a4220000-0000-0000-0000-000000000001', 'c4200000-0000-0000-0000-00000000000a', 'a4210000-0000-0000-0000-000000000002', '축의금', '결혼');
insert into public.expense_items (id, claim_id, company_id, sort_order, payment_method, evidence_type, expense_date, amount) values
  ('a4230000-0000-0000-0000-000000000001', 'a4220000-0000-0000-0000-000000000001', 'c4200000-0000-0000-0000-00000000000a', 1, 'personal_card', 'other', '2026-10-20', 100000);

do $$
begin
  -- 기본 매핑: 내부 → 복리후생비, 외부 → 기업업무추진비 (대상 없는 경조사비 매핑은 없음)
  if (select string_agg(m.condolence_target || '=' || t.name, ',' order by m.condolence_target) from public.account_title_mappings m join public.account_titles t on t.id = m.account_title_id
       where m.company_id = 'c4200000-0000-0000-0000-00000000000a' and m.category = 'condolence') <> 'external=기업업무추진비,internal=복리후생비' then
    raise exception 'FAIL [seed mappings]';
  end if;
end;
$$;

-- 직원: 경조사비 고르기 → 대상 안 고르면 상신 문제, 이상한 값 거절, 외부면 거래처명 필요
select set_config('request.jwt.claims', '{"sub":"a4200000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public._t_raises($q$select public.set_claim_category('a4220000-0000-0000-0000-000000000001', 'condolence', p_condolence_target => 'friend')$q$, 'INVALID_CONDOLENCE_TARGET', 'E bad target');
do $$
declare h jsonb;
begin
  perform public.set_claim_category('a4220000-0000-0000-0000-000000000001', 'condolence');
  h := public.check_claim_for_submit('a4220000-0000-0000-0000-000000000001') -> 'header';
  if not h ? 'condolence_target' then raise exception 'FAIL [target required] %', h; end if;
  perform public.set_claim_category('a4220000-0000-0000-0000-000000000001', 'condolence', p_condolence_target => 'external');
  h := public.check_claim_for_submit('a4220000-0000-0000-0000-000000000001') -> 'header';
  if h ? 'condolence_target' or not h ? 'client_name' then raise exception 'FAIL [external needs client] %', h; end if;
  perform public.set_claim_category('a4220000-0000-0000-0000-000000000001', 'condolence', p_client_name => '가나상사', p_condolence_target => 'external');
  h := public.check_claim_for_submit('a4220000-0000-0000-0000-000000000001') -> 'header';
  if h ? 'client_name' then raise exception 'FAIL [client given] %', h; end if;
  -- 내부로 바꾸면 영수증도 따라간다
  perform public.set_claim_category('a4220000-0000-0000-0000-000000000001', 'condolence', p_condolence_target => 'internal');
  if (select condolence_target from public.expense_items where id = 'a4230000-0000-0000-0000-000000000001') <> 'internal' then raise exception 'FAIL [item follows]'; end if;
  -- 다른 카테고리로 바꾸면 대상은 비운다
  perform public.set_claim_category('a4220000-0000-0000-0000-000000000001', 'team_dinner');
  if (select condolence_target from public.expense_claims where id = 'a4220000-0000-0000-0000-000000000001') is not null
     or (select condolence_target from public.expense_items where id = 'a4230000-0000-0000-0000-000000000001') is not null then
    raise exception 'FAIL [cleared]';
  end if;
  perform public.set_claim_category('a4220000-0000-0000-0000-000000000001', 'condolence', p_condolence_target => 'internal');
end;
$$;
reset role;
-- 새로 넣은 영수증도 결의서의 대상을 따른다(트리거)
insert into public.expense_items (id, claim_id, company_id, sort_order, payment_method, evidence_type, expense_date, amount) values
  ('a4230000-0000-0000-0000-000000000002', 'a4220000-0000-0000-0000-000000000001', 'c4200000-0000-0000-0000-00000000000a', 2, 'personal_card', 'other', '2026-10-21', 50000);

-- 관리자: 매핑 기준 계정과목 = 내부 → 복리후생비, 외부 → 기업업무추진비
select set_config('request.jwt.claims', '{"sub":"a4200000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select condolence_target from public.expense_items where id = 'a4230000-0000-0000-0000-000000000002') <> 'internal' then raise exception 'FAIL [new item follows]'; end if;
  perform public.override_item_account_title('a4230000-0000-0000-0000-000000000001', null);
  if (select account_title_name from public.expense_items where id = 'a4230000-0000-0000-0000-000000000001') <> '복리후생비' then raise exception 'FAIL [internal title]'; end if;
end;
$$;
reset role;
update public.expense_claims set condolence_target = 'external', client_name = '가나상사' where id = 'a4220000-0000-0000-0000-000000000001';
update public.expense_items set condolence_target = 'external' where claim_id = 'a4220000-0000-0000-0000-000000000001';
set local role authenticated;
do $$
begin
  perform public.override_item_account_title('a4230000-0000-0000-0000-000000000001', null);
  if (select account_title_name from public.expense_items where id = 'a4230000-0000-0000-0000-000000000001') <> '기업업무추진비' then raise exception 'FAIL [external title]'; end if;
end;
$$;
reset role;

select 'CONDOLENCE_TARGET_OK' as result;
rollback;
