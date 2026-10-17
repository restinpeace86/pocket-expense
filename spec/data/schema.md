# [Spec] 데이터 스키마 (단일 출처)

> 이 문서가 테이블·컬럼·enum의 유일한 기준이다. 다른 문서와 다르면 이 문서를 따른다. (D-001)
> 모든 테이블은 `id uuid PK default gen_random_uuid()`, `created_at`, `updated_at timestamptz`(updated_at 트리거)를 가진다. 아래 표에서는 생략한다.
> 금액은 모두 원 단위 정수(`integer`)다.
> **격리 구현(T1)**: 회사 데이터 테이블은 모두 `company_id NOT NULL`이고, 회사 데이터끼리의 참조는 `(id, company_id)` 복합 외래키로 묶어 다른 회사 행을 가리킬 수 없다. 실제 정의는 `supabase/migrations/001~005`, 검증은 `supabase/tests/001_tenant_isolation.sql`.
> **경비 구조 (D-034)**: 지출소명서 1건(`expense_claims`, 헤더) 안에 영수증 항목 N건(`expense_items`, 행). 결재·상태·정산완료는 소명서 단위, 카테고리·금액 계산·영수증은 항목 단위다.

## 1. Enum

| 이름 | 값 |
|---|---|
| `member_role` | `super_admin`(최고 관리자, 회사당 1명), `admin`(관리자), `employee`(직원) (D-038) |
| `member_status` | `pending`(승인 대기), `approved`(활성), `inactive`(비활성/퇴사) |
| `claim_status` | `draft`, `submitted`, `approved`, `rejected`, `paid` (소명서 상태) |
| `expense_category` | `meal`(일반 식대), `trip`(출장비), `meeting`(외부 미팅비) (항목 카테고리. 출장 중 비용은 모두 `trip`, D-035) |
| `payment_method` | `corporate_card`(법인카드, 기본값), `personal_card`(개인(사비): 개인카드·현금 등 직원 돈) (D-048) |
| `trip_type` | `meal`(출장 식비), `public_transport`(대중교통), `taxi`(택시), `toll_parking`(통행료·주차), `lodging`(숙박), `own_car`(자차 유류비), `other`(기타) |
| `distance_source` | `api`(카카오 길찾기 산출), `manual`(직접 입력) |
| `approval_step_kind` | `review`(사전 검토, 결재라인), `final`(관리자 최종 승인) (D-039) |
| `meal_limit_mode` | `split`(절사: 초과분 개인 부담), `notify`(알림: 전액 지원 + 한도 초과 배지) (D-041) |
| `evidence_type` | `card_slip`(카드매출전표), `cash_receipt`(현금영수증), `tax_invoice`(세금계산서), `simple_receipt`(간이영수증), `other`(기타·증빙 없음) (D-051) |
| `billing_status` | `free_trial`(한시 무료 제공), `active`(유료 구독 — 결제 연동 후) (D-046) |
| `invitation_status` | `invited`(초대 대기), `accepted`, `canceled` (D-042) |
| `approval_step_status` | `waiting`(앞 단계 대기), `pending`(내 차례), `approved`, `rejected`, `skipped`, `canceled` |
| `parse_status` | `none`, `parsing`, `success`, `failed` |
| `notification_status` | `queued`, `sent`, `failed` |
| `claim_deadline_type` | `none`(사용 안 함), `end_of_month`(결제월 말일까지), `days_after`(결제일로부터 N일), `next_month_day`(결제한 다음 달 N일까지, D-064) |

## 2. 테이블

