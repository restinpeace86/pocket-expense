# 2026-10-29 todo_improvement 개선사항 1~3 — 고정 마감·관리자 메뉴 간소화·계정과목 리포트 (D-159~D-161)

## 구현 대상 (사용자 지시 + 결정)
- 개선사항 1: 매월 2일 직원 청구 마감·5일 세무 마감 고정, 쉬는 날이면 앞 영업일, 관리자 1·3·5일 알림, 설정은 확인용
  - 결정: 마감 뒤 지난달 영수증은 상신은 되고 다음 달 정산으로 / 영업일 = 주말 + 공휴일(DB 표, 운영자 관리)
- 개선사항 2: 사내 공지·알림 이력 숨김, 알림 이력은 운영자 화면으로
- 개선사항 3: 계정과목은 회사 보기 전용 리포트([월별 지출 현황]), 수정은 세무사무소 — 기본값 + 일괄 적용 버튼(복잡하지 않게)

## 변경 사항
- D-159: `admin-shell.tsx` 설정 메뉴에서 사내 공지·알림 이력 제거, 홈 "알림톡 발송 실패" 할 일 제거. `/app-admin/notifications`(회사·실패 거르기)
- D-160: `/admin/spending` + `spending-report.tsx`(계정과목별 막대 → 영수증 표), 메인 메뉴 추가·설정에서 계정과목 제거, 홈 알림 링크를 리포트로. migration 087(`tax_offices.default_*`, `save_tax_office_default_titles`, `tax_office_default_titles`, `apply_tax_office_default_titles`), `default-titles.tsx`(고객사 화면·사무소 관리), `tax-office/default-titles-actions.ts`
- D-161: migration 088(`kr_holidays` + 2026·2027, `private.prev_working_day/claim_cutoff/tax_close_due/settlement_month`, `claim_deadline_date` 고정 규칙화, `tax_month_pending_items` 늦은 청구 → 상신한 달 전월 추가분, `push_deadline_targets` 고정 마감, `closing_admin_targets`, `closing_calendar`, push_logs `closing`, 알림톡 `CLOSING`)
  - `src/lib/expense/deadline.ts` 고정 규칙(+test), `holidays.ts`, 직원·관리자 "기한 초과" → "다음 달 정산", 직원 항목 경고 문구
  - 설정 `fixed-closing-section.tsx`(이번 달 실제 날짜), `claim-deadline-section.tsx` 삭제, 정책 요약 문구
  - 세무 마감 화면 위 마감일 안내
  - `src/lib/push/closing.ts` + `sendClosingNotice` + `closingNotice` 템플릿, 아침 cron에 추가
  - `/app-admin/holidays`(추가·지우기)
- DB 테스트 055·056 추가, 007·028·038은 고정 규칙에 맞게 고침. 예전 회사별 기한 E2E(`e2e-deadline.mjs`)는 retired로
- spec: admin-settings §2.0, admin-dashboard ⑨-1·⑩·⑪, app-admin §3b·3c, notification-rule CLOSING, tax-office §3g, tax-closing §3e / decision-log D-159~161 / todo 8-12~8-15

## 특이 사항
- 홈택스 자료와 직원 영수증 자동 대조(크로스체크 화면)·통합 결의서 자동 생성·정기 구독 템플릿 대조는 실제 홈택스 파일 견본을 받은 뒤(8-12). 견본 없이 칸 이름을 추측해 만들지 않음
- 관리자 알림은 기존 아침 7시 cron에서(Vercel cron 개수 제한) — 스펙 예시 9시와 다름. 카카오 알림톡 실제 발송은 O-01 보류 그대로(기록·콘솔만), 웹푸시는 실제 발송
- 공휴일 2026·2027은 직접 넣은 값 — 운영자 화면에서 한 번 확인 필요(근로자의 날 등 법 개정 여부 포함)
- 정산 달 판정은 결의서의 현재 상신일 기준이라, 반려 뒤 마감 지나 다시 상신하면 다음 달로 넘어간다
- 세무사무소 기본값은 새로 연결된 고객사에 자동 적용하지 않음(버튼 한 번)

## 확인
- `npx tsc --noEmit` 통과, `npm run test` 225개 통과(마감 규칙 테스트 교체)
- DB 테스트 055(기본값 저장·적용·권한·격리·이력·두 번 적용 0줄)·056(영업일·늦은 청구·관리자/직원 알림 대상) + 전체 `test:db` 통과
- `npm run build` 통과
- 화면 E2E `.responsive/live/e2e-improve3.mjs` 25/25: 메뉴(1280·390), 운영자 알림 이력·공휴일 추가, 월별 지출 현황(합계·펼침·읽기 전용·넘침 없음 1280·390), 사무소 기본값 저장·B에만 적용·B 계정과목·B 홈 알림·리포트 이력, 설정 마감 일정(실제 날짜), 직원 늦은 청구 안내, 늦게 상신한 9월 영수증이 9월 아닌 10월 세무 마감에. 스크린샷 확인
- 회귀: e2e-tax-office 34/34, e2e-tax-governance 20/20, e2e-d155-156 21/21, e2e-hometax 18/18, e2e-referral 20/20, e2e-tax(회사 ZIP·PDF) 정상, e2e-flow 17 OK. 테스트 회사·사무소 0개
