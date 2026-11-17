# Next.js 보안 패치 (D-282, 9-33z)

- 구현 일시: 2026-11-17
- 대상: next·eslint-config-next 16.4.2 → 16.4.6, fflate ^0.8.2 → ^0.8.3
- 이유: GHSA-mfr8-8qww-v76h(next, moderate — unstable_cache 안에서 'use cache' 함수 호출 시 정보 노출), GHSA-px8p-9vwx-vf98(fflate, ZIP64 풀기 무한 반복). 이 앱은 두 경로 모두 안 써서 실제 영향은 없었음
- 변경: package.json·package-lock.json만(코드 변경 없음)
- 남은 것: exceljs 4.4.0 안의 uuid 8.3.2(moderate, v3/v5/v6에 buf 넘길 때만) — exceljs가 해당 호출을 안 하고, 고치려면 exceljs 3.4로 내려야 해서 그대로 둠
- 검증: 타입 체크 · 단위 테스트 472 · 빌드(Next.js 16.4.6, 보안 경고 사라짐) · 로컬/운영 화면 E2E
