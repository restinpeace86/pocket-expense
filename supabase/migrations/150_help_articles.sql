-- 150: 도움말 지식 DB (D-255, spec/features/help-knowledge.md §A)
-- 글(help_articles) + 단계(help_steps: 글 + 화면 그림). 읽기 = 로그인한 사람(공개 글, 관리자 글은 관리자만), 쓰기 = 운영자(서버 키)만.
-- 화면 그림은 공개 버킷 help-images(예시 회사 화면 캡처, 개인 정보 없음)
create table public.help_articles (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  category text not null check (category in ('basic', 'expense', 'attendance', 'convert', 'together')),
  audience text not null default 'all' check (audience in ('all', 'admin')),
  needs text check (needs in ('attendance', 'calendar', 'chat', 'bus')),
  title text not null check (char_length(title) between 2 and 80),
  summary text not null default '' check (char_length(summary) <= 200),
  keywords text[] not null default '{}' check (cardinality(keywords) <= 30),
  path text check (path is null or path ~ '^/[A-Za-z0-9/_?=&.-]{1,120}$'),
  admin_path text check (admin_path is null or admin_path ~ '^/[A-Za-z0-9/_?=&.-]{1,120}$'),
  path_label text check (path_label is null or char_length(path_label) <= 40),
  sim text check (sim is null or sim ~ '^[a-z-]{2,30}$'),
  sort integer not null default 0,
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by_name text
);
create table public.help_steps (
  article_id text not null references public.help_articles (id) on delete cascade on update cascade,
  idx smallint not null check (idx between 0 and 19),
  body text not null check (char_length(body) between 1 and 500),
  image_path text check (image_path is null or image_path ~ '^[a-z0-9][a-z0-9/_.-]{3,160}$'),
  image_alt text check (image_alt is null or char_length(image_alt) <= 120),
  primary key (article_id, idx)
);

alter table public.help_articles enable row level security;
alter table public.help_articles force row level security;
alter table public.help_steps enable row level security;
alter table public.help_steps force row level security;
revoke all on public.help_articles, public.help_steps from anon, authenticated;
grant select on public.help_articles, public.help_steps to authenticated;
create policy help_articles_select on public.help_articles for select to authenticated
  using (published and (audience = 'all' or (select private.is_admin())));
create policy help_steps_select on public.help_steps for select to authenticated
  using (exists (select 1 from public.help_articles a where a.id = article_id and a.published and (a.audience = 'all' or (select private.is_admin()))));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('help-images', 'help-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
