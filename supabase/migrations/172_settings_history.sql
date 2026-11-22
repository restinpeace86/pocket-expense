-- 172: 설정 변경 이력 — D-302 (사용자 2026-11-22, 벤치마킹 B-2: "모든 설정의 누가·언제·이전→이후")
-- 설계
--   · 근태 설정은 이미 attendance_history(124)에 남는다 → 그대로 두고, 그 밖의 설정만 settings_history에 남긴다.
--     화면(설정 › 변경 이력)은 두 표를 시간순으로 합쳐 보여 준다(데이터를 옮기거나 겹쳐 쓰지 않음)
--   · 모양은 attendance_history와 같게: 바꾼 사람 · 때 · 무엇 · changes [{label, from, to}]
--   · 고치거나 지울 수 없음(회사가 지워질 때만 함께 지워짐) — attendance_history_guard와 같은 규칙
--   · 기록은 표마다 붙인 트리거가 한다 → 화면·서버 동작이 어느 경로로 바꿔도 빠짐없이 남는다
--     회사 관리자(로그인한 회사 멤버)가 바꾼 것만 남긴다. 운영자·시스템(service role) 작업과 회사 삭제에 따른 연쇄 삭제는 남기지 않는다
--   · 결재라인은 검토자를 지웠다가 다시 넣는 구조라 줄 단위 트리거로는 '이전→이후'가 안 보인다 → save_approval_line에서 직접 남긴다
--   · 화면 정렬 순서·updated_at 같은 값은 남기지 않는다(관리자가 '설정'이라고 느끼는 값만)

create table public.settings_history (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid, -- 바꾼 사람(멤버가 지워져도 이름은 남김)
  member_name text,
  at timestamptz not null default now(),
  area text not null check (area in ('company', 'assets', 'features', 'policy', 'forms', 'files')), -- 설정 메뉴(settings-groups.ts의 key)
  menu text not null check (char_length(menu) between 1 and 40), -- 탭 이름(예: 식대 한도)
  action text not null check (action in ('add', 'change', 'remove')),
  target text check (target is null or char_length(target) <= 120), -- 무엇을(예: 영업팀, 법인카드 ····1234)
  changes jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array')
);
create index settings_history_company_at on public.settings_history (company_id, at desc, id desc);
alter table public.settings_history enable row level security;
alter table public.settings_history force row level security;
revoke all on public.settings_history from anon, authenticated;
grant select on public.settings_history to authenticated;
grant all on public.settings_history to service_role;
create policy settings_history_select on public.settings_history for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

create or replace function private.settings_history_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.companies c where c.id = old.company_id) then return old; end if;
  raise exception 'HISTORY_LOCKED' using errcode = '42501';
end;
$$;
create trigger settings_history_guard before update or delete on public.settings_history
  for each row execute function private.settings_history_guard();

