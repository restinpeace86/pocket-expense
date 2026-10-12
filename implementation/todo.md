# Implementation Todo (`pocket-expense`)

> 규칙: CLAUDE.md 하네스 Pre-check 수행 → 홀드 표시 없는 첫 `[ ]`부터 순서대로 진행.
> 홀드 표시: `⛔ 보류(O-xx)` — `project/decision-log.md` 미결 사항. 해당 항목만 건너뛴다.
> 각 항목의 기준 문서를 반드시 읽고 구현한다.

## 하네스 구축 (완료)
- [x] GitHub 원격 연결 (`restinpeace86/pocket-expense`)
- [x] CLAUDE.md 하네스 규칙 + 헌법 정비
- [x] project/ (overview, decision-log) 작성
- [x] spec/ 충돌 정리 및 재작성 (data, common, features, screens)
- [x] `scripts/notify-discord.mjs` 추가

## T0. 프로젝트 스캐폴딩 — 기준: CLAUDE.md Tech Stack
- [ ] T0-1 Next.js(App Router, TS, Tailwind, ESLint) 초기화 (현재 디렉터리, 기존 문서 보존)
- [ ] T0-2 lucide-react, @supabase/ssr, @supabase/supabase-js 설치 및 서버/브라우저 클라이언트 유틸
- [ ] T0-3 Vitest 설치, `npm run test` 스크립트 추가, 샘플 테스트 1개
- [ ] T0-4 `.env.example`에 필요한 키 이름 정리 (값 없이): Supabase, `GEMINI_API_KEY`, `KAKAO_REST_API_KEY`, Kakao OAuth, `ALIMTALK_DRIVER`, `NEXT_PUBLIC_SITE_URL`, `DISCORD_WEBHOOK_URL`
- [ ] T0-5 `.env.local`에서 이 프로젝트와 무관한 키(T맵, 네이버 등) 제거 여부 확인 후 기록 (값을 커밋하지 말 것)
- [ ] T0-6 검증 루프(tsc → test → build) 1회 통과 확인

## T1. DB 스키마 — 기준: `spec/data/schema.md`, `spec/data/expense-lifecycle.md`
- [ ] T1-1 `supabase/migrations/001_initial_schema.sql` 재작성 (enum, 테이블, updated_at 트리거, 제약)
- [ ] T1-2 RLS 정책 + `current_member()` 헬퍼
- [ ] T1-3 Storage 버킷(`receipts`, `form-templates`) 및 정책
- [ ] T1-4 상태 전이 RPC/서버 함수 골격 (상신, 승인, 반려, 정산완료)
- [ ] T1-5 Supabase 적용 및 TypeScript 타입 생성
- [ ] T1-6 RLS 격리 테스트 (타사 데이터 접근 불가 확인)

## T2. 인증·온보딩 — 기준: `spec/features/auth-onboarding.md`, `spec/common/routes.md`
- [ ] T2-1 카카오/Google 로그인, `/auth/callback`, 로그인 후 분기 미들웨어
- [ ] T2-2 회사 생성 플로우 (첫 관리자, invite_code 발급)
- [ ] T2-3 `/join/[inviteCode]` 진입 + 직원 정보 입력 + 개인정보 동의
- [ ] T2-4 승인 대기 화면

## T3. 관리자 기본 — 기준: `spec/screens/admin-dashboard.md` ④⑤⑧
- [ ] T3-1 관리자 레이아웃(사이드바, Split View, 모바일 접힘)
- [ ] T3-2 회사 설정 (식대 한도, 유류비 단가, 초대 링크·QR·재발급)
- [ ] T3-3 부서 관리
- [ ] T3-4 멤버 관리 (승인/거절, 역할, 부서, 비활성화 규칙)

## T4. 결재라인 설정 — 기준: `spec/features/approval-workflow.md` §2, admin ⑥
- [ ] T4-1 기본/부서별 결재라인 CRUD + 단계 편집
- [ ] T4-2 청구자 기준 결재라인 선택 함수 + 단위 테스트

