-- =============================================================================
-- 135_feedback.sql — 의견 보내기(버그 신고 · 기능 요청) (D-246, spec/features/improvement-2026-11.md §C)
-- - 직원·관리자 누구나 운영자(WORKON)에게 보냄. 회사 관리자는 직원 의견을 보지 않는다(읽기는 운영 키만)
-- - 한 회사 하루(한국 시간) 5건. 버그 신고는 캡처 1장(선택, 서버가 운영 키로 비공개 보관함에 올림)
-- - 화면 주소(경로만)·브라우저 정보·화면 크기·앱 버전을 함께 저장(작성 창에 알림)
-- - 해결된 의견은 1년 뒤 새벽 정리에서 지운다(feedback_due)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-files', 'feedback-files', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create table public.feedback_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  reporter_name text,
  category text not null check (category in ('bug', 'feature')),
  content text not null check (char_length(content) between 5 and 2000),
  page_url text check (page_url is null or char_length(page_url) <= 500),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  viewport text check (viewport is null or char_length(viewport) <= 20),
  app_version text check (app_version is null or char_length(app_version) <= 20),
  shot_path text check (shot_path is null or split_part(shot_path, '/', 1) = company_id::text),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved')),
  operator_note text check (operator_note is null or char_length(operator_note) <= 1000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade
);
create index feedback_logs_company_day_idx on public.feedback_logs (company_id, created_at);
create index feedback_logs_created_idx on public.feedback_logs (created_at desc);

-- 회사 사용자는 표를 직접 읽거나 쓰지 않는다(운영 키만). 쓰기는 아래 함수로만
alter table public.feedback_logs enable row level security;
alter table public.feedback_logs force row level security;
revoke all on public.feedback_logs from anon, authenticated;

-- 의견 저장: 로그인한 승인 멤버만, 회사·이름은 로그인에서 채움. 같은 회사 하루 5건
create or replace function public.feedback_submit(
  p_id uuid, p_category text, p_content text, p_page_url text, p_user_agent text, p_viewport text, p_app_version text, p_shot_path text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_day_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
  v_content text := btrim(coalesce(p_content, ''));
  v_id uuid;
begin
  if p_category not in ('bug', 'feature') or char_length(v_content) not between 5 and 2000 then raise exception 'INVALID_FEEDBACK'; end if;
  if p_shot_path is not null and (p_category <> 'bug' or split_part(p_shot_path, '/', 1) <> v_me.company_id::text) then raise exception 'INVALID_FEEDBACK'; end if;
  -- 같은 회사가 동시에 보내도 5건을 넘지 않게 회사 단위로 줄 세움
  perform pg_advisory_xact_lock(hashtextextended('feedback:' || v_me.company_id::text, 0));
  if (select count(*) from public.feedback_logs where company_id = v_me.company_id and created_at >= v_day_start) >= 5 then
    raise exception 'FEEDBACK_LIMIT';
  end if;
  insert into public.feedback_logs (id, company_id, member_id, reporter_name, category, content, page_url, user_agent, viewport, app_version, shot_path)
  values (
    coalesce(p_id, gen_random_uuid()), v_me.company_id, v_me.id, v_me.name, p_category, v_content,
    nullif(left(split_part(coalesce(p_page_url, ''), '?', 1), 500), ''),
    nullif(left(coalesce(p_user_agent, ''), 300), ''),
    nullif(left(coalesce(p_viewport, ''), 20), ''),
    nullif(left(coalesce(p_app_version, ''), 20), ''),
    p_shot_path
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.feedback_submit(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.feedback_submit(uuid, text, text, text, text, text, text, text) to authenticated;

-- 오늘 회사가 보낸 건수(작성 창에서 '오늘 n/5' 안내)
create or replace function public.feedback_today_count()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(*)::integer from public.feedback_logs
  where company_id = (select (private.require_member()).company_id)
    and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
$$;
revoke all on function public.feedback_today_count() from public, anon;
grant execute on function public.feedback_today_count() to authenticated;

-- 새벽 정리(서버 전용): 해결된 지 1년 지난 의견 — 캡처 경로를 돌려주고 줄을 지운다
create or replace function public.feedback_due()
returns table (id uuid, shot_path text)
language sql security definer
set search_path = ''
as $$
  delete from public.feedback_logs
  where status = 'resolved' and resolved_at < now() - interval '1 year'
  returning id, shot_path;
$$;
revoke all on function public.feedback_due() from public, anon, authenticated;
grant execute on function public.feedback_due() to service_role;
