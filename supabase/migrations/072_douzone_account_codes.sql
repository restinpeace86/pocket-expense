-- =============================================================================
-- 072_douzone_account_codes.sql — 기본 계정과목에 더존 기본 계정코드 채우기 (D-138)
-- - 세무사무소는 계정코드가 필요하지만(D-136) 소기업은 코드를 모른다 → 앱이 더존 기본 코드로 미리 채운다
--   복리후생비 811 · 여비교통비 812 · 기업업무추진비 813 · 차량유지비 822 · 교육훈련비 825 · 도서인쇄비 826 · 소모품비 830 · 지급수수료 831 · 비품 212
-- - 법정 표준이 아니라 더존의 기본값. 세무사무소 번호가 다르면 관리자가 [계정과목]에서 바꾼다
-- - 코드가 비어 있는 기본 계정과목만 채운다. 이미 상신된 항목의 코드 스냅샷(D-036)은 바꾸지 않는다
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

  -- 더존(Smart A·위하고) 기본 계정코드(D-138). 코드가 비어 있을 때만 채운다(관리자가 넣은 코드는 그대로)
  update public.account_titles t set code = d.code
    from (values ('복리후생비', '811'), ('여비교통비', '812'), ('기업업무추진비', '813'), ('차량유지비', '822'), ('교육훈련비', '825'),
                 ('도서인쇄비', '826'), ('소모품비', '830'), ('지급수수료', '831'), ('비품', '212')) as d(name, code)
   where t.company_id = p_company_id and t.name = d.name and t.code is null;

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
end;
$$;
