# 근태 ⑦ 휴가 신청 · 취소 (D-241)

- 구현 일시: 2026-11-08
- Spec: `spec/features/attendance.md` §8 (승인) · 시안 캔버스 ⑦ 줄

## 변경 사항
- DB(migration 130_attendance_vacations.sql)
  - 휴가 종류 `attendance_leave_types`: 기본 9가지(연차·경조사·병가·공가·생리휴가·출산전후·배우자 출산·난임치료·가족돌봄) + 회사 추가(최대 40). 연차는 바꿀 수 없음(항상 켜짐·차감·증빙 없음). 기본 종류 증빙은 고정(연차·생리휴가 받지 않음, 나머지 필수). 5인 미만 회사는 생리휴가를 꺼진 채로 만듦. 바꾸면 이력(leave_type)
  - 휴가 `attendance_leaves`: 종류·차감·증빙 규칙을 신청 때 고정 저장, 근무일 수·차감량·연차 기간, 상태(대기·승인·반려·취소) + 취소 신청(대기·승인·반려). 내용은 바꾸거나 지울 수 없음(트리거)
  - 증빙 `attendance_leave_files` + 비공개 버킷 `leave-proofs`(본인 폴더·자기 휴가만 올림, 본인·관리자 열람, 대기 중만 본인 삭제), 민감정보 동의 시각, 휴가 끝난 날 + 3년 `delete_after`
  - 함수: 종류 목록·저장, 연차 부족(막기/당겨쓰기) 저장, 신청(이번 달부터·근무일·겹침·시간 단위·연차 기간·잔여), 증빙 등록(동의 필수·최대 5개)/빼기, 취소(대기는 바로, 승인은 취소 신청), 승인·반려(증빙 필수면 첨부 전 승인 불가, 막기면 승인 때 잔여 다시 확인, 반려 사유 필수), 관리자 목록, 직원 `my_vacation`, 캘린더 `calendar_leaves_range`(다른 직원은 "휴가"만), `my_attendance_month`(승인 휴가), `attendance_pending_count`(휴가 포함), 새벽 정리 `leave_files_due`/`mark_purged`
  - 승인자·알림은 정정 신청과 같음(직원 → 관리자·대표, 관리자 → 대표, 대표 → 본인 승인 — 증빙 필수면 첨부 뒤), 새 신청·증빙 도착·취소 신청은 건마다 승인자 [알림]방, 결과는 신청자 [알림]방
- 계산 `src/lib/attendance/vacation.ts`: 근무일 세기(주말·공휴일 제외), 미리 보기(차감·잔여·막기/당겨쓰기·이번 달·연차 기간), 표시
- 화면: 직원 홈 [휴가] 칸, `/employee/vacation`(남은 연차·내역·상세), `/employee/vacation/new`(종류·단위·날짜·시간·미리 보기·사유 선택·증빙·민감정보 동의), 사진 증빙은 브라우저에서 긴 변 2000px JPEG로 줄여 저장(위치정보 지움, `src/lib/attendance/proof-image.ts`), 관리자 [휴가 종류](연차 부족·켜기/끄기 — 법정 휴가 끌 때 "앱에서 신청만 못 할 뿐 법상 의무는 그대로" 확인 창·추가/수정), 근태 설정 위 카드, [근태 승인]에 휴가·휴가 취소(남은 연차 미리 보기·증빙 열기), 캘린더 휴가 칩, 월 근태 휴가 표시(기록 없음에서 뺌)
- 새벽 03:00 작업에 3년 지난 증빙 지우기 추가
- 안내 그림: `public/guide/attendance/vacation-form.png`, `vacation-proof.png`

## 검증
- tsc / npm run test 66파일 366개 / DB test 082_attendance_vacations(+078~081) / build
- E2E: e2e-vacation(신규) ALL_OK, e2e-attendance·e2e-leave·e2e-hub ALL_OK, leftovers []
- 스크린숏: form-390, proof-390, list-390, approve-1280, types-off-1280, types-1280, types-390, month-390

## 특이 사항
- 증빙은 건강·가족 정보(민감정보) — 개인정보처리방침·동의 문구 반영 필요(8-93)
- 법정 휴가 일수·유급 범위는 앱에 고정하지 않음(개정 잦음 → 1350 안내)
- 육아휴직 등 휴직은 범위 밖
