# 근태 정정·휴일근무 신청서를 회사 양식으로 (9-33c, D-279·D-280)

- 구현 일시: 2026-11-14
- Spec: `spec/features/company-forms.md` §G-1 · 시안 https://claude.ai/artifact/ASW9QozQCgmuMDvXnfgXJU (1단계)

## 변경 사항
- DB(migration 160, 운영 적용 승인): `company_forms.kind` + correction·holiday(회사에 종류마다 하나, unique index), `attendance_requests.form_id·custom_payload`(신청 뒤 못 바꿈 — guard), `attendance_request_create(…, p_custom)`(양식이 있으면 `form_custom_clean`으로 직원 입력 칸만), 화면 JSON에 form_id, 등록 함수(read_begin·publish)가 근태 양식 3종을 같은 규칙(종류마다 하나·직원 입력 5칸)으로
- 칸 모델(`model.ts`): FormKind correction·holiday, CORRECTION_DATA·HOLIDAY_DATA, isAttendanceKind
- 채우기(`fill.ts`): 정정 날짜·변경 전/후·사유·머문 시간 / 근무 날짜·시간대·합계·한 일, 문서 번호 정정-·휴일-
- 받기: `request-doc.ts`(RLS로 본인·관리자 확인 → 서버 키로 같은 회사 양식 버전), PDF 액션, 엑셀 `/workspace/[id]/request-doc/[requestId]/xlsx`, `FormDocButtons`(휴가와 공용)
- 화면: 정정·휴일 근무 시트 아래 [회사 추가 항목](필수 확인·지난 값), 직원 그날 상세(승인 대기·바뀐 기록)·관리자 근태 승인 줄에 [… 신청서 PDF]·[엑셀], 등록 창 종류에 근태 정정·휴일·연장근무(이미 있으면 새 버전 안내), 목록 '등록됨', AI 프롬프트에 칸 키 안내
- 테스트: DB 097(양식 없음 그대로·종류 확인·종류마다 하나·필수/다른 회사 직원 막힘·이름 저장·잠금·JSON form_id·승인·격리), 단위 fill +2, E2E `e2e-request-forms`(등록 창 → 정정 [회사 추가 항목] → PDF → 관리자 받기·승인 → 엑셀 값·결재란 → 휴일 근무 → 다른 직원 404 · 넘침)
- 기존 테스트: e2e-scenario-workday의 '퇴근 안 찍음' 알림 확인을 카드 순서와 무관하게(저녁 7시 이후 실행 시 앞 단계에서 먼저 보냄)

## 확인
- tsc · test 82/467 · lint · build, DB 097 운영 통과, 로컬 E2E(request-forms·attendance·vacation·leave-form·scenario-workday·forms) 통과, 휴대폰 시트·관리자 줄 스크린샷 확인, leftovers []

## 다음
- 9-33d 2단계: 양식 종류 + 종류별 표준 칸, 등록 때 AI 짝짓기·관리자 확인
