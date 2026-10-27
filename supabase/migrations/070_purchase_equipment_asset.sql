-- =============================================================================
-- 070_purchase_equipment_asset.sql — 회사 물품 구매 '비품'은 비품(자산) 계정으로 (세무사무소 답변 2026-10-27, D-136)
-- - 세무사무소: 비품은 금액이 아니라 오래 남는 물건(테이블·노트북·의자·프린터·복합기·에어컨 등, 비품대장에 적을 것)으로 구분해 '비품'으로 넘긴다.
--   펜·A4 등 사무용품은 소모품비, 탕비실 간식은 복리후생비(그대로)
-- - 기본 계정과목에 '비품' 추가, purchase_type small_equipment(화면 이름 "비품(오래 쓰는 물건)") → 비품
-- - 기존 회사: 비품 계정 추가, small_equipment 매핑이 아직 기본값(소모품비)이면 비품으로 바꾼다(관리자가 바꾼 매핑은 그대로).
--   이미 상신된 항목의 계정과목 스냅샷(D-036)은 바꾸지 않는다
-- =============================================================================

create or replace function private.seed_account_defaults(p_company_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_welfare uuid; v_travel uuid; v_entertain uuid; v_supplies uuid; v_print uuid; v_vehicle uuid; v_fees uuid; v_edu uuid; v_asset uuid;
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
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '교육훈련비', v_next + 1) on conflict (company_id, name) do nothing;
  select coalesce(max(sort_order), 0) into v_next from public.account_titles where company_id = p_company_id;
  insert into public.account_titles (company_id, name, sort_order) values (p_company_id, '비품', v_next + 1) on conflict (company_id, name) do nothing;

  select id into v_welfare from public.account_titles where company_id = p_company_id and name = '복리후생비';
  select id into v_travel from public.account_titles where company_id = p_company_id and name = '여비교통비';
  select id into v_entertain from public.account_titles where company_id = p_company_id and name = '기업업무추진비';
  select id into v_supplies from public.account_titles where company_id = p_company_id and name = '소모품비';
  select id into v_print from public.account_titles where company_id = p_company_id and name = '도서인쇄비';
  select id into v_vehicle from public.account_titles where company_id = p_company_id and name = '차량유지비';
  select id into v_fees from public.account_titles where company_id = p_company_id and name = '지급수수료';
  select id into v_edu from public.account_titles where company_id = p_company_id and name = '교육훈련비';
  select id into v_asset from public.account_titles where company_id = p_company_id and name = '비품';

  insert into public.account_title_mappings (company_id, category, account_title_id) values
    (p_company_id, 'meal', v_welfare),
    (p_company_id, 'meeting', v_entertain),
    (p_company_id, 'team_dinner', v_welfare),
    (p_company_id, 'seminar', v_edu),
    (p_company_id, 'books', v_print),
    (p_company_id, 'training', v_edu),
    (p_company_id, 'company_car', v_vehicle),
    (p_company_id, 'saas', v_fees)
    on conflict on constraint account_title_mappings_unique_classification do nothing;
  -- 경조사비(D-123): 내부(임직원) → 복리후생비, 외부(거래처) → 기업업무추진비
  insert into public.account_title_mappings (company_id, category, condolence_target, account_title_id) values
    (p_company_id, 'condolence', 'internal', v_welfare),
    (p_company_id, 'condolence', 'external', v_entertain)
    on conflict on constraint account_title_mappings_unique_classification do nothing;
  foreach t in array enum_range(null::public.trip_type) loop
    insert into public.account_title_mappings (company_id, category, trip_type, account_title_id)
    values (p_company_id, 'trip', t, case when t in ('car_fuel', 'car_toll') then v_vehicle else v_travel end)
      on conflict on constraint account_title_mappings_unique_classification do nothing;
  end loop;
  foreach p in array enum_range(null::public.purchase_type) loop
    insert into public.account_title_mappings (company_id, category, purchase_type, account_title_id)
    values (p_company_id, 'purchase', p, case when p = 'pantry' then v_welfare when p = 'small_equipment' then v_asset else v_supplies end)
      on conflict on constraint account_title_mappings_unique_classification do nothing;
  end loop;
end;
$$;
revoke all on function private.seed_account_defaults(uuid) from public, anon, authenticated;

do $$
declare c uuid;
begin
  for c in select id from public.companies loop
    perform private.seed_account_defaults(c);
  end loop;
  update public.account_title_mappings m
     set account_title_id = a.id
    from public.account_titles s, public.account_titles a
   where m.category = 'purchase' and m.purchase_type = 'small_equipment'
     and s.id = m.account_title_id and s.company_id = m.company_id and s.name = '소모품비'
     and a.company_id = m.company_id and a.name = '비품';
end;
$$;
