-- 159: 서비스 이름 Moa-on → RealOn (D-274, 사용자 2026-11-14)
-- ① 약관·개인정보 처리방침 본문의 서비스 이름이 바뀌어 버전만 올린다(내용 변경 없음 — 다시 동의를 받지 않음, 143과 같은 방식)
--    src/components/legal/documents.tsx LEGAL_VERSION도 같은 날짜로
update private.app_settings set value = '2026-11-14' where key in ('terms_version', 'privacy_version');

-- ② 도우미 방 이름(화면은 BRAND 이름으로 다시 그리지만 저장된 이름도 맞춤)
update public.chat_rooms set title = 'RealOn 도우미' where kind = 'assistant' and title in ('Moa-on 도우미', 'WORKON 도우미');
create or replace function public.chat_assistant_room()
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_room uuid;
begin
  select id into v_room from public.chat_rooms where company_id = v_me.company_id and assistant_member_id = v_me.id;
  if v_room is null then
    insert into public.chat_rooms (company_id, kind, title, assistant_member_id) values (v_me.company_id, 'assistant', 'RealOn 도우미', v_me.id)
      on conflict (company_id, assistant_member_id) do nothing returning id into v_room;
    if v_room is null then select id into v_room from public.chat_rooms where company_id = v_me.company_id and assistant_member_id = v_me.id; end if;
    insert into public.chat_members (room_id, company_id, member_id) values (v_room, v_me.company_id, v_me.id) on conflict do nothing;
  end if;
  return v_room;
end;
$$;
