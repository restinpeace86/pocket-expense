-- =============================================================================
-- 107_chat_claim_owner.sql — 소명서 대화: 작성자 본인이 [이 건으로 대화]를 누르면
-- 참여자 목록에 같은 사람이 두 번 들어가 "ON CONFLICT ... cannot affect row a second time"으로 실패하던 것 고침(D-203)
-- =============================================================================

create or replace function public.chat_open_claim(p_claim uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.members := private.require_chat();
  v_claim public.expense_claims;
  v_room uuid;
begin
  if not private.can_view_claim(p_claim) then raise exception 'NOT_FOUND'; end if;
  select * into v_claim from public.expense_claims where id = p_claim and company_id = v_me.company_id;
  select id into v_room from public.chat_rooms where company_id = v_me.company_id and claim_id = p_claim;
  if v_room is null then
    insert into public.chat_rooms (company_id, kind, claim_id, created_by_member_id)
      values (v_me.company_id, 'claim', p_claim, v_me.id)
      on conflict (company_id, claim_id) do nothing
      returning id into v_room;
    if v_room is null then select id into v_room from public.chat_rooms where company_id = v_me.company_id and claim_id = p_claim; end if;
  end if;
  insert into public.chat_members (room_id, company_id, member_id)
    select distinct v_room, v_me.company_id, x from unnest(array[v_me.id, v_claim.member_id]) x -- 작성자 본인이 열면 같은 사람이 두 번 → 한 번만
    where exists (select 1 from public.members m where m.id = x and m.status = 'approved')
    on conflict (room_id, member_id) do update set left_at = null, joined_at = case when public.chat_members.left_at is null then public.chat_members.joined_at else now() end,
      last_read_at = case when public.chat_members.left_at is null then public.chat_members.last_read_at else now() end;
  perform private.chat_notify(v_room, 'room', jsonb_build_object('room_id', v_room));
  return v_room;
end;
$$;
