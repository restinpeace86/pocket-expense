# [Spec] 사내 지출결의서 양식 (AI 분석 · 노코드 보정 · 자동 채움)

관련: D-006, D-019, D-034 / 데이터: `form_templates`, `expense_claims.form_template_id`, `expense_claims.header_custom_payload`, `expense_items.item_custom_payload`

## 1. 개요
회사가 쓰던 지출결의서·지출결의서 양식을 관리자가 사진/PDF로 올리면 Gemini Vision이 필드를 추출해 웹 양식으로 만든다. 관리자는 노코드 편집기로 보정한다.
양식은 **헤더 영역**(청구자, 제목, 프로젝트 코드 등 결의서에 한 번 나오는 항목)과 **항목 표**(영수증 한 장당 한 행으로 반복되는 열)로 나뉜다(D-034). 직원이 영수증을 올리면 파싱값이 항목 표에, 직원 정보가 헤더에 **자동으로 채워지고**, 직원은 남은 회사 고유 항목만 입력해 상신한다. 결재자와 월말 PDF는 이 양식 모양으로 결의서를 본다.

## 2. 흐름 (관리자)
1. `/admin/form-template`에서 양식 이미지/PDF 업로드 → `form-templates` 버킷 저장.
2. Gemini Vision이 양식을 분석 → `ai_extracted_schema` 저장 → 편집기에 초안 표시.
   - 각 입력 칸이 헤더 영역인지 반복 표의 열인지 구분하고(`scope`), 표준 항목(§4 바인딩)에 해당하는지도 추천한다. 예: 표의 "사용일자" 열 → `item.expense_date`, 상단 "성명" → `member.name`.
   - 결재란(담당/팀장/대표 도장 칸)은 필드로 만들지 않는다. 결재란은 결재라인에서 자동 생성된다(§5).
3. 편집기(노션 블록형): 헤더 필드 / 항목 표 열 두 구역. 필드 추가/삭제/순서 변경(드래그), 구역 이동, 라벨 수정, 타입 지정, 필수 여부, 선택지 편집, 바인딩 지정, 적용 카테고리 지정(항목 필드만).
4. 우측 실시간 미리보기: 직원 모바일 입력 폼 / 지출결의서 문서 모양 두 탭.
5. [적용하기] → 새 버전으로 저장하고 `is_active=true`(기존 활성 버전은 false).
- 분석 실패 시: "양식을 분석하지 못했어요. 직접 항목을 추가해 주세요" 안내 후 빈 편집기로 수동 구성.
- 양식을 업로드하지 않고 편집기에서 처음부터 만들 수도 있다.

## 3. 양식 정의(`form_templates.schema`) 형식
```json
{
  "title": "지출결의서",
  "fields": [
    {
      "key": "project_code",          // 영문 snake_case, 양식 내 고유
      "label": "프로젝트 코드",
      "scope": "header",              // header(결의서 1회) | item(항목 표의 열)
      "type": "text",                 // text | textarea | number | date | select
      "required": true,
      "options": null,                // select일 때 문자열 배열
      "binding": null,                // §4 표준 항목 키 또는 null(회사 고유 항목)
      "categories": null,             // item 필드만: 적용 카테고리 배열, null = 전체
      "order": 1
    }
  ]
}
```

## 4. 표준 항목 바인딩 (자동 채움)
바인딩된 필드는 직원이 따로 입력하지 않는다. 값은 표준 데이터에서 가져와 읽기 전용으로 보인다.
| scope | 바인딩 키 | 값 출처 |
|---|---|---|
| header | `member.name`, `member.department`, `member.position`, `member.employee_number` | 청구자 정보 |
| header | `claim.title`, `claim.description`, `claim.submitted_at` | 결의서 제목·지출 사유·상신일 |
| header | `claim.trip_destination`, `claim.trip_period`, `claim.trip_purpose` | 출장지·출장 기간(시작~종료)·출장 목적 (출장 결의서) |
| header | `claim.total_amount`, `claim.total_company_supported`, `claim.total_personal_burden`, `claim.item_count` | 합계 |
| item | `item.expense_date`, `item.merchant_name`, `item.amount`, `item.supply_amount`, `item.vat_amount` | 영수증 파싱/입력값 |
| item | `item.category`, `item.trip_type`, `item.payment_method` | 카테고리·유형·결제수단 표시명 |
| item | `item.purpose`, `item.headcount`, `item.attendees`, `item.client_name` | 카테고리별 입력값 |
| item | `item.company_supported_amount`, `item.personal_burden_amount` | 계산값 |
| item | `item.start_location`, `item.end_location`, `item.distance_km` | 자차 정보 |

- 바인딩 없는 헤더 필드 값은 `header_custom_payload`, 바인딩 없는 항목 필드 값은 각 항목의 `item_custom_payload`에 `{ key: value }`로 저장한다.

## 5. 지출결의서 문서 렌더링
결재 화면, 관리자 결의서 상세, 직원 미리보기, 월말 PDF에서 같은 렌더러를 쓴다.
- 상단: 양식 `title`, 회사명, 결재란(결재라인 스냅샷 단계별 칸: 결재자 이름 / 승인·반려·대기 / 처리일).
- 헤더 영역: 헤더 필드를 순서대로 라벨–값으로 표시.
- 항목 표: 항목 필드를 열로, 영수증 항목을 행으로. 마지막 행에 합계. 항목 카테고리에 적용되지 않는 열은 빈칸.
- 하단: 정산 요약(회사 지원금, 개인 부담금, 지급/납부)과 항목별 영수증 이미지(PDF에서는 다음 페이지들).
- 활성 양식이 없는 회사는 기본 양식으로 렌더링한다. 기본 양식 항목: `spec/screens/template-configuration.md` §2.

## 6. 버전 규칙
- 결의서는 `draft`/`rejected` 상태에서 저장할 때마다 그 시점 활성 양식을 `form_template_id`로 참조한다. 바뀐 양식에 없는 payload 키는 보존하되 화면에 표시하지 않는다.
- `submitted` 이후 결의서는 상신 당시 양식 버전으로 렌더링한다.
- 이전 버전은 삭제하지 않는다.
