# 파일 보관함 휴지통 (9-22, D-266)

- 구현 일시: 2026-11-13 (migration 155 운영 적용: 사용자 승인 "migration 153~157" 범위)
- Spec: `spec/features/file-vault.md` "휴지통", 시안 https://claude.ai/artifact/Ler67tzj8iWouxoFjo8jMg ②

## 변경 사항
- DB `155_vault_trash.sql`: `billing_plans.trash_days`(30·90·365), `vault_files.deleted_at·deleted_by`, 읽기 정책(보관함 = 안 지운 것, 휴지통 = 복구할 수 있는 사람만), `vault_can_read`(휴지통 못 엶), `vault_status`(휴지통 개수·크기·일수), `vault_keep_check`(IN_TRASH), `vault_set_scope`·`vault_delete`(휴지통으로), 새 `vault_restore`·`vault_purge`·`vault_empty_trash`, 서버 전용 `vault_trash_due`
- DB 테스트 `094_vault_trash.sql`(새), `085_vault.sql`(지우기 → 휴지통 → 영구 삭제 경로)
- `src/lib/vault/format.ts`(+test `trashDaysLeft`), `server.ts`(휴지통·영구 삭제·비우기·밤 정리), 보관함 actions·page(휴지통 목록), `vault-view.tsx`([휴지통 n]·`TrashSheet`·확인 문구), 채팅 '보관됨'에서 휴지통 제외, 밤 cron `purgeVaultTrash`
- 요금 카드 [지운 파일 복구 n일/1년](`plan-benefits`·요금제 읽기 칸), 처리방침 보관 기간 표 파일 보관함 줄
- E2E `e2e-vault.mjs` 휴지통 흐름 + 보관 시트 일수 확인 기다리기(가끔 늦게 불러와 실패하던 것), `shot-pricing.mjs` 카드 줄

## 확인
- tsc · test 80/447 · lint · build · DB 085·094 · db:types, `e2e-vault.mjs` ALL_OK(1280·390), `shot-pricing.mjs` OK, 스크린샷 확인(390에서 'n일 남음'이 잘려 둘째 줄로 옮김), leftovers []

## 특이 사항
- 처리방침 문구는 보완만 하고 동의 버전은 올리지 않음(다시 동의 받기 없음)
- 플랜을 내릴 때 하루 전 안내는 결제 연동 때(지금은 회사별 플랜 변경 없음)
