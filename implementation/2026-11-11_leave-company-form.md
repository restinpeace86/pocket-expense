# 휴가신청서를 회사 양식으로 (8-104 C) — 2026-11-11

- 근거: spec/features/company-forms.md §C, D-249(승인), D-253(세부)
- 구현 대상: 회사가 등록한 휴가신청서 양식으로 직원이 추가 항목을 넣어 신청하고, 그 모양 그대로 PDF·엑셀을 받기

## 변경 사항
- migration 147: `attendance_leaves.form_id`(쓴 양식 버전, 회사 복합 FK)·`custom_payload`(jsonb), 기록 잠금에 두 칸 추가, `private.form_custom_clean`(직원 입력 칸만 받고 필수·글 200/긴 글 1000·숫자·날짜·선택지·직원 고르기(같은 회사 승인된 멤버 → 이름) 확인, 다른 키는 버림), `attendance_leave_create`가 active 휴가 양식이 있으면 값 확인 후 저장
- migration 148: `remaining_days`(신청할 때 남은 연차, 연차 차감 종류만)
- `lib/company-forms/fill.ts`: 칸 바인딩대로 채우기(우리 데이터·직원 입력·고정 값·비워 두기), 결재란·기간·일수·반차·남은 연차·증빙·문서 번호
- `lib/company-forms/leave-doc.ts`: 볼 수 있는 휴가인지 RLS(본인·관리자)로 확인 → 그때 양식 버전(지운 양식도)·사람 정보는 서버 키로 같은 회사 안에서만 → 채운 표
- `lib/company-forms/leave-inputs.ts` + `components/attendance/leave-custom-fields.tsx`: 신청 화면 [회사 추가 항목](양식 위→아래, 지난 값 미리 채움, 필수 비면 막힘), 오류 문구 CUSTOM_REQUIRED·CUSTOM_INVALID
- `components/company-forms/leave-doc-buttons.tsx`: [휴가신청서 PDF](브라우저에서 만듦)·[엑셀](`/workspace/{id}/leave-doc/{leave}/xlsx`) — 직원 휴가 상세, 관리자 근태 승인 목록(대기·처리 끝)
- DB 테스트 091(양식 없음 그대로·필수·다른 회사 직원·선택지·끼워넣은 키 버림·이름 저장·남은 연차·잠금·승인)

## 검증
- tsc, test(426 — 채우기 2), test:db(091), build 통과
- E2E `e2e-leave-form.mjs` ALL_OK: 양식 없으면 추가 항목 없음 → 양식 등록 뒤 3칸(양식 순서)·필수 비면 막힘·신청 → payload(대행자 이름)·양식 버전·남은 연차 4일, 지난 값 미리 채움, 직원 상세 PDF(파일명 휴가신청서_이름_날짜) · 엑셀(이름·직급·대행자·연락처·구분·결재 전), 양식 없이 낸 휴가 엑셀 404, 관리자 목록 버튼, 승인 뒤 엑셀 결재란 승인자. leftovers []
- 화면: 신청 390, 상세 390, 관리자 1440, PDF 1쪽(pdf.js로 그려 확인 — 양식 모양·결재란 "최직원/대리/11.11"·"결재 전")

## 특이 사항
- 휴가 승인은 한 단계라 결재란은 신청자·승인자 두 칸만 채움(D-253)
