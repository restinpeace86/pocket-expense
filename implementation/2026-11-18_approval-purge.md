# 결재 문서 첨부 일괄 정리 + 결재 문서 도움말 (D-291)

- 일시: 2026-11-18 · migration 166(운영 적용, 사용자 승인) · DB 테스트 `supabase/tests/102_approval_files_purge.sql` · E2E `.responsive/live/e2e-approval-purge.mjs`

## 변경
- DB: `approval_documents.files_purged`(지운 첨부 수)·`files_purged_at` / `approval_doc_purge_status()` 기간별(3·6·12·0) 문서·첨부·크기 / `approval_doc_purge_list(months)` 경로 최대 500 / `approval_doc_purge_done(paths)` 저장소에 없는 것만 기록 지움 + 문서 표시(updated_at 그대로). 모두 관리자·자기 회사·승인된 문서만
- 서버: `admin/chat-settings/actions.ts` `purgeApprovalFilesAction` — 목록 → 저장소 API로 지움(회사 경로만) → done, 최대 20번 반복, 못 지운 건 다시 잡지 않음
- 화면: `components/admin/approval-files-purge.tsx`(파일 보관 화면, 결재 문서 양식이 있었거나 정리할 첨부가 있는 회사만) · 문서 보기 정리 안내 · 요금제 저장 공간 안내 한 줄 · 파일 보관 도움말(?) 한 단락
- 도움말: `src/lib/help/seed.ts`에 5편(approval-doc-write·fields·decide·forms·purge) → `node scripts/help-seed.mjs`(없는 글만 넣음, 운영자 고친 글 그대로)

## 확인
- DB 테스트: 직원 막힘 · 기간별 개수 · 반려·결재 중 제외 · 다른 회사 경로 무시 · 저장소에 남은 파일 기록 유지 · 500개 넘김 막힘 · admin 역할 가능 · 직접 수정 막힘
- E2E(로컬·운영): 카드 개수(반려 뺌) · 기본 선택 = 첫 있는 기간 · 6개월 정리 → 옛 승인 2개만 저장소·기록에서 사라짐 · 최근 승인·반려 그대로 · 문서 보기 안내(관리자·직원) · 390/1280 넘침 0 · 직원은 카드 없음
