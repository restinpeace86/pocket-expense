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

## 2차 — APK 빌드·배포 (2026-11-06)
- 빌드: Android Studio에 든 Java 25는 Gradle 8.14가 못 읽어서(class file major version 69) 빌드용 Temurin JDK 21을 `%LOCALAPPDATA%\pe-tools\jdk21`에 둠(압축만, 시스템 설정 변경 없음). `mobile/android/local.properties`(저장소 제외)에 SDK 경로.
  ```
  cd mobile && npx cap sync android
  cd android && JAVA_HOME=%LOCALAPPDATA%\pe-tools\jdk21 gradlew.bat assembleRelease --no-daemon --max-workers=1 -Dorg.gradle.jvmargs=-Xmx1024m
  ```
  (PC 메모리가 빠듯해 일꾼 1개·힙 1GB로)
- 확인: apksigner 서명 = CN=Damounlab, 패키지 `kr.damounlab.app` 1.0.0(versionCode 1), target 36, POST_NOTIFICATIONS·VIBRATE, Firebase 설정(google_app_id) 포함. 4.1MB.
- 올리기: `node scripts/upload-android-apk.mjs` → `app-downloads/android/workon.apk`(공개 200, APK 형식). `ANDROID_APK_READY = true`로 받기 버튼·안내 링크 켬.
- 새 버전: `mobile/android/app/build.gradle` versionCode +1·versionName, `src/lib/app-download.ts` ANDROID_APP_VERSION 같게 → 빌드 → 올리기. 같은 서명 키여야 덮어 설치된다.
- 검증: e2e-androidapp(받기 주소 실제 200·APK 형식, 링크 켜짐) · e2e-invite-share · e2e-install ALL_OK.
- 참고: 로컬 `.env.local`의 FCM 키가 다시 여러 줄로 돌아가 있어 한 줄로 다시 정리(운영 Vercel 값과 무관).

