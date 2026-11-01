# 세무사무소 화면 틀 — 관리자 워크스페이스와 같은 왼쪽 메뉴 (D-184)

- 구현 일시: 2026-11-01
- 대상: `src/components/tax-office/tax-office-shell.tsx`, `src/app/tax-office/default-titles/page.tsx`(새로), `src/app/tax-office/manage/page.tsx`, `src/components/tax-office/tax-office-month-view.tsx`, `src/app/tax-office/[companyId]/account-titles/page.tsx`, `spec/screens/tax-office.md`

## 변경
- 틀: PC(md 이상) 왼쪽 어두운 메뉴(관리자와 같은 sidebar 색·모양), 휴대폰 ☰ 서랍. 맨 위 사무소명 + "세무사무소".
- 메뉴: 고객사 현황 / 선택한 고객사(세무 자료 · 계정과목) / 사무소(기본 계정과목(관리자만) · 결산 양식 · 사무소 관리 또는 내 사무소).
- 위쪽 줄: [고객사] 고르기 + 로그아웃. 고르면 보던 메뉴(세무 자료·계정과목)를 그대로 그 회사로, 세무 자료는 보던 달 유지. 고객사 화면 밖에서는 마지막으로 본 고객사(localStorage `pe-tax-office-company`, 실패해도 첫 고객사로) 기준.
- 사무소 기본 계정과목 카드를 [사무소 관리]에서 새 화면 `/tax-office/default-titles`(관리자만, 아니면 404)로 옮김.
- 세무 자료·계정과목 화면 안의 [세무 자료]/[계정과목] 버튼 제거(메뉴로 대신).

## 특이 사항
- 기능·권한·DB는 그대로. 자료 요청은 달마다 묶여 있어 [세무 자료] 화면 안에 그대로 둠(별도 메뉴 없음).
