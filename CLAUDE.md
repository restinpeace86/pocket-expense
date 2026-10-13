# 프로젝트 기술 환경

## Tech Stack
- Frontend: Next.js (App Router), TypeScript, TailwindCSS, lucide-react
- Backend Platform: Supabase
- Database: PostgreSQL (via Supabase)
- Authentication: Supabase Auth (Kakao OAuth, Google OAuth) — 휴대폰 번호 인증은 사용하지 않는다
- Storage: Supabase Storage (비공개 버킷)
- AI: Google Gemini API (Vision — 영수증 파싱, 사내 양식 분석)
- 외부 API: Kakao Local API(주소→좌표), Kakao Mobility 길찾기 API(주행거리), 카카오 알림톡(발송대행사 경유)
- Test: Vitest
- Deployment: Vercel

## Agent Commands
- 개발 서버 실행: `npm run dev`
- 타입 체크: `npx tsc --noEmit`
- 테스트 실행: `npm run test`
- 빌드: `npm run build`

> 위 명령은 `implementation/todo.md`의 "T0. 프로젝트 스캐폴딩" 완료 후 사용 가능하다. T0 완료 전에는 검증 루프 대신 T0을 먼저 수행한다.

---

## Autonomous Harness Loop Rules (자율 하네스 실행 규칙)

요구사항 구현이나 코드 수정을 진행할 때는 사용자에게 따로 물어보지 말고 아래 무인 자율 프로세스를 엄격히 준수할 것:

0. **사전 준수 확인 (Pre-check) — 구현 착수 전 반드시 먼저 수행:**
   - 작업을 시작하기 전에 `implementation/todo.md`를 읽고, 지금 하려는 작업(또는 관련 상위 항목)에 `보류`, `미결`, `구현 보류`, `awaiting-decision`, `임의로 구현 가능으로 바꾸지 말 것` 등 홀드 표시가 있는지 확인하라.
   - 이 문서(제3장 임의 판단 금지·추측 금지, 제7장 금지 사항)나 `project/decision-log.md`의 Decision과 지금 하려는 작업이 상충하는지 확인하라. `decision-log.md`의 "미결 사항(Open)" 목록에 걸린 작업도 홀드로 취급한다.
   - 홀드 표시가 있거나 상충이 발견되면 **해당 작업은 구현하지 말고 즉시 중단**하라. 검증 루프나 다른 작업으로 넘어가지 말고 아래 순서를 그대로 수행하라:
     1. `implementation/todo.md`에 어떤 작업을 왜 스킵했는지(어떤 홀드/Decision과 상충하는지) 구체적으로 적는다.
     2. 그 변경만 커밋하고(`git commit -m "docs: [Harness Auto] <작업명> 스킵 - <이유 요약>"`) 원격에 푸시한다.
     3. 스킵 알림을 전송한다(인자 없이 실행하면 "작업 완료"로 오인되므로 반드시 인자를 넘길 것):
        ```bash
        node scripts/notify-discord.mjs "⏭️ [PocketExpense] 작업 스킵 알림" "<스킵한 작업명>: <스킵 이유 요약>" "⏭️ Skipped (홀드/Decision 상충)"
        ```
   - 이 사전 확인은 작업을 새로 받을 때마다 스스로 수행하며, 지시문에 언급되지 않아도 생략하지 않는다.

1. **검증 순서 (Validation Loop):**
   코드 수정이 완료되면 아래 순서로 검증을 스스로 연속 수행하라.
   - 1단계: `npx tsc --noEmit` (타입 체크)
   - 2단계: `npm run test` (테스트 실행)
   - 3단계: `npm run build` (프로덕션 빌드 검증)
   *(에러 발생 시 스스로 원인을 분석·수정한 뒤 1단계부터 다시 수행할 것)*

2. **자동 커밋 & 원격 푸시 (Commit & Push):**
   - 3단계까지 통과하면 즉시 커밋하고 원격(`https://github.com/restinpeace86/pocket-expense`)에 푸시하라.
     ```bash
     git add .
     git commit -m "feat: [Harness Auto] <구현내용 요약>"
     git push origin main
     ```

3. **디스코드 알림 전송:**
   - Push 완료 후 즉시 실행한다.
     ```bash
     node scripts/notify-discord.mjs "✅ [PocketExpense] 작업 완료 알림" "<구현내용 요약>" "✅ Passed (tsc, test, build)"
     ```

---

# 프로젝트 헌법

## 제1장. 프로젝트 존재 이유

### 제1조. 프로젝트의 목적
PocketExpense는 5~30인 소기업·스타트업·비영리 단체가 **영수증 한 장으로 경비 청구부터 결재, 세무사무소 전달까지** 끝낼 수 있게 하는 모바일 웹 경비 정산 SaaS이다.
모든 기획, 구현, 검수는 "직원의 청구 수고, 결재자의 확인 수고, 월말 마감 수고를 줄인다"는 목적을 최우선 기준으로 한다.

