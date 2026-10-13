# [Spec] 사내 양식 설정 화면 (기본 양식 + AI 맞춤 양식)

라우트: `/workspace/[id]/admin/form-template` / 기능 규칙 원본: `spec/features/form-template.md`

## 1. 이원화 원칙
- **기본 양식**: 가입 직후 별도 설정 없이 쓰는 표준 지출결의서. 회사가 양식을 등록하지 않아도 모든 기능(청구·결재·월말 출력)이 동작한다.
- **AI 맞춤 양식**: 회사가 평소 쓰던 양식이 있으면 등록해서 쓴다(선택).

## 2. 기본 양식 (활성 양식이 없을 때 적용)
표준 항목만으로 구성되며 `form-template.md` §4의 바인딩 키를 쓴다.
| 순서 | 항목 | 바인딩 |
|---|---|---|
| 1 | 사용 일자 | `expense.expense_date` |
| 2 | 사용처(가맹점명) | `expense.merchant_name` |
| 3 | 합계금액 / 공급가액 / 부가세 | `expense.amount` / `expense.supply_amount` / `expense.vat_amount` |
| 4 | 지출 카테고리 | `expense.category` (+ 출장 세부유형 `expense.trip_type`) |
| 5 | 결제수단 | `expense.payment_method` |
| 6 | 적요(지출 목적) | `expense.purpose` |
| 7 | 청구자 / 부서 | `member.name` / `member.department` |
| 8 | 회사 지원금 / 개인 부담금 | `expense.company_supported_amount` / `expense.personal_burden_amount` |
- 영수증 이미지와 결재란은 렌더러가 자동으로 붙인다(`form-template.md` §5).
- 카테고리별 항목(인원수, 참석자, 출발지·도착지·주행거리 등)은 해당 카테고리 경비에만 표시한다.

## 3. AI 맞춤 양식 화면 구성
- 상단 상태: "현재 사용 중: 기본 양식" 또는 "현재 사용 중: 맞춤 양식 v3" + [기본 양식으로 되돌리기](활성 양식 해제).
- [우리 회사 양식 등록하기] → 업로드(이미지 jpg/png 또는 PDF, 최대 10MB. 엑셀·워드 양식은 PDF로 저장해서 올리도록 안내) → [AI로 분석하기].
- 3단 레이아웃: 좌 원본 양식 이미지 / 중 필드 편집기(블록형) / 우 미리보기(직원 입력 폼 · 지출결의서 문서 탭).
- 하단 [적용하기] → 새 버전으로 활성화.
- 분석·편집·버전 규칙은 `form-template.md` §2~§6.
