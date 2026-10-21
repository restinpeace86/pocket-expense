# [Spec] 지출결의서 상태 전이 · 결재 진행 · 금액 계산 · 정산 방향 (규칙 단일 출처)

> 상태 전이와 결재 규칙은 이 문서만이 기준이다. (D-001)
> 모든 상태 전이는 서버 액션(DB 트랜잭션/RPC)으로만 수행하며, 클라이언트가 `status`를 직접 수정하지 않는다.
> **결재 단위는 지출결의서(`expense_claims`)다.** 영수증 항목(`expense_items`)은 상태를 갖지 않고 소속 결의서의 상태를 따른다. (D-034)

## 1. 결의서 상태 전이

```
          저장              상신                최종 승인            정산 지급 완료(관리자)
 (신규) ──────▶ draft ──────────▶ submitted ──────────▶ approved(정산 대기) ──▶ paid
                                            └─(정산할 금액 없음)──────────────────▶ paid
                  ▲                    │
                  │                    │ 어느 단계든 반려 (결의서 전체)
                  │   수정 후 재상신    ▼
                  └────────────── rejected ─────(재상신 시 submitted, round+1)

 draft ──(상신, 청구자가 최고 관리자)──▶ approved   ※ 결재 생략 (§3-3)
```

| 전이 | 주체 | 조건 | 처리 |
|---|---|---|---|
| (신규) → `draft` | 청구자 | — | 결의서 생성. 항목 추가·수정은 자유(필수값 검증 없음) |
| `draft` → `submitted` | 청구자 | §2 상신 검증 통과 | 금액 재계산·합계 갱신, 항목별 계정과목 스냅샷(§7), `current_round += 1`, 결재라인 스냅샷 생성(§3), `submitted_at` 기록, 첫 결재자에게 알림톡 |
| `rejected` → `submitted` | 청구자 | §2 상신 검증 통과 | 위와 동일(새 회차). `rejection_reason`은 새 반려 시 덮어씀 |
| `draft`/`rejected` → `approved` | 청구자(최고 관리자) | §2 통과 + §3-3 결재 생략 | 결재 생략. `current_round += 1`, 스냅샷 단계 전부 `skipped`, `self_approved = true`, `submitted_at`·`approved_at` 동시 기록. 알림톡 없음 |
| `submitted` → `approved` / `paid` | 관리자 이상(청구자 제외) | `final` 단계 `pending`에서 [일괄 승인] | 정산할 금액(§5.5 지급액·납부액)이 있으면 `approved`(정산 대기, `settlement_required=true`), 없으면 바로 `paid`(정산 없음, `paid_at = approved_at`, `paid_by_member_id = null`). 이어서 | 결의서 안 **모든 항목을 한 번에 승인**. `approved_at` 기록, 청구자에게 최종 승인 알림톡 |
| `submitted` → `rejected` | 현재 단계 처리 권한자 | 반려 사유 필수 | 결의서 전체 반려. 문제 항목 지목(`flagged_item_ids`)은 선택. 현재 단계 `rejected`, 이후 `waiting` 단계는 `canceled`, `rejection_reason`·`rejected_at` 기록, 청구자에게 반려 알림톡 |
| `approved` → `paid` | 관리자 이상 | [정산 지급 관리]에서 [정산 지급 완료 처리] | `paid_at`, `paid_by_member_id` 기록. 여러 결의서 일괄 처리 가능. 지급액 > 0이면 직원에게 `PAYOUT_COMPLETED` 알림톡 (D-047) |
| `draft` 삭제 제한 | — | — | 세무 마감된 항목(`closed_month` 있음)이 든 결의서는 삭제 불가(D-045) |
| `draft` 삭제 | 청구자 | `draft`만 | 항목과 영수증 파일도 삭제 |

- `submitted`, `approved`, `paid` 상태의 결의서와 그 항목은 청구자가 수정할 수 없다.
- 항목별 부분 승인·부분 반려는 하지 않는다. 문제 항목이 있으면 결의서 전체를 반려하고, 청구자가 해당 항목을 고치거나 삭제한 뒤 재상신한다.
- 상신 취소(회수)는 현재 범위가 아니다.
- `rejected` 상태에서 수정하면 상태는 `rejected` 그대로 유지되고, 재상신할 때 `submitted`로 바뀐다.

