# 근태 ⑥ 직원별 연차 일수 (D-240)

- 구현 일시: 2026-11-08
- Spec: `spec/features/attendance.md` §7 (승인) · `spec/features/auth-onboarding.md` §3.2(입사일) · 시안 캔버스 ⑥ 줄

## 변경 사항
- DB
  - migration 128: `members.hire_date`, `attendance_settings.hourly_leave · leave_rounding(day/half/hour, 시간 단위는 시간차 켰을 때만, 버림 없음)`, `attendance_leave_grants`(추천값·확정값·사유·확정자, 강제 RLS: 본인·관리자 읽기), 이력 action에 hire_date·leave_grant 추가
  - 함수: `set_my_hire_date`(본인 한 번, 가입 대기 중에도) · `my_hire_date` · `attendance_member_hire_date_set`(관리자, 사유 필수 + 이력 + 직원 [알림]방·휴대폰) · `attendance_leave_settings_save` · `attendance_leave_confirm`(여러 명, 법 기준보다 적으면 사유 필수 — 막지 않음, 이력) · `attendance_leave_admin(연도)`
  - migration 129: `attendance_leave_admin`·`my_attendance_month` volatile(근태 설정 줄이 없을 때 만들다 생기던 오류)
- 계산(`src/lib/attendance/leave.ts`): 근로기준법 제60조 ①②④ + 회계연도(입사 다음 해 비례 15×재직일수÷365, 올림 방식) / 입사일 기준, 1년 미만 월차(입사일 + n개월), 가산 최대 25일, 대표·5인 미만·입사일 없음·입사 전은 추천 없음, 단계별 계산 근거(조항 표시), 달마다 개근 참고(근무일·출근 기록·기록 없는 날)
- 화면
  - 관리자 설정 > 근태 > [직원별 연차] `/admin/attendance-settings/leave?year=`: 법 안내(처음 한 번 펼침, 조항 표 + 연도 기준·앱이 하지 않는 것 + 예시 그림 2장, 휴대폰은 카드), 우리 회사 연도 기준, 시간차 스위치·소수점(올림 3가지), 직원 목록(입사일·근속·추천·확정·상태), 계산 근거 펼침, [추천값으로 모두 확정], 확정·수정 창(입사일 고치기 사유 필수, 법 기준보다 적음 경고 + 사유 필수)
  - 근태 설정 위 [직원별 연차] 카드, 변경 이력에 입사일·연차·사유 표시
  - 가입 화면 입사일(필수), 직원 홈 "입사일을 넣어 주세요"(근태 켠 회사·입사일 없을 때 한 번)
- 안내 그림: `public/guide/attendance/join-hire.png`, `leave-edit.png`

## 검증
- tsc / npm run test 65파일 359개(leave 9개) / DB test 081_attendance_leave(+078~080) / build
- E2E: e2e-leave(신규) ALL_OK, e2e-attendance ALL_OK, e2e-hub ALL_OK, e2e-invite(입사일 입력 → hire_date 저장 확인), leftovers []
- 스크린숏: leave-1280, leave-390, leave-edit-390, home-hire-390, history-1280, invite_join_390

## 특이 사항
- 입사일이 가입 필수 항목이 되어 개인정보처리방침·가입 동의 문구 반영이 필요(8-93에 추가, 실제 고객 받기 전)
- 멤버 관리 화면의 입사일 표시는 이번 범위 밖(직원별 연차 화면에서 보고 고침)
- Next 화면 전환 뒤 앞 화면이 숨겨진 채 남아 E2E에서 그림 수를 셀 때 보이는 것만 센다
