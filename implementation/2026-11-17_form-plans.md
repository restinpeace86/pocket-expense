# 4단계 — 회사 양식 요금 칸·랜딩·맞춤 지원 안내 (9-33f, D-289)

- 구현 일시: 2026-11-17 · migration 165(사용자 승인 후 운영 적용) · DB 테스트 `101_form_slots_general_only.sql`(test:db 목록에 추가), `089_company_forms.sql`을 새 기준(근태 양식 안 셈)으로 고침

## 변경 사항
- DB: billing_plans 회사 양식 칸 0·3·5(무제한 끔), `form_slot_used` = 결재 문서만, `form_slot_blocked(회사, 종류)` = 칸 0이면 전부 / 결재 문서만 칸까지 — `company_form_read_begin`·`company_form_publish`가 씀
- 요금: `plan-benefits.ts` `formLabel`·비교표 줄·`CUSTOM_SCREEN_NOTE`, 랜딩 요금 카드 아래 맞춤 지원 안내(`data-custom-note`), 다른 점 카드·기능 벽 문구
- 관리자 [회사 양식]: 막대 '결재 문서 n / m개' + 근태 양식 안 셈·꽉 차면 안내, 빈 칸 줄, `custom-screen-card.tsx`(새) — [맞춤 제작 문의] 창 → [의견 보내기] 통로(기능 개선)
- 양식 추가 창: '결재 문서 칸(근태 양식은 안 셈)', 꽉 참은 결재 문서일 때만(칸 0이면 전부), 문구 정리

## 확인
- DB 101·089·091·097·098·099·012(165 위에서 롤백) 통과, 운영 101·089 통과
- 단위 482(plan-benefits 기대값 3·5개로) · `e2e-form-plans`(요금 카드·맞춤 안내·다른 점·관리자 막대 0/3개·맞춤 문의 창·390 넘침) · `e2e-forms` 기대값 0/3개로
- 랜딩 요금 영역은 `use cache`라 배포 뒤 새 값으로 나오는지 운영에서 확인
