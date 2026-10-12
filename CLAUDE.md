# PocketExpense - 통합 마스터 스펙 문서 (Master Spec)

## 1. 프로젝트 개요 및 핵심 USP
- **목적**: 5인~20인 소기업, 스타트업 및 비영리 단체를 위한 모바일 웹 기반 초간편 경비 정산 SaaS.
- **핵심 강점 (3대 훅)**:
  1. **초기 도입비 및 고정 비용 제로 (Zero Cost)**: 네이버웍스나 비즈플레이 같은 무거운 그룹웨어의 인당 월 구독료와 설치비 부담을 없앰.
  2. **관리자 커스텀 양식 세팅 & AI 자동화 (Custom Format & LLM)**: 회사가 평소 쓰던 양식을 올리면 Vision LLM이 스키마를 추출하고, 관리자는 노코드 폼 빌더로 손쉽게 보정.
  3. **카카오 알림톡 실시간 결재 Flow**: 앱 설치 없이 카카오톡으로 결재 요청을 받고 터치 한 번에 승인/반려 완료.

---

## 2. 데이터베이스 스키마 설계 (Supabase PostgreSQL)
*복잡한 오버엔지니어링을 배제하고, 회사별 커스텀 양식을 유연하게 담기 위해 `JSONB` 구조를 채택.*

### ① `companies` (회사 테이블)
- `id` (UUID, PK)
- `name` (회사명)
- `invite_code` (직원 가입용 초대 코드)
- `max_meal_amount` (식대 지원 기본 한도, 예: 10000)
- `fuel_rate_per_km` (자차 km당 유류비 단가, 예: 200)
- `custom_schema` (JSONB) - 관리자가 세팅하거나 Vision LLM이 추출한 **회사별 커스텀 양식 필드 정의서**
- `created_at` (Timestamp)

### ② `users` (직원/관리자 테이블)
- `id` (UUID, PK)
- `auth_id` (Supabase Auth UID 연동)
- `company_id` (소속 회사 UUID - FK)
- `name` (실명)
- `department` (부서명)
- `role` ('employee' | 'admin')
- `status` ('pending' 대기중 | 'approved' 승인됨)
- `created_at` (Timestamp)

### ③ `expenses` (지출결의서 청구 테이블)
- `id` (UUID, PK)
- `company_id` (FK), `user_id` (FK)
- `category` ('meal' 식대 | 'trip' 출장비 | 'meeting' 미팅비)
- `amount` (총 청구 금액)
- `merchant_name` (가맹점/상호명)
- `expense_date` (결제 일자)
- `receipt_url` (Supabase Storage 영수증 이미지 주소)
- `status` ('draft' 작성중 | 'submitted' 제출완료 | 'approved' 승인완료 | 'rejected' 반려됨 | 'paid' 정산완료)
- `company_supported_amount` (식대 등 회사 지원금)
- `personal_burden_amount` (식대 등 개인 부담금)
- `trip_distance_km` (출장비 자차 주행거리)
- `custom_payload` (JSONB) - 회사의 `custom_schema`에 맞춰 입력된 **실제 커스텀 필드 값들**
- `rejection_reason` (반려 시 관리자가 입력한 사유)
- `created_at` (Timestamp)

---

## 3. 핵심 기능별 상세 명세

### ① 관리자 커스텀 양식 세팅 (Custom Format & Form Builder)
- **양식 업로드**: 관리자가 기존 사내 지출결의서 문서(이미지/PDF)를 업로드.
- **AI 스키마 추출**: Gemini Vision LLM이 분석해 필요한 필드(예: 프로젝트 코드, 예산 과목 등)를 추출하여 `companies.custom_schema`에 저장.
- **노코드 보정 UI**: 관리자가 노션 블록처럼 필드명 수정, 타입 지정(텍스트/숫자/셀렉트), 필수 여부 체크, 추가/삭제를 직관적으로 수행 가능. 우측 실시간 프리뷰를 통해 직원 화면 미리 확인.

### ② 소셜 로그인 및 QR 온보딩 (`/onboarding`)
- **진입**: 기업 QR/링크 접속 ➔ 카카오/Google 소셜 로그인 (Supabase Auth).
- **매핑**: 최초 방문 유저는 본인 이름과 회사 초대 코드 입력 ➔ `users` 테이블에 등록 (`status = 'pending'`, 관리자 승인 후 활성화).
- **RLS 보안**: Supabase RLS 정책을 통해 `company_id` 기반으로 타사 데이터 철저 격리.

### ③ 카카오 알림톡 결재 Flow (Approval Workflow)
1. **신청 직후**: 직원이 [관리자에게 제출하기] 클릭 ➔ 관리자 카카오톡으로 청구 내역 요약 + **[웹에서 검토하기 링크]** 발송.
2. **검토 및 처리**: 관리자가 링크를 눌러 영수증 원본과 내역을 확인한 뒤 **[승인]** 또는 **[반려(사유 입력)]** 클릭.
3. **결과 안내**: 
   - 승인 시: 직원 카톡으로 "정산 대기 중" 알림톡 발송.
   - 반려 시: 직원 카톡으로 "반려 사유"와 함께 수정 모드 복귀 알림톡 발송.

### ④ Vision LLM 영수증 파싱 & 동적 폼 입력
- 영수증 촬영/업로드 시 1~3초 내에 상호명, 금액, 결제일자 추출 후 에디터 폼에 자동 입력 (Human-in-the-loop 수정 가능).
- 회사가 설정한 `custom_schema` 필드들이 모바일 입력 폼에 동적으로 렌더링됨.

### ⑤ 식대 스마트 분할 & 카카오내비 출장비
- **식대 분할**: `companies.max_meal_amount` 기준 초과 시 회사 지원금과 개인 부담금을 실시간 자동 분할 계산 및 인폼.
- **출장비 산정**: 출발지/도착지 주소 입력 ➔ 카카오 모빌리티 API로 주행거리(km) 산출 ➔ 회사 유류비 단가(`fuel_rate_per_km`)와 곱하여 자동 계산 (실패 시 수동 입력 Fallback).

### ⑥ 관리자 PC 대시보드 및 월말 세무 패키지 출력
- **PC 대시보드 (`>= 768px`, 2단 Split View)**: 전체 청구 현황 요약, 경비 승인/반려 검토, 사내 규칙(식대 한도, 유류비 단가) 설정.
- **월말 출력 (`/workspace/[id]/admin/export`)**: 승인된 건 기준 세무사무소용 표준 지출결의서 엑셀(`.xlsx`/`.csv`) 및 원본 영수증 PDF 패키지 일괄 다운로드.

---

## 4. UI/UX 및 반응형 레이아웃 규칙
- **직원용 모바일 웹 (`< 768px`)**: 하단 고정 CTA (`+ 새 경비 청구하기`), 터치 최적화 버튼 (`min-height: 44px` 이상).
- **상태 배지 표준**: 
  - `draft` (작성중: 회색) ➔ `submitted` (제출완료: 파랑) ➔ `approved` (승인완료: 초록) ➔ `paid` (정산완료: 보라).
- **인터랙션**: 비동기 API 통신 시 로딩 스켈레톤 및 토스트 메시지 필수 적용.