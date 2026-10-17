# [Spec] 사업자등록번호 국세청 상태조회 (D-057)

관련: D-056, D-057 / 데이터: `private.app_settings`, `public.business_verifications`, `companies.business_status·business_verified_at` / 구현: `supabase/migrations/009_business_verification.sql`, `src/lib/business/nts.ts`, `src/app/onboarding/actions.ts`

## 1. 목적
회사 등록 시 입력한 사업자등록번호가 실제로 존재하고 영업 중인지 국세청에 확인해, 남의·가짜·폐업 번호로 회사가 만들어지는 것을 막는다. MVP 단계에서는 끄고 운영할 수 있어야 한다.

## 2. 외부 API
- 공공데이터포털 "국세청_사업자등록정보 진위확인 및 상태조회 서비스" — **상태조회** `POST https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey={키}&returnType=JSON`, 본문 `{"b_no": ["1234567890"]}`.
- 응답 `b_stt_cd`: `01` 계속사업자 → `active`, `02` 휴업자 → `suspended`, `03` 폐업자 → `closed`. 코드가 비고 `tax_type`이 "국세청에 등록되지 않은…"이면 `not_registered`. 그 외·실패는 `unverified`.
- 키: 환경변수 `NTS_SERVICE_KEY`(URL 인코딩된 일반 인증키, 서버 전용). 진위확인(`/validate`)은 개업일·대표자명이 필요해 현재 범위가 아니다.

## 3. 모드 (DB 설정 `private.app_settings`, 운영자가 SQL로 변경)
| `business_verify_mode` | 동작 |
|---|---|
| `off` (**현재 기본값**) | 조회·검사 안 함. 10자리 형식만 맞으면 통과. 회사 `business_status = 'skipped'` |
| `warn` | 조회해서 기록만, 등록은 통과. 체크섬 틀린 번호는 거부. 폐업·미등록도 통과하되 상태 `unverified` |
| `enforce` | 체크섬 오류 거부, **폐업 → `BUSINESS_CLOSED` 거부, 미등록 → `BUSINESS_NOT_REGISTERED` 거부**, 휴업 → 경고 상태(`suspended`)로 통과, 조회 실패(키 없음·API 장애) → `unverified`(확인 대기)로 통과 |

- **통과 구멍**: `business_verify_bypass_numbers`(쉼표 구분)에 넣은 번호는 어떤 모드에서도 체크섬·조회 없이 통과(`bypass`). 테스트·데모용.
- 판정은 `create_company`(DB) 안에서 한다. 화면을 거치지 않고 함수를 직접 불러도 피할 수 없다.
- 회사 설정에서 번호를 바꿀 때도 `update_company_settings`(DB)가 같은 판정을 한다. `companies.business_number`는 직접 UPDATE할 수 없다(D-063).
- 조회 결과는 서버가 service role로 `business_verifications`에 **사용자별로** 기록하고, DB는 **같은 사용자가 최근 30분 안에 조회한 결과**만 인정한다(다른 사람의 조회 결과를 빌려 쓸 수 없음). 앱 사용자는 이 테이블을 읽거나 쓸 수 없다.
- 휴업자 처리(경고 후 통과)는 Claude 제안으로 잠정 결정했다. 바꾸려면 D-057을 수정한다.

## 4. 운영 방법
```sql
-- 모드 변경 (off / warn / enforce)
update private.app_settings set value = 'enforce', updated_at = now() where key = 'business_verify_mode';
-- 통과 허용 번호 추가 (쉼표 구분, 하이픈 없이)
update private.app_settings set value = '1234567890,1112223334', updated_at = now() where key = 'business_verify_bypass_numbers';
```
실행: SQL 파일로 저장 후 `node scripts/supabase-sql.mjs --file <파일>`.
- `warn`·`enforce`를 배포 환경에서 쓰려면 Vercel에 `NTS_SERVICE_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`가 있어야 한다(없으면 조회를 건너뛰고 모두 `unverified`).

## 5. 검증
- `supabase/tests/003_business_verification.sql`(`npm run test:db`): enforce에서 계속사업자 통과·폐업/미등록 거부·남의 조회 결과 사용 불가·통과 구멍·체크섬 오류 거부, warn 통과, 앱 사용자의 조회 결과 테이블 읽기/위조 차단.
- `src/lib/business/nts.test.ts`: 상태 코드 변환(실제 응답 문구 포함), 키 없음 시 확인 대기.