### 2.1 `companies` — 회사(Workspace)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| name | text | not null | 회사명 |
| business_number | text | not null, 숫자 10자리 | 사업자등록번호 (회사 등록 시 필수, D-056) |
| business_status | text | not null, default 'skipped' | 국세청 조회 판정: skipped / bypass / active / suspended / unverified (D-057) |
| business_verified_at | timestamptz | null | 국세청 확인 시각 |
| invite_code | text | not null, unique | 직원 초대 코드 (재발급 가능) |
| meal_limit_enabled | boolean | not null, default true | false면 식대 한도 없이 전액 지원 (D-068) |
| meal_limit_per_person | integer | not null, default 10000 | 1식 1인당 지원 한도 (일반 식대·출장 식비 공통, D-040) |
| meal_limit_mode | meal_limit_mode | not null, default 'split' | 한도 초과 처리 방식 (D-041) |
| fuel_enabled | boolean | not null, default true | false면 자차 유류비(own_car) 항목을 받지 않음 (D-068) |
| fuel_rate_per_km | integer | not null, default 200 | 자차 km당 유류비 단가 |
| claim_deadline_type | claim_deadline_type | not null, default 'next_month_day' | 청구 기한 방식 (D-031, D-064) |
| claim_deadline_days | integer | default 5, 1~90 | `days_after`: 결제일로부터 N일(1~90) / `next_month_day`: 다음 달 N일(1~28). 그 외 방식이면 null |
| policy_confirmed_at | timestamptz | null | 관리자가 정산 정책을 처음 저장한 시각. null이면 홈에 정책 확인 안내 (D-068) |
| billing_status | billing_status | not null, default 'free_trial' | 과금 상태 (D-046) |
| receipt_credits_granted | integer | not null, default 100 | 지급된 무료 크레딧(회사 생성 시 100) |
| receipt_credits_used | integer | not null, default 0 | 사용한 크레딧. `used ≤ granted` 체크 제약 |
| last_event_bonus_at | timestamptz | null | 마지막 이벤트 추가 지급 시각 (D-054) |
| event_bonus_acknowledged_at | timestamptz | null | 관리자가 이벤트 지급 배너를 확인한 시각 |

### 2.1a `billing_plans` — 요금제 (D-046, 표시용)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| code | text | not null, unique | `basic` / `standard` / `pro` |
| name | text | not null | 베이직 / 스탠다드 / 프로 |
| monthly_price | integer | not null | 40000 / 70000 / 100000 |
| monthly_receipts | integer | not null | 300 / 600 / 1000 |
| recommended_size | text | null | 5~10인 / 10~20인 / 20~30인 |
| sort_order | integer | default 0 | |
| is_purchasable | boolean | not null, default false | 결제 가능 여부. 결제 연동 전까지 false (D-046) |
- `id`·`created_at` 외 회사와 무관한 공용 데이터. 시드 마이그레이션으로 넣는다.

### 2.1b `credit_ledger` — 크레딧 이력 (D-046)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies, not null | |
| delta | integer | not null | +100(무료 지급·이벤트 추가 지급) / -1(영수증 업로드) |
| reason | text | not null | `free_trial_grant` / `receipt_upload` / `event_bonus` (D-054) |
| item_id | uuid | FK expense_items, null | 차감 대상 항목 |
| member_id | uuid | FK members, null | 업로드한 사람 |

### 2.1c `business_verifications` — 사업자번호 조회 기록 (D-057, 서버 service role 전용)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| b_no | text | not null, 숫자 10자리 | |
| auth_user_id | uuid | FK auth.users | 조회한 사용자 (본인 조회 결과만 인정) |
| status | text | active / suspended / closed / not_registered / unverified | |
| status_label | text | null | 국세청 상태 문구 |
| raw | jsonb | null | 원본 응답 |
| checked_at | timestamptz | not null | |
- 앱 사용자(anon·authenticated) 권한 없음. 설정은 `private.app_settings`(`business_verify_mode`, `business_verify_bypass_numbers`).

### 2.2 `departments` — 부서
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies, not null | |
| name | text | not null, unique(company_id, name) | 부서명 |
| sort_order | integer | default 0 | |

