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

 draft ──(상신, 청구자가 최고 관리자)──▶ approved   ※ 결재 생략 (§3-3)
```

| 전이 | 주체 | 조건 | 처리 |
|---|---|---|---|
| (신규) → `draft` | 청구자 | — | 소명서 생성. 항목 추가·수정은 자유(필수값 검증 없음) |
| `draft` → `submitted` | 청구자 | §2 상신 검증 통과 | 금액 재계산·합계 갱신, 항목별 계정과목 스냅샷(§7), `current_round += 1`, 결재라인 스냅샷 생성(§3), `submitted_at` 기록, 첫 결재자에게 알림톡 |
| `rejected` → `submitted` | 청구자 | §2 상신 검증 통과 | 위와 동일(새 회차). `rejection_reason`은 새 반려 시 덮어씀 |
| `draft`/`rejected` → `approved` | 청구자(최고 관리자) | §2 통과 + §3-3 결재 생략 | 결재 생략. `current_round += 1`, 스냅샷 단계 전부 `skipped`, `self_approved = true`, `submitted_at`·`approved_at` 동시 기록. 알림톡 없음 |
| `submitted` → `approved` | 관리자 이상(청구자 제외) | `final` 단계 `pending`에서 [일괄 승인] | 소명서 안 **모든 항목을 한 번에 승인**. `approved_at` 기록, 청구자에게 최종 승인 알림톡 |
| `submitted` → `rejected` | 현재 단계 처리 권한자 | 반려 사유 필수 | 소명서 전체 반려. 문제 항목 지목(`flagged_item_ids`)은 선택. 현재 단계 `rejected`, 이후 `waiting` 단계는 `canceled`, `rejection_reason`·`rejected_at` 기록, 청구자에게 반려 알림톡 |
| `approved` → `paid` | 관리자 이상 | — | `paid_at`, `paid_by_member_id` 기록. 여러 소명서 일괄 처리 가능 |
| `draft` 삭제 제한 | — | — | 세무 마감된 항목(`closed_month` 있음)이 든 소명서는 삭제 불가(D-045) |
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
| `meal` | `receipt_path`, `headcount`(≥1, 기본 1) |
| `meeting` | `receipt_path`, `purpose` |
| `trip` / `own_car` | `start_location`, `end_location`, `distance_km`(>0) — 영수증 선택 |
| `trip` / `lodging` | `receipt_path`, `trip_start_date`, `trip_end_date` |
| `trip` / `other` | `receipt_path`, `purpose` |
| `trip` / `meal` | `receipt_path`, `headcount`(≥1, 기본 1) |
| `trip` / 그 외 유형(`public_transport`, `taxi`, `toll_parking`) | `receipt_path`, `trip_type` |

- 검증 실패 시 상신하지 않고, 실패한 항목과 누락 필드를 모두 돌려준다.
- 파싱 중(`parse_status='parsing'`)인 항목이 있으면 상신할 수 없다.
- 항목 `amount`가 `supply_amount + vat_amount`와 다르면 상신은 허용하되 경고를 표시한다(면세·봉사료 등 존재).
- 상신 시점에 모든 항목의 금액 계산(§5)을 서버에서 다시 수행해 저장하고, 소명서 합계 컬럼을 갱신한다.
- 결재 생략·재상신을 포함한 모든 상신에서 계정과목 스냅샷(§7)을 다시 수행한다. 단, 관리자가 개별 조정한 항목(`account_title_overridden`)은 유지한다.

## 3. 결재 진행 규칙 (D-012, D-039)
결재 단계 = **사전 검토 단계 0~n개(결재라인, 선택)** + **관리자 최종 승인 단계 1개(고정)**.
1. **결재라인 선택**: 청구자의 `department_id`와 일치하는 결재라인이 있으면 그것을, 없으면 회사 기본 결재라인(`department_id is null`)을 쓴다. 기본 결재라인은 회사 생성 시 사전 검토 0단계로 만들어지므로 항상 존재한다.
2. **스냅샷**: 사전 검토 단계를 `claim_approvals`에 `step_kind='review'`, 검토자 지정으로 복사하고, 마지막에 `step_kind='final'`, `approver_member_id = null`(관리자 이상 누구나) 단계를 추가한다. `round = current_round`. 첫 단계는 `pending`, 나머지는 `waiting`.
3. **청구자 본인 처리**(D-026):
   - 청구자가 사전 검토 단계에 있으면 1단계부터 본인 단계까지 `skipped`.
   - 청구자가 **최고 관리자**면 모든 단계를 `skipped`로 하고 **결재 절차 없이 즉시 `approved`**, `self_approved = true`. 반려될 수 없으며 알림톡도 보내지 않는다.
   - 청구자가 관리자(`admin`)면 관리자 최종 승인 단계는 **본인을 제외한** 관리자 이상이 처리한다(최고 관리자가 항상 있으므로 처리자가 없어지지 않는다).
   - 결재 생략 소명서도 상신 검증(§2)과 금액 계산(§5)은 똑같이 적용하고, 월말 출력에 포함한다.
4. **비활성 검토자**: 사전 검토자가 `inactive`면 상신을 막고 관리자에게 결재라인 수정을 요청하도록 안내한다.
5. **사전 검토 승인**: 현재 `pending`인 review 단계의 지정 검토자만 승인할 수 있다. 승인하면 다음 단계를 `pending`으로 바꾸고 그 대상자에게 알림톡.
6. **관리자 최종 승인**: `final` 단계가 `pending`일 때 **청구자 본인을 제외한 관리자 이상 누구나** [일괄 승인]할 수 있다. 처리한 사람을 `acted_by_member_id`에 기록하고 소명서를 `approved`로 전이한다. 사전 검토가 남아 있는 동안에는 관리자도 승인할 수 없다(읽기 전용).
7. **반려**: 현재 `pending` 단계의 처리 권한자(review: 지정 검토자, final: 본인 제외 관리자 이상)만 반려할 수 있고, 사유는 필수다.
8. **동시성**: 승인/반려는 "해당 단계가 아직 `pending`인지"를 조건으로 원자적으로 갱신한다. 이미 처리된 단계면 "이미 처리된 결재입니다"를 안내한다.

## 4. 결재 이력
- `claim_approvals`의 모든 회차를 보존한다. 소명서 상세 화면은 회차별 타임라인(상신 → 단계별 승인/반려/스킵 → 결과, 반려 시 지목된 항목)을 보여 준다.

## 5. 금액 계산 규칙 (항목 단위)
### 5.1 식대 한도 적용 — 일반 식대(`meal`)와 출장 식비(`trip`/`meal`) (D-009, D-040, D-041, D-044)
```
per_person = members.meal_limit_override ?? companies.meal_limit_per_person   // 개인별 예외 한도 우선 (D-044)
limit      = per_person × headcount
over       = max(amount - limit, 0)

