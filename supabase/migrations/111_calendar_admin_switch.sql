-- D-208 캘린더 켜기·끄기를 회사 관리자가 앱에서(설정 › 캘린더·회의실). 메신저·근태 스위치는 그대로 운영자만.
-- 끄면 메뉴·주소·홈 카드만 숨고 일정·회의실 데이터는 그대로(다시 켜면 그대로 보임). 끈 동안 회의 10분 전 안내도 안 감(109의 tick이 확인).
create or replace function public.calendar_set_enabled(p_enabled boolean)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_admin();
begin
  if p_enabled is null then raise exception 'INVALID'; end if;
  insert into public.company_features (company_id, feature, enabled, updated_at)
  values (v_me.company_id, 'calendar', p_enabled, now())
  on conflict (company_id, feature) do update set enabled = excluded.enabled, updated_at = now();
  return p_enabled;
end;
$$;
revoke all on function public.calendar_set_enabled(boolean) from public, anon;
grant execute on function public.calendar_set_enabled(boolean) to authenticated;
