-- =============================================================================
-- 041_route_card_file.sql — 자차 유류비 '출장 경로 및 거리 산정 요약' 증빙 이미지 파일 (D-088, D-085 ⑤ 보완)
-- - 상신이 끝나면 서버가 확정된 값(경로·거리·단가 스냅샷·금액)으로 PNG를 만들어 영수증 버킷에 저장하고 항목에 연결한다.
-- - 경로: {company_id}/route-cards/{claim_id}/{item_id}.png — 두 번째 폴더가 member_id가 아니라서
--   직원 업로드 정책(receipts_insert/update: {company}/{member}/{claim}/…)으로는 올리거나 덮어쓸 수 없다(서버만, 위조 방지).
-- - 열람: 영수증과 같은 규칙(자기 회사 + 그 항목을 볼 수 있는 사람).
-- - 경로·거리·왕복·금액이 바뀌면 연결을 끊는다(반려 후 고치면 다시 상신할 때 새로 만든다).
-- =============================================================================

alter table public.expense_items
  add column route_card_path text,
  add constraint expense_items_route_card_path_in_company
    check (route_card_path is null or route_card_path like company_id::text || '/route-cards/%');
-- 직원은 이 칸을 쓸 수 없다(표에 칸 단위 권한만 있어 새 칸에는 쓰기 권한이 없음). 서버(service role)만 쓴다.

create index if not exists expense_items_route_card_path_idx on public.expense_items (route_card_path) where route_card_path is not null;

create or replace function private.clear_stale_route_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.route_card_path is not distinct from old.route_card_path
     and (new.start_lat, new.start_lng, new.end_lat, new.end_lng, new.is_round_trip, new.distance_km, new.amount)
         is distinct from (old.start_lat, old.start_lng, old.end_lat, old.end_lng, old.is_round_trip, old.distance_km, old.amount) then
    new.route_card_path := null;
  end if;
  return new;
end;
$$;
create trigger expense_items_clear_stale_route_card before update on public.expense_items
  for each row when (old.route_card_path is not null) execute function private.clear_stale_route_card();
revoke all on function private.clear_stale_route_card() from public, anon, authenticated;

drop policy receipts_select on storage.objects;
create policy receipts_select on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (
    exists (select 1 from public.expense_items i where i.receipt_path = storage.objects.name and i.company_id = (select private.current_company_id()))
    or exists (select 1 from public.expense_items i where i.receipt_thumb_path = storage.objects.name and i.company_id = (select private.current_company_id()))
    or exists (select 1 from public.expense_items i where i.route_card_path = storage.objects.name and i.company_id = (select private.current_company_id()))
  )
);
