-- 171: 최초 1회 설정(설정 마법사) 진행 기록 — D-300 (사용자 2026-11-22, U-1 A안)
-- 규칙(사용자 결정)
--   · 진행률 = (완료 + 건너뜀) / 전체 단계. 건너뛴 단계는 따로 표시
--   · 기록은 회사 단위(다른 관리자가 들어와도 같은 진행률) · 관리자만 읽고 쓴다 · 다른 회사 기록은 안 보인다
--   · 이미 쓰고 있는 회사(이 마이그레이션 이전 회사)는 legacy = 시작 안내 창을 띄우지 않고 설정 화면 [설정 마법사] 버튼만
-- 단계 목록·순서·시간은 앱 코드(src/lib/admin/setup-wizard.ts). 여기서는 단계 이름 모양만 확인

create table public.setup_wizards (
  company_id uuid primary key references public.companies (id) on delete cascade,
  legacy boolean not null default false,
  intro_answered_at timestamptz, -- 시작 안내 창에서 [지금 시작]·[나중에 할게요]를 누른 때(null이면 아직 안 뜸)
  finished_at timestamptz, -- 모든 단계를 완료·건너뜀으로 처리한 때
  created_at timestamptz not null default now()
);
alter table public.setup_wizards enable row level security;
alter table public.setup_wizards force row level security;
revoke all on public.setup_wizards from anon, authenticated;
grant select on public.setup_wizards to authenticated;
grant all on public.setup_wizards to service_role;
create policy setup_wizards_select on public.setup_wizards for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

create table public.setup_wizard_steps (
  company_id uuid not null references public.companies (id) on delete cascade,
  step_key text not null check (step_key ~ '^[a-z][a-z0-9-]{1,39}$'),
  status text not null check (status in ('done', 'skipped')),
  member_id uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (company_id, step_key)
);
alter table public.setup_wizard_steps enable row level security;
alter table public.setup_wizard_steps force row level security;
revoke all on public.setup_wizard_steps from anon, authenticated;
grant select on public.setup_wizard_steps to authenticated;
grant all on public.setup_wizard_steps to service_role;
create policy setup_wizard_steps_select on public.setup_wizard_steps for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- 지금 있는 회사 = legacy (시작 안내 창 안 띄움)
insert into public.setup_wizards (company_id, legacy, intro_answered_at)
select id, true, now() from public.companies
on conflict (company_id) do nothing;

-- 시작 안내 창 답(지금 시작·나중에): 한 번만 기록
create or replace function public.setup_wizard_answer_intro()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
begin
  insert into public.setup_wizards (company_id, intro_answered_at) values (v_me.company_id, now())
  on conflict (company_id) do update set intro_answered_at = coalesce(public.setup_wizards.intro_answered_at, excluded.intro_answered_at);
end;
$$;
revoke all on function public.setup_wizard_answer_intro() from public, anon;
grant execute on function public.setup_wizard_answer_intro() to authenticated;

-- 단계 완료·건너뜀. p_finished = 앱이 계산한 '모든 단계 처리됨'이면 finished_at 기록(이미 있으면 그대로)
create or replace function public.setup_wizard_mark(p_step text, p_status text, p_finished boolean default false)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
begin
  if p_status not in ('done', 'skipped') or p_step !~ '^[a-z][a-z0-9-]{1,39}$' then
    raise exception 'BAD_INPUT';
  end if;
  insert into public.setup_wizards (company_id, intro_answered_at) values (v_me.company_id, now())
  on conflict (company_id) do nothing;
  insert into public.setup_wizard_steps (company_id, step_key, status, member_id, updated_at)
  values (v_me.company_id, p_step, p_status, v_me.id, now())
  on conflict (company_id, step_key) do update
    -- 한 번 완료한 단계는 나중에 건너뛰어도 완료로 남긴다
    set status = case when public.setup_wizard_steps.status = 'done' then 'done' else excluded.status end,
        member_id = excluded.member_id, updated_at = now();
  if p_finished then
    update public.setup_wizards set finished_at = coalesce(finished_at, now()) where company_id = v_me.company_id;
  end if;
end;
$$;
revoke all on function public.setup_wizard_mark(text, text, boolean) from public, anon;
grant execute on function public.setup_wizard_mark(text, text, boolean) to authenticated;
