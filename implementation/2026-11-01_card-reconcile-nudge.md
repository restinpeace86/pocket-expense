# 법인카드 내역 대조 — 사무소는 대조한 달만, 회사는 월말 권유 (D-190)

- 구현 일시: 2026-11-01
- 대상: `supabase/migrations/100_closing_card_reconcile.sql`, `supabase/tests/056_fixed_closing_calendar.sql`, `src/lib/push/closing.ts`, `src/lib/notify/templates.ts`(+ `closing-notice.test.ts`), `src/lib/tax/workbook.ts`(+ test), `src/components/admin/card-reconcile-status.tsx`, `src/components/tax-office/office-workbook-preview.tsx`, `src/app/workspace/[id]/admin/export/page.tsx`

## 변경
- 엑셀: "카드 대조 결과" 시트는 그 달 대조를 저장했을 때만(`if (opts.cardReconcile)`). `taxWorkbookLayout(main, withCard)`.
- 세무사무소: 대조 상태 카드는 대조한 달만(`CardReconcileStatus`에 href가 없고 안 했으면 아무것도 안 그림).
- 회사 세무 마감: 사용 중 법인카드가 있으면(`recommend`) 안 한 달을 주황 "마감 전 권장" 카드(2단계 안내 + 버튼). 세무사무소와 같은 [세무용 엑셀 미리보기](`audience="company"`) + 대조 안 했으면 아래 권유 한 줄.
- 월말 알림: `closing_admin_targets`에 `has_cards`·`card_missing`. 3일 대상에 "대조 안 함"(마감 안 한 회사) 추가. 문구: 1일 카드 내역 올리기 한 줄(카드 있는 회사), 3일·5일 대조 권유(마감했으면 뺌). 3일 푸시 제목 "법인카드 내역 대조를 해 주세요"(홈택스 자료는 올렸을 때).

## 특이 사항
- 마감은 막지 않음(권장). 홈택스 카드 내역 파일 대조는 8-12 보류(견본 대기) — 문구는 "카드사 사용 내역".
- 법인카드 개인부담(D-010)은 유지.

## D-191 이점·내려받는 방법 (같은 날)
- 권장 카드에 자동 대조 설명 + 이점 4가지 + 접힌 내려받는 방법 4단계. 한 달에 파일 하나만 대조(다시 올리면 덮어씀)라 "카드사마다 차례로 올리기" 안내는 넣지 않음. 홈택스 카드 내역 대조는 8-12 보류 — "준비 중".

## D-192 회사 미리보기 (같은 날)
- 회사 세무 마감 미리보기: 지출내역 탭부터, 회계 프로그램 시트 탭 옆 "세무사무소용"(`WorkbookViewer`의 `tabBadges`). 세무사무소 화면은 그대로.
