# 관리자 설정 8개 메뉴 (todo_improvement 개선사항 1) — 2026-11-11

- 근거: D-251(제안서 승인), spec/screens/admin-settings.md §4
- 구현 대상: 15개로 흩어진 설정 메뉴를 7개 그룹 + 요금제로, 그룹 안 하위 영역은 탭

## 변경 사항
- `src/lib/admin/settings-groups.ts`: 그룹·탭 목록, `findSettingsTab`(가장 길게 맞는 탭), `visibleGroups`(근태 꺼지면 근태 정책 숨김)
- `admin-shell.tsx`: 설정 하위 = 그룹 8개(요금제는 구분선 아래), 맨 아래 [이 기기 알림](나만). `settings-tabs.tsx`: 화면 위 "설정 · 그룹" + 탭(휴대폰은 옆으로 밀림)
- 지출 한도·정책 한 화면 → 회사정보 `/settings` · 회사 위치 `/settings/location` · 식대 `/settings/meal` · 유류비 `/settings/fuel` · 일비 `/settings/per-diem` · 마감 `/settings/closing`. `CompanySettingsForm`에 `show`(보이는 영역) — 저장은 늘 전체 값(안 보이는 회사명·사업자번호는 hidden)
- 근태 설정 → 근무 기준 `/attendance-settings` · 출근 단말 `/terminals` · 변경 이력 `/history`(+ 기존 직원별 연차·휴가 종류). 근태 켜기는 `/features`로, "← 근태 설정" 뒤로 가기 링크 뺌
- 캘린더·회의실 → 회의실만(`/calendar-settings`), 캘린더 스위치는 `/features`
- `/admin/device-alerts`: 이 기기 알림 + PC 시각 알림(채팅 켠 회사). 채팅의 관리자 [내 정보] 링크도 여기로
- `help.tsx`: 처음 한 번 펼치던 것 없앰, [ⓘ 설명 보기] 알약 버튼
- 요금제: 저장 용량 추가 요금 카드(준비 중, D-248 요금)
- 안내 글 속 메뉴 경로 갱신(설정 › 회사 자산 › 회사차량 등), 관리자 홈 "정산 정책 확인" → 식대 탭
- migration 141: 캘린더 기본 켜짐(`private.feature_enabled` 줄 없으면 messenger·calendar 켜짐). DB 테스트 066·067·068은 꺼 둔 줄로 시작하게 고침

## 검증
- tsc, test(417), test:db, build 통과
- E2E `e2e-settings.mjs` ALL_OK(메뉴 7→8, 탭, 설명 접힘, 식대만 저장해도 다른 값 그대로, 캘린더 기본 켜짐, 근태 켜기 → 근태 정책, 회의실, 이 기기 알림, 용량 카드, 휴대폰 가로 넘침 없음), leftovers []
- 화면: 경비 정책 1440·390, 기능 사용 1440, 서랍 390 확인

## 특이 사항
- 설정 묶음은 설정 화면이 아닐 때 접혀 있음(기존과 같음)
- 기존 회사도 캘린더 줄이 없으면 이번부터 켜짐(사용자 결정)
