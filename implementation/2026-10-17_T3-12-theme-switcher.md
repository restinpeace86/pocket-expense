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
