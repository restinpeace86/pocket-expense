-- =============================================================================
-- 122_notice_cards.sql — 앱 알림을 채팅 [알림]방 카드로도 (D-224, 사용자 지시 2026-11-05)
-- "카카오 알림으로 하기로 한 핵심 알림(초대·결재 요청·반려·독촉·자료 요청)을 빼고 다른 알림은 앱 푸시와 함께 채팅에 카드로"
-- - 서버(service role)만 부른다. 메신저가 꺼진 회사면 넣지 않는다(앱 알림만).
-- - 글 = 첫 줄 제목 + 나머지 줄 내용, link = [열기] 버튼 주소. 앱 알림은 이미 따로 보냈으므로 pushed_at을 채워 다시 보내지 않게 한다.
-- =============================================================================
create or replace function public.chat_post_notices(p_company uuid, p_members uuid[], p_body text, p_link text)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_room uuid;
  v_n integer := 0;
begin
  if p_company is null or coalesce(cardinality(p_members), 0) = 0 or btrim(coalesce(p_body, '')) = '' then return 0; end if;
  if not private.feature_enabled(p_company, 'messenger') then return 0; end if;
  for v_member in
    select m.id from public.members m where m.company_id = p_company and m.status = 'approved' and m.id = any (p_members)
  loop
    v_room := private.chat_notice_room(p_company, v_member);
    insert into public.chat_messages (room_id, company_id, sender_member_id, kind, body, link, pushed_at)
    values (v_room, p_company, null, 'notice', left(p_body, 2000), left(p_link, 300), now());
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.chat_post_notices(uuid, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.chat_post_notices(uuid, uuid[], text, text) to service_role;
