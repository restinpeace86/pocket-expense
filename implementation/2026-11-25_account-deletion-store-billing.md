# 2026-11-25 계정 삭제 · 안드로이드 앱 결제 숨김 (D-314)

## 구현 대상
- Play 스토어 등록 준비: 앱 안 결제 숨김, 계정 삭제(spec/features/account-deletion.md)

## 변경 사항
- DB 174_account_deletion.sql (운영 적용 승인 2026-11-25): members.account_deleted_at, auth_user_id null 허용(지운 계정만 — 체크 제약), 휴대폰 빈 값(지운 계정만), account_deletion_check()·prepare_account_deletion(), reactivate_member가 지운 계정 막음. 테스트 supabase/tests/108_account_deletion.sql(dry-run 통과)
- 화면: /account/delete(지워지는 것·남는 것·막힘 안내·체크+확인·완료), 들어가는 링크(내 정보·세무사무소·시작하기·승인 대기), 멤버 상세 '계정 삭제(퇴사)'·다시 활성화 숨김, 목록 휴대폰 자리 '계정 삭제'
- 서버: deleteMyAccountAction — DB 정리 → auth 사용자 삭제(service role) → 이 기기 로그아웃
- 앱 결제 숨김: layout STORE_BOOT(UA `DamoOnApp/android`·Capacitor 다리 → html[data-store=android]), globals.css 규칙, data-store-hide 6곳, 요금제 화면 앱 안내(data-store-only)
- 설치 앱: capacitor.config android.appendUserAgent, 1.0.7(versionCode 8), cap sync
- 약관·처리방침 계정 삭제 문구, robots /account/ 막음, 사이트맵 날짜 2026-11-25

## 검증
- tsc 통과, vitest 93 파일 525 테스트 통과, build 통과
- 로컬 E2E(.responsive/live/e2e-account-delete.mjs) ALL_OK 22항목: 비로그인→로그인, 최고 관리자 막힘, 직원 삭제(내 정보 링크→확인→완료→다시 들어가면 로그인), DB 정리·auth 삭제, 관리자 화면 표시, 앱 UA 결제 숨김/웹 그대로, 390 넘침 없음. 메뉴 숨김 1280 별도 확인(check-store-menu.mjs)
- 스크린샷: account_delete_390, account_delete_blocked_390, account_deleted_390, billing_android_app_390

## 특이 사항
- 올린 파일의 storage owner 연결은 함수에서 끊지만, 실제 파일이 있는 계정으로 auth 삭제까지는 E2E에서 따로 확인하지 않음(dry-run에서 auth 삭제가 막히지 않음은 확인)
- 앱 결제 숨김은 표시만 숨김(서버 결제 동작은 그대로) — 앱에서 결제로 가는 길이 없게 하는 목적