### 제2조. 단일 파이프라인
PocketExpense는 범용 그룹웨어가 아니다.
**[사내 양식 등록 → 영수증 여러 장 촬영·파싱 → 지출소명서(헤더 + 영수증 항목 표) 자동 채움 → 결재라인 상신 → 카카오 알림톡 결재 → 세무 패키지 출력]** 이라는 하나의 파이프라인에 집중한다.

### 제3조. 범위 원칙
`spec/`에 정의된 기능이 현재 구현 범위의 전부이다. 범위 밖 기능은 구현하지 않고 제안한다.


## 제2장. 프로젝트 철학

### 제1조. 사용자 수고 최소화
직원은 촬영과 확인만, 결재자는 알림톡 터치와 승인만, 관리자는 월말 다운로드 한 번으로 끝나야 한다.

### 제2조. 돈과 증빙의 정확성
금액 계산(식대 분할, 유류비, 부가세)과 영수증 원본 보존은 편의보다 우선한다. 계산 기준값은 계산 시점 값으로 스냅샷 저장하여 사후 규칙 변경이 과거 청구를 바꾸지 않게 한다.

### 제3조. AI는 보조 역할
AI(Vision LLM) 결과는 초안이다. 사람이 확인·수정한 값이 최종값이며, 최종 책임은 사람에게 있다.

### 제4조. 회사 간 데이터 격리
모든 데이터는 `company_id` 기준으로 격리한다. 타사 데이터가 노출될 가능성이 있는 구현은 기능 완성보다 우선해서 막는다.

### 제5조. 단순함과 신뢰성
화면과 흐름은 단순하게 유지하고, 외부 연동(파싱, 거리 계산, 알림톡)이 실패해도 서비스가 멈추지 않게 한다.


## 제3장. 의사결정 원칙

### 제1조. 사용자 가치 우선
사용자 가치와 개발 편의가 충돌하면 사용자 가치를 우선한다.

### 제2조. Spec 우선
모든 구현은 최신 Spec을 기준으로 한다. Spec에 없는 기능은 구현하지 않는다.

### 제3조. 단일 출처(Single Source of Truth)
- 데이터 구조(테이블·컬럼·enum)는 `spec/data/schema.md`만이 기준이다.
- 상태 전이와 결재 규칙은 `spec/data/expense-lifecycle.md`만이 기준이다.
- 다른 문서에 같은 내용이 다르게 적혀 있으면 위 두 문서를 따르고, 불일치를 `implementation/todo.md`에 기록한다.

### 제4조. 추측 금지
Spec이 명확하지 않으면 임의로 판단해 구현하지 않는다. `project/decision-log.md`의 미결 사항으로 등록하고 해당 작업을 보류한다.


## 제4장. 역할과 책임

### 제1조. 기획 AI
서비스 구조, 기능 정의, 데이터 구조, Spec 작성 및 Review를 수행한다. 직접 구현하지 않는다.

### 제2조. 구현 AI
승인된 Spec을 기준으로 구현한다. 기획을 변경하거나 새 기능을 독자적으로 결정하지 않는다.

### 제3조. 서비스 내 역할
- **관리자(admin)**: 회사 설정, 멤버 승인, 결재라인·양식 설정, 정산완료 처리, 월말 출력을 담당한다.
- **결재자(approver)**: 결재라인에 지정된 멤버. 역할(role)이 아니라 결재라인 지정으로 결정된다.
- **직원(employee)**: 경비를 청구하고 결재 결과를 받는다.

### 제4조. 역할 침범 금지
기획 AI는 구현하지 않고, 구현 AI는 기획하지 않는다.


## 제5장. 구현 운영 원칙

### 제1조. 문서 우선순위
1. CLAUDE.md
2. project/ (overview, decision-log)
3. spec/data/
4. spec/common/
5. spec/features/, spec/screens/
6. implementation/
7. review/

상위 문서와 하위 문서가 충돌하면 상위 문서를 우선한다.

### 제2조. 임의 판단 금지
기능 추가·삭제, 사용자 흐름 변경, 데이터 구조 변경, 공개 범위 변경, 권한 변경은 Spec 수정 이후에만 진행한다.

### 제3조. 기존 구조 우선
새 구조보다 기존 구조 재사용을 우선하고 중복을 만들지 않는다.

### 제4조. 하드코딩 금지
회사별 규칙(식대 한도, 유류비 단가), 양식 필드, 결재라인, 부서는 코드에 하드코딩하지 않고 DB에서 관리한다. 외부 API 키는 환경변수로만 사용한다.

### 제5조. 외부 연동 어댑터
Vision LLM, Kakao Mobility, 알림톡은 각각 어댑터 모듈 뒤에 둔다. 실패 시 Spec에 정의된 Fallback을 따르며, 키가 없는 개발 환경에서도 앱이 동작해야 한다.

