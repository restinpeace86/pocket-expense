# 개선사항 3 — 직원 [내 정보] 화면 색상

- 구현 대상: `implementation/todo_improvement.md` [개선사항 3]
- 구현 일시: 2026-10-21

## 변경 사항
- `theme-switcher.tsx`: `ThemeOptionsCard`(내 정보용 카드, 7색 라디오 — 누르는 즉시 적용 + `saveUiThemeAction`으로 `members.ui_theme` 저장, 저장 버튼 없음), `ThemeSync`(화면 없이 계정 색 맞추기만).
- `workspace-header.tsx`: 직원 모드에서는 색상 버튼을 빼고 `ThemeSync`만 둔다(다시 접속하거나 다른 기기에서도 계정 색 적용). **관리자 모드는 그대로**(PC 헤더 [색상], 모바일 햄버거 메뉴 안).
- `profile-form.tsx`: 프로필 [저장] 아래, 로그인 계정 위에 [화면 색상] 카드. 긴 이메일일 때 [로그아웃]이 두 줄로 꺾이던 것 `whitespace-nowrap`.
- 스펙: `employee-mobile.md` ⑤, `ui-rules.md` 화면 색상 선택.
- DB 변경 없음(기존 `members.ui_theme`, `saveUiThemeAction` 재사용).

## 검증
- 로그인 E2E(임시 회사, 삭제 확인): 직원 헤더 색상 버튼 0개 / [D · 와인] 누름 → 화면 적용 0.07초(화면 체감), 계정 저장 0.49초 안 / **새 브라우저**(이 기기 저장값 없음)로 접속해도 와인 / 관리자 모드 헤더 색상 버튼 1개(유지), 관리자의 직원 모드 헤더 0개.
- check:responsive 전 화면 4폭 넘침 없음(내 정보 360·PC 스크린샷 확인). tsc / test(83) / lint / build 통과.
