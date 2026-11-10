-- =============================================================================
-- 136_chat_visual_alert.sql — PC 무소음 시각 알림 켜기/끄기 (D-246, spec/features/improvement-2026-11.md §B)
-- members.chat_visual_alert(기본 켜짐): 화면 색상·채팅 색감처럼 본인만 바꾼다(컬럼 권한). my_membership에 함께 싣는다
-- =============================================================================

alter table public.members add column chat_visual_alert boolean not null default true;
grant update (chat_visual_alert) on public.members to authenticated;

create or replace function public.my_membership()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'member_id', m.id, 'company_id', m.company_id, 'company_name', c.name,
    'name', m.name, 'role', m.role, 'status', m.status, 'ui_theme', m.ui_theme, 'chat_theme', m.chat_theme,
    'chat_visual_alert', m.chat_visual_alert
  )
  from public.members m join public.companies c on c.id = m.company_id
  where m.auth_user_id = (select auth.uid())
$$;
