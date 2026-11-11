-- 146: AI 도움말 하루 질문 수(D-251 ⑪ — 한 사람 하루 20번, 크레딧 안 씀)
-- 표는 직접 읽고 쓰지 못하고 함수로만. 날짜는 한국 시간
create table public.help_questions (
  member_id uuid not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count between 0 and 20),
  primary key (member_id, day),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade
);
alter table public.help_questions enable row level security;
alter table public.help_questions force row level security;
revoke all on public.help_questions from anon, authenticated;

-- 한 번 묻기: 남은 횟수를 돌려준다. 20번을 넘으면 HELP_LIMIT
create or replace function public.help_take()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id();
  v_company uuid := private.current_company_id();
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_count integer;
begin
  if v_member is null or v_company is null then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  insert into public.help_questions (member_id, company_id, day, count) values (v_member, v_company, v_day, 0)
    on conflict (member_id, day) do nothing;
  update public.help_questions set count = count + 1 where member_id = v_member and day = v_day and count < 20 returning count into v_count;
  if v_count is null then raise exception 'HELP_LIMIT'; end if;
  delete from public.help_questions where member_id = v_member and day < v_day - 7; -- 지난 기록은 일주일만
  return 20 - v_count;
end;
$$;
revoke all on function public.help_take() from public, anon;
grant execute on function public.help_take() to authenticated;
