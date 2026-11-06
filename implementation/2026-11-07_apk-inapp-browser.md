# 앱 안 브라우저에서 설치 앱 받기 (D-231)

- 구현 일시: 2026-11-07
- 구현 대상: 사용자 실기기 — 카카오톡에서 [앱 받기] → "파일 관리자에서 다운로드한 앱을 직접 설치해 주세요"로 끝남

## 원인
- 카카오톡 앱 안 브라우저는 받은 APK로 설치 화면을 열지 못한다. 설치 파일 응답은 정상(`application/vnd.android.package-archive`, 4.3MB).

## 변경 사항
- `src/lib/app-download.ts`: `inAppBrowser(ua)`(안드로이드 카카오톡 / 그 밖 앱 안 브라우저), `openOutsideUrl(url, kind)`(카카오톡 `kakaotalk://web/openExternal?url=`, 그 밖 크롬 intent + 실패 시 원래 주소). 테스트 `app-download.test.ts`.
- `src/app/download/apk-button.tsx`(새): 앱 안 브라우저면 [크롬에서 앱 받기] + 안내, 아니면 기존 바로 받기.
- `src/app/download/page.tsx`: 버튼 교체, 1단계 설명을 "받기 끝나면 [열기]"로.

## 특이 사항
- 안드로이드는 보안상 웹에서 사람이 누르지 않고 설치까지 가는 방법이 없다: 받기 → [열기] → [설치](처음 한 번 출처 허용).

## 검증
- tsc · `npm run test`(60 파일 318개) · build 통과
- e2e-apk-inapp(360px): 카카오톡 → 기본 브라우저로 받기 주소·안내, 크롬 → 바로 받기, 가로 넘침 없음. 스크린샷 확인.
