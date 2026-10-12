# [Spec] 데이터 스키마 (단일 출처)

> 이 문서가 테이블·컬럼·enum의 유일한 기준이다. 다른 문서와 다르면 이 문서를 따른다. (D-001)
> 모든 테이블은 `id uuid PK default gen_random_uuid()`, `created_at`, `updated_at timestamptz`(updated_at 트리거)를 가진다. 아래 표에서는 생략한다.
> 금액은 모두 원 단위 정수(`integer`)다.

## 1. Enum

| 이름 | 값 |
|---|---|
| `member_role` | `admin`, `employee` |
| `member_status` | `pending`(승인 대기), `approved`(활성), `inactive`(비활성/퇴사) |
| `expense_category` | `meal`(식대), `trip`(출장비), `meeting`(외부 미팅비) |
| `payment_method` | `personal_card`(개인카드), `corporate_card`(법인카드) |
| `expense_status` | `draft`, `submitted`, `approved`, `rejected`, `paid` |
| `trip_type` | `own_car`(자차), `public_transport`(대중교통), `taxi`(택시), `lodging`(숙박), `toll_parking`(통행료·주차), `other`(기타) |
| `distance_source` | `api`(카카오 길찾기 산출), `manual`(직접 입력) |
| `approval_step_status` | `waiting`(앞 단계 대기), `pending`(내 차례), `approved`, `rejected`, `skipped`, `canceled` |
| `parse_status` | `none`, `success`, `failed` |
| `notification_status` | `queued`, `sent`, `failed` |

## 2. 테이블

### 2.1 `companies` — 회사(Workspace)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| name | text | not null | 회사명 |
| business_number | text | null | 사업자등록번호 |
| invite_code | text | not null, unique | 직원 초대 코드 (재발급 가능) |
| meal_limit_per_person | integer | not null, default 10000 | 1인당 식대 지원 한도 |
| fuel_rate_per_km | integer | not null, default 200 | 자차 km당 유류비 단가 |

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
| department_id | uuid | FK departments, null | 온보딩 필수 입력. 부서 삭제 시 null |
| position | text | null | 직급/직책 (선택) |
| employee_number | text | null | 사번 (선택) |
| vehicle_number | text | null | 차량번호 (선택, 자차 출장비용) |
| role | member_role | not null, default 'employee' | |
| status | member_status | not null, default 'pending' | |
| privacy_agreed_at | timestamptz | not null | 개인정보 수집·이용 동의 시각 |
| approved_at | timestamptz | null | 관리자 가입 승인 시각 |

### 2.4 `member_bank_accounts` — 정산 계좌 (선택, 민감정보 분리)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| member_id | uuid | FK members, unique | |
| company_id | uuid | FK companies | RLS용 |
| bank_name | text | not null | |
| account_number | text | not null | |
| account_holder | text | not null | 예금주 |

### 2.5 `form_templates` — 사내 지출결의서 양식 (D-019)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies | |
| version | integer | not null, unique(company_id, version) | 1부터 증가 |
| schema | jsonb | not null | 양식 정의 객체 (`spec/features/form-template.md` §3) |
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
| step_order | integer | not null, unique(approval_line_id, step_order) | 1부터 |
| approver_member_id | uuid | FK members, not null | `approved` 상태 멤버만 지정 가능 |