### 2.3 `members` — 직원/관리자 (D-005)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| auth_user_id | uuid | FK auth.users, not null, **unique** | 1계정 1회사 (D-004) |
| company_id | uuid | FK companies, not null | |
| name | text | not null | 실명 |
| phone | text | not null | 휴대폰 번호(숫자만 저장). 알림톡 수신 번호. 인증 수단 아님 (D-002) |
| email | text | null | OAuth 계정 이메일 |
| department_id | uuid | FK departments, null | 직원 가입 시 필수. 회사 등록자는 null(부서 없음) 가능, 부서 삭제 시 null. **null은 모든 기능에서 정상 상태**(결재라인=회사 기본, 표시="부서 없음") (D-058) |
| position | text | null | 직급/직책 (선택) |
| employee_number | text | null | 사번 (선택) |
| vehicle_number | text | null | 차량번호 (선택, 자차 출장비용) |
| meal_limit_override | integer | null | 개인별 예외 1식 한도. null이면 회사 공통 (D-044) |
| joined_via | text | not null, default 'shared_link' | `shared_link`(공용 링크/QR → 승인 대기) / `invitation`(개별 초대 → 즉시 활성) / `company_creation` |
| last_reminded_at | timestamptz | null | 마지막 독촉 알림 발송 시각 (하루 1회 제한, D-043) |
| role | member_role | not null, default 'employee' | `super_admin`은 회사당 정확히 1명 (partial unique: company_id where role='super_admin') |
| status | member_status | not null, default 'pending' | |
| privacy_agreed_at | timestamptz | not null | 개인정보 수집·이용 동의 시각 |
| terms_agreed_at | timestamptz | null | 서비스 이용약관 동의 시각 (D-059) |
| terms_version / privacy_version | text | null | 동의한 문서 버전 (`private.app_settings`) |
| optional_consent_at | timestamptz | null | 선택 항목(정산 계좌·차량번호) 동의 시각. 없으면 선택 항목 저장 불가 |
| approved_at | timestamptz | null | 관리자 가입 승인 시각 |
| ui_theme | text | null, 영문 소문자 2~20자 | 화면 색상(팔레트 이름, D-067). 본인만 수정. 모르는 값·null이면 기본(A) |

### 2.3a `member_invitations` — 개별 초대 (D-042)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies, not null | |
| name | text | not null | 초대 대상 이름 |
| phone | text | null | 휴대폰(알림톡 초대 시 필수) |
| department_id | uuid | FK departments, null | |
| position | text | null | 직급 |
| token | text | not null, unique | 개인 초대 링크 토큰(추측 불가 난수) |
| status | invitation_status | not null, default 'invited' | |
| invited_by_member_id | uuid | FK members, not null | |
| accepted_member_id | uuid | FK members, null | 가입 완료 시 연결 |
| last_sent_at | timestamptz | null | 마지막 알림톡 발송 시각 |

### 2.4 `member_bank_accounts` — 정산 계좌 (선택, 민감정보 분리)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| member_id | uuid | FK members, unique | |
| company_id | uuid | FK companies | RLS용 |
| bank_name | text | not null | |
| account_number | text | not null | |
| account_holder | text | not null | 예금주 |

### 2.5 `form_templates` — 사내 지출소명서 양식 (D-019)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies | |
| version | integer | not null, unique(company_id, version) | 1부터 증가 |
| schema | jsonb | not null | 양식 정의 객체 — 헤더 필드 + 항목(표) 필드 (`spec/features/form-template.md` §3) |
| source_file_path | text | null | 업로드한 원본 양식 파일 (Storage `form-templates`) |
| ai_extracted_schema | jsonb | null | LLM 1차 추출 원본 (보정 전) |
| is_active | boolean | not null, default false | 회사당 활성 양식 최대 1개 (partial unique) |

### 2.6 `approval_lines` / `approval_line_steps` — 결재라인 설정 (D-011)
`approval_lines`
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies | |
| name | text | not null | 예: "기본 결재라인", "영업팀 결재라인" |
| department_id | uuid | FK departments, null | null = 회사 기본 결재라인 |
| | | unique(company_id, department_id) — null 포함 회사당 기본 1개 | |

`approval_line_steps`
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| approval_line_id | uuid | FK approval_lines, cascade | |
| company_id | uuid | FK companies, not null | 격리·RLS용 (복합 FK) |
| step_order | integer | not null, unique(approval_line_id, step_order) | 1부터 |
| approver_member_id | uuid | FK members, not null | 사전 검토자. `approved` 상태 멤버(역할 무관) (D-039) |