## 2. 상신 검증 (서버에서 재검증)
**결의서**: `title` 필수, `description`(적요/지출 사유) 필수(D-048), 항목 1건 이상(최대 30건), 활성 양식의 필수 헤더 필드. 출장 결의서(`is_business_trip`)면 `trip_destination`, `trip_start_date`, `trip_end_date`(≥ 시작일), `trip_purpose` 필수.
**항목마다**: `category`, `payment_method`(기본 법인카드), 법인카드이고 회사에 활성 법인카드가 있으면 `corporate_card_id`(D-055), `evidence_type`(AI 추정 후 직원 확인), `expense_date`, `amount`(>0), 활성 양식의 필수 항목 필드(해당 카테고리 적용분), 그리고 카테고리별 필수:
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
- 상신 시점에 모든 항목의 금액 계산(§5)을 서버에서 다시 수행해 저장하고, 결의서 합계 컬럼을 갱신한다.
- 결재 생략·재상신을 포함한 모든 상신에서 계정과목 스냅샷(§7)을 다시 수행한다. 단, 관리자가 개별 조정한 항목(`account_title_overridden`)은 유지한다.

## 3. 결재 진행 규칙 (D-012, D-039)
결재 단계 = **사전 검토 단계 0~n개(결재라인, 선택)** + **관리자 최종 승인 단계 1개(고정)**.
1. **결재라인 선택**: 청구자의 `department_id`와 일치하는 결재라인이 있으면 그것을, 없으면 회사 기본 결재라인(`department_id is null`)을 쓴다. 기본 결재라인은 회사 생성 시 사전 검토 0단계로 만들어지므로 항상 존재한다.
2. **스냅샷**: 사전 검토 단계를 `claim_approvals`에 `step_kind='review'`, 검토자 지정으로 복사하고, 마지막에 `step_kind='final'`, `approver_member_id = null`(관리자 이상 누구나) 단계를 추가한다. `round = current_round`. 첫 단계는 `pending`, 나머지는 `waiting`.
3. **청구자 본인 처리**(D-026):
   - 청구자가 사전 검토 단계에 있으면 1단계부터 본인 단계까지 `skipped`.
   - 청구자가 **최고 관리자**면 모든 단계를 `skipped`로 하고 **결재 절차 없이 즉시 `approved`**, `self_approved = true`. 반려될 수 없으며 알림톡도 보내지 않는다.
   - 청구자가 관리자(`admin`)면 관리자 최종 승인 단계는 **본인을 제외한** 관리자 이상이 처리한다(최고 관리자가 항상 있으므로 처리자가 없어지지 않는다).
   - 결재 생략 결의서도 상신 검증(§2)과 금액 계산(§5)은 똑같이 적용하고, 월말 출력에 포함한다.
4. **비활성 검토자**: 사전 검토자가 `inactive`면 상신을 막고 관리자에게 결재라인 수정을 요청하도록 안내한다.
5. **사전 검토 승인**: 현재 `pending`인 review 단계의 지정 검토자만 승인할 수 있다. 승인하면 다음 단계를 `pending`으로 바꾸고 그 대상자에게 알림톡.
6. **관리자 최종 승인**: `final` 단계가 `pending`일 때 **청구자 본인을 제외한 관리자 이상 누구나** [일괄 승인]할 수 있다. 처리한 사람을 `acted_by_member_id`에 기록하고 결의서를 `approved`로 전이한다. 사전 검토가 남아 있는 동안에는 관리자도 승인할 수 없다(읽기 전용).
7. **반려**: 현재 `pending` 단계의 처리 권한자(review: 지정 검토자, final: 본인 제외 관리자 이상)만 반려할 수 있고, 사유는 필수다.
8. **동시성**: 승인/반려는 "해당 단계가 아직 `pending`인지"를 조건으로 원자적으로 갱신한다. 이미 처리된 단계면 "이미 처리된 결재입니다"를 안내한다.

## 4. 결재 이력
- `claim_approvals`의 모든 회차를 보존한다. 결의서 상세 화면은 회차별 타임라인(상신 → 단계별 승인/반려/스킵 → 결과, 반려 시 지목된 항목)을 보여 준다.

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
- 한도는 항목(영수증) 단위로 적용한다. 같은 결의서 안 여러 식대 항목의 한도를 합산·이월하지 않는다.

### 5.2 외부 미팅비 (`meeting`), 회사 물품 구매 (`purchase`, D-076), 출장비 중 `own_car`·`meal` 외 유형
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
- 왕복 처리(D-069): [왕복] 체크 기본값. 체크하면 `distance_km` = 편도 거리 × 2, `is_round_trip=true`.

### 5.4 결의서 합계
```
total_amount            = Σ item.amount
total_company_supported = Σ item.company_supported_amount
total_personal_burden   = Σ item.personal_burden_amount
```
- 항목 추가·수정·삭제와 상신 시 서버가 갱신한다.

