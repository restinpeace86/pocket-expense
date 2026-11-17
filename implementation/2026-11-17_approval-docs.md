# [결재 문서] 3단계 (9-33e, D-284)

## 9-33e1 [양식 보기] — 2026-11-17
- `src/components/company-forms/form-doc-dialog.tsx`(새): 채운 회사 양식(DocModel)을 표로 그리는 창 — 휴가·근태 신청서와 [결재 문서] 상세가 같이 씀. Esc·닫기, 휴대폰은 아래에서 올라오는 창, 넓은 표는 창 안에서 옆으로
- `leave-doc-buttons.tsx`: [양식 보기] 버튼 추가(관리자 근태·휴가 승인 줄, 직원 그날 상세·휴가 상세 — FormDocButtons를 쓰는 모든 곳). PDF·이미지를 만들지 않고 서버 액션으로 채운 표 데이터(수 KB)만 한 번 받아 그림, 같은 데이터로 PDF도 만듦(다시 안 받음)
- 확인: e2e-request-forms ③-2(직원 390: 사유·추가 항목·결재 전, 넘침 없음, Esc 닫힘)·④(관리자 1280 창), e2e-leave-form, 스크린샷 확인

