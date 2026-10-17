-- =============================================================================
-- 018_member_ui_theme.sql — 화면 색상을 계정에 저장 (D-066 보완)
-- 어느 기기에서 로그인해도 본인이 고른 색상으로 보이게 한다.
-- 값은 팔레트 이름(영문 소문자). 팔레트 목록은 화면 코드(src/lib/theme.ts)가 관리하고, 모르는 값은 기본(A)으로 보여 준다.
-- 격리: 본인 행만 수정(기존 members_update_self 정책 + 컬럼 권한). 다른 사람·다른 회사 행은 바꿀 수 없다.
-- =============================================================================

alter table public.members add column ui_theme text check (ui_theme ~ '^[a-z]{2,20}$');
grant update (ui_theme) on public.members to authenticated;

-- 내 소속에 색상 포함 (로그인 직후 화면에서 바로 적용)
create or replace function public.my_membership()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'member_id', m.id, 'company_id', m.company_id, 'company_name', c.name,
    'name', m.name, 'role', m.role, 'status', m.status, 'ui_theme', m.ui_theme
  )
  from public.members m join public.companies c on c.id = m.company_id
  where m.auth_user_id = (select auth.uid())
$$;
