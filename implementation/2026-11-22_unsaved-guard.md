# 저장 방식 안내(U-2) · 홈 정책 안내 하나로(U-6) — D-301 / todo 9-44b

- 구현 일시: 2026-11-22
- 구현 대상: 설정 화면 저장 안 한 변경 경고, 바로 저장 화면 "저장했어요" 알림, 관리자 홈 중복 안내 정리

## 변경 사항
- `src/lib/ui/unsaved-store.ts`: 저장 안 한 영역 목록(form 또는 [저장] 버튼 묶음)
- `src/lib/ui/saved-event.ts`: `showSaved()` 이벤트
- `src/components/admin/unsaved-guard.tsx`: 입력 감시 · 아래 줄 · 링크 이동 확인 창 · beforeunload · "저장했어요" 알림. `admin-shell.tsx` main 끝에 붙임
- 바로 저장 화면 성공 때 `showSaved()`: corporate-cards-view · vehicles-view · meeting-rooms-view · departments-view · calendar-switch · alimtalk-switch · attendance-admin(AttendanceSwitch)
- `setup-wizard-bar.tsx`: 자체 감시를 없애고 같은 목록(hasUnsaved) 사용
- `company-location-card.tsx`: `data-unsaved-ignore`
- `admin-home-view.tsx`: 정책 카드 삭제, 체크리스트 항목 안 요약. `dashboard.ts` 정책 항목 링크 /settings → /settings/meal

## 특이 사항
- 이동 확인은 화면 안 링크(탭·왼쪽 메뉴·머리글)만. 브라우저 [뒤로]는 막지 않음
- 저장 버튼을 눌렀는데 서버에서 실패해도 줄은 사라짐(화면의 오류 문구로 안내)
- 검증: tsc · vitest 511 · build · 로컬/운영 E2E(`.responsive/live/e2e-unsaved.mjs`, `e2e-setup-wizard.mjs`, 1280·390) · leftovers []
