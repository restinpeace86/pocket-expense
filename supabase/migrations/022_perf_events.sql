-- =============================================================================
-- 022_perf_events.sql — 사용자 체감 성능 기록 (D-075, spec/common/performance.md §7)
-- 실제 사용자의 브라우저가 "화면 요청 → 화면에 보일 때까지"(TTFB·FCP·LCP·INP·CLS)와
-- "버튼 → 결과 표시"(ACTION) 시간을 보내면 여기에 쌓는다. 화면 경로는 id를 [id]로 바꾼 형태만 저장(개인정보 없음).
-- 격리: 앱 사용자는 이 표를 읽거나 직접 쓸 수 없다. 로그인 사용자만 record_perf_events 함수로 넣을 수 있다.
-- 보관: 90일 지난 기록은 함수가 가끔 지운다.
-- =============================================================================

create table public.perf_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  created_by uuid not null,               -- 보낸 사용자(초당 기록 수 제한용, 화면에 노출하지 않음)
  company_id uuid,                        -- 회사별 묶어 보기용(소속 전이면 null)
  route text not null check (length(route) between 1 and 120),
  metric text not null check (metric in ('TTFB', 'FCP', 'LCP', 'INP', 'CLS', 'ACTION')),
  action text check (action is null or action ~ '^[a-z0-9_.-]{1,40}$'),
  value real not null check (value >= 0 and value <= 120000),
  nav_type text check (nav_type is null or length(nav_type) <= 24),
  device text not null check (device in ('mobile', 'desktop')),
  conn text check (conn is null or length(conn) <= 12),
  build text check (build is null or length(build) <= 12)
);
create index perf_events_created_idx on public.perf_events (created_at);
create index perf_events_user_idx on public.perf_events (created_by, created_at);

alter table public.perf_events enable row level security;
alter table public.perf_events force row level security;
revoke all on public.perf_events from anon, authenticated;

create or replace function public.record_perf_events(p_events jsonb)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_company uuid;
  v_n integer;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) = 0 then return 0; end if;
  if jsonb_array_length(p_events) > 30 then raise exception 'TOO_MANY_EVENTS'; end if;
  -- 사용자당 10분에 300건까지(오작동·남용 방지)
  if (select count(*) from public.perf_events where created_by = v_uid and created_at > now() - interval '10 minutes') > 300 then
    return 0;
  end if;

  select company_id into v_company from public.members where auth_user_id = v_uid and status = 'approved';

  insert into public.perf_events (created_by, company_id, route, metric, action, value, nav_type, device, conn, build)
  select v_uid, v_company, e->>'route', e->>'metric', nullif(e->>'action', ''), (e->>'value')::real,
         nullif(e->>'nav', ''), e->>'device', nullif(e->>'conn', ''), nullif(e->>'build', '')
  from jsonb_array_elements(p_events) e;
  get diagnostics v_n = row_count;

  -- 가끔(약 1%) 90일 지난 기록 정리
  if random() < 0.01 then
    delete from public.perf_events where created_at < now() - interval '90 days';
  end if;
  return v_n;
end;
$$;

revoke all on function public.record_perf_events(jsonb) from public, anon;
grant execute on function public.record_perf_events(jsonb) to authenticated;