-- 기록 한 줄. 바꾼 사람 = 지금 로그인한 그 회사 멤버. 없으면(운영자·시스템) 남기지 않음
create or replace function private.settings_log(p_company uuid, p_area text, p_menu text, p_action text, p_target text, p_changes jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members;
begin
  select * into v_member from public.members m
   where m.auth_user_id = (select auth.uid()) and m.status = 'approved' and m.company_id = p_company;
  if v_member.id is null then return; end if;
  if not exists (select 1 from public.companies c where c.id = p_company) then return; end if;
  if p_action = 'change' and coalesce(jsonb_array_length(p_changes), 0) = 0 then return; end if;
  insert into public.settings_history (company_id, member_id, member_name, area, menu, action, target, changes)
  values (p_company, v_member.id, v_member.name, p_area, p_menu, p_action, left(p_target, 120), coalesce(p_changes, '[]'::jsonb));
end;
$$;

-- 값 → 사람이 읽는 글자
create or replace function private.settings_fmt(p_kind text, p_val jsonb)
returns text
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_val is null or p_val = 'null'::jsonb then return '없음'; end if;
  case p_kind
    when 'bool' then return case when p_val = 'true'::jsonb then '켬' else '끔' end;
    when 'won' then return to_char((p_val #>> '{}')::numeric, 'FM999,999,999,990') || '원';
    when 'days' then return (p_val #>> '{}') || '일';
    when 'meal_mode' then return case p_val #>> '{}' when 'split' then '초과분 개인 부담' when 'notify' then '전부 지원·표시만' else p_val #>> '{}' end;
    when 'fuel_mode' then return case p_val #>> '{}' when 'fixed' then 'km당 정한 단가' when 'opinet' then '그날 전국 평균 유가' else p_val #>> '{}' end;
    when 'form_status' then return case p_val #>> '{}' when 'draft' then '작성 중' when 'active' then '사용 중' when 'old' then '이전 버전' when 'deleted' then '삭제' else p_val #>> '{}' end;
    else return p_val #>> '{}';
  end case;
end;
$$;

-- 표마다 남길 값: [열, 이름, 종류]
create or replace function private.settings_track_cols(p_table text)
returns jsonb
language sql immutable
set search_path = ''
as $$
  select case p_table
    when 'departments' then '[["name","부서 이름","text"]]'
    when 'company_tax_offices' then '[["office_name","세무사무소","text"],["agent_name","담당자","text"]]'
    when 'corporate_cards' then '[["nickname","카드 이름","text"],["is_active","사용","bool"]]'
    when 'company_vehicles' then '[["nickname","차량 이름","text"],["plate_number","차량번호","text"],["is_active","사용","bool"]]'
    when 'meeting_rooms' then '[["name","회의실 이름","text"]]'
    when 'company_features' then '[["enabled","사용","bool"]]'
    when 'company_budgets' then '[["monthly_amount","월 예산","won"]]'
    when 'recurring_payments' then '[["service_name","서비스","text"],["amount","금액","won"],["billing_day","결제일","days"],["is_active","사용","bool"]]'
    when 'company_chat_settings' then '[["attachment_days","보관 기간","days"]]'
    when 'company_locations' then '[["address","회사 주소","text"]]'
    when 'company_forms' then '[["name","양식 이름","text"],["status","상태","form_status"]]'
    else '[]'
  end::jsonb
$$;

create or replace function private.settings_track()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  v_company uuid := (r ->> 'company_id')::uuid;
  v_area text;
  v_menu text;
  v_target text;
  v_changes jsonb := '[]'::jsonb;
  c jsonb;
  v_action text := case tg_op when 'INSERT' then 'add' when 'DELETE' then 'remove' else 'change' end;
begin
  -- 어느 메뉴·무엇
  case tg_table_name
    when 'departments' then v_area := 'company'; v_menu := '부서'; v_target := r ->> 'name';
    when 'company_tax_offices' then v_area := 'company'; v_menu := '세무사무소'; v_target := r ->> 'office_name';
    when 'company_locations' then v_area := 'company'; v_menu := '회사 위치'; v_target := null;
    when 'corporate_cards' then v_area := 'assets'; v_menu := '법인카드'; v_target := concat_ws(' ', nullif(r ->> 'nickname', ''), '····' || (r ->> 'last4'));
    when 'company_vehicles' then v_area := 'assets'; v_menu := '회사차량'; v_target := concat_ws(' ', r ->> 'nickname', r ->> 'plate_number');
    when 'meeting_rooms' then v_area := 'assets'; v_menu := '회의실'; v_target := r ->> 'name';
    when 'company_features' then
      v_area := 'features'; v_menu := '기능 사용';
      v_target := case r ->> 'feature' when 'attendance' then '근태' when 'calendar' then '사내 캘린더' when 'alimtalk' then '카카오 알림톡' when 'messenger' then '채팅' else r ->> 'feature' end;
      -- 처음 켜고 끄는 것도 '추가'가 아니라 사용 값 변경으로 보이게
      if tg_op = 'INSERT' then v_action := 'change'; o := jsonb_build_object('enabled', null); end if;
    when 'company_budgets' then
      v_area := 'policy'; v_menu := '예산';
      v_target := coalesce((select t.name from public.account_titles t where t.id = (r ->> 'account_title_id')::uuid), '전체 예산');
    when 'recurring_payments' then v_area := 'policy'; v_menu := '정기 결제'; v_target := r ->> 'service_name';
    when 'form_templates' then
      -- 저장 = 이전 버전 끄고(update) 새 버전 넣기(insert) → 넣을 때 한 줄만
      if tg_op <> 'INSERT' then return null; end if;
      perform private.settings_log(v_company, 'forms', '지출결의서 양식', 'change', null,
        jsonb_build_array(jsonb_build_object('label', '양식', 'from', case when (r ->> 'version')::int > 1 then (((r ->> 'version')::int - 1)::text || '번째 양식') else '기본 양식' end, 'to', (r ->> 'version') || '번째 양식 저장')));
      return null;
    when 'company_forms' then v_area := 'forms'; v_menu := '회사 양식'; v_target := r ->> 'name';
    when 'company_chat_settings' then
      v_area := 'files'; v_menu := '파일 보관'; v_target := null;
      if tg_op = 'INSERT' then v_action := 'change'; o := jsonb_build_object('attachment_days', null); end if;
    else return null;
  end case;

  if v_action = 'change' then
    for c in select * from jsonb_array_elements(private.settings_track_cols(tg_table_name)) loop
      if (o -> (c ->> 0)) is distinct from (n -> (c ->> 0)) then
        v_changes := v_changes || jsonb_build_array(jsonb_build_object('label', c ->> 1, 'from', private.settings_fmt(c ->> 2, o -> (c ->> 0)), 'to', private.settings_fmt(c ->> 2, n -> (c ->> 0))));
      end if;
    end loop;
  end if;
  perform private.settings_log(v_company, v_area, v_menu, v_action, v_target, v_changes);
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['departments', 'company_tax_offices', 'company_locations', 'corporate_cards', 'company_vehicles', 'meeting_rooms', 'company_features',
                           'company_budgets', 'recurring_payments', 'form_templates', 'company_forms', 'company_chat_settings'] loop
    execute format('create trigger settings_track after insert or update or delete on public.%I for each row execute function private.settings_track()', t);
  end loop;
end;
$$;

-- 회사정보·경비 정책(companies 표): 열마다 메뉴가 다르다
create or replace function private.settings_track_company()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  c jsonb;
  m text;
  v_changes jsonb;
  -- [열, 이름, 종류, 메뉴, 영역]
  v_cols jsonb := '[
    ["name","회사 이름","text","회사정보","company"],
    ["business_number","사업자등록번호","text","회사정보","company"],
    ["meal_limit_enabled","1인 한도 적용","bool","식대 한도","policy"],
    ["meal_limit_per_person","1식 1인당 한도","won","식대 한도","policy"],
    ["meal_limit_mode","한도를 넘으면","meal_mode","식대 한도","policy"],
    ["fuel_enabled","자차 유류비","bool","자차 유류비","policy"],
    ["fuel_rate_mode","계산 방법","fuel_mode","자차 유류비","policy"],
    ["fuel_rate_per_km","km당 단가","won","자차 유류비","policy"],
    ["odometer_photo_required","계기판 사진 필수","bool","자차 유류비","policy"],
    ["per_diem_enabled","출장 일비","bool","출장 일비","policy"],
    ["per_diem_amount","하루 일비","won","출장 일비","policy"]
  ]'::jsonb;
begin
  for m in select distinct x ->> 3 from jsonb_array_elements(v_cols) x loop
    v_changes := '[]'::jsonb;
    for c in select x from jsonb_array_elements(v_cols) x where x ->> 3 = m loop
      if (o -> (c ->> 0)) is distinct from (n -> (c ->> 0)) then
        v_changes := v_changes || jsonb_build_array(jsonb_build_object('label', c ->> 1, 'from', private.settings_fmt(c ->> 2, o -> (c ->> 0)), 'to', private.settings_fmt(c ->> 2, n -> (c ->> 0))));
      end if;
    end loop;
    if jsonb_array_length(v_changes) > 0 then
      perform private.settings_log(new.id, (select x ->> 4 from jsonb_array_elements(v_cols) x where x ->> 3 = m limit 1), m, 'change', null, v_changes);
    end if;
  end loop;
  return null;
end;
$$;
create trigger settings_track_company after update on public.companies
  for each row execute function private.settings_track_company();

-- 결재라인(034 save_approval_line): 검토자 이전→이후를 직접 남긴다. 나머지 동작은 034와 같다
create or replace function public.save_approval_line(p_department_id uuid, p_approver_ids uuid[])
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member public.members := private.require_member();
  v_ids uuid[] := coalesce(p_approver_ids, '{}');
  v_line uuid;
  v_name text;
  v_before text;
  v_after text;
  i integer;
begin
  if v_member.role not in ('super_admin', 'admin') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if cardinality(v_ids) > 4 then raise exception 'TOO_MANY_REVIEWERS'; end if;
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then raise exception 'DUPLICATE_REVIEWER'; end if;
  if exists (
    select 1 from unnest(v_ids) x
     where not exists (select 1 from public.members m where m.id = x and m.company_id = v_member.company_id and m.status = 'approved')
  ) then
    raise exception 'INVALID_REVIEWER';
  end if;

  if p_department_id is not null then
    select name into v_name from public.departments where id = p_department_id and company_id = v_member.company_id;
    if not found then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  end if;

  select id into v_line from public.approval_lines where company_id = v_member.company_id and department_id is not distinct from p_department_id for update;
  v_before := coalesce((select string_agg(m.name, ' → ' order by s.step_order) from public.approval_line_steps s join public.members m on m.id = s.approver_member_id where s.approval_line_id = v_line), '없음(관리자에게 바로)');

  if p_department_id is not null and cardinality(v_ids) = 0 then
    delete from public.approval_lines where company_id = v_member.company_id and department_id = p_department_id;
    if v_line is not null then
      perform private.settings_log(v_member.company_id, 'forms', '사전 검토 결재라인', 'remove', v_name || ' 결재라인',
        jsonb_build_array(jsonb_build_object('label', '검토자', 'from', v_before, 'to', '없음(기본 결재라인)')));
    end if;
    return null;
  end if;

  if v_line is null then
    insert into public.approval_lines (company_id, name, department_id)
    values (v_member.company_id, coalesce(v_name || ' 결재라인', '기본 결재라인'), p_department_id)
    returning id into v_line;
  end if;

  delete from public.approval_line_steps where approval_line_id = v_line;
  for i in 1 .. cardinality(v_ids) loop
    insert into public.approval_line_steps (approval_line_id, company_id, step_order, approver_member_id)
    values (v_line, v_member.company_id, i, v_ids[i]);
  end loop;
  update public.approval_lines set updated_at = now() where id = v_line;

  v_after := coalesce((select string_agg(m.name, ' → ' order by s.step_order) from public.approval_line_steps s join public.members m on m.id = s.approver_member_id where s.approval_line_id = v_line), '없음(관리자에게 바로)');
  if v_after is distinct from v_before then
    perform private.settings_log(v_member.company_id, 'forms', '사전 검토 결재라인', 'change', coalesce(v_name || ' 결재라인', '기본 결재라인'),
      jsonb_build_array(jsonb_build_object('label', '검토자', 'from', v_before, 'to', v_after)));
  end if;
  return v_line;
end;
$$;
revoke all on function public.save_approval_line(uuid, uuid[]) from public, anon;
grant execute on function public.save_approval_line(uuid, uuid[]) to authenticated;

revoke all on function private.settings_history_guard(), private.settings_log(uuid, text, text, text, text, jsonb), private.settings_fmt(text, jsonb),
  private.settings_track_cols(text), private.settings_track(), private.settings_track_company() from public, anon, authenticated;
