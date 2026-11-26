# 2026-11-26 알림 안내 계정 기준 · 지난달 지출 리포트 · 월별 지출 현황 추이 (D-318·D-319)

## 구현 대상
- 사용자 지시(2026-11-26): 알림 안내를 계정 단위로, 지출 리포트(1), 월별 지출 현황 시각화(2)

## 변경 사항
- src/lib/push/prompt.ts(+test): 계정 기준 판단·앱 안 브라우저 판별 · app/push/actions.ts deferPushPromptAction · workspace layout에서 기기 수·계정 기록 확인 · push-auto-prompt.tsx ask
- src/lib/report/monthly.ts(+test)·monthly-server.ts · api/cron/morning(매월 1일) · api/cron/monthly-report(한 회사, CRON_SECRET)
- components/admin/spending-trend.tsx · admin/spending/page.tsx(6개월 추이·직원별)

## 검증
- tsc · vitest 540 · build 통과
- E2E e2e-report-prompt(로컬, 운영 DB의 smoke 회사): ① 처음 안내 뜸 + 계정에 30일 뒤 ② 다른 브라우저 같은 계정 안 뜸 ③ 카카오톡 안 브라우저 안 뜸·기록 안 남김 ④ 앱 알림 기기 있으면 안 뜸 ⑤ 리포트 대표·관리자 2명만, 총액·전월 대비·사람·예산·링크 ⑥ 같은 달 다시 안 보냄 ⑦ 알림방 카드 화면 ⑧ 6개월 막대·전달 대비·직원별, 390·1280 넘침 없음 — ALL_OK, leftovers []
- 로컬 리포트 발송 시험은 로컬 서버에만 임시 CRON_SECRET을 넣어 실행(Vercel 설정 변경 없음)

## 특이 사항
- 리포트 기준(결재 올린 것 포함)과 월별 지출 현황 기준(승인·지급)이 달라 카드에 '결재 올린 것까지 포함' 표기
- 계정 기록은 새 표 대신 로그인 계정 정보(user_metadata) — DB 변경 없음
