-- =============================================================================
-- 114_push_vibrate.sql — 기기별 [알림 올 때 소리·진동] (D-214, todo_improvement 개선사항 1)
-- - push_subscriptions.vibrate: 기본 켜짐. 끄면 서버가 그 기기에만 '조용한 알림'(배너만, 소리·진동 없음)으로 보낸다.
-- - 본인 기기 것만 이 칸만 바꿀 수 있다(다른 칸·남의 구독은 그대로 못 바꿈).
-- =============================================================================
alter table public.push_subscriptions add column if not exists vibrate boolean not null default true;

grant update (vibrate) on public.push_subscriptions to authenticated;
drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated
  using (member_id = (select private.current_member_id()) and company_id = (select private.current_company_id()))
  with check (member_id = (select private.current_member_id()) and company_id = (select private.current_company_id()));
