-- =============================================================================
-- 123_push_app_tokens.sql — 안드로이드 설치 앱 알림(FCM) 기기 토큰 + APK 내려받기 저장소 (D-228)
-- - push_app_tokens: 설치 앱 기기별 FCM 토큰. 본인 것만 보고 등록·삭제(RLS, 회사 격리 = push_subscriptions와 같음).
--   보내기는 서버(service role)만. 같은 토큰을 다른 사람이 쓰게 되면(로그인 바꿈) 서버가 예전 것을 지우고 새로 등록.
-- - app-downloads: 설치 파일(APK) 공개 내려받기 저장소. 읽기 = 누구나(공개 버킷), 올리기 = 서버(service role)만.
-- =============================================================================

create table public.push_app_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  token text not null unique check (char_length(token) between 20 and 4096),
  platform text not null default 'android' check (platform in ('android')),
  app_version text check (char_length(app_version) <= 40),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade
);
create index push_app_tokens_member_idx on public.push_app_tokens (member_id);
create index push_app_tokens_company_idx on public.push_app_tokens (company_id);
alter table public.push_app_tokens enable row level security;
alter table public.push_app_tokens force row level security;
grant select, insert, delete on public.push_app_tokens to authenticated;
create policy push_app_tokens_select on public.push_app_tokens for select to authenticated
  using (member_id = (select private.current_member_id()) and company_id = (select private.current_company_id()));
create policy push_app_tokens_insert on public.push_app_tokens for insert to authenticated
  with check (member_id = (select private.current_member_id()) and company_id = (select private.current_company_id()));
create policy push_app_tokens_delete on public.push_app_tokens for delete to authenticated
  using (member_id = (select private.current_member_id()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app-downloads', 'app-downloads', true, 104857600, array['application/vnd.android.package-archive'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
