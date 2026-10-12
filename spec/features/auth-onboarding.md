# [Spec] 소셜 로그인 및 최초 온보딩(Workspace 매핑) 플로우

## 1. 개요
직원이 QR코드나 링크를 통해 모바일 웹에 최초 접속했을 때의 인증 및 소속 회사 연동 절차.

## 2. 인증 및 온보딩 단계 (User Journey)
1. **랜딩 및 로그인 화면 (`/login` 또는 루트)**:
   - "PocketExpense 시작하기" 화면 표시.
   - [카카오로 3초 만에 시작하기] 또는 [Google로 로그인] 버튼 제공.
   - Supabase Auth를 활용하여 OAuth 인증 수행.

2. **최초 가입 여부 체크 (Onboarding Check)**:
   - 로그인 직후, `users` 테이블에서 현재 로그인한 유로의 `auth_id`가 존재하는지 조회.
   - **기존 유저인 경우**: 곧바로 홈 화면(`/workspace/[id]/employee`)으로 리다이렉트.
   - **최초 방문 유저인 경우 (신규 직원)**: 온보딩 화면(`/onboarding`)으로 강제 이동.

3. **최초 1회 온보딩 폼 (`/onboarding`)**:
   - 입력 필드:
     - 본인 실명 (`name`)
     - 회사 초대 코드 또는 관리자에게 받은 Workspace ID (`company_code`)
   - [완료 및 시작하기] 버튼 클릭 시:
     - `users` 테이블에 새 레코드 생성 (`auth_id`, `name`, `company_id`, `role = 'employee'`).
     - 이후 정상 서비스 이용 가능.

## 3. 보안 및 RLS 연동 가이드
- 모든 Supabase 쿼리는 로그인된 유저의 `auth.uid()`와 `users.auth_id`를 조인하여, **자신이 소속된 `company_id`의 데이터만** 읽고 쓸 수 있도록 RLS(Row Level Security) 정책이 반드시 적용되어야 한다.