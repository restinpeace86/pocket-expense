-- 169: 카카오 알림톡 = 프로 이상 요금제 기본 포함 + 회사 관리자 스위치(D-295 → D-297, 사용자 2026-11-19)
-- - billing_plans.alimtalk_included: 요금제에 알림톡이 들어 있는지(스타터 X, 프로·비즈니스 O). 요금제 표에 두어 코드에 하드코딩하지 않는다
-- - 보내는 조건 = 회사에 적용되는 요금제(private.effective_plan)에 포함 + company_features 'alimtalk' 켬(기본 꺼짐, 138)
--   · 요금제가 스타터로 내려가면 스위치가 켜져 있어도 보내지 않는다(alimtalk_active가 매번 확인)
-- - 관리자 화면: alimtalk_status()(포함·켬 여부) · alimtalk_set_enabled()(관리자만, 자기 회사만, 포함 안 된 요금제는 켜기 거절)
-- - 발송(서버 service role): alimtalk_active(회사) — 로그인 사용자는 못 부름

alter table public.billing_plans add column alimtalk_included boolean not null default false;
update public.billing_plans set alimtalk_included = (code in ('standard', 'pro'));

create or replace function private.alimtalk_included(p_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select p.alimtalk_included from private.effective_plan(p_company) p), false)
$$;
revoke all on function private.alimtalk_included(uuid) from public, anon, authenticated;

create or replace function private.alimtalk_switch(p_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select enabled from public.company_features where company_id = p_company and feature = 'alimtalk'), false)
$$;
revoke all on function private.alimtalk_switch(uuid) from public, anon, authenticated;

-- 설정 › 기능 사용 카드: 관리자만, 자기 회사
create or replace function public.alimtalk_status()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
begin
  return jsonb_build_object('included', private.alimtalk_included(v_me.company_id), 'enabled', private.alimtalk_switch(v_me.company_id));
end;
$$;
revoke all on function public.alimtalk_status() from public, anon;
grant execute on function public.alimtalk_status() to authenticated;

create or replace function public.alimtalk_set_enabled(p_enabled boolean)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
begin
  if p_enabled is null then raise exception 'INVALID'; end if;
  if p_enabled and not private.alimtalk_included(v_me.company_id) then
    raise exception 'ALIMTALK_PLAN' using errcode = '42501';
  end if;
  insert into public.company_features (company_id, feature, enabled, updated_at)
  values (v_me.company_id, 'alimtalk', p_enabled, now())
  on conflict (company_id, feature) do update set enabled = excluded.enabled, updated_at = now();
  return p_enabled;
end;
$$;
revoke all on function public.alimtalk_set_enabled(boolean) from public, anon;
grant execute on function public.alimtalk_set_enabled(boolean) to authenticated;

-- 발송할 때(서버): 요금제 포함 + 켬
create or replace function public.alimtalk_active(p_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.alimtalk_included(p_company) and private.alimtalk_switch(p_company)
$$;
revoke all on function public.alimtalk_active(uuid) from public, anon, authenticated;
grant execute on function public.alimtalk_active(uuid) to service_role;
