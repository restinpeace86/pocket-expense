# 최초 1회 설정 끝 [직원 초대] 단계 — D-302 B-1 / todo 9-45a

- 구현 일시: 2026-11-22
- 변경 사항: `src/lib/admin/setup-wizard.ts` 직원 초대 단계(멤버 관리 /members, last) · 순서 = 설정 → 근태 → 직원 초대. `setup-wizard-bar.tsx` 설정 밖 단계 화면에서도 진행 띠(멈춘 상태의 [설정 마법사] 버튼은 설정 화면에만). 테스트·E2E 단계 수 18/22로
- 특이 사항: 이미 다 끝낸 회사(finished_at 있음)는 새 단계가 '안 봄'으로 남지만 홈 카드는 뜨지 않음(설정 마법사 버튼에서 다시 훑어보기 가능)
- 검증: tsc · vitest 511 · build · 로컬/운영 E2E(e2e-setup-wizard, e2e-unsaved) · leftovers []
