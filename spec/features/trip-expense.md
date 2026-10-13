# [Spec] 출장비 (세부 유형 · 자차 거리/유류비)

관련: D-008, D-018, D-034, O-04 / 데이터: `expense_items`의 trip 관련 컬럼 (항목 단위) / 계산 규칙 원본: `spec/data/expense-lifecycle.md` §5.2, §5.3

## 1. 세부 유형 (`trip_type`, 필수)
| 값 | 표시명 | 영수증 | 금액 입력 |
|---|---|---|---|
| `own_car` | 자차 | 선택 | 거리 × 단가 자동 계산 |
| `public_transport` | 대중교통(KTX·버스 등) | 필수 | 영수증 파싱/직접 입력 |
| `taxi` | 택시 | 필수 | 영수증 파싱/직접 입력 |
| `lodging` | 숙박 | 필수 | 영수증 파싱/직접 입력 |
| `toll_parking` | 통행료·주차 | 필수 | 영수증 파싱/직접 입력 |
| `other` | 기타 | 필수 | 영수증 파싱/직접 입력 |

공통 입력: `purpose`(출장 목적, 권장), `trip_start_date`(기본값 = 결제일자), `trip_end_date`(숙박이면 필수, 그 외 선택), `payment_method`.
같은 출장의 자차·통행료·주차·숙박·식대는 **한 소명서 안에 항목으로 함께** 담는다(D-034). 자차 항목은 영수증 없이 [영수증 없이 항목 추가]로 만든다.

## 2. 자차 (`own_car`)
### 2.1 입력
- 출발지·도착지: 주소 검색(Kakao Local API, `KAKAO_REST_API_KEY` 서버 호출)으로 선택 → `start_location`/`end_location`, 좌표 저장.
- [거리 계산] 버튼 → 서버에서 Kakao Mobility 길찾기 API 호출 → `distance_km`(소수 첫째 자리 반올림), `distance_source='api'`.
- 차량번호: 멤버 프로필 `vehicle_number`를 보여 주고, 없으면 "내 정보에서 차량번호를 등록하세요" 안내(상신은 막지 않음).
- `payment_method`는 개인카드로 고정한다(`expense-lifecycle.md` §5.5).
- `expense_date`는 `trip_start_date`와 같은 값으로 저장한다.

### 2.2 계산
- 청구 금액 = `distance_km × 회사 km당 단가`, 원 단위 반올림. 상신 시 `applied_fuel_rate_per_km` 스냅샷.
- 표시: "128.4km × 200원 = 25,680원".
- **편도/왕복 기준은 미결(O-04).** 잠정: `distance_km`에 실제 총 주행거리를 넣고 그대로 계산한다. 왕복 토글 UI와 2배 계산은 구현 보류.

### 2.3 Fallback
- 주소 검색·길찾기 실패 또는 키 미설정 시: "거리를 자동으로 계산하지 못했어요. 주행거리를 직접 입력해 주세요" 안내 + km 직접 입력 필드 → `distance_source='manual'`.
- 자동 계산 후 직원이 km 값을 고치면 `distance_source='manual'`로 바뀐다.
- 결재자·관리자 화면에서 `manual` 건은 "직접 입력 거리" 배지를 표시한다.
