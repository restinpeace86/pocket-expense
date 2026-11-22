-- 173: 설정 변경 이력 — 처음 바꿀 때 '이전 값'을 기본값으로 (D-306, 2026-11-22 시나리오 점검에서 발견)
-- 문제: 회사 설정 줄이 아직 없는 상태(= 기본값 사용 중)에서 처음 바꾸면 INSERT라 이전 값이 비어 "보관 기간 없음 → 60일",
--       "사내 캘린더 사용 없음 → 끔"으로 남았다. 실제 이전 값은 기본값(보관 90일, 캘린더·채팅 켬, 그 밖의 기능 끔)
-- 문제 2: 예산·정기 결제를 추가·삭제하면 '전체 예산 추가'만 남고 금액이 안 보였다
-- 고침: settings_track()만 바꿈(처음 바꿀 때 이전 값 = 기본값, 추가·삭제 때 금액·날짜도 남김) — 표·트리거·권한은 그대로. 이전 값이 기본값과 같으면(예: 기본 90일을 90일로 저장) 남기지 않음
-- 이미 남은 기록은 고칠 수 없음(settings_history는 고치거나 지울 수 없음 — 172 규칙 그대로)

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
      -- 처음 켜고 끄는 것도 '추가'가 아니라 사용 값 변경으로. 이전 값 = 줄이 없을 때의 기본값(private.feature_enabled와 같은 규칙)
      if tg_op = 'INSERT' then v_action := 'change'; o := jsonb_build_object('enabled', (r ->> 'feature') in ('messenger', 'calendar')); end if;
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
      -- 처음 바꿀 때 이전 값 = 앱 기본 보관 기간(private.chat_attachment_days와 같은 규칙)
      if tg_op = 'INSERT' then v_action := 'change'; o := jsonb_build_object('attachment_days', coalesce((select value from private.app_settings where key = 'chat_attachment_days')::integer, 90)); end if;
    else return null;
  end case;

  if v_action = 'change' then
    for c in select * from jsonb_array_elements(private.settings_track_cols(tg_table_name)) loop
      if (o -> (c ->> 0)) is distinct from (n -> (c ->> 0)) then
        v_changes := v_changes || jsonb_build_array(jsonb_build_object('label', c ->> 1, 'from', private.settings_fmt(c ->> 2, o -> (c ->> 0)), 'to', private.settings_fmt(c ->> 2, n -> (c ->> 0))));
      end if;
    end loop;
  elsif v_action in ('add', 'remove') then
    -- 추가·삭제 때도 금액·날짜(그리고 이름이 따로 없는 줄은 값)를 남김 — 예: 예산 추가 '월 예산 3,000,000원'
    for c in select * from jsonb_array_elements(private.settings_track_cols(tg_table_name)) loop
      if coalesce(jsonb_typeof(r -> (c ->> 0)), 'null') <> 'null' and ((c ->> 2) in ('won', 'days') or v_target is null) then
        v_changes := v_changes || jsonb_build_array(jsonb_build_object('label', c ->> 1,
          'from', case when v_action = 'remove' then private.settings_fmt(c ->> 2, r -> (c ->> 0)) end,
          'to', case when v_action = 'add' then private.settings_fmt(c ->> 2, r -> (c ->> 0)) end));
      end if;
    end loop;
  end if;
  perform private.settings_log(v_company, v_area, v_menu, v_action, v_target, v_changes);
  return null;
end;
$$;
