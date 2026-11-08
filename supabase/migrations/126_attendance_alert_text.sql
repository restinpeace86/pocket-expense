-- =============================================================================
-- 126_attendance_alert_text.sql — 퇴근 누락 알림 문구 (D-238)
-- 알림방 글·휴대폰 알림에 "자정까지 안 찍으면 정규 퇴근 시각으로 자동 기록" 안내를 반드시 앞쪽에 넣는다.
-- 첫 줄 = 알림 제목(휴대폰 알림 제목), 둘째 줄 = 자동 기록 안내(휴대폰 알림 본문 맨 앞)
-- 함수 본문은 124와 같고 문구와 링크(→ 월 근태 현황, 버튼 [내 근태 보기])만 바뀐다.
-- =============================================================================

create or replace function private.attendance_tick()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'Asia/Seoul')::date;
  r record;
  v_room uuid;
  v_n integer := 0;
  v_url text;
  v_secret text;
begin
  -- ① 자정이 지난 날 중 퇴근이 없는 날 → 정규 퇴근 시각으로 자동 기록(출근이 더 늦으면 출근 시각)
  update public.attendance_days d
  set out_at = greatest(d.in_at, (d.work_date + d.sched_end) at time zone 'Asia/Seoul'), out_method = 'auto'
  where d.work_date < v_today and d.out_at is null;

  -- ② 오늘 정규 퇴근 + 설정 시간(늦어도 23:50)이 지났는데 퇴근을 안 찍은 사람 → 본인 [알림]방 한 번(휴일 제외)
  for r in
    select d.company_id, d.member_id, d.work_date, d.in_at, d.sched_end
    from public.attendance_days d join public.members m on m.id = d.member_id
    where d.work_date = v_today and d.out_at is null and d.alerted_at is null and not d.holiday and m.status = 'approved'
      -- 분 단위로 비교(time + interval은 자정을 넘으면 0시로 돌아가므로)
      and extract(epoch from (v_now at time zone 'Asia/Seoul')::time) / 60
          >= least(extract(epoch from d.sched_end) / 60 + d.alert_minutes, 23 * 60 + 50)
    for update of d skip locked
  loop
    update public.attendance_days set alerted_at = v_now where member_id = r.member_id and work_date = r.work_date;
    if not private.feature_enabled(r.company_id, 'attendance') or not private.feature_enabled(r.company_id, 'messenger') then continue; end if;
    v_room := private.chat_notice_room(r.company_id, r.member_id);
    insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link)
    values (v_room, r.company_id, null, 'notice',
      '퇴근을 아직 안 찍었어요' || chr(10)
        || '자정까지 안 찍으면 정규 퇴근 시각(' || to_char(r.sched_end, 'HH24:MI') || ')으로 자동 기록돼요.' || chr(10)
        || '더 일하고 있다면 자정 전에 회사 QR로 퇴근을 찍어 주세요.' || chr(10)
        || '출근: ' || to_char(r.in_at at time zone 'Asia/Seoul', 'HH24:MI'),
      '/workspace/' || r.company_id || '/employee/attendance'); -- [내 근태 보기]
    v_n := v_n + 1;
  end loop;

  -- ③ 실패 기록 90일, 쓴·지난 연결 코드 1일
  delete from public.attendance_attempts where at < v_now - interval '90 days';
  delete from public.attendance_pair_codes where expires_at < v_now - interval '1 day';

  if v_n > 0 then
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'reminder_push_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'reminder_push_secret';
    if v_url is not null and v_secret is not null then
      perform net.http_post(url := v_url, body := '{}'::jsonb,
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'), timeout_milliseconds := 10000);
    end if;
  end if;
  return v_n;
end;
$$;

revoke all on function private.attendance_tick() from public, anon, authenticated;
