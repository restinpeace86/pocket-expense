# 개선사항(2차) 8 — 휴대폰 가상 키보드 대응 (D-101)

- 구현 일시: 2026-10-22
- 변경
  - `src/components/ui/keyboard-aware.tsx`(루트 레이아웃에 1개): visualViewport가 120px 넘게 줄고 글자 입력칸에 포커스가 있으면 `data-keyboard="open"`, `--kb`. 터치 기기에서 입력칸 포커스 0.32초 뒤 가려져 있으면 보이는 영역 가운데로 스크롤(visualViewport 기준이라 iOS에서도 키보드 위로).
  - `globals.css`: `.kb-hide:not(:focus-within)` 숨김, `.kb-pad` 아래 여백 = 키보드 + 7rem.
  - 하단 고정 바 6곳에 `kb-hide`(결의서 작성·직원 메뉴·결재 상세·직원 결의서 상세·지급·세무 마감), 결의서 작성 화면 `kb-pad` + 기본 아래 여백 바 높이 + 48px(최소 128px).
- 검증
  - tsc / test 138 / lint / build 통과, check:responsive 전체 화면 넘침 없음.
  - E2E(`.responsive/live/e2e-keyboard.mjs`, 360×640·390×844): 헤드리스 브라우저에 키보드가 없어 visualViewport를 가짜로 바꿔 "키보드 300px(iOS처럼 보이는 영역만 줄어듦)"를 흉내. 맨 아래 영수증의 금액 칸 포커스 → 금액 칸 148~192px(보이는 영역 0~340) / 394~438px(0~544)로 가려지지 않음, 하단 바 숨김, 아래 여백 412px → 키보드 내리면 바 돌아옴 → 맨 위 제목 칸도 보이는 영역 안. 결재 상세에서 하단 바 안 반려 사유 입력 중에는 바 유지 확인. 스크린샷 확인.
- 특이 사항: 실제 휴대폰 키보드(iOS Safari·Android Chrome)에서의 확인은 사용자 기기 확인이 필요(자동 테스트는 흉내).
