# 개선사항 1 — 관리자 모바일 메뉴 · 카카오톡 공유 · 영수증 상세 레이아웃

- 구현 대상: `implementation/todo_improvement.md` [개선사항 1] 1~3
- 구현 일시: 2026-10-21

## 변경 사항
1. **관리자 모바일 메뉴의 설정 펼침** — `admin-shell.tsx` `NavList`에 `settingsOpen` 추가. 모바일 서랍에서는 [설정] 묶음이 처음부터 펼쳐져 화면 이름이 바로 보인다. PC 옆 메뉴는 그대로(현재 화면이 설정일 때만 펼침).
2. **카카오톡으로 공유하기** — `kakao-share-button.tsx`(신규)를 초대 링크 카드에 [링크 복사] 아래 추가.
   - 버튼을 누를 때 카카오 JS SDK 2.7.2를 불러와 `Kakao.Share.sendDefault`(feed 카드: "{회사}에서 경비 정산에 초대했어요", 버튼 [가입하기] → 초대 링크).
   - 카드 이미지: `/share/invite-image` (800×400, 정적 생성. 서버 이미지 생성기에 한글 글꼴이 없어 이미지 안 글자는 영문, 한글은 카드 글 영역).
   - 키: `NEXT_PUBLIC_KAKAO_JS_KEY`. **`.env.local`에는 이 키가 없음**(있는 것: `NEXT_PUBLIC_KAKAO_MAP_API_KEY`, `KAKAO_REST_API_KEY`). 키가 없으면 버튼을 숨긴다. `.env.example`에 항목 추가.
3. **영수증 상세(ItemEditor) 재배치** — 사진을 맨 위에 화면 폭 그대로(최대 높이 60vh, 잘림 없이 `object-contain`) 보여 주고, 그 아래로 중복 경고 → 영수증 정보 → 결제수단 → AI 참고 정보 → 카테고리 순으로 세로 스크롤. 사진을 누르면 크게 보기.

## 검증
- 로그인 E2E(임시 회사 `smoke-e2e-*`, 끝나고 삭제 확인): 360·390폭에서 사진 아래끝이 가맹점 입력칸보다 위(겹침 없음), 가로 넘침 0. 관리자 모바일 서랍 설정 펼침 확인, 초대 카드에 카카오 버튼 1개.
- `npm run check:responsive` 전 화면 4폭 넘침 없음. tsc / test(83) / lint / build 통과.

## 특이 사항 / 사용자 할 일
- 카카오 개발자 콘솔 › 내 애플리케이션 › 앱 키의 **JavaScript 키**를 Vercel 환경변수와 `.env.local`에 `NEXT_PUBLIC_KAKAO_JS_KEY`로 넣고, **플랫폼 › Web › 사이트 도메인**에 운영 주소(와 `http://localhost:3000`)를 등록해야 공유가 열린다.
- 이번 빌드에서 `route segment config "dynamic"`이 cacheComponents와 맞지 않아 제거(요청 정보를 쓰지 않아 자동으로 정적 생성됨).