### 2.5a `corporate_cards` — 법인카드 (선택 기능, D-055, `spec/features/corporate-cards.md`)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies, not null | |
| nickname | text | not null | 별칭 (예: 대표 법인카드) |
| last4 | text | not null, 숫자 4자리, unique(company_id, last4) where is_active | 카드 끝 4자리. **카드번호 전체·유효기간·CVC는 저장하지 않는다** |
| holder_member_id | uuid | FK members, null | 담당자(표시용) |
| is_active | boolean | not null, default true | 해지 시 false (삭제 대신) |

### 2.6a `account_titles` / `account_title_mappings` — 계정과목 (D-036, `spec/features/account-titles.md`)
`account_titles`
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies, not null | |
| name | text | not null, unique(company_id, name) | 계정과목명 (예: 여비교통비) |
| code | text | null | 세무사무소 회계 프로그램 계정코드 |
| sort_order | integer | default 0 | |

`account_title_mappings`
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies, not null | |
| category | expense_category | not null | 내부 분류: 카테고리 |
| trip_type | trip_type | null | 내부 분류: 출장 세부 유형 (`trip`일 때만, 그 외 null) |
| account_title_id | uuid | FK account_titles, not null | |
| | | unique(company_id, category, trip_type) — null 포함 | |

### 2.7 `expense_claims` — 지출소명서 (헤더, 결재 단위) (D-034)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies, not null | |
| member_id | uuid | FK members, not null | 청구자 |
| form_template_id | uuid | FK form_templates, null | 작성 당시 활성 양식 |
| title | text | not null | 소명서 제목. 예: "10/15 부산 출장" (자동 제안, 수정 가능) |
| description | text | null | 소명 내용(공통 사유) |
| is_business_trip | boolean | not null, default false | 출장 소명서 여부 (D-035) |
| trip_destination | text | null | 출장지. `is_business_trip`이면 상신 시 필수 |
| trip_start_date / trip_end_date | date | null | 출장 기간. `is_business_trip`이면 상신 시 필수 |
| trip_purpose | text | null | 출장 목적. `is_business_trip`이면 상신 시 필수 |
| status | claim_status | not null, default 'draft' | |
| header_custom_payload | jsonb | not null, default '{}' | 양식 헤더 고유 항목 값 `{ field_key: value }` |
| item_count | integer | not null, default 0 | 항목 수 (서버가 항목 변경 시 갱신) |
| total_amount | integer | not null, default 0 | 항목 `amount` 합계 (서버 갱신) |
| total_company_supported | integer | not null, default 0 | 항목 회사지원금 합계 (서버 갱신) |
| total_personal_burden | integer | not null, default 0 | 항목 개인부담금 합계 (서버 갱신) |
| self_approved | boolean | not null, default false | 본인 최종 결재로 결재 생략 승인 여부 (D-026) |
| settlement_required | boolean | null | 승인 시 결정: 지급·납부할 금액이 있으면 true(정산 대기), 없으면 false(바로 `paid`) (D-047) |
| current_round | integer | not null, default 0 | 결재 회차 (상신마다 +1) |
| rejection_reason | text | null | 최근 반려 사유 |
| submitted_at / approved_at / rejected_at / paid_at | timestamptz | null | 상태 전이 시각 |
| paid_by_member_id | uuid | FK members, null | 정산완료 처리자 |

