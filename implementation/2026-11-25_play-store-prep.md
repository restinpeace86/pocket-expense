# 2026-11-25 Play 스토어 등록 준비물 · AAB 빌드 수정 (8-78p)

## 구현 대상
- 사용자 지시(2026-11-25): "등록 준비물 해놔, AAB 빌드 수정도"

## 변경 사항
- Gradle wrapper 8.14.3 → 9.1.0: Android Studio 내장 JDK가 25로 바뀌어 8.14에서 빌드 스크립트 컴파일 실패(class file major 69). JDK 21 내려받기는 권한에서 막혀 Gradle을 Java 25 지원 버전으로 올림. AGP 8.13.0 그대로
- mobile/package.json `aab` 스크립트(cap sync + bundleRelease)
- mobile/store/play/: README(Play Console 입력값 순서대로 — 조직 계정 영문 정보, 스토어 설명, 카테고리, 앱 액세스 안내, 콘텐츠 등급, 타겟층, 금융 기능, 데이터 보안 = 처리방침 2번·6번 기준), icon-512.png(/icons/512), feature-graphic-1024x500.png, screenshot-1~5.png(1080x1920)

## 검증
- bundleRelease 성공: kr.damounlab.app, versionCode 8, versionName 1.0.7, targetSdk 36, jarsigner verified(업로드 키)
- 스크린샷: smoke 시험 회사(모아상사)에 예시 결의서 4건 → 안드로이드 앱 UA로 실제 화면(결제 숨김 상태) → 꾸밈. 끝나고 정리, leftovers 확인
- 웹 코드 변경 없음(tsc·test·build 대상 아님)

## 특이 사항
- 근태 화면 스크린샷은 기능 켜기 절차가 길어 이번엔 뺌(필요하면 추가)
- 심사용 계정 비밀번호는 문서에 적지 않음 — 사용자가 Play Console에 직접 입력. 2단계 인증이 켜져 있으면 심사자 로그인 불가