### 2.7 `expenses` — 경비 청구
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies, not null | |
| member_id | uuid | FK members, not null | 청구자 |
| form_template_id | uuid | FK form_templates, null | 작성 당시 활성 양식 |
| category | expense_category | not null | |
| payment_method | payment_method | not null | (D-010) |
| status | expense_status | not null, default 'draft' | |
| expense_date | date | null (상신 시 필수) | 결제/사용 일자. 출력 기준월 (D-016) |
| merchant_name | text | null | 가맹점명 (자차는 null 허용) |
| amount | integer | null (상신 시 필수) | 총 결제금액 |
| supply_amount | integer | null | 공급가액 (D-017) |
| vat_amount | integer | null | 부가세 (D-017) |
| headcount | integer | null, ≥1 | 인원수. `meal` 필수, `meeting` 선택 (D-009) |
| applied_meal_limit_per_person | integer | null | 계산 시점 1인 한도 스냅샷 (D-018) |
| company_supported_amount | integer | null | 회사 지원금 |
| personal_burden_amount | integer | not null, default 0 | 개인 부담금 |
| purpose | text | null | 지출 목적/적요. `meeting` 필수 |
| attendees | text | null | 참석자 (`meeting`) |
| client_name | text | null | 거래처/상대 회사명 (`meeting`) |
| receipt_path | text | null | Storage `receipts` 경로. `own_car` 외 상신 시 필수 |
| parse_status | parse_status | not null, default 'none' | |
| ai_parsed_payload | jsonb | null | LLM 파싱 원본 결과 |
| trip_type | trip_type | null | `trip` 필수 |
| trip_start_date | date | null | 출장 시작일 |
| trip_end_date | date | null | 출장 종료일 (숙박 등) |
| start_location | text | null | 출발지 주소 (`own_car`) |
| start_lat / start_lng | numeric | null | 출발지 좌표 |
| end_location | text | null | 도착지 주소 (`own_car`) |
| end_lat / end_lng | numeric | null | 도착지 좌표 |
| is_round_trip | boolean | null | 왕복 여부 (기준 미결 O-04) |
| distance_km | numeric(8,1) | null | 주행거리 |
| distance_source | distance_source | null | |
| applied_fuel_rate_per_km | integer | null | 계산 시점 단가 스냅샷 (D-018) |
| custom_payload | jsonb | not null, default '{}' | 양식 커스텀 필드 입력값 `{ field_key: value }` |
| current_round | integer | not null, default 0 | 결재 회차 (상신마다 +1) |
| rejection_reason | text | null | 최근 반려 사유 |
| submitted_at / approved_at / rejected_at / paid_at | timestamptz | null | 상태 전이 시각 |
| paid_by_member_id | uuid | FK members, null | 정산완료 처리자 |

### 2.8 `expense_approvals` — 경비별 결재 진행 (스냅샷, D-012)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| expense_id | uuid | FK expenses, cascade | |
| company_id | uuid | FK companies | RLS용 |
| round | integer | not null | 결재 회차 |
| step_order | integer | not null, unique(expense_id, round, step_order) | |
| approver_member_id | uuid | FK members | |
| status | approval_step_status | not null | |
| comment | text | null | 반려 사유(반려 시 필수) / 승인 코멘트 |
| acted_at | timestamptz | null | |

### 2.9 `notification_logs` — 알림톡 발송 이력
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| company_id | uuid | FK companies | |
| expense_id | uuid | FK expenses, null | |
| recipient_member_id | uuid | FK members | |
| recipient_phone | text | not null | 발송 시점 번호 |
| template_code | text | not null | `spec/features/kakao-alimtalk.md` §3 |
| payload | jsonb | not null | 템플릿 변수 |
| status | notification_status | not null | |
| provider | text | not null | 발송 드라이버명 (`log` 포함) |
| provider_message_id | text | null | |
| error_message | text | null | |
| sent_at | timestamptz | null | |

## 3. RLS 정책 (전 테이블 RLS enable + 아래 정책 필수)
공통 헬퍼: `current_member()` = `auth.uid()`와 `members.auth_user_id`가 일치하고 `status='approved'`인 멤버.

| 테이블 | 조회 | 생성/수정/삭제 |
|---|---|---|
| companies | 자기 회사 | admin만 수정. 생성은 회사 생성 서버 액션(서버 전용) |
| departments | 자기 회사 | admin |
| members | 자기 회사 멤버 (pending 본인은 자기 행만) | 본인: 자기 프로필(role·status 제외) / admin: role·status·부서 |
| member_bank_accounts | 본인, 자기 회사 admin | 본인 |
| form_templates | 자기 회사 | admin |
| approval_lines, approval_line_steps | 자기 회사 | admin |
| expenses | 본인 경비 / 해당 경비의 결재자(expense_approvals에 있는 멤버) / 자기 회사 admin | 본인: `draft`·`rejected` 상태에서만 수정·삭제(`draft`만 삭제). 상태 전이는 서버 액션(RPC)으로만 |
| expense_approvals | 해당 경비 열람 가능자 | 서버 액션(RPC)으로만 |
| notification_logs | 자기 회사 admin | 서버 전용 |

- 승인 대기(`pending`)·비활성(`inactive`) 멤버는 자기 member 행 외 회사 데이터에 접근할 수 없다.
- service role 키는 서버 코드(알림톡 발송, 회사 생성, export)에서만 사용한다.

## 4. Storage
| 버킷 | 공개 | 경로 규칙 | 접근 |
|---|---|---|---|
| `receipts` | 비공개 | `{company_id}/{member_id}/{expense_id}/{uuid}.{ext}` | 해당 경비 열람 가능자. signed URL(유효 10분)로만 표시 |
| `form-templates` | 비공개 | `{company_id}/{uuid}.{ext}` | 자기 회사 admin |

- 허용 형식: 영수증 jpg/png/webp/pdf, 양식 jpg/png/pdf. 최대 10MB.
