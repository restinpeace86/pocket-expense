# [Spec] Vision LLM 영수증 파싱

관련: D-006, D-017 / 데이터: `expenses` (receipt_path, parse_status, ai_parsed_payload, merchant_name, amount, supply_amount, vat_amount, expense_date)

## 1. 개요
직원이 촬영·업로드한 영수증 이미지를 Storage에 원본 저장하고, Gemini Vision으로 핵심 거래 정보를 추출해 입력 폼에 자동으로 채운다. 추출 결과는 초안이며 직원이 확인·수정한다.

## 2. 처리 흐름
1. 직원이 영수증 선택(카메라/갤러리/PDF).
2. 클라이언트에서 이미지 긴 변 2000px 이하로 리사이즈 후 업로드 → `receipts` 버킷에 원본 저장(`spec/data/schema.md` §4). 아직 경비 행이 없으면 `draft` 경비를 먼저 생성한다.
3. 서버 액션이 Gemini Vision 호출 (`GEMINI_API_KEY`, 서버 전용).
4. 결과를 `ai_parsed_payload`에 원본 그대로 저장하고 `parse_status` 갱신.
5. 추출값을 폼의 **빈 필드에만** 채운다(직원이 이미 입력한 값은 덮어쓰지 않음).

## 3. 추출 필드
| 필드 | 형식 | 비고 |
|---|---|---|
| `merchant_name` | string | 가맹점(상호)명 |
| `amount` | integer | 총 결제금액(합계) |
| `supply_amount` | integer \| null | 공급가액. 표기 없으면 null |
| `vat_amount` | integer \| null | 부가세. 표기 없으면 null (계산으로 추정하지 않음) |
| `expense_date` | `YYYY-MM-DD` | 결제일자 |
| `suggested_category` | `meal` / `trip` / `meeting` / null | 카테고리 추천(D-032). 카테고리가 비어 있을 때만 기본값으로 채우고 "AI 추천" 표시. 판단이 어려우면 null |

- 응답은 JSON 스키마로 강제(Structured Output)하고, 서버에서 형식·범위를 검증한다(금액 음수 불가, 날짜는 오늘 이후 불가).
- 범위 밖(오버엔지니어링 금지): 카드번호, 승인번호, 품목별 내역, 가맹점 사업자번호.

## 4. UX
- 업로드 직후 "영수증 분석 중..." 스켈레톤을 폼 필드 위치에 표시한다. 목표 응답 1~3초, 타임아웃 15초.
- AI가 채운 필드에는 "AI 입력" 표시를 하고, 직원이 수정하면 표시를 없앤다.
- 영수증 이미지는 폼 상단에 썸네일로 보이고, 눌러서 크게 볼 수 있다(입력값과 대조용).
- 영수증 재업로드 시 기존 파일을 교체하고 다시 파싱한다(빈 필드 규칙 동일).

## 5. 실패 처리
- 파싱 실패·타임아웃·키 미설정: `parse_status='failed'`, "자동 인식에 실패했어요. 직접 입력해 주세요" 안내 후 수동 입력. 영수증 원본은 저장된 상태를 유지한다.
- 업로드 실패: 재시도 버튼 제공. 폼 입력값은 유지한다.
