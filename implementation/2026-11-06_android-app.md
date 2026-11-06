# 안드로이드 설치 앱 — 서버·웹·앱 껍데기 (D-228, 1차)

- 구현 일시: 2026-11-06
- 구현 대상: spec/features/android-app.md §2–4 (APK 빌드·배포는 Android SDK 설치 뒤)

## 변경 사항
- DB: `supabase/migrations/123_push_app_tokens.sql` — `push_app_tokens`(RLS 강제·회사 복합 FK) + 공개 저장소 `app-downloads`. 테스트 `supabase/tests/077_push_app_tokens.sql`.
- 서버: `src/lib/push/fcm.ts`(FCM HTTP v1, 서비스 계정 JWT → 접근 토큰 캐시, 채널 chat/general, 없어진 토큰 판정). `src/lib/push/server.ts` — 웹푸시와 함께 앱으로도 보내고, 앱 있는 사람의 안드로이드 웹 구독은 건너뜀(`dropAndroidWeb`). 웹푸시 키가 없어도 앱 알림만으로 동작.
- 액션: `src/app/push/actions.ts` `saveAppTokenAction`·`deleteAppTokenAction`(본인만, 같은 토큰 다른 사람 → 서버가 정리).
- 웹(앱 안): `src/components/push/native.ts` — `window.Capacitor` 다리로 알림 권한·토큰·알림 누르면 그 화면(우리 사이트 경로만). [내 정보] 알림 토글·첫 안내·채팅방 알림 닫기가 앱이면 앱 방식.
- 안내: `src/app/download/page.tsx`(PC QR·설치 앱 장점·설치 순서·홈 화면 웹앱·아이폰), `src/lib/app-download.ts`(버전·주소·`ANDROID_APK_READY`).
- 앱 껍데기: `mobile/`(Capacitor 8, `kr.damounlab.app`, server.url = 운영 주소). `MainActivity` 알림 채널, 매니페스트 기본 알림 아이콘·채널·POST_NOTIFICATIONS, 아이콘(운영 /icons/512로 만듦)·흰 스플래시·상단바 아이콘. 서명 설정(`keystore.properties`).
- 웹 빌드·린트에서 `mobile/` 제외(tsconfig·eslint), `.gitignore`.

## 특이 사항
- 서명 키 `mobile/android/workon-release.jks`·`keystore.properties`(비밀번호), Firebase `app/google-services.json`은 저장소에 올리지 않음.
- `supabase/tests/027_admin_dashboard.sql`: 날짜가 지나면 '기한 초과' 건수가 바뀌던 테스트(고정 마감 달력 088 + now() 기준)를 같은 규칙으로 기대값을 계산하게 고침(기능 변경 없음).
- `.responsive/live/e2e-push.mjs`: D-227 진동 값(500,200,500,200,500)으로 기대값 갱신.

## 검증
- tsc · `npm run test`(313) · db:migrate·db:types·`npm run test:db`(077 포함) · build 통과
- `.responsive/live/e2e-androidapp.mjs` ALL_OK: `/download` PC QR·휴대폰(넘침 없음) / 준비 전 받기·링크 숨김 / 앱 안(Capacitor 흉내) 홈 화면 안내 없음·알림 켜기 → 토큰 등록(본인·회사·앱 버전) / **진짜 FCM**으로 시험 알림 → 가짜 토큰이라 FCM이 거절 → 서버가 토큰 지움(운영 키 인증·보내기 길 확인) / 알림 누르면 채팅 화면·바깥 주소 무시
- e2e-install · e2e-push ALL_OK, 스크린샷 확인
- 남은 것: APK 빌드(SDK) → 저장소 업로드 → `ANDROID_APK_READY = true` → 실기기 설치·알림 확인
