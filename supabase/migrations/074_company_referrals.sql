-- =============================================================================
-- 074_company_referrals.sql — 추천인·추천 회사 (개선사항 1, D-147)
-- - 회사를 만든 직후 최고 관리자가 선택으로 한 번 적는다: 추천 회사(가입된 회사 중 검색) 또는 추천인(이름·휴대폰)
-- - 회사당 1건, 고치거나 지우지 않는다(운영자가 보상 확인용으로 그대로 본다)
-- - 운영자(app_admins)는 앱관리자 화면에서 service role로 읽는다. 고객 쪽은 자기 회사 최고 관리자만 '적었는지'를 본다
-- - 회사 검색은 이름만, 2자 이상, 8곳까지(사업자번호·id 외 정보 없음). 자기 회사는 빼고 보여 준다
-- =============================================================================

create table public.company_referrals (
  company_id uuid primary key references public.companies (id) on delete cascade,
  member_id uuid,
  kind text not null check (kind in ('company', 'person')),
  referrer_company_id uuid references public.companies (id) on delete set null,
  referrer_company_name text check (referrer_company_name is null or char_length(referrer_company_name) between 1 and 100),
  referrer_name text check (referrer_name is null or char_length(referrer_name) between 1 and 50),
  referrer_phone text check (referrer_phone is null or referrer_phone ~ '^01[016789][0-9]{7,8}$'),
  created_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete set null (member_id),
  check (
    (kind = 'company' and referrer_company_name is not null and referrer_name is null and referrer_phone is null)
    or (kind = 'person' and referrer_name is not null and referrer_phone is not null and referrer_company_id is null and referrer_company_name is null)
  ),
  check (referrer_company_id is null or referrer_company_id <> company_id)
);
create index company_referrals_created_idx on public.company_referrals (created_at desc);
create index company_referrals_referrer_idx on public.company_referrals (referrer_company_id) where referrer_company_id is not null;

alter table public.company_referrals enable row level security;
alter table public.company_referrals force row level security;
revoke all on public.company_referrals from anon, authenticated;
grant select on public.company_referrals to authenticated;
create policy company_referrals_select on public.company_referrals for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_super_admin()));

-- 추천 회사 검색: 최고 관리자만, 이름 2자 이상, 8곳까지
create or replace function public.search_referral_companies(p_query text)
returns table (id uuid, name text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_q text := btrim(coalesce(p_query, ''));
  v_like text;
begin
  if v_me.role <> 'super_admin' then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if char_length(v_q) < 2 or char_length(v_q) > 50 then return; end if;
  v_like := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select c.id, c.name
      from public.companies c
     where c.id <> v_me.company_id
       and c.name ilike '%' || v_like || '%'
     order by (c.name ilike v_like || '%') desc, char_length(c.name), c.name
     limit 8;
end;
$$;
revoke all on function public.search_referral_companies(text) from public, anon;
grant execute on function public.search_referral_companies(text) to authenticated;

-- 추천 저장: 최고 관리자만, 회사당 1회
create or replace function public.save_company_referral(p_kind text, p_referrer_company_id uuid, p_referrer_name text, p_referrer_phone text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_member();
  v_company_name text;
  v_name text := nullif(btrim(coalesce(p_referrer_name, '')), '');
begin
  if v_me.role <> 'super_admin' then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  perform 1 from public.companies where id = v_me.company_id for update;
  if exists (select 1 from public.company_referrals where company_id = v_me.company_id) then raise exception 'REFERRAL_ALREADY_SAVED'; end if;

  if p_kind = 'company' then
    if p_referrer_company_id is null or p_referrer_company_id = v_me.company_id then raise exception 'INVALID_REFERRAL'; end if;
    select name into v_company_name from public.companies where id = p_referrer_company_id;
    if v_company_name is null then raise exception 'INVALID_REFERRAL'; end if;
    insert into public.company_referrals (company_id, member_id, kind, referrer_company_id, referrer_company_name)
    values (v_me.company_id, v_me.id, 'company', p_referrer_company_id, v_company_name);
  elsif p_kind = 'person' then
    if v_name is null or char_length(v_name) > 50 then raise exception 'INVALID_REFERRAL'; end if;
    insert into public.company_referrals (company_id, member_id, kind, referrer_name, referrer_phone)
    values (v_me.company_id, v_me.id, 'person', v_name, private.normalize_phone(p_referrer_phone));
  else
    raise exception 'INVALID_REFERRAL';
  end if;
end;
$$;
revoke all on function public.save_company_referral(text, uuid, text, text) from public, anon;
grant execute on function public.save_company_referral(text, uuid, text, text) to authenticated;

-- 개인정보 처리방침에 추천 정보 항목 추가 → 버전 갱신(기존 동의는 다시 받지 않음, D-125와 같은 방식)
update private.app_settings set value = '2026-10-28' where key in ('terms_version', 'privacy_version');
