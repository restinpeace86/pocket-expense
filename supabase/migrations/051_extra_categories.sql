-- =============================================================================
-- 051_extra_categories.sql — 추가 카테고리의 기본 계정과목·매핑 (todo_improvement(2차) 9, D-102)
--   회식비 → 복리후생비 / 경조사비 → 기업업무추진비 / 세미나·컨퍼런스 참가·업무용 도서 구입·교육·훈련 → 도서인쇄비 /
--   회사차량 → 차량유지비 / 온라인 SaaS 구독료 → 지급수수료
--   금액: 1식 한도는 식대·출장 식비에만 적용되므로(private.item_amounts) 추가 카테고리는 전액 지원.
--   025의 private.seed_account_defaults에 더하고, 새 회사·기존 회사 모두에 적용한다(있으면 건너뜀 — 관리자가 바꾼 매핑·이름은 그대로).
-- =============================================================================

create or replace function private.seed_account_defaults(p_company_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_welfare uuid; v_travel uuid; v_entertain uuid; v_supplies uuid; v_print uuid; v_vehicle uuid; v_fees uuid;
  v_next integer;
  t public.trip_type;
  p public.purchase_type;
begin
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;

  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '복리후생비', 1) on conflict (company_id, name) do nothing;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '여비교통비', 2) on conflict (company_id, name) do nothing;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '기업업무추진비', 3) on conflict (company_id, name) do nothing;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '소모품비', greatest(4, v_next + 1)) on conflict (company_id, name) do nothing;
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '도서인쇄비', v_next + 1) on conflict (company_id, name) do nothing;
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '차량유지비', v_next + 1) on conflict (company_id, name) do nothing;
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '지급수수료', v_next + 1) on conflict (company_id, name) do nothing;

  select id into v_welfare from public.account_titles where company_id = p_company_id and name = '복리후생비';
  select id into v_travel from public.account_titles where company_id = p_company_id and name = '여비교통비';
  select id into v_entertain from public.account_titles where company_id = p_company_id and name = '기업업무추진비';
  select id into v_supplies from public.account_titles where company_id = p_company_id and name = '소모품비';
  select id into v_print from public.account_titles where company_id = p_company_id and name = '도서인쇄비';
  select id into v_vehicle from public.account_titles where company_id = p_company_id and name = '차량유지비';
  select id into v_fees from public.account_titles where company_id = p_company_id and name = '지급수수료';

  insert into public.account_title_mappings (company_id, category, account_title_id) values
    (p_company_id, 'meal', v_welfare),
    (p_company_id, 'meeting', v_entertain),
    (p_company_id, 'team_dinner', v_welfare),
    (p_company_id, 'condolence', v_entertain),
    (p_company_id, 'seminar', v_print),
    (p_company_id, 'books', v_print),
    (p_company_id, 'training', v_print),
    (p_company_id, 'company_car', v_vehicle),
    (p_company_id, 'saas', v_fees)
    on conflict on constraint account_title_mappings_unique_classification do nothing;
  foreach t in array enum_range(null::public.trip_type) loop
    insert into public.account_title_mappings (company_id, category, trip_type, account_title_id) values (p_company_id, 'trip', t, v_travel)
      on conflict on constraint account_title_mappings_unique_classification do nothing;
  end loop;
  foreach p in array enum_range(null::public.purchase_type) loop
    insert into public.account_title_mappings (company_id, category, purchase_type, account_title_id)
    values (p_company_id, 'purchase', p, case when p = 'pantry' then v_welfare else v_supplies end)
      on conflict on constraint account_title_mappings_unique_classification do nothing;
  end loop;
end;
$$;
revoke all on function private.seed_account_defaults(uuid) from public, anon, authenticated;

-- 기존 회사에도 채우기
do $$
declare c uuid;
begin
  for c in select id from public.companies loop
    perform private.seed_account_defaults(c);
  end loop;
end;
$$;