절사 모드(meal_limit_mode = 'split', 기본):
  company_supported_amount = min(amount, limit)
  personal_burden_amount   = over
알림 모드(meal_limit_mode = 'notify'):
  company_supported_amount = amount
  personal_burden_amount   = 0            // 초과분(over)은 "한도 초과" 배지로만 표시
```
- `applied_meal_limit_per_person`에 계산 시점의 `per_person` 값을, `applied_meal_limit_mode`에 계산 시점 모드를 스냅샷한다(D-018). 상신 시 서버 재계산으로 확정.
- 출장 식비도 같은 1식 한도를 적용한다(D-040). 계정과목은 여비교통비 그대로다(D-036).
- 한도는 항목(영수증) 단위로 적용한다. 같은 소명서 안 여러 식대 항목의 한도를 합산·이월하지 않는다.

### 5.2 외부 미팅비 (`meeting`), 출장비 중 `own_car`·`meal` 외 유형
```
company_supported_amount = amount
personal_burden_amount   = 0
```

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

## 7. 계정과목 (D-036, 항목 단위)
- 상신 시 항목의 내부 분류(`category`, `trip_type`)로 `account_title_mappings`를 찾아 `account_title_id`, `account_title_name`, `account_title_code`를 저장한다.
- 매핑이 없는 분류가 있으면 상신은 막지 않고 계정과목을 비운 채 저장하며, 관리자 대시보드 할 일에 "계정과목 미지정 항목 n건"을 표시한다.
- 관리자는 항목별 계정과목을 바꿀 수 있다(`account_title_overridden = true`). 금액 등 다른 값은 바꿀 수 없다. 세무 마감된 항목은 바꿀 수 없다(D-045).

## 8. 세무 마감 잠금 (D-045)
- 세무 마감 패키지를 다운로드하면 해당 월(`monthly_closings`)이 마감 완료가 되고, 포함된 항목의 `closed_month`가 기록된다(`spec/screens/tax-closing.md` §4.C).
- 마감된 항목: 계정과목 조정 불가, 소속 소명서 삭제 불가. 승인·정산완료 처리는 가능하다.
- 마감 완료 월의 사용일자를 가진 항목이 이후 승인되면 다음 마감 대기 월의 패키지에 "전월 추가분"으로 포함된다.
- 최고 관리자만 마감 해제할 수 있다. 해제하면 그 월에 기록된 `closed_month`를 지우고 다음 다운로드 때 다시 집계한다.
