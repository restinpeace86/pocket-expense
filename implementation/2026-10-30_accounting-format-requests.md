# 다른 회계 프로그램 양식 접수 (D-180)

- 구현 대상: 회사 세무 마감 화면 [다른 회계 프로그램을 쓰시나요?] 팝업 등록 + 운영자 [양식 접수]
- 구현 일시: 2026-10-30

## 변경 사항
- DB `098_accounting_format_requests.sql`: 비공개 보관함 `accounting-format-files`(5MB), 표 `accounting_format_requests`(강제 RLS, 회사 관리자가 자기 회사 것만 읽음, 직접 쓰기 없음), 함수 `add_accounting_format_request`(관리자만, 자기 회사 폴더만, 회사당 20개).
- 회사: `src/components/admin/accounting-format-request.tsx`(버튼 2개 + 팝업 + 목록), `export/format-actions.ts`(파일 확인·보관 → DB 기록, 실패하면 파일 지움 → 운영자 디스코드 알림), `src/lib/accounting-format/*`.
- 운영자: `/app-admin/format-requests`(목록·원본 받기·준비 완료 표시), 상단 메뉴 [양식 접수].
- DB 테스트 `supabase/tests/060_accounting_format_requests.sql`(직원 차단·다른 회사 폴더·직접 쓰기·회사 격리·직원 안 보임·20개 한도).

## 검증
- tsc, 테스트 242개, DB 테스트 전체(060 포함), 빌드 통과.
- 화면 E2E `.responsive/live/e2e-format-request.mjs` 19/19: 390 영역·팝업·엑셀 아닌 파일 안내·등록·접수됨 목록·보관 원본 크기·실패 파일 안 남음 / 다른 회사·직원 안 보임·운영자 아니면 404 / 운영자 1280 목록·원본 받기·준비 완료 / 회사 1280 준비 완료·세무사랑 팝업. 넘침 없음, 스크린샷 확인. 테스트 데이터 남지 않음.

## 특이 사항
- 맞춤 다운로드는 아직 없음(접수만). 실제 양식이 오면 todo 8-27·8-28로 만든다.
- 운영자 알림은 서버 환경 변수 `DISCORD_WEBHOOK_URL`이 있을 때만 — Vercel에 등록해야 배포본에서도 알림이 온다.
- 회사가 잘못 올린 파일을 지우는 기능은 두지 않았다(운영자가 확인).
