-- D-210 일정 ↔ 경비 연결 (spec/features/calendar.md §12)
-- 출장·회의 일정 상세에서 [경비 올리기] → 일정 정보가 채워진 결의서(작성 중)를 만든다. 결의서는 그 일정과 연결돼
-- 일정 상세에 "이 일정 경비"로 묶여 보이고, 관리자 결의서 화면에 "연결된 일정"이 보인다.
-- 연결은 이 함수로만 생긴다(expense_claims.calendar_event_id에는 직접 쓰기 권한 없음). 일정을 지우면 연결만 끊긴다.

alter table public.expense_claims add column calendar_event_id uuid;
alter table public.expense_claims add constraint expense_claims_calendar_event_fk
  foreign key (calendar_event_id, company_id) references public.calendar_events (id, company_id) on delete set null (calendar_event_id);
create index expense_claims_calendar_event_idx on public.expense_claims (calendar_event_id) where calendar_event_id is not null;

-- 일정 → 결의서(작성 중) 만들기. 참석자(불참 제외)만, 출장·회의 일정만
create or replace function public.calendar_create_claim(p_event_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  e public.calendar_events;
  v_id uuid;
  v_sd date;
  v_ed date;
  v_place text;
  v_names text;
begin
  if v_me.status <> 'approved' then raise exception 'NOT_A_MEMBER'; end if;
  select * into e from public.calendar_events where id = p_event_id and company_id = v_me.company_id;
  if e.id is null then raise exception 'NOT_FOUND'; end if;
  if e.kind not in ('trip', 'meeting') then raise exception 'EVENT_KIND_NO_CLAIM'; end if;
  if not exists (select 1 from public.calendar_attendees a where a.event_id = e.id and a.member_id = v_me.id and a.response <> 'declined') then
    raise exception 'NOT_ATTENDEE';
  end if;
  v_sd := coalesce(e.start_date, (e.starts_at at time zone 'Asia/Seoul')::date);
  v_ed := coalesce(e.end_date, ((e.ends_at - interval '1 second') at time zone 'Asia/Seoul')::date);
  if e.kind = 'trip' then
    -- 출장 결의서: 출장지 = 회의실 이름·장소, 기간 = 일정 날짜, 목적 = 일정 제목. 제목은 비워 두면 화면이 "11/15 부산 출장"을 제안한다
    v_place := nullif(concat_ws(' · ', (select r.name from public.meeting_rooms r where r.id = e.room_id), e.location), '');
    insert into public.expense_claims (company_id, member_id, title, category, is_business_trip, trip_destination, trip_start_date, trip_end_date, trip_purpose, calendar_event_id)
    values (v_me.company_id, v_me.id, '', 'trip', true, left(v_place, 100), v_sd, v_ed, left(e.title, 100), e.id)
    returning id into v_id;
  else
    -- 회의: 카테고리는 직원이 고른다(외부 미팅비·식대 등). 외부 미팅비를 고르면 목적·참석자가 이미 채워져 있다
    select string_agg(m.name, ', ' order by (m.id = e.created_by_member_id) desc, m.name) into v_names
      from public.calendar_attendees a join public.members m on m.id = a.member_id
     where a.event_id = e.id and a.response <> 'declined';
    insert into public.expense_claims (company_id, member_id, title, meeting_purpose, attendees, calendar_event_id)
    values (v_me.company_id, v_me.id, left(to_char(v_sd, 'FMMM/FMDD') || ' ' || e.title, 100), left(e.title, 200), left(v_names, 200), e.id)
    returning id into v_id;
  end if;
  perform private.recompute_claim(v_id);
  return v_id;
end;
$$;

-- 일정에 묶인 경비: 내 것(작성 중 포함) + 관리자는 다른 사람의 올린 결의서(작성 중 제외 — 관리자 화면 규칙과 같게)
create or replace function public.calendar_event_claims(p_event_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_calendar();
  v_admin boolean := v_me.role in ('super_admin', 'admin');
begin
  if not exists (select 1 from public.calendar_events where id = p_event_id and company_id = v_me.company_id) then raise exception 'NOT_FOUND'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'title', c.title, 'status', c.status, 'total_amount', c.total_amount,
      'member_name', m.name, 'mine', c.member_id = v_me.id
    ) order by (c.member_id = v_me.id) desc, c.created_at), '[]')
    from public.expense_claims c join public.members m on m.id = c.member_id
    where c.company_id = v_me.company_id and c.calendar_event_id = p_event_id
      and (c.member_id = v_me.id or (v_admin and c.status <> 'draft'))
  );
end;
$$;

revoke all on function public.calendar_create_claim(uuid), public.calendar_event_claims(uuid) from public, anon;
grant execute on function public.calendar_create_claim(uuid), public.calendar_event_claims(uuid) to authenticated;