### 2.8 `expense_items` — 영수증 항목 (행) (D-034)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| claim_id | uuid | FK expense_claims, cascade, not null | 소속 소명서 |
| company_id | uuid | FK companies, not null | RLS용 |
| sort_order | integer | not null, default 0 | 소명서 안 표시 순서 |
| category | expense_category | null (상신 시 필수) | |
| payment_method | payment_method | not null, default 'corporate_card' | (D-010, D-048) |
| expense_date | date | null (상신 시 필수) | 결제/사용 일자. 출력 기준월 (D-016) |
| merchant_name | text | null | 가맹점명 (자차는 null 허용) |
| merchant_business_number | text | null | 가맹점 사업자등록번호(숫자 10자리 저장, 표시 `000-00-00000`). AI 추출 후 직원 확인 (D-050) |
| evidence_type | evidence_type | null (상신 시 필수) | 증빙구분. AI 추정 후 직원 확인 (D-051) |
| card_last4 | text | null | AI가 영수증에서 읽은 카드 끝 4자리 (D-055) |
| corporate_card_id | uuid | FK corporate_cards, null | 사용한 법인카드. 등록 카드가 있고 결제수단이 법인카드면 상신 시 필수 |
| credit_charged | boolean | not null, default false | 이 항목 영수증 업로드로 크레딧을 차감했는지(교체 시 추가 차감 방지) |
| amount | integer | null (상신 시 필수) | 총 결제금액 |
| supply_amount | integer | null | 공급가액 (D-017) |
| vat_amount | integer | null | 부가세 (D-017) |
| headcount | integer | null, ≥1 | 인원수. 일반 식대·출장 식비 필수(기본 1), `meeting` 선택 (D-009, D-040) |
| applied_meal_limit_per_person | integer | null | 계산 시점 1인 한도 스냅샷(개인 예외 한도 반영) (D-018, D-044) |
| applied_meal_limit_mode | meal_limit_mode | null | 계산 시점 한도 처리 방식 스냅샷 (D-041) |
| company_supported_amount | integer | null | 회사 지원금 |
| personal_burden_amount | integer | not null, default 0 | 개인 부담금 |
| purpose | text | null | 항목 적요. `meeting` 필수 |
| attendees | text | null | 참석자 (`meeting`) |
| client_name | text | null | 거래처/상대 회사명 (`meeting`) |
| receipt_path | text | null | Storage `receipts` 경로. `own_car` 외 상신 시 필수 |
| parse_status | parse_status | not null, default 'none' | |
| ai_parsed_payload | jsonb | null | LLM 파싱 원본 결과 |
| trip_type | trip_type | null | `trip` 필수 |
| trip_start_date | date | null | 숙박 체크인일 (`lodging`) |
| trip_end_date | date | null | 숙박 체크아웃일 (`lodging`) |
| start_location | text | null | 출발지 주소 (`own_car`) |
| start_lat / start_lng | numeric | null | 출발지 좌표 |
| end_location | text | null | 도착지 주소 (`own_car`) |
| end_lat / end_lng | numeric | null | 도착지 좌표 |
| is_round_trip | boolean | null | 왕복 여부 (기준 미결 O-04) |
| distance_km | numeric(8,1) | null | 주행거리 |
| distance_source | distance_source | null | |
| applied_fuel_rate_per_km | integer | null | 계산 시점 단가 스냅샷 (D-018) |
| item_custom_payload | jsonb | not null, default '{}' | 양식 항목(표) 고유 필드 값 `{ field_key: value }` |
| account_title_id | uuid | FK account_titles, null | 상신 시 매핑으로 결정 (D-036) |
| account_title_name / account_title_code | text | null | 상신 시점 계정과목명·코드 스냅샷 |
| account_title_overridden | boolean | not null, default false | 관리자가 개별 조정했는지 |
| closed_month | text | null | 세무 마감에 포함된 마감월 `YYYY-MM` (D-045) |

- 소명서 1건의 항목은 1~30건이다.

### 2.9 `claim_approvals` — 소명서별 결재 진행 (스냅샷, D-012)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| claim_id | uuid | FK expense_claims, cascade | |
| company_id | uuid | FK companies | RLS용 |
| round | integer | not null | 결재 회차 |
| step_order | integer | not null, unique(claim_id, round, step_order) | |
| step_kind | approval_step_kind | not null | `review` / `final` (D-039) |
| approver_member_id | uuid | FK members, null | review: 지정 검토자 / final: null(청구자 제외 관리자 이상 누구나) |
| acted_by_member_id | uuid | FK members, null | 실제 처리자 |
| status | approval_step_status | not null | |
| comment | text | null | 반려 사유(반려 시 필수) / 승인 코멘트 |
| flagged_item_ids | uuid[] | not null, default '{}' | 반려 시 결재자가 지목한 문제 항목(선택) |
| acted_at | timestamptz | null | |

### 2.9a `monthly_closings` — 세무 마감 (D-045)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies, not null | |
| year_month | text | not null, unique(company_id, year_month) | `YYYY-MM` |
| status | text | not null | `closed` (해제 시 행 삭제 대신 `reopened`) |
| closed_at / closed_by_member_id | timestamptz / uuid | | 마감 처리 시각·처리자 |
| reopened_at / reopened_by_member_id / reopen_reason | | null | 마감 해제(최고 관리자) |