### 제6조. 구현 완료 기준
다음 절차를 모두 거친 상태를 "Review 요청 가능"으로 본다.
구현 → TypeScript 검증 → Test 검증 → Build 검증 → 실제 화면 확인 → Spec 일치 확인.
금액 계산 로직(식대 분할, 유류비, 부가세, 소명서 합계, 정산 방향)과 결재 상태 전이는 반드시 단위 테스트를 포함한다.
프로젝트에 없는 검증 명령을 임의로 만들어 실행하지 않는다.

### 제7조. 구현 기록
구현 완료 후 `implementation/`에 구현 대상, 일시, 변경 사항, 특이 사항을 기록한다.

### 제8조. 오류 처리
예상하지 못한 상황에도 서비스가 중단되지 않아야 하며, 사용자에게 토스트 또는 안내 문구로 알린다.

### 제9조. 자율 상태 관리 및 세션 복구
1. 모든 작업 시작 전 `implementation/todo.md`를 확인한다.
2. 받은 작업을 세분화해 `[ ]`로 등록하고 하나씩 진행한다.
3. Sub-task가 성공할 때마다 `[x]`로 변경한다.
4. 세션이 끊긴 뒤 재시작되면 홀드 표시가 없는 첫 번째 `[ ]` 항목부터 즉시 재개한다.


## 제6장. 검수 원칙
1. Spec 일치 여부를 기준으로 검수한다.
2. 직원·결재자·관리자 각각의 관점에서 목적 달성이 쉬운지 확인한다.
3. 화면뿐 아니라 데이터 생성·저장·연결 흐름과 RLS 격리를 검수한다.
4. 디자인보다 목적 달성을 우선한다.


## 제7장. 금지 사항
1. Spec 없는 기능 추가 금지
2. Spec에 정의된 화면 목적과 사용자 흐름의 임의 변경 금지
3. 정의되지 않은 비즈니스 규칙(특히 금액 계산·결재 규칙) 임의 생성 금지
4. 개발 편의를 위한 RLS 우회·공개 버킷 사용 금지 (service role 키는 서버 전용)
5. 승인된 Spec과 기획의 임의 변경 금지


# 문서 지도

| 경로 | 내용 |
|---|---|
| `project/overview.md` | 서비스 목적, 타겟, USP, 비즈니스 모델 |
| `project/decision-log.md` | 확정 결정 + 미결 사항(Open) |
| `spec/data/schema.md` | 테이블·컬럼·enum·RLS·Storage (데이터 단일 출처) |
| `spec/data/expense-lifecycle.md` | 지출소명서 상태 전이, 결재 진행, 금액 계산, 정산 방향 (규칙 단일 출처) |
| `spec/common/ui-rules.md` | 반응형, 디자인 시스템, 상태 배지, 로딩·에러 |
| `spec/common/routes.md` | 전체 라우트 맵과 접근 권한 |
| `spec/features/auth-onboarding.md` | 소셜 로그인, 회사 생성, 직원 가입, 멤버 승인 |
| `spec/features/roles-and-permissions.md` | 역할(admin/employee)·결재자·권한 매트릭스 |
| `spec/features/expense-claim-flow.md` | 지출소명서 작성 흐름 (영수증 N장 → 소명서 1건 → 일괄 결재) |
| `spec/features/form-template.md` | 사내 지출결의서 양식 분석·노코드 보정·자동 채움 |
| `spec/features/receipt-parser.md` | Vision LLM 영수증 파싱 |
| `spec/features/smart-meal.md` | 식대 인원수 기반 분할 |
| `spec/features/trip-expense.md` | 출장비 세부 유형, 자차 거리·유류비 |
| `spec/features/approval-workflow.md` | 결재라인 설정, 상신, 순차 결재 |
| `spec/features/kakao-alimtalk.md` | 알림톡 발송 시점·템플릿·실패 처리 |
| `spec/features/tax-export.md` | 월말 엑셀·영수증 ZIP·PDF 출력 |
| `spec/screens/landing-page.md` | 랜딩 페이지 |
| `spec/screens/admin-onboarding.md` | 회사 생성 위저드 |
| `spec/screens/employee-mobile.md` | 직원 화면 |
| `spec/screens/approver.md` | 결재자 화면 (알림톡 링크 진입) |
| `spec/screens/admin-dashboard.md` | 관리자 PC 화면 (사이드바, 홈, 경비, 멤버, 부서, 결재라인, 세무 마감, 알림 이력) |
| `spec/screens/admin-settings.md` | 관리자 설정: 회사 정보, 정산 정책, 청구 기한, 초대 |
| `spec/screens/template-configuration.md` | 사내 양식 설정 화면 (기본 양식 + AI 맞춤 양식) |
