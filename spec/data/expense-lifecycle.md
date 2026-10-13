# [Spec] 지출소명서 상태 전이 · 결재 진행 · 금액 계산 · 정산 방향 (규칙 단일 출처)

> 상태 전이와 결재 규칙은 이 문서만이 기준이다. (D-001)
> 모든 상태 전이는 서버 액션(DB 트랜잭션/RPC)으로만 수행하며, 클라이언트가 `status`를 직접 수정하지 않는다.
> **결재 단위는 지출소명서(`expense_claims`)다.** 영수증 항목(`expense_items`)은 상태를 갖지 않고 소속 소명서의 상태를 따른다. (D-034)

## 1. 소명서 상태 전이

```
          저장              상신                최종 승인            정산완료(관리자)
 (신규) ──────▶ draft ──────────▶ submitted ──────────▶ approved ──────────▶ paid
                  ▲                    │
                  │                    │ 어느 단계든 반려 (소명서 전체)
                  │   수정 후 재상신    ▼
                  └────────────── rejected ─────(재상신 시 submitted, round+1)

 draft ──(상신, 청구자가 결재라인의 최종 결재자)──▶ approved   ※ 본인 최종 결재: 결재 생략 (§3-3)
```

| 전이 | 주체 | 조건 | 처리 |
|---|---|---|---|
| (신규) → `draft` | 청구자 | — | 소명서 생성. 항목 추가·수정은 자유(필수값 검증 없음) |
| `draft` → `submitted` | 청구자 | §2 상신 검증 통과 | 금액 재계산·합계 갱신, `current_round += 1`, 결재라인 스냅샷 생성(§3), `submitted_at` 기록, 첫 결재자에게 알림톡 |
| `rejected` → `submitted` | 청구자 | §2 상신 검증 통과 | 위와 동일(새 회차). `rejection_reason`은 새 반려 시 덮어씀 |
| `draft`/`rejected` → `approved` | 청구자 | §2 통과 + §3-3에서 남은 결재 단계 없음 | 결재 생략. `current_round += 1`, 스냅샷 단계 전부 `skipped`, `self_approved = true`, `submitted_at`·`approved_at` 동시 기록. 알림톡 없음 |
| `submitted` → `approved` | 마지막 결재자 | 마지막 `pending` 단계 승인 | 소명서 안 **모든 항목을 한 번에 승인**. `approved_at` 기록, 청구자에게 최종 승인 알림톡 |
| `submitted` → `rejected` | 현재 결재자 | 반려 사유 필수 | 소명서 전체 반려. 문제 항목 지목(`flagged_item_ids`)은 선택. 현재 단계 `rejected`, 이후 `waiting` 단계는 `canceled`, `rejection_reason`·`rejected_at` 기록, 청구자에게 반려 알림톡 |
| `approved` → `paid` | admin | — | `paid_at`, `paid_by_member_id` 기록. 여러 소명서 일괄 처리 가능 |
| `draft` 삭제 | 청구자 | `draft`만 | 항목과 영수증 파일도 삭제 |

- `submitted`, `approved`, `paid` 상태의 소명서와 그 항목은 청구자가 수정할 수 없다.
- 항목별 부분 승인·부분 반려는 하지 않는다. 문제 항목이 있으면 소명서 전체를 반려하고, 청구자가 해당 항목을 고치거나 삭제한 뒤 재상신한다.
- 상신 취소(회수)는 현재 범위가 아니다.
- `rejected` 상태에서 수정하면 상태는 `rejected` 그대로 유지되고, 재상신할 때 `submitted`로 바뀐다.

## 2. 상신 검증 (서버에서 재검증)
**소명서**: `title` 필수, 항목 1건 이상(최대 30건), 활성 양식의 필수 헤더 필드. 출장 소명서(`is_business_trip`)면 `trip_destination`, `trip_start_date`, `trip_end_date`(≥ 시작일), `trip_purpose` 필수.
**항목마다**: `category`, `payment_method`, `expense_date`, `amount`(>0), 활성 양식의 필수 항목 필드(해당 카테고리 적용분), 그리고 카테고리별 필수:
| 카테고리 | 추가 필수 |
|---|---|
| `meal` | `receipt_path`, `headcount`(≥1) |
| `meeting` | `receipt_path`, `purpose` |
| `trip` / `own_car` | `start_location`, `end_location`, `distance_km`(>0) — 영수증 선택 |
| `trip` / `lodging` | `receipt_path`, `trip_start_date`, `trip_end_date` |
| `trip` / `other` | `receipt_path`, `purpose` |
| `trip` / 그 외 유형(`meal`, `public_transport`, `taxi`, `toll_parking`) | `receipt_path`, `trip_type` |

- 검증 실패 시 상신하지 않고, 실패한 항목과 누락 필드를 모두 돌려준다.
- 파싱 중(`parse_status='parsing'`)인 항목이 있으면 상신할 수 없다.
- 항목 `amount`가 `supply_amount + vat_amount`와 다르면 상신은 허용하되 경고를 표시한다(면세·봉사료 등 존재).
- 상신 시점에 모든 항목의 금액 계산(§5)을 서버에서 다시 수행해 저장하고, 소명서 합계 컬럼을 갱신한다.

