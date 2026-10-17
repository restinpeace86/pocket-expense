# T3-12 화면 색상 선택 (A·B·C)

- 구현 일시: 2026-10-17
- 기준: D-066, `spec/common/ui-rules.md` §3 (사용자 결정)

## 변경 사항
- 색 토큰화 `src/app/globals.css`: `brand-50~900`(포인트), `sidebar`·`sidebar-fg`·`sidebar-muted`·`sidebar-hover`·`sidebar-active`·`sidebar-active-fg`·`sidebar-border`·`page`. 기본값 = A(딥 네이비+인디고). `[data-theme="light"|"emerald"]`로 B·C
- 관리자·공용 화면의 `blue-*` → `brand-*` (랜딩·약관·로그인 버튼은 대상 아님)
- 관리자 사이드바: 토큰 색 + "P" 로고 마크
- `src/components/workspace/theme-switcher.tsx`: 헤더 [색상] 메뉴(로그아웃 왼쪽), 모바일 관리자 메뉴용 `ThemeOptionsInline`. localStorage `pe-theme`
- `src/app/layout.tsx`: 저장된 색상을 첫 화면 전에 `<html data-theme>`로 적용하는 인라인 스크립트(깜빡임 방지), `suppressHydrationWarning`
- 미리보기 `/dev/preview/...?theme=navy|light|emerald`, 선택 메뉴 표시용 `previewPath`
- 비교 페이지(아티팩트): https://claude.ai/artifact/HeLKPBsipi4wLe36M6WYUE

## 검증
- tsc·test 22·lint·build 통과, 반응형 전 화면 4폭 가로 넘침 없음
- 브라우저 동작 확인: [색상] → C 선택 시 사이드바 색 변경(rgb(15,23,42) → rgb(28,31,36)), 새로고침 후 유지, 콘솔 오류 없음. 모바일 메뉴에서 B 선택 → 새로고침 후 유지
- 360px 헤더에 [색상]을 두면 회사명이 "포…"로 줄어 → 모바일 관리자는 메뉴 안으로 옮김(640px 이상은 헤더)

## 특이 사항
- 저장은 브라우저별(다른 기기에서는 기본 A). 기기 간 동기화가 필요하면 멤버별 저장으로 바꾼다

## 추가 (2026-10-17): 계정 저장 + 팔레트 7종 + 성능 (D-067)
- 사용자 결정: 계속 두는 개인화 기능, 계정에 저장, 팔레트 10개 이내(5~7개 희망), 대비 기준을 정해 놓고 선택
- DB `018_member_ui_theme.sql`: `members.ui_theme`(영문 소문자 2~20자 check), 본인 컬럼 수정 권한, `my_membership`에 `ui_theme` 포함
- 테스트 `008_member_ui_theme.sql`: 본인 저장 1건, 같은 회사 대표·다른 회사 행 0건, 잘못된 값 거부, 본인 역할 변경 불가, my_membership 반영. 변이(본인 행 제한 해제) → FAIL로 잡음
- 화면: `src/lib/theme.ts`(팔레트 목록), `saveUiThemeAction`, 헤더/모바일 메뉴 선택 시 계정 저장, 계정 값과 브라우저 값이 다르면 계정 값으로 맞춤(계정 값 없고 브라우저에 있으면 계정에 올림)
- 팔레트 7종: A 딥 네이비, B 화이트, C 차콜·에메랄드, D 와인, E 웜 오렌지, F 딥 오션, G 바이올렛. 대비 계산으로 B(흐린 글자 2.4)·C(버튼 3.8)·E·G(흐린 글자) 미달 발견 → 색 조정 후 7종 모두 통과
- 성능 측정: 팔레트 CSS 3,525B(압축 764B), 색 전환 계산 PC median 0.9ms(p95 2.1ms), CPU 6배 느리게 median 5.3ms(p95 14.4ms)
- 발견·수정: 미리보기에서 클라이언트 파일의 상수를 서버에서 써서 `?theme=` 페이지가 서버 오류 → 공용 목록(lib/theme)으로 교체. 반응형 점검이 오류 화면을 통과시키던 구멍 → 오류 화면·스크립트 오류를 FAIL로 처리, `?theme=wine` 경로를 기본 점검에 추가
- 비교 페이지 갱신(7종): https://claude.ai/artifact/HeLKPBsipi4wLe36M6WYUE
