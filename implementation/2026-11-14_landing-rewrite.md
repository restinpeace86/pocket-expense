# 랜딩 다시 짜기 (9-28, D-273)

- 구현 일시: 2026-11-14 (DB 변경 없음)
- 시안: https://claude.ai/artifact/P2ovBCNHq4gXsKgtSrqdyw (사용자 의견: 서브 대화 시뮬레이션 추가, 다른 점 문구 강하게, 기능이 보이게, 요금 아래 기본 기능)

## 변경 사항
- `src/app/page.tsx`: 구역 구성·문구 다시 짬(다른 점·기능 벽·한 달 흐름·누구에게·끝), 큰 제목 `Heading`, 휴대폰 고정 버튼
- `src/lib/landing/features.ts`(새): 모든 플랜 공통 기능 5구역(랜딩 기능 벽·요금 아래·관리자 요금제가 같이 씀)
- `src/components/sims/threads.tsx`(새) + `sims/index.tsx`·`feature-preview.tsx`: 서브 대화 시뮬레이션(섞이는 대화 → 서브 대화로 → AI 요약 → 내 서브 대화 모아 보기), 미리 보기 8탭
- `src/components/landing/mobile-start-bar.tsx`(새), `section-nav.tsx`(메뉴에 없는 구역에서 표시 끔)
- `src/components/landing/pricing.tsx`: 제목, 카드 핵심 4줄(`planCore`), [플랜 자세히 비교] 표(`planCompareRows`), [모든 플랜 기본 기능], [요금 기준 보기] 접기
- `src/lib/billing/plan-benefits.ts`(+test): `planCore`·`planCompareRows`, `COMMON_FEATURES` → `FEATURE_GROUPS`, 관리자 요금제 기본 기능도 구역별
- E2E: `shot-pricing`(접힌 것 펼쳐 확인·카드 핵심 줄), `e2e-landing-sims`(8탭·한 달 흐름·이어짐 칩), `measure-landing.mjs`(구역별 길이)

## 확인
- tsc · test 82/458 · lint · build(컴퓨터 메모리가 모자라 두 번 멈춘 뒤 여유가 생겨 통과 — 코드 문제 아님을 변경 없이 빌드해 확인), `shot-pricing`·`shot-landing-color`·`e2e-storage`·`e2e-landing-sims` 로컬 통과, 스크린샷 확인, leftovers []
- 길이: PC 7,494px(화면 8.3장, 전 9.8장), 휴대폰 12,068px(14.3장, 전 18.7장). 가장 긴 곳은 휴대폰 요금(카드 3장이 세로로 쌓임)
