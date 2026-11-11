# 기능 시뮬레이션 7개 · 랜딩 개편 (D-255 §B·§C, D-256) — 2026-11-12

- 근거: spec/features/help-knowledge.md §B·§C(승인 D-255), 사용자 2026-11-12 "그래 진행해"(밝은 바탕 추천안)
- 구현 대상: 랜딩·도움말 공용 시뮬레이션 틀과 7개, 랜딩 전면 개편

## 변경 사항
- `components/sims/sim-player.tsx`: 공용 틀. 단계(제목·누구·아이콘·tick 수) → 장면 함수 scene(단계, tick). 보이면 한 번 자동 재생(useSeen), 단계 버튼 = 그 단계만, [처음부터 다시 보기], 움직임 줄이기면 끝 모습, `playNow`(도움말: 누르면 바로 재생·화면 안으로)
- `components/sims/ui.tsx`: 휴대폰·창 틀, 나타나는 줄, 버튼 상태, 알림 카드, 칸, 예시 QR
- 시뮬레이션: `receipt`(지금 랜딩 내용 그대로 옮김) `qr` `leave` `convert` `rooms` `chat` `closing` — 문구는 실제 화면(출근 단말·휴가신청서 버튼·변환 화면·[알림]방 회의 카드·서브 대화 종결 요약·영구 보관·세무 마감)에 맞춤
- `components/sims/index.tsx`: 목록·키, `<Sim simKey>`
- 도움말 `help-center.tsx`: renderSim 자리 → 글의 sim 키가 있으면 [▶ 화면으로 보기]로 그 자리 재생
- 랜딩 `app/page.tsx`: 밝은 바탕, 다른 점 4, 다섯 기둥(+[▶ 화면으로 보기]), `landing/feature-preview.tsx`(진한 띠, 탭 7개, `#preview-{키}`), 이어짐 6, 역할 문구에 근태·휴가. FAQ·후기·요금제 밝은 색으로
- 지움: `landing/ai-simulator.tsx`(영수증 시뮬레이션은 sims/receipt로)

## 검증
- tsc, test(430), build 통과
- E2E `e2e-landing-sims.mjs` ALL_OK(로컬): 390·1280 섹션·넘침 없음, 탭 7개 모두 끝까지 재생·넘침 없음, 단계 버튼, 기둥 링크 → 탭, 움직임 줄이기 → 끝 모습, 도움말 QR 글 [▶ 화면으로 보기] → 재생 끝. leftovers []
- 캡처: 랜딩 1280 전체, 시뮬레이션 7개 390, 휴가·월말 1280, 도움말 390 확인

## 특이 사항
- 도움말 안 시뮬레이션은 글 아래에 열려 화면 밖일 때가 많아 "보이면 재생" 대신 누르면 바로 재생으로 함
- 히어로 목업(결재 알림 카드)은 그대로 둠(진한 기기 틀이 밝은 바탕에서도 잘 보임)
