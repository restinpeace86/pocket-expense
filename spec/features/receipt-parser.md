# [Spec] Vision LLM 영수증 파싱

관련: D-006, D-017, D-034 / 데이터: `expense_items` (receipt_path, parse_status, ai_parsed_payload, merchant_name, amount, supply_amount, vat_amount, expense_date, category) / 여러 장 동시 처리: `spec/features/expense-claim-flow.md` Step 2

## 1. 개요
직원이 촬영·업로드한 영수증 이미지를 Storage에 원본 저장하고, Gemini Vision으로 핵심 거래 정보를 추출해 입력 폼에 자동으로 채운다. 추출 결과는 초안이며 직원이 확인·수정한다.

## 2. 처리 흐름
1. 직원이 영수증 선택(카메라/갤러리/PDF).
2. 클라이언트에서 이미지 긴 변 2000px 이하로 리사이즈하고 320px 썸네일(WebP)도 함께 만들어 업로드(`spec/common/performance.md` §1, D-073) → `receipts` 버킷에 원본 저장(`spec/data/schema.md` §4). 영수증마다 소명서 안에 항목 1건을 먼저 생성하고 `parse_status='parsing'`으로 둔다.
3. 서버 액션이 Gemini Vision 호출 (`GEMINI_API_KEY`, 서버 전용). 보관본(2000px)을 그대로 보낸다(썸네일 사용 금지). 실패·시간 초과는 자동 1회 재시도(D-073).
4. 결과를 `ai_parsed_payload`에 원본 그대로 저장하고 `parse_status` 갱신.
5. 추출값을 폼의 **빈 필드에만** 채운다(직원이 이미 입력한 값은 덮어쓰지 않음).

## 3. 추출 필드
| 필드 | 형식 | 비고 |
|---|---|---|
| `merchant_name` | string | 가맹점(상호)명 |
| `merchant_business_number` | string(숫자 10자리) / null | 가맹점 사업자등록번호. 형식 검증(10자리) 실패 시 null (D-050) |
| `card_last4` | string(숫자 4자리) / null | 마스킹된 카드번호의 **끝 4자리만** 추출. 법인카드 자동 판별용 (D-055, `corporate-cards.md` §3) |
| `suggested_evidence_type` | `evidence_type` 값 / null | 증빙구분 추정(D-051): "신용승인·카드번호 마스킹" → 카드매출전표, "현금영수증·지출증빙/소득공제" → 현금영수증, "세금계산서·공급받는자" → 세금계산서, 사업자 정보 없는 수기 영수증 → 간이영수증. 확신이 낮으면 null |
| `amount` | integer | 총 결제금액(합계) |
| `supply_amount` | integer \| null | 공급가액. 표기 없으면 null |
| `vat_amount` | integer \| null | 부가세. 표기 없으면 null (계산으로 추정하지 않음) |
| `expense_date` | `YYYY-MM-DD` | 결제일자 |
| `suggested_category` | `meal` / `trip` / `meeting` / null | 카테고리 추천(D-032). 카테고리가 비어 있을 때만 기본값으로 채우고 "AI 추천" 표시. 판단이 어려우면 null |
| `suggested_trip_type` | `trip_type` 값 / null | 출장비일 때 세부 유형 추천. 예: 식당 → `meal`, 톨게이트·하이패스·주차장 → `toll_parking`, 승차권·항공권 → `public_transport`, 택시 → `taxi`, 호텔·숙박 → `lodging` |

- **출장 소명서**(`is_business_trip`)에 올린 영수증은 카테고리를 `trip`으로 고정해 추천하고 `suggested_trip_type`만 판단한다. 일반 소명서에서는 식당 영수증을 일반 식대(`meal`)로 추천한다(D-035). 파싱 요청에 소명서의 출장 여부를 함께 넘긴다.

- 응답은 JSON 스키마로 강제(Structured Output)하고, 서버에서 형식·범위를 검증한다(금액 음수 불가, 날짜는 오늘 이후 불가).
- 범위 밖(오버엔지니어링 금지): 카드번호 전체(끝 4자리 외), 승인번호, 품목별 내역.
- 증빙구분·사업자등록번호는 AI가 채우고 직원은 확인만 한다. 추정값이 null이면 항목에 "확인 필요"로 표시하고, 증빙구분은 상신 전 직원이 선택해야 한다.
- 현금영수증이 "소득공제용"으로 발행된 경우 "지출증빙용이 아닙니다 — 회사 경비 처리 시 불이익이 있을 수 있어요" 경고를 표시한다.

## 4. UX
- 업로드 직후 "영수증 분석 중..." 스켈레톤을 폼 필드 위치에 표시한다. 목표 응답 1~3초, 타임아웃 15초.
- AI가 채운 필드에는 "AI 입력" 표시를 하고, 직원이 수정하면 표시를 없앤다.
- 영수증 이미지는 폼 상단에 썸네일로 보이고, 눌러서 크게 볼 수 있다(입력값과 대조용).
- 영수증 재업로드 시 기존 파일을 교체하고 다시 파싱한다(빈 필드 규칙 동일).

## 5. 실패 처리
- 파싱 실패·타임아웃·키 미설정: `parse_status='failed'`, "자동 인식에 실패했어요. 직접 입력해 주세요" 안내 후 수동 입력. 영수증 원본은 저장된 상태를 유지한다.
- 업로드 실패: 재시도 버튼 제공. 폼 입력값은 유지한다.