## T5. 사내 양식 — 기준: `spec/features/form-template.md`, admin ⑦
- [ ] T5-1 양식 업로드 + Gemini 분석 어댑터 (실패 Fallback)
- [ ] T5-2 블록형 필드 편집기 + 바인딩 지정
- [ ] T5-3 지출결의서 렌더러(공용) + 기본 양식 + 미리보기
- [ ] T5-4 버전 저장/활성화

## T6. 경비 작성 — 기준: `spec/screens/employee-mobile.md` ①②④, `spec/features/receipt-parser.md`, `spec/features/smart-meal.md`
- [ ] T6-1 직원 홈 / 경비 리스트
- [ ] T6-2 경비 작성 폼 골격 (카테고리, 결제수단, 임시저장, 수정, 삭제)
- [ ] T6-3 영수증 업로드 + Gemini 파싱 어댑터 + 빈 필드 자동 채움 + 실패 Fallback
- [ ] T6-4 식대 인원수 분할 계산 + 실시간 안내 + 단위 테스트
- [ ] T6-5 외부 미팅비 입력
- [ ] T6-6 회사 양식 고유 항목 동적 렌더링 + 지출결의서 미리보기
- [ ] T6-7 내 정보 (프로필, 정산 계좌, 차량번호)

## T7. 출장비 — 기준: `spec/features/trip-expense.md`
- [ ] T7-1 세부 유형별 입력·검증
- [ ] T7-2 자차: Kakao Local 주소 검색 + Kakao Mobility 거리 계산 어댑터
- [ ] T7-3 자차 유류비 계산 + 수동 입력 Fallback + `distance_source` + 단위 테스트
- [ ] T7-4 ⛔ 보류(O-04) 왕복 토글 및 왕복 거리 계산 — 편도/왕복 기준 미결. 임의로 구현 가능으로 바꾸지 말 것

## T8. 알림톡 — 기준: `spec/features/kakao-alimtalk.md`
- [ ] T8-1 `NotificationSender` 어댑터 + `log` 드라이버 + `notification_logs` 기록
- [ ] T8-2 템플릿 3종 메시지 빌더 + 1회 자동 재시도
- [ ] T8-3 ⛔ 보류(O-01) 실제 발송대행사 드라이버 — 대행사·템플릿 심사 미결. 임의로 구현 가능으로 바꾸지 말 것

## T9. 상신·결재 — 기준: `spec/data/expense-lifecycle.md`, `spec/features/approval-workflow.md`, `spec/screens/approver.md`
- [ ] T9-1 상신 검증 + 결재라인 스냅샷 + 본인 포함 결재라인 처리·결재 생략 승인(D-026) + 단위 테스트
- [ ] T9-2 승인/반려 (원자적 처리, 동시성) + 단위 테스트
- [ ] T9-3 결재 화면(알림톡 링크 도착지, 로그인 복귀, 상태별 표시)
- [ ] T9-4 내 결재함
- [ ] T9-5 직원 경비 상세 (결재 타임라인, 반려 사유, 재상신)
- [ ] T9-6 알림톡 발송 연결 (상신, 단계 승인, 최종 승인, 반려)

## T10. 월말 출력 — 기준: `spec/features/tax-export.md`, admin ⑨
- [ ] T10-1 대상 조회 + 미포함 경고
- [ ] T10-2 엑셀(전체 데이터 시트1, 합계, 요약 시트2)
- [ ] T10-3 ZIP 패키지 (영수증 파일명 규칙, 지출결의서 PDF, 한글 폰트)
- [ ] T10-4 ⛔ 보류(O-02) 더존/세무사랑 업로드 호환 매핑 — 업로드 템플릿 미확보. 임의로 구현 가능으로 바꾸지 말 것

## T11. 관리자 운영 화면 — 기준: `spec/screens/admin-dashboard.md` ①②③⑩
- [ ] T11-1 대시보드 홈 (체크리스트, 할 일, 이번 달 요약)
- [ ] T11-2 경비 목록 (필터, 확인 포인트 배지) + 정산완료 일괄 처리
- [ ] T11-3 경비 상세 (관리자)
- [ ] T11-4 알림 이력 + 재발송 + 개발 모드 배너

## 스킵 기록
(하네스가 스킵한 작업과 사유를 여기에 기록)
