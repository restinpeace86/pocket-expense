-- =============================================================================
-- 098_accounting_format_requests.sql — 다른 회계 프로그램 양식 접수 (D-180)
-- 사용자 지시(2026-10-30): 회사 세무 마감 화면에서 이카운트 ERP·뉴젠 세무사랑을 쓰는 회사가 실제 쓰는 엑셀 업로드 서식을 등록하면,
-- 운영자가 확인해 그 양식에 맞는 파일을 최대한 빠르게 준비한다. 지금은 접수만(맞춤 다운로드는 첫 양식을 보고 만든다 — todo 8-27·8-28).
-- - 원본 파일은 비공개 보관함(accounting-format-files/{회사}/{uuid}.{확장자}), 서버가 운영 키로만 읽고 쓴다
-- - 쓰기는 회사 관리자(함수), 읽기는 그 회사 관리자. 운영자는 운영 키로 보고 '준비 완료'를 표시한다
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('accounting-format-files', 'accounting-format-files', false, 5242880)
on conflict (id) do nothing;

create table public.accounting_format_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  program text not null check (program in ('ecount', 'sesarang')),
  file_path text not null check (split_part(file_path, '/', 1) = company_id::text),
  file_name text not null check (char_length(file_name) between 1 and 200),
  file_size integer not null check (file_size between 1 and 5242880),
  memo text check (memo is null or char_length(memo) <= 300),
  requested_by_name text,
  status text not null default 'received' check (status in ('received', 'done')),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index accounting_format_requests_company_idx on public.accounting_format_requests (company_id, created_at);
create index accounting_format_requests_created_idx on public.accounting_format_requests (created_at desc);

alter table public.accounting_format_requests enable row level security;
alter table public.accounting_format_requests force row level security;
revoke all on public.accounting_format_requests from anon, authenticated;
grant select on public.accounting_format_requests to authenticated;
create policy accounting_format_requests_select on public.accounting_format_requests for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_admin()));

-- 회사 관리자: 등록 기록(파일은 서버가 먼저 보관함에 올림). 회사당 20개까지
create or replace function public.add_accounting_format_request(p_program text, p_file_path text, p_file_name text, p_file_size integer, p_memo text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_id uuid;
begin
  if split_part(coalesce(p_file_path, ''), '/', 1) <> v_admin.company_id::text then raise exception 'INVALID_FORMAT_REQUEST'; end if;
  if (select count(*) from public.accounting_format_requests where company_id = v_admin.company_id) >= 20 then raise exception 'FORMAT_REQUEST_LIMIT'; end if;
  begin
    insert into public.accounting_format_requests (company_id, program, file_path, file_name, file_size, memo, requested_by_name)
    values (v_admin.company_id, p_program, p_file_path, left(p_file_name, 200), p_file_size, nullif(btrim(coalesce(p_memo, '')), ''), v_admin.name)
    returning id into v_id;
  exception when check_violation then
    raise exception 'INVALID_FORMAT_REQUEST';
  end;
  return v_id;
end;
$$;
revoke all on function public.add_accounting_format_request(text, text, text, integer, text) from public, anon;
grant execute on function public.add_accounting_format_request(text, text, text, integer, text) to authenticated;
