# 세무사무소 초대 코드 입력칸 없앰 (D-183)

- 구현 일시: 2026-11-01
- 대상: `src/components/tax-office/tax-office-onboarding.tsx`, `src/components/tax-office/office-manage.tsx`, `spec/screens/tax-office.md`

## 변경
- 세무사무소 등록 화면(구성원이 아닐 때)에서 [초대 코드로 합류] 카드(8자리 입력 → `/tax-join/코드` 이동)를 지우고, "이미 있는 사무소에 들어가는 세무사·직원이라면 새로 등록하지 말고, 사무소 관리자에게 받은 초대 링크를 눌러 주세요" 안내 한 줄로 바꿈.
- 사무소 관리 > 소속 세무사·직원 초대: 링크 아래 "초대 코드 XXXXXXXX" 줄을 뺌. [링크 새로 만들기] 확인 문구 "이전 링크와 코드" → "이전 링크".

## 특이 사항
- DB(`tax_offices.invite_code`)·`/tax-join/[code]` 화면·합류 RPC는 그대로 — 링크 안에 코드가 들어 있다.
- 회사 쪽 [초대 코드로 회사 합류](`/onboarding`)는 다른 기능이라 건드리지 않음.