## 3. 결재 진행 규칙 (D-011, D-012)
1. **결재라인 선택**: 청구자의 `department_id`와 일치하는 결재라인이 있으면 그것을, 없으면 회사 기본 결재라인(`department_id is null`)을 쓴다. 둘 다 없으면 상신을 막고 "관리자에게 결재라인 설정을 요청하세요"를 안내한다.
2. **스냅샷**: 선택된 결재라인의 단계를 `claim_approvals`에 `round = current_round`로 복사한다. 첫 단계는 `pending`, 나머지는 `waiting`.
3. **청구자가 결재라인에 포함된 경우**(D-026): 1단계부터 청구자 본인 단계까지를 모두 `skipped`로 만들고, 그다음 단계부터 결재를 진행한다(자기보다 윗선에게만 결재를 받는다).
   - 남은 단계가 없으면(예: 대표가 최종 결재자인 결재라인에서 대표가 상신) **결재 절차 없이 즉시 `approved`** 로 전이하고 `self_approved = true`로 기록한다. 반려될 수 없으며 알림톡도 보내지 않는다.
   - 예) 결재라인 `김팀장 → 이대표`: 김팀장이 상신하면 이대표만 결재 / 이대표가 상신하면 결재 생략, 바로 승인.
   - 결재 생략 소명서도 상신 검증(§2)과 금액 계산(§5)은 똑같이 적용하고, 월말 출력에 포함한다.
4. **비활성 결재자**: 결재자가 `inactive`면 상신을 막고 관리자에게 결재라인 수정을 요청하도록 안내한다.
5. **승인**: 현재 `pending` 단계의 결재자만 승인할 수 있다. 승인하면 해당 단계 `approved` → 다음 `waiting` 단계를 `pending`으로 바꾸고 그 결재자에게 알림톡. 다음 단계가 없으면 소명서를 `approved`로 전이.
6. **반려**: 현재 `pending` 단계의 결재자만 반려할 수 있고, 사유는 필수다.
7. **동시성**: 승인/반려는 "해당 단계가 아직 `pending`인지"를 조건으로 원자적으로 갱신한다. 이미 처리된 단계면 "이미 처리된 결재입니다"를 안내한다.
8. 관리자(admin)라도 결재라인의 현재 결재자가 아니면 승인/반려할 수 없다.

## 4. 결재 이력
- `claim_approvals`의 모든 회차를 보존한다. 소명서 상세 화면은 회차별 타임라인(상신 → 단계별 승인/반려/스킵 → 결과, 반려 시 지목된 항목)을 보여 준다.

## 5. 금액 계산 규칙 (항목 단위)
### 5.1 일반 식대 (`meal`) — D-009
```
limit = applied_meal_limit_per_person × headcount
company_supported_amount = min(amount, limit)
personal_burden_amount   = max(amount - limit, 0)
```
- `applied_meal_limit_per_person`는 계산 시점의 `companies.meal_limit_per_person` 값이다(D-018). 상신 시 서버 재계산으로 확정.
- 한도는 항목(영수증) 단위로 적용한다. 같은 소명서 안 여러 식대 항목의 한도를 합산·이월하지 않는다.

### 5.2 외부 미팅비 (`meeting`), 출장비 중 `own_car` 외 유형 (출장 식비 포함, D-035)
```
company_supported_amount = amount
personal_burden_amount   = 0
```
- 출장 식비(`trip` / `meal`)에는 일반 식대의 1인 한도 분할을 적용하지 않는다.

### 5.3 자차 출장비 (`trip` / `own_car`)
```
amount = round(distance_km × applied_fuel_rate_per_km)   // 원 단위 반올림
company_supported_amount = amount
personal_burden_amount   = 0
```
- 왕복 처리 기준은 미결(O-04). 잠정: `distance_km`에 실제 총 주행거리를 넣고 그대로 계산한다.

### 5.4 소명서 합계
```
total_amount            = Σ item.amount
total_company_supported = Σ item.company_supported_amount
total_personal_burden   = Σ item.personal_burden_amount
```
- 항목 추가·수정·삭제와 상신 시 서버가 갱신한다.

### 5.5 정산 방향 — D-010 (항목별 계산, 소명서별 합산)
| 결제수단 | 의미 | 정산 금액 |
|---|---|---|
| `personal_card` | 직원이 먼저 결제 | 회사 → 직원 지급액 = `company_supported_amount` |
| `corporate_card` | 회사 카드로 결제 | 직원 → 회사 납부액 = `personal_burden_amount` (0이면 정산할 금액 없음) |
- 한 소명서에 개인카드·법인카드 항목이 섞일 수 있다. 소명서 정산 요약은 "지급 n원 / 납부 m원"을 따로 표시하며 서로 상계하지 않는다.
- 자차 출장비 항목은 `personal_card`로 고정한다(직원이 유류비를 부담했으므로 회사가 지급).
- 정산 금액은 저장하지 않고 위 규칙으로 계산해 화면·엑셀에 표시한다.

## 6. 청구 기한 (D-031, 항목 단위 판정)
- 출장 소명서의 출장비 항목 중 결제일자가 출장 기간 밖이면 "출장 기간 밖" 경고를 표시한다(상신 가능).
- 항목마다 회사 청구 기한을 판정한다. 기한 초과 항목이 하나라도 있으면 소명서에 "기한 초과" 배지를 표시한다. 상신은 막지 않는다.
