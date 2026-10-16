# 구현 기록 — T1. DB 스키마 · 회사 간 데이터 격리

- **구현 대상**: `implementation/todo.md` T1-1 ~ T1-7
- **구현 일시**: 2026-10-16
- **기준 문서**: `spec/data/schema.md`, `spec/data/expense-lifecycle.md`, CLAUDE.md 제2장 제4조(회사 간 데이터 격리 — 절대 원칙)

## 변경 사항
| 파일 | 내용 |
|---|---|
| `supabase/migrations/001_initial_schema.sql` | 폐기 스키마(빈 테이블 3개·enum 3개) 정리 후 enum 16종, 테이블 18개, 제약, 인덱스, `updated_at` 트리거 |
| `002_rls_policies.sql` | anon/authenticated 기본 권한 회수(이후 생성 객체 포함), `private` 스키마 헬퍼(`current_member_id`, `current_company_id`, `is_admin`, `is_super_admin`, `can_view_claim`, `can_edit_claim`), 전 테이블 RLS ENABLE+FORCE, 테이블·컬럼 단위 권한과 정책 |
| `003_storage.sql` | `receipts`(기존 **공개 버킷 → 비공개**로 변경), `form-templates` 비공개 버킷, 회사/멤버/소명서 폴더 기준 정책 |
| `004_rpc_functions.sql` | `submit_claim`, `approve_claim`, `reject_claim`, `mark_claims_paid`(authenticated), `consume_receipt_credit`(service_role 전용, 이벤트 추가 지급 포함) |
| `005_seed.sql` | 요금제 3종(`is_purchasable = false`) |
| `supabase/tests/001_tenant_isolation.sql` | 회사 간 격리 테스트(릴리스 차단) |
| `scripts/supabase-sql.mjs` + `npm run db:migrate / test:db / db:types` | Management API로 마이그레이션 적용(미적용분만), 격리 테스트 실행, 타입 생성 |
| `src/lib/supabase/database.types.ts` | 생성된 DB 타입, 브라우저·서버 클라이언트에 연결 |
| CLAUDE.md | 명령 추가, 검증 루프 2-1단계(DB 변경 시 드라이런 → 적용 → 격리 테스트 필수), 헌법 제2장 제4조 격리 원칙 구체화 |

## 격리 설계 (다층 방어)
1. **구조**: 회사 데이터 테이블 전부 `company_id NOT NULL` + 회사 데이터끼리 `(id, company_id)` 복합 외래키. 다른 회사의 소명서·멤버·카드·계정과목·부서를 가리키는 행은 DB가 거부한다. 영수증 경로는 `company_id/`로 시작해야 하는 CHECK 제약.
2. **권한**: anon은 `billing_plans` 열람만. authenticated도 테이블·컬럼별로 필요한 것만 부여. 상태·합계·영수증 경로·파싱 결과·카드 끝자리·계정과목·마감월·크레딧·역할·멤버 상태는 컬럼 권한 자체가 없다.
3. **RLS**: 전 테이블 ENABLE + FORCE. 회사 판별은 승인된 멤버만 반환하는 헬퍼로 한다. 승인 대기·비활성·외부인은 자기 멤버 행 외 아무것도 보지 못한다.
4. **서버 함수**: SECURITY DEFINER 함수는 호출자 멤버와 대상 행의 `company_id`를 다시 비교하고, 다른 회사 행이면 존재 여부를 숨기도록 `NOT_FOUND`로 통일. 일괄 지급은 한 건이라도 다른 회사·대상 아님이면 전체 거부.
5. **저장소**: 비공개 버킷, 경로 첫 폴더 = 회사, 둘째 = 멤버, 셋째 = 편집 가능한 소명서. 열람은 그 영수증 항목을 볼 수 있는 사람만.

## 검증
| 항목 | 결과 |
|---|---|
| 드라이런(마이그레이션 5개 + 격리 테스트를 한 트랜잭션에서 실행 후 ROLLBACK) | ✅ `TENANT_ISOLATION_OK` |
| **변이 테스트 1**: 회사 열람 정책을 "전체 허용"으로 바꿈 | ✅ 테스트가 `FAIL [A_EMP] companies: expected 1, got 2`로 잡아냄 |
| **변이 테스트 2**: 소명서 열람 정책을 "전체 허용"으로 바꿈 | ✅ `FAIL [A_EMP] claims: expected 1, got 2`로 잡아냄 |
| **변이 테스트 3**: 승인·반려 함수의 회사 검사 제거 | ✅ 그래도 B 관리자의 A 소명서 승인이 막힘 — 결재 기록의 복합 외래키(처리자 멤버 ↔ 소명서 회사)가 2차로 거부. 이중 방어 확인 |
| 실제 DB 적용 `npm run db:migrate` | ✅ 001~005 적용 |
| 적용 후 `npm run test:db` | ✅ `TENANT_ISOLATION_OK` |
| 적용 후 상태 | 테스트 데이터 잔존 0건, 버킷 2개 모두 비공개, RLS 꺼진/강제 안 된 테이블 0개, anon 권한 테이블 = `billing_plans`만 |

격리 테스트가 확인하는 것: A 직원·A 최고 관리자·A 승인 대기·B 최고 관리자·B 직원·외부인·비로그인 각각의 테이블별 열람 건수, 다른 회사로의 생성·수정·삭제 차단, 민감 칸 직접 변경 차단(상태·영수증 경로·크레딧·역할 상승), 다른 회사 폴더 업로드 차단, 다른 회사 소명서 상신·승인·반려·지급 차단, 다른 회사 건이 섞인 일괄 지급 전체 거부, 복합 외래키·경로 CHECK, 크레딧 이중 차감 방지·이벤트 추가 지급·이벤트 꺼짐 시 0장 차단, 정상 흐름(상신 → 승인 → 정산 대기 → 지급 완료).

## 특이 사항
1. 스키마 문서 대비 구현에서 추가한 것(격리용): `approval_line_steps.company_id`, `notification_logs.invitation_id`(초대 알림은 비회원이라 `recipient_member_id` null 허용). `spec/data/schema.md`에 반영했다.
2. 마이그레이션은 Supabase CLI 대신 Management API로 적용하며 `private.applied_migrations`에 기록한다. 같은 파일을 다시 적용하지 않는다.
3. `consume_receipt_credit`는 이벤트 설정(환경변수)을 서버가 넘기는 구조라 **service_role 전용**이다. 서버 코드는 세션 사용자의 멤버 id를 확인한 뒤 호출해야 한다.
4. 멤버의 부서·상태·역할 변경, 회사 생성, 초대 수락, 초대 코드 재발급은 컬럼 권한을 열지 않았다. T2·T3에서 서버 함수로 만든다.
5. 남은 일(T9-1): 상신 시 카테고리별 필수 항목 검증, 식대 한도·유류비 재계산, 계정과목 스냅샷.
