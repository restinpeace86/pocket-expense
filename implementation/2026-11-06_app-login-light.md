# 설치 앱 로그인·밝은 화면 (D-230)

- 구현 일시: 2026-11-06
- 구현 대상: 사용자 실기기 확인 — 검은 배경 / 홈 화면 안내 팝업 반복 / 카카오 로그인 후 뒤로 가기 하면 "카카오로 이동 중"만 계속

## 원인
- 앱(Capacitor)은 운영 주소가 아닌 곳(Supabase 로그인·카카오·구글)을 휴대폰 크롬으로 넘긴다 → 로그인이 크롬에서 끝나 앱으로 돌아오지 못함 → 크롬에서 계속 쓰게 되어 크롬용 홈 화면 안내가 뜸.
- 앱 화면은 이동하지 않았으니 로그인 버튼이 "이동 중"에 멈춤.
- 앱 테마가 DayNight(휴대폰 다크 모드를 따라감) + 크롬 자동 다크.

## 변경 사항
- `src/components/push/native.ts`: `appAuthRedirect`(앱이면 로그인 끝 주소 = `kr.damounlab.app://auth/callback`), `appUrlToCallback`, `initNativeAuthReturn`(appUrlOpen·getLaunchUrl → `/auth/callback?…`). 테스트 `native.test.ts`.
- `src/components/push/native-app-bridge.tsx`(새) — 루트 레이아웃에서 모든 화면(로그인 포함)에 연결.
- `src/components/auth/oauth-buttons.tsx`: 앱이면 앱 주소로, 로그인 창에서 돌아오면(visibilitychange·pageshow) 버튼 원래대로.
- `src/app/layout.tsx`: `viewport.colorScheme = "only light"`.
- 앱: `styles.xml` Light 테마·흰 바탕·forceDark 끔·상단/하단바 흰색, 매니페스트에 `kr.damounlab.app://auth` 받기, `capacitor.config.json` backgroundColor 흰색, 1.0.1(versionCode 2). `src/lib/app-download.ts` 버전 1.0.1.
- Supabase Auth Redirect URLs에 `kr.damounlab.app://auth/callback` 추가(사용자 승인, 관리 API로 기존 목록 유지 + 추가).

## 특이 사항
- Supabase Site URL이 `http://localhost:3000`으로 되어 있다(허용 목록에 없는 주소로 돌아갈 때 쓰는 기본값). 운영 주소로 바꾸는 것을 권장 — 사용자 결정 필요.
- 이미 1.0.0을 설치한 사람은 1.0.1을 받아 덮어 설치(같은 서명 키라 데이터 유지).

## 검증
- tsc · `npm run test` · build 통과
- e2e-androidapp ALL_OK: 앱 안 로그인 시 돌아올 주소 = 앱 주소 / 돌아오면 "이동 중" 풀림 / 앱 주소로 열리면 `/auth/callback`(가짜 코드 → 로그인 오류 화면 = 길 확인) + 기존 항목, e2e-install ALL_OK, `<meta name="color-scheme" content="only light">` 확인
- APK 1.0.1: versionCode 2, 앱 주소 받기(intent-filter) 확인. 실기기 확인 필요(크롬 로그인 → 앱 복귀)
