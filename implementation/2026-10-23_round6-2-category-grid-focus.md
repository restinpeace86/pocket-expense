# 6차 개선사항 2 — 카테고리 2열 정렬·고른 칸 구분·입력칸 포커스 강조 (D-115)

- 구현 일시: 2026-10-23
- 변경
  - `src/components/employee/claim-editor.tsx`: `categoryChip()` 하나로 4대·그 밖의 경비 칸 모양 통일(높이 48px, 2열 `grid-cols-2`, 낱말 단위 줄바꿈). 고른 칸 = 브랜드색 채움 + 흰 글씨 + 그림자, 안 고른 칸 = 흰 바탕·회색 테두리(올리면 옅은 브랜드색). AI가 골라 둔 카테고리(D-103)도 고른 칸 모양으로(전에는 `form.category`로만 색을 칠해 AI 추천 칸이 안 칠해졌음).
  - `src/components/ui/page-shell.tsx` `inputClass`: 포커스 때 `border-brand-600` + `ring-4 ring-brand-500/25` + `bg-brand-50/40`(앱 전체 입력칸 공통 — 제목·지출 사유 포함).
- 검증: tsc / test 154 / lint / build 통과, check:responsive 전체 넘침 없음. 360·390·1280 스크린샷(그 밖의 경비 펼침 + 제목 포커스, 포커스 링 적용 확인). 카테고리 E2E 3개(결의서 카테고리·추가 카테고리·3차) 재실행 통과.
