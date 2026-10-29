# 2026-10-29 마감일 승인 대기 독촉 (D-166)

## 구현 대상 (사용자 지시)
- 5일까지 승인 안 된 결의서는 대표·관리자 책임 → 5일이 되면 빨리 승인하거나 반려하라고 독촉

## 변경 사항
- migration 090: `closing_admin_targets`에 승인 대기 수(지난달까지 쓴 영수증이 든 상신 결의서)·홈택스 미업로드·마감 여부를 더하고, 3일·5일 대상에 승인 대기가 있는 회사 추가(마감했어도)
- `closingNotice` 문구를 상황별로 조합(승인 대기 독촉 먼저, 버튼 [승인 대기 보기]) + 테스트 4개, `push/closing.ts` 웹푸시 제목에 대기 건수
- 세무 마감 화면 빨간 안내 + [승인하러 가기]
- DB 테스트 056에 승인 대기 경우 추가, spec notification-rule·tax-closing

## 확인
- tsc·eslint 통과, `npm run test` 234개, 전체 `test:db`, `npm run build` 통과
- 화면 E2E `.responsive/live/e2e-pending-nag.mjs` 6/6(9월 마감 화면: 9월까지 대기 2건·10월 건 제외, 링크, 1280·390 넘침 없음). 스크린샷 확인
- 회귀: e2e-improve3 25/25, e2e-tax 정상. 테스트 회사 0개
