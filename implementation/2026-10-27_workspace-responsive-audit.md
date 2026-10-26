# 구현 기록 — 워크스페이스 반응형 품질 점검·보완 (D-126)

- 구현 일시: 2026-10-27
- 근거: 사용자 요청(관리자 워크스페이스는 PC 기반이지만 모바일로도 보기 좋게, 직원 워크스페이스는 모바일 퍼스트인지)

## 점검 방법
- `.responsive/live/e2e-ws-audit.mjs`(새, 로컬): 운영 빌드에 로그인 상태로 직원 8화면(홈·결의서 편집·상세 2·정산 내역·내 정보·결재함·검토) + 관리자 19화면(홈·지출 승인 목록/상세·정산 지급·멤버/상세·세무 마감·설정 전부) × 360·390·768·1280
- 점검 항목: 가로 넘침, 하단 고정 바가 맨 아래 내용 가림, 입력 글자 16px 미만(아이폰 확대), 누르는 영역 44px 미만(휴대폰·태블릿), 11px 미만 글자, 내용 폭

## 결과(고치기 전)
- 가로 넘침·고정 바 가림: 없음
- 직원: 휴대폰 328·358px(꽉), 태블릿·PC 416~736px 가운데 → 모바일 퍼스트 맞음. 관리자 PC 960px
- 고칠 것: 도움말 [ⓘ 왜 필요한가요?] 36px(관리자 거의 모든 화면), 멤버·알림 이력 탭 40px, 정산 지급 체크박스 20px·결의서 줄 20px, 결의서 [펼쳐서 확인하기] 36px·[확인 필요 n장] 20px·[자료가 정말 없어요] 20px, 지출결의서 양식 화면 칸·버튼 36~40px·입력 14px, 결재라인 추가 선택 14px, 태블릿에서 지출 승인 필터·계정과목 선택 14px·40px(`sm:`부터 작아졌음)

## 변경 사항
- `help.tsx` 도움말 열기 44px, `claim-editor.tsx` 펼치기 탭·확인 필요 44px, `item-editor.tsx` 자료가 정말 없어요 44px
- `payouts-view.tsx` 체크박스를 44px 라벨로 감싸고 결의서 줄 44px
- `members-view.tsx`·`notification-list.tsx` 탭 44px, `admin-claim-detail.tsx` 정산 이동 링크 44px
- `claim-filters.tsx`·`claim-items.tsx` 작게 보이는 기준을 `sm:` → `lg:`(태블릿도 손가락 기준)
- `form-template-view.tsx` 칸·화살표·모드 버튼 44px, 입력 글자는 PC(lg)에서만 작게
- `approval-lines-view.tsx` 결재라인 추가 선택 글자 PC에서만 작게
- `globals.css` 안전망: `(pointer: coarse)`에서 입력·선택 글자 16px 미만 금지
- spec `ui-rules.md` §1 보강

## 검증
- 다시 점검: 휴대폰·태블릿 모든 화면 문제 없음. PC 지출결의서 양식 화면의 11px 미만 2곳은 문서 미리보기(결재란 칸 이름, 종이 양식 축소 모양)라 그대로
- 옛 모바일 점검(`e2e-mobile-audit.mjs`)의 '고정 바 가림 73px'(검토 화면·영수증 추가 시트)은 화면으로 확인해 보니 오탐(빈 여백을 셈 / 일부러 연 시트)
- check:responsive 전 화면, 회귀 E2E flow·form-template·company-fields·round4·per-diem·split 통과, tsc·lint·unit 175·build 통과