### 2.10 `notification_logs` — 알림톡 발송 이력
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies | |
| claim_id | uuid | FK expense_claims, null | |
| recipient_member_id | uuid | FK members, null | 초대(`INVITE`)는 비회원이라 null |
| invitation_id | uuid | FK member_invitations, null | `INVITE` 발송 대상 |
| recipient_phone | text | not null | 발송 시점 번호 |
| template_code | text | not null | `spec/features/kakao-alimtalk.md` §3 |
| payload | jsonb | not null | 템플릿 변수 |
| status | notification_status | not null | |
| provider | text | not null | 발송 드라이버명 (`log` 포함) |
| provider_message_id | text | null | |
| error_message | text | null | |
| sent_at | timestamptz | null | |

## 3. RLS 정책 (전 테이블 RLS enable + 아래 정책 필수)
공통 헬퍼: `current_member()` = `auth.uid()`와 `members.auth_user_id`가 일치하고 `status='approved'`인 멤버. `is_admin()` = current_member의 role이 `super_admin` 또는 `admin`. **아래 표의 "admin"은 `is_admin()`(관리자 이상)을 뜻한다.**

| 테이블 | 조회 | 생성/수정/삭제 |
|---|---|---|
| companies | 자기 회사 | admin만 수정. 생성은 회사 생성 서버 액션(서버 전용) |
| departments | 자기 회사 | admin |
| members | 자기 회사 멤버 (pending 본인은 자기 행만) | 본인: 자기 프로필(role·status 제외) / admin: 직원의 status·부서 / role 변경·관리자 비활성화·최고 관리자 넘기기는 `super_admin`만, 서버 액션으로 (`roles-and-permissions.md` §3) |
| member_bank_accounts | 본인, 자기 회사 admin | 본인 |
| form_templates | 자기 회사 | admin |
| approval_lines, approval_line_steps | 자기 회사 | admin |
| account_titles, account_title_mappings | 자기 회사 admin | admin |
| billing_plans | 로그인 사용자 전체 | 서버 전용(시드) |
| corporate_cards | 자기 회사 멤버(별칭·끝 4자리·담당자만) | admin |
| credit_ledger | 자기 회사 admin | 서버 액션(업로드 차감, 회사 생성 지급)으로만 |
| member_invitations | 자기 회사 admin | admin. 토큰으로 가입하는 경로는 서버 액션 |
| monthly_closings | 자기 회사 admin | 서버 액션(다운로드 시 마감, 해제는 `super_admin`) |
| expense_claims | 본인 소명서 / 해당 소명서의 사전 검토자(claim_approvals에 지정된 멤버) / 자기 회사 admin | 본인: `draft`·`rejected` 상태에서만 수정, `draft`만 삭제. 상태·합계 컬럼은 서버 액션(RPC)으로만 |
| expense_items | 소속 소명서 열람 가능자 (계정과목 컬럼은 admin 화면에서만 표시) | 본인: 소속 소명서가 `draft`·`rejected`일 때만 추가·수정·삭제. 계정과목 컬럼은 서버 액션(상신 스냅샷, admin 개별 조정)으로만 |
| claim_approvals | 해당 소명서 열람 가능자 | 서버 액션(RPC)으로만 |
| notification_logs | 자기 회사 admin | 서버 전용 |

- 승인 대기(`pending`)·비활성(`inactive`) 멤버는 자기 member 행 외 회사 데이터에 접근할 수 없다.
- service role 키는 서버 코드(알림톡 발송, 회사 생성, export)에서만 사용한다.

## 4. Storage
| 버킷 | 공개 | 경로 규칙 | 접근 |
|---|---|---|---|
| `receipts` | 비공개 | `{company_id}/{member_id}/{claim_id}/{item_id}.{ext}` | 소속 소명서 열람 가능자. signed URL(유효 10분)로만 표시 |
| `form-templates` | 비공개 | `{company_id}/{uuid}.{ext}` | 자기 회사 admin |

- 허용 형식: 영수증 jpg/png/webp/pdf, 양식 jpg/png/pdf. 최대 10MB.
