# [내 서브 대화] 드롭다운 (9-20, D-264)

- 구현 일시: 2026-11-13
- Spec: `spec/features/messenger.md` "[내 서브 대화] 드롭다운", 시안 https://claude.ai/artifact/Ler67tzj8iWouxoFjo8jMg ⑧

## 변경 사항
- `src/components/chat/my-threads.tsx`: `MyThreadsRow`가 `chat_my_threads` 목록을 받아 그 자리에서 펼치는 드롭다운으로 바뀜(진행 중 최근 글 순 → 종결 흐리게, 방별 새 글 수, 최대 8개 + [모두 보기]/[모아보기로 보기], Esc 닫기, 고르면 열고 접힘). 서브 대화 없으면 줄 숨김. 여는 동작은 `openThread()`로 모아보기 창과 같이 씀
- `.responsive/live/e2e-threads.mjs`: ④ 드롭다운(펼침·새 글 2·모아보기·접힘), ⑥ 휴대폰 드롭다운·넘침

## 확인
- tsc · test 80/446 · build, `e2e-threads.mjs` 로컬 ALL_OK(1440·1024·390), 스크린샷 확인, leftovers []

## 특이 사항
- DB 변경 없음. 줄 배지는 진행 중 서브 대화 새 글 합계(목록 데이터로 계산, `chat_my_threads_new` 호출 하나 줄어듦)
