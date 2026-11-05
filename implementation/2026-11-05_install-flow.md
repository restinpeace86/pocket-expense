# 홈 화면에 추가 → 알림 켜기 (D-219) — 2026-11-05

- 대상: 사용자 지시 "설치 대신 바로가기를 우리 쪽에서 바탕화면에 넣어 주는 흐름"
- 한계: 브라우저가 사이트의 몰래 아이콘 만들기를 막는다 → 버튼 한 번 + 휴대폰 [추가] 한 번이 가장 짧은 흐름(안드로이드). 아이폰은 API가 없어 메뉴 안내.

## 변경
- `layout.tsx` INSTALL_BOOT: `beforeinstallprompt`·`appinstalled`를 처음에 잡아 `window.__peInstall`
- `src/components/push/install.ts`(새): `useInstallPrompt()` — standalone / prompt / ios / android-manual / desktop
- `push-auto-prompt.tsx`: 휴대폰 탭이면 두 단계(홈 화면에 추가 → 알림 켜기), 앱·PC는 알림만. 서비스 워커를 미리 등록
- `push-toggle.tsx`: [홈 화면에 추가] 버튼, ⓘ 안내 정정(안드로이드도 홈 화면 아이콘 권장, 크롬 앱 알림 허용·배터리)

## 확인
- tsc, 단위, build, `e2e-install`(안드로이드 신호 → 버튼 → prompt 호출·추가 뒤 문구, 신호 없음 메뉴 안내, 아이폰 안내, 앱으로 열면·PC는 알림만, 390 넘침 없음) ALL_OK, `e2e-chattheme`·`e2e-push`·`e2e-tabbar` 회귀
- 실기기 확인 필요: 실제 안드로이드에서 [홈 화면에 추가] → 휴대폰 추가 창이 뜨는지(크롬은 같은 사이트를 이미 추가했거나 잠깐 사이 여러 번 거절하면 신호를 주지 않음 → 메뉴 안내로 보임)