### 5.5 정산 방향 — D-010 (항목별 계산, 결의서별 합산)
| 결제수단 | 의미 | 정산 금액 |
|---|---|---|
| `personal_card` | 직원이 먼저 결제 | 회사 → 직원 지급액 = `company_supported_amount` |
| `corporate_card` | 회사 카드로 결제 | 직원 → 회사 납부액 = `personal_burden_amount` (0이면 정산할 금액 없음) |
- 한 결의서에 개인카드·법인카드 항목이 섞일 수 있다. 결의서 정산 요약은 "지급 n원 / 납부 m원"을 따로 표시하며 서로 상계하지 않는다.
- 자차 출장비 항목은 `personal_card`로 고정한다(직원이 유류비를 부담했으므로 회사가 지급).
- 정산 금액은 저장하지 않고 위 규칙으로 계산해 화면·엑셀에 표시한다. 다만 승인 시 정산 필요 여부(`settlement_required`)는 저장한다.
- **정산은 결의서 단위**다(D-047). 한 결의서에 법인카드·사비가 섞여도 지급액·납부액을 결의서별로 합산해 한 번에 처리하며, 항목별 부분 지급은 하지 않는다.
- `payment_method = personal_card`는 "개인(사비)" 전체(개인카드·현금 등 직원 돈)를 뜻한다(D-048).

## 6. 청구 기한 (D-031, 항목 단위 판정)
- 출장 결의서의 출장비 항목 중 결제일자가 출장 기간 밖이면 "출장 기간 밖" 경고를 표시한다(상신 가능).
- 항목마다 회사 청구 기한을 판정한다. 기한 초과 항목이 하나라도 있으면 결의서에 "기한 초과" 배지를 표시한다. 상신은 막지 않는다.
- **판정 규칙(D-093)**: 기한 = 결제한 달 말일(`end_of_month`) / 결제일 + N일(`days_after`) / 결제한 다음 달 N일(`next_month_day`, N 1~28) / 없음(`none`). 그날까지 상신하면 기한 안. 기준일은 상신한 결의서는 **상신일(한국 날짜)**, 작성중·반려 결의서는 **오늘**. 규칙 코드: `src/lib/expense/deadline.ts` = DB `private.claim_deadline_date`(migration 046).
- 표시: 직원 항목 화면 노란 경고("청구 기한(2026.09.05까지)이 지났어요…", 사용일을 고치면 바로 다시 판정), 결의서 화면 항목 "기한 초과" 배지, 관리자 지출 승인 관리 목록 "기한 초과" 배지, 결의서 상세(관리자·사전 검토자·직원) 항목 "기한 초과(9/5까지)" 배지, 관리자 홈 할 일 "청구 기한이 지난 항목이 든 승인 대기 결의서 n건".

## 7. 계정과목 (D-036, 항목 단위)
- 상신 시 항목의 내부 분류(`category`, `trip_type`)로 `account_title_mappings`를 찾아 `account_title_id`, `account_title_name`, `account_title_code`를 저장한다.
- 매핑이 없는 분류가 있으면 상신은 막지 않고 계정과목을 비운 채 저장하며, 관리자 대시보드 할 일에 "계정과목 미지정 항목 n건"을 표시한다.
- 관리자는 항목별 계정과목을 바꿀 수 있다(`account_title_overridden = true`). 금액 등 다른 값은 바꿀 수 없다. 세무 마감된 항목은 바꿀 수 없다(D-045).

## 8. 세무 마감 잠금 (D-045)
- 세무 마감 패키지를 다운로드하면 해당 월(`monthly_closings`)이 마감 완료가 되고, 포함된 항목의 `closed_month`가 기록된다(`spec/screens/tax-closing.md` §4.C).
- 마감된 항목: 계정과목 조정 불가, 소속 결의서 삭제 불가. 승인·정산완료 처리는 가능하다.
- 마감 완료 월의 사용일자를 가진 항목이 이후 승인되면 다음 마감 대기 월의 패키지에 "전월 추가분"으로 포함된다.
- 최고 관리자만 마감 해제할 수 있다. 해제하면 그 월에 기록된 `closed_month`를 지우고 다음 다운로드 때 다시 집계한다.

## 9. 무료 크레딧 (D-046)
- 영수증 파일 업로드가 성공할 때마다 회사 크레딧 1장을 원자적으로 차감한다(`spec/common/pricing-policy.md` §4). 결의서 상태 전이와는 무관하다.
- 차감 후 남은 크레딧이 0이 되면, 이벤트가 켜져 있는 동안 같은 트랜잭션에서 추가 100장을 지급한다(D-054, `pricing-policy.md` §5).
- 이벤트가 꺼져 있고 크레딧이 0이면 영수증 업로드만 막고, 작성·상신·결재·정산·세무 마감은 계속 허용한다.
