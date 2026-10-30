# 랜딩 애니메이션 — 사람이 보고 있을 때만 (D-182)

- 구현 대상: todo 8-31. 사용자 지시는 "딱 그게 포커스 되었을 때, 사람들이 볼 수 있을 때 시작".
- 구현 일시: 2026-10-30

## 발견한 문제
150px씩 스크롤하며 기록했다(`.responsive/live/landing-anim-scroll.mjs`).
1. **휴대폰에서 늦게 시작**: AI 미리보기가 화면 가운데 40% 띠 기준이었다. 그래서 영수증이 보이는데도 시작하지 않았다(한 위치에서 14초 동안 그대로).
2. **보이는 중에 처음으로 돌아감**: 조금 지나쳐 카드가 200~290px 보이는데도 "사진 올리기 전"으로 되돌아갔다(PC·휴대폰).
3. **다른 탭에서도 진행**: 타이머가 계속 돌아, 아무도 안 보는 사이 시연이 끝날 수 있었다.

히어로 목업은 보일 때 재생되고 있었다. 다만 기준(가운데 60% 띠)이 미리보기와 달랐고, 다른 탭인지는 보지 않았다.

## 변경 사항
- `src/components/landing/use-seen.ts`(새 파일): 공통 기준.
  - 요소가 60% 이상 보이면 켜진다. 화면보다 긴 요소는 화면 높이의 60%가 기준이다.
  - 15% 아래로 줄거나 `visibilitychange`로 페이지가 가려지면 꺼진다.
  - 켜짐·꺼짐 기준을 달리 둬 조금 스크롤할 때 깜빡이지 않게 했다.
- `hero-mockup.tsx`: 자체 IntersectionObserver를 `useSeen`으로 바꿨다. CSS 일시정지(`data-playing`)는 그대로 쓴다.
- `ai-simulator.tsx`: 자체 IntersectionObserver를 `useSeen` 결과로 바꿨다.
  - 시작과 멈춤(처음 모습으로)은 기존 `play`·`stopUnseen`을 그대로 쓴다.
  - 끝까지 본 뒤 다시 자동 재생하지 않는 것도 그대로다.
- `spec/screens/landing-page.md`의 재생 시점, `project/decision-log.md` D-182.

## 검증
- tsc, 테스트 242, 빌드: OK.
- `.responsive/live/landing-anim-scroll.mjs` 14/14(휴대폰 iPhone 13, PC 1280):
  - 히어로: 보이면 재생, 다른 탭이면 멈춤.
  - 미리보기: 시작은 휴대폰 76%·PC 100% 보일 때. 일부 보이는 동안 되돌아가지 않음. 다른 탭이면 처음 모습, 돌아오면 다시 시작. 3단계 끝까지 진행.
- 스크린샷을 확인했다(`.responsive/e2e/landing-anim/`).
