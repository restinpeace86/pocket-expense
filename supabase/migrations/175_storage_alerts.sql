-- =============================================================================
-- 175_storage_alerts.sql — 회사 저장 공간 80%·100% 알림 (9-24, D-316)
-- 사용자 지시(2026-11-26 "저장공간 80% 알림은 해줘"): 예산 알림(D-267)과 같은 방식
-- - 매일 새벽 작업(nightly)이 회사마다 사용량(D-286 모든 파일 합계) / 한도(요금제 + 추가 공간)를 본다
-- - 80%·100%를 넘으면 관리자 [알림]방 카드(앱 알림은 기존 알림 푸시가 가져감). 같은 단계는 한 번
-- - 100%면 80%는 따로 안 온다. 사용량이 80% 아래로 내려가면 기록을 지워 다음에 다시 넘으면 또 알린다
-- - 막지 않는다(100%에서 올리기가 막히는 건 D-286 그대로). 직원에게는 보내지 않는다
-- =============================================================================

create table public.storage_alert_logs (
  company_id uuid not null references public.companies (id) on delete cascade,
  level integer not null check (level in (80, 100)),
  created_at timestamptz not null default now(),
  primary key (company_id, level)
);
alter table public.storage_alert_logs enable row level security;
alter table public.storage_alert_logs force row level security;
revoke all on public.storage_alert_logs from anon, authenticated;

-- 한 회사 확인: 새로 알린 단계(없으면 null)
create or replace function private.storage_alert_check(p_company uuid)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_used bigint := private.storage_total_used(p_company);
  v_limit bigint := private.storage_total_limit(p_company);
  v_level integer;
  v_pct integer;
  v_body text;
  r record;
begin
  if v_limit <= 0 then return null; end if;
  v_level := case when v_used >= v_limit then 100 when v_used * 100 >= v_limit * 80 then 80 else null end;
  if v_level is null then
    delete from public.storage_alert_logs where company_id = p_company;
    return null;
  end if;
  -- 100%에서 내려와 80%대가 되면 100% 기록만 지워 다음에 다시 꽉 차면 알린다
  if v_level = 80 then delete from public.storage_alert_logs where company_id = p_company and level = 100; end if;
  if v_level = 100 then
    insert into public.storage_alert_logs (company_id, level) values (p_company, 80) on conflict do nothing;
  end if;
  insert into public.storage_alert_logs (company_id, level) values (p_company, v_level) on conflict do nothing;
  if not found then return null; end if;
  if not private.feature_enabled(p_company, 'messenger') then return v_level; end if;
  v_pct := least(100, floor(v_used * 100.0 / v_limit))::int;
  v_body := case when v_level = 100
      then '회사 저장 공간이 꽉 찼어요' || E'\n' || '지금은 영수증·채팅 사진·파일을 새로 올릴 수 없어요.'
      else format('회사 저장 공간의 %s%%를 썼어요', v_pct) || E'\n' || '꽉 차면 영수증을 포함한 모든 파일 올리기가 멈춰요.'
    end
    || E'\n' || format('%sGB 중 %sGB 사용', trim(to_char(v_limit / 1073741824.0, 'FM999990.0')), trim(to_char(v_used / 1073741824.0, 'FM999990.0')))
    || E'\n' || '요금제 화면에서 저장 공간을 추가하거나, 파일 보관함·휴지통에서 안 쓰는 파일을 지워 주세요.';
  for r in select id from public.members where company_id = p_company and status = 'approved' and role in ('admin', 'super_admin') loop
    insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link)
    values (private.chat_notice_room(p_company, r.id), p_company, null, 'notice', v_body, '/workspace/' || p_company || '/admin/billing');
  end loop;
  return v_level;
end;
$$;
revoke all on function private.storage_alert_check(uuid) from public, anon, authenticated;

-- 매일 새벽 작업: 모든 회사. 서버 키만
create or replace function public.storage_alert_check_all()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  c record;
  v integer;
  v_sent integer := 0;
begin
  for c in select id from public.companies loop
    v := private.storage_alert_check(c.id);
    if v is not null then v_sent := v_sent + 1; end if;
  end loop;
  return jsonb_build_object('alerted', v_sent);
end;
$$;
revoke all on function public.storage_alert_check_all() from public, anon, authenticated;
grant execute on function public.storage_alert_check_all() to service_role;
