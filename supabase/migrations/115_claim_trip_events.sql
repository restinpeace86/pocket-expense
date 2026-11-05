-- =============================================================================
-- 115_claim_trip_events.sql — 결의서 쓰기에서 캘린더 출장·외근 일정 불러오기 (D-216, todo_improvement 개선사항 3)
-- - calendar_my_trip_events(): 내가 참석(불참 아님)하는 출장·외근 일정, 오늘 기준 60일 전 ~ 30일 뒤, 가까운 순 20개까지
-- - claim_link_calendar_event(결의서, 일정|null): 내 결의서(작성 중·반려)에 그 일정을 연결(또는 끊기)하고, 화면이 채울 값을 돌려준다
--   출장지 = 회의실 이름 · 장소, 기간 = 일정 날짜, 목적 = 일정 제목. 칸 채우기·저장은 화면의 평소 자동 저장으로(직원이 고칠 수 있게)
-- - 캘린더 등록은 선택: 일정이 없으면 예전처럼 직접 적는다. 캘린더가 꺼진 회사는 FEATURE_DISABLED(화면이 칸을 숨김)
-- =============================================================================

create or replace function public.calendar_my_trip_events()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  return (
    select coalesce(jsonb_agg(x.j order by x.dist, x.sd desc), '[]')
    from (
      select
        jsonb_build_object(
          'id', e.id,
          'kind', e.kind,
          'title', e.title,
          'start_date', s.sd,
          'end_date', s.ed,
          'all_day', e.all_day,
          'starts_at', e.starts_at,
          'ends_at', e.ends_at,
          'place', nullif(concat_ws(' · ', r.name, e.location), '')
        ) as j,
        s.sd,
        case when v_today between s.sd and s.ed then 0 else least(abs(s.sd - v_today), abs(s.ed - v_today)) end as dist
      from public.calendar_events e
      cross join lateral (
        select coalesce(e.start_date, (e.starts_at at time zone 'Asia/Seoul')::date) as sd,
               coalesce(e.end_date, ((e.ends_at - interval '1 second') at time zone 'Asia/Seoul')::date) as ed
      ) s
      left join public.meeting_rooms r on r.id = e.room_id and r.company_id = e.company_id
      where e.company_id = v_me.company_id
        and e.kind in ('trip', 'outside')
        and s.ed >= v_today - 60 and s.sd <= v_today + 30
        and exists (select 1 from public.calendar_attendees a where a.event_id = e.id and a.member_id = v_me.id and a.response <> 'declined')
      order by dist, s.sd desc
      limit 20
    ) x
  );
end;
$$;

create or replace function public.claim_link_calendar_event(p_claim uuid, p_event uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  c public.expense_claims;
  e public.calendar_events;
  v_sd date;
  v_ed date;
begin
  if v_me.status <> 'approved' then raise exception 'NOT_A_MEMBER'; end if;
  select * into c from public.expense_claims where id = p_claim and company_id = v_me.company_id and member_id = v_me.id;
  if c.id is null then raise exception 'NOT_FOUND'; end if;
  if c.status not in ('draft', 'rejected') then raise exception 'NOT_EDITABLE'; end if;
  if p_event is null then
    update public.expense_claims set calendar_event_id = null where id = c.id;
    return null;
  end if;
  select * into e from public.calendar_events where id = p_event and company_id = v_me.company_id;
  if e.id is null then raise exception 'NOT_FOUND'; end if;
  if e.kind not in ('trip', 'outside') then raise exception 'EVENT_KIND_NO_CLAIM'; end if;
  if not exists (select 1 from public.calendar_attendees a where a.event_id = e.id and a.member_id = v_me.id and a.response <> 'declined') then
    raise exception 'NOT_ATTENDEE';
  end if;
  update public.expense_claims set calendar_event_id = e.id where id = c.id;
  v_sd := coalesce(e.start_date, (e.starts_at at time zone 'Asia/Seoul')::date);
  v_ed := coalesce(e.end_date, ((e.ends_at - interval '1 second') at time zone 'Asia/Seoul')::date);
  return jsonb_build_object(
    'event_id', e.id,
    'kind', e.kind,
    'destination', left(nullif(concat_ws(' · ', (select r.name from public.meeting_rooms r where r.id = e.room_id), e.location), ''), 100),
    'start_date', v_sd,
    'end_date', v_ed,
    'purpose', left(e.title, 100)
  );
end;
$$;

revoke all on function public.calendar_my_trip_events(), public.claim_link_calendar_event(uuid, uuid) from public, anon;
grant execute on function public.calendar_my_trip_events(), public.claim_link_calendar_event(uuid, uuid) to authenticated;
