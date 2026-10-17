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
- [x] T0-1 Next.js(App Router, TS, Tailwind, ESLint) 초기화 (현재 디렉터리, 기존 문서 보존)
- [x] T0-2 lucide-react, @supabase/ssr, @supabase/supabase-js 설치 및 서버/브라우저 클라이언트 유틸
- [x] T0-3 Vitest 설치, `npm run test` 스크립트 추가, 샘플 테스트 1개
- [x] T0-4 `.env.example`에 필요한 키 이름 정리 (값 없이): Supabase, `GEMINI_API_KEY`, `KAKAO_REST_API_KEY`, Kakao OAuth, `ALIMTALK_DRIVER`, `CREDIT_EVENT_BONUS_ENABLED`, `CREDIT_EVENT_BONUS_AMOUNT`, `NEXT_PUBLIC_SITE_URL`, `DISCORD_WEBHOOK_URL`
- [x] T0-5 `.env.local`에서 이 프로젝트와 무관한 키(T맵, 네이버 등) 제거 여부 확인 후 기록 (값을 커밋하지 말 것) → 무관 키 4개 확인, 사용자 확인 대기(기록: implementation/2026-10-16_T0-scaffolding.md)
- [x] T0-6 검증 루프(tsc → test → build) 1회 통과 확인

## T1. DB 스키마 — 기준: `spec/data/schema.md`, `spec/data/expense-lifecycle.md`
- [x] T1-1 `supabase/migrations/001_initial_schema.sql` 재작성 (enum, 테이블, updated_at 트리거, 제약)
- [x] T1-2 RLS 정책 + `current_member()`·`is_admin()` 헬퍼 + 최고 관리자 1명 제약
- [x] T1-3 Storage 버킷(`receipts`, `form-templates`) 및 정책
- [x] T1-7 `billing_plans` 시드(3종, 결제 불가), `credit_ledger`, 크레딧 원자적 차감 + 0장 시 이벤트 추가 지급 함수 + 단위 테스트 (D-046, D-054)
- [x] T1-4 상태 전이 RPC/서버 함수 골격 (상신, 승인, 반려, 정산완료) — 권한·회사 검사·결재 단계 스냅샷·결재 생략·정산 판정까지. 상세 항목 검증·금액 재계산·계정과목 스냅샷은 T9-1에서 보강
- [x] T1-5 Supabase 적용 및 TypeScript 타입 생성
- [x] T1-6 RLS 격리 테스트 (타사 데이터 접근 불가 확인)

## T2. 인증·온보딩 — 기준: `spec/features/auth-onboarding.md`, `spec/common/routes.md`
- [x] T2-0 랜딩 페이지 (`spec/screens/landing-page.md`: 소개 동영상 또는 목업 애니메이션)
- [x] T2-1 카카오/Google 로그인, `/auth/callback`, 로그인 후 분기 미들웨어(역할별 워크스페이스) — 실제 카카오·Google 로그인은 사용자 브라우저 확인 대기
- [x] T2-2 회사 생성 위저드 (무료 크레딧 100장 지급 포함) (`spec/screens/admin-onboarding.md`: 부서 태그, invite_code, 기본 결재라인=생성자, 대시보드 이동)
- [x] T2-3 `/join/[inviteCode]` 진입 + 직원 정보 입력 + 개인정보 동의
- [x] T2-4 승인 대기 화면
- [x] T2-5 이용약관·개인정보 동의 구조(전체/필수/선택, 팝업, 동의 기록), `/terms`·`/privacy` 초안 페이지 (D-059)
- [ ] T2-6 ⛔ 보류(O-07) 이용약관·개인정보 처리방침 본문 확정 — 전문가 검토 대기. 임의로 구현 가능으로 바꾸지 말 것

## T3. 관리자 기본 — 기준: `spec/screens/admin-dashboard.md` 0·⑤, `spec/screens/admin-team-members.md`, `spec/screens/admin-settings.md`, `spec/features/roles-and-permissions.md`
- [ ] T3-1 관리자 레이아웃(사이드바, Split View, 모바일 반응형) + 워크스페이스 스위처(D-049)
  - [x] T3-1a 사이드바(PC)·햄버거 메뉴(모바일) 레이아웃 + 관리자/직원 모드 전환 헤더 (2026-10-17)
  - [ ] T3-1b Split View (지출 승인 관리 화면과 함께, T7)
- [x] T3-0 직원 합류 흐름 우선 처리 (2026-10-17, 사용자 지시: 초대는 코드가 아니라 링크로 보낸다)
  - [x] 관리자 홈: 가입 승인 대기 안내 + 공용 초대 링크 카드(링크 복사·QR 이미지 저장·새 링크 만들기) + 무료 영수증 잔량
  - [x] 멤버 관리: 탭(전체·가입 승인 대기·비활성) + 가입 승인/거절 (`approve_member`·`reject_member`, 마이그레이션 012, `supabase/tests/004_member_admin.sql`)
- [ ] T3-9 요금제 화면 A-05 (사용량, 이벤트 지급 횟수, 플랜 3종, 결제 폼·버튼 비활성) + 이벤트 지급 배너 (`admin-billing.md`, D-054)
- [x] T3-2 회사·정책 설정 (1식 한도, 한도 초과 처리 방식 D-041, 유류비 단가, 청구 기한 D-031, 공용 초대 링크·QR·재발급 — 링크·QR·재발급은 T3-0에서 완료, 설정 화면에도 같은 카드 재사용) (2026-10-17, migration 015, `supabase/tests/007_company_settings.sql`, D-063)
- [x] T3-3 부서 관리 (추가·이름 변경·순서 변경·삭제, 삭제 시 인원·결재라인 경고) (2026-10-17)
- [x] T3-4 멤버 관리 (승인/거절 — T3-0에서 완료, 부서, 비활성화 규칙, 역할 변경·관리자 비활성화는 최고 관리자만, 최고 관리자 넘기기 — D-038) + 권한 단위 테스트 (2026-10-17)
  - [x] 멤버 상세·편집(이름·휴대폰·부서·직급·사번), 이름/부서 검색·부서 필터, 총/활성 인원
  - [x] 역할 변경·최고 관리자 넘기기(최고 관리자만), 비활성화(점검: 미정산 경고, 결재라인·검토 차례 차단) — migration 013, `supabase/tests/005_member_management.sql`, `src/lib/admin/capabilities.test.ts`
  - [x] T3-4r 비활성 멤버 다시 활성화 (D-062, migration 014, `supabase/tests/006_member_reactivation.sql`) (2026-10-17)
  - [x] 관리자 홈: 승인된 멤버가 본인뿐이면 초대 카드를 맨 위(안내 포함), 이후에는 아래로 간단히 (admin-dashboard.md ①-2) (2026-10-17)
- [ ] T3-6 개별 초대(초대 대기·알림톡/링크 복사·취소, `/join/i/[token]` 즉시 활성, D-042)
- [ ] T3-7 멤버 편집: 개인별 식대 예외 한도(D-044) (퇴사 처리 미정산 경고·차단은 T3-4에서 완료)
- [ ] T3-8 미제출자 독촉 알림(멤버별·일괄, 하루 1회, D-043)
- [ ] T3-10 법인카드 등록(선택: 별칭·끝 4자리·담당자, 전체 카드번호 미저장) 화면 (`corporate-cards.md`, D-055)
- [ ] T3-5 계정과목 목록·매핑 화면 + 회사 생성 시 기본값 생성 (`spec/features/account-titles.md`, D-036)

- [x] T3-11 화면 설명(도움말) 공통 규칙 적용 (D-065, ui-rules.md §6): 설정(회사 정보·식대 한도·유류비·청구 기한), 멤버 관리, 멤버 상세(권한·퇴사 처리), 부서, 초대 링크 카드 (2026-10-17)

- [x] T3-12 화면 색상 선택 A·B·C (D-066): 색 토큰화, 헤더 [색상], 모바일 관리자 메뉴 안 선택지, 첫 화면 전 적용 (2026-10-17)

- [x] T3-13 화면 색상 계정 저장 + 팔레트 7종 후보(대비 기준 통과) + 성능 측정 (D-067, migration 018, `supabase/tests/008_member_ui_theme.sql`) (2026-10-17)
- [x] T3-13b 팔레트 7종 모두 유지 (사용자 확정, 2026-10-17)
- [x] T3-2b 금액 입력 천 단위 쉼표 표시(식대 한도·유류비 단가, `AmountInput`) (2026-10-17)

- [x] T3-2c 식대 한도 "한도 없이 전액 지원"·자차 유류비 "사용 안 함"·홈 정산 정책 확인 카드·설정 화면 초대 카드 제거 (D-068, migration 019) (2026-10-17)
  - 직원 쪽 반영(전액 지원 계산, own_car 숨김·서버 거부)은 T6·T7에서 구현 — smart-meal.md §3, trip-expense.md §4 참고

- [x] T3-14 자가운전보조금 받음(멤버 편집)·계기판 사진 받기(설정) 선택 기능 (D-070, migration 020) (2026-10-17)
  - 직원 쪽 반영(own_car 차단 안내, 계기판 사진 첨부)은 T7에서 — trip-expense.md §4

## T4. 사전 검토 결재라인 설정 (선택 기능) — 기준: `spec/features/approval-workflow.md` §2, admin ⑥
- [ ] T4-1 기본(0단계)/부서별 결재라인 CRUD + 사전 검토 단계 편집 + 고정 "관리자 최종 승인" 표시
- [ ] T4-2 청구자 기준 결재라인 선택 + 단계 스냅샷(review + final) 함수 + 단위 테스트

## T5. 사내 양식 — 기준: `spec/features/form-template.md`, `spec/screens/template-configuration.md`
- [ ] T5-1 양식 업로드 + Gemini 분석 어댑터 (실패 Fallback)
- [ ] T5-2 블록형 필드 편집기 + 바인딩 지정
- [ ] T5-3 지출결의서 렌더러(공용) + 기본 양식(template-configuration §2) + 미리보기 + 기본 양식으로 되돌리기
- [ ] T5-4 버전 저장/활성화

## T6. 지출소명서 작성 — 기준: `spec/features/expense-claim-flow.md`, `spec/screens/worker-dashboard.md`(E-01), `spec/screens/worker-tax-processing.md`(E-02), `spec/screens/employee-mobile.md` ④⑤, `spec/features/receipt-parser.md`, `spec/features/smart-meal.md`
- [ ] T6-0 성능 기반(D-073, `spec/common/performance.md`): 브라우저에서 보관본 2000px·썸네일 320px 만들기, 한 번에 10장·동시 3건 업로드, signed URL 묶음 발급, 목록 커서 페이지네이션 공용 함수, AI 인식 자동 1회 재시도, 착수 시 bench 규모 확대 재측정
- [ ] T6-1 E-01 직원 메인 대시보드 (사비 정산 대기금, 상태 뱃지 5종, 반려 바텀시트, 크레딧 0 안내)
- [ ] T6-2 소명서 편집 골격 (헤더: 제목 자동 제안·소명 내용·결제수단 기본값·[출장 경비] 스위치와 출장지·기간·목적, 항목 표, 임시저장, 삭제) + 합계 서버 갱신 + 단위 테스트
- [ ] T6-3 영수증 다중 업로드(연속 촬영·다중 선택·PDF, 최대 30장) → 항목 생성 + Gemini 파싱 어댑터(동시 3건) + 빈 필드 자동 채움 + 사업자등록번호·증빙구분·카드 끝 4자리 추정(D-050, D-051, D-055) + 법인카드 자동 판별 + 업로드 시 크레딧 차감(D-046) + 카테고리·출장 세부 유형 추천(D-032, D-035: 출장 소명서는 출장비 고정) + 실패 Fallback
- [ ] T6-4 항목 편집 화면 (카테고리, 결제수단, 이전/다음 항목, 영수증 없이 항목 추가)
- [ ] T6-5 식대·출장 식비 1식 한도 분할(개인별 한도, 절사/알림 모드) + 실시간 안내 + 단위 테스트 (D-040, D-041, D-044)
- [ ] T6-6 외부 미팅비 입력
- [ ] T6-7 회사 양식 헤더·항목 고유 필드 동적 렌더링 + 지출소명서 미리보기
- [ ] T6-8 청구 기한 초과 경고 (항목 단위, D-031)
- [ ] T6-9 내 정보 (프로필, 정산 계좌, 차량번호)
- [ ] T6-10 E-03 정산 내역 · 입금 타임라인 (`worker-timeline.md`)

## T7. 출장비 — 기준: `spec/features/trip-expense.md` (D-035)
- [ ] T7-1 출장 세부 유형별 입력·검증 (출장 식비·대중교통·택시·통행료·주차·숙박·자차·기타, 출장 기간 밖 경고)
- [ ] T7-2 자차: Kakao Local 주소 검색 + Kakao Mobility 거리 계산 어댑터
- [ ] T7-3 자차 유류비 계산 + 수동 입력 Fallback + `distance_source` + 단위 테스트
- [ ] T7-4 왕복 토글(기본 왕복) 및 왕복 거리 × 2 계산 + 승인 화면 "왕복 · n km × 2" 표시 (D-069, O-04 해소)

## T8. 알림톡 — 기준: `spec/features/kakao-alimtalk.md`
- [ ] T8-1 `NotificationSender` 어댑터 + `log` 드라이버 + `notification_logs` 기록
- [ ] T8-2 템플릿 6종(`notification-rule.md`: 결재 요청·승인·반려·지급 완료·초대·독촉) 메시지 빌더 + 1회 자동 재시도
- [ ] T8-3 ⛔ 보류(O-01) 실제 발송대행사 드라이버 — 대행사·템플릿 심사 미결. 임의로 구현 가능으로 바꾸지 말 것

## T9. 상신·결재 (소명서 단위) — 기준: `spec/data/expense-lifecycle.md`, `spec/features/approval-workflow.md`, `spec/screens/approver.md`, `spec/screens/admin-expense-approvals.md`
- [ ] T9-1 상신 검증(소명서 + 전 항목, 실패 항목 반환) + 금액 재계산 + 계정과목 스냅샷(D-036) + 결재라인 스냅샷 + 본인 포함 결재라인 처리·결재 생략 승인(D-026) + 단위 테스트
- [ ] T9-2 사전 검토 승인/반려 + 관리자 최종 일괄 승인/반려(본인 제외, 먼저 처리한 사람 반영, 문제 항목 지목) — 원자적 처리 + 단위 테스트 (D-039)
- [ ] T9-3 결재 화면(알림톡 링크 도착지, 항목 리스트, 원본↔읽어낸 값 나란히 보기, "직원 수정" 표시(D-037), 영수증 모아보기, 로그인 복귀, 상태별 표시)
- [ ] T9-4 내 결재함 (사전 검토자·관리자)
- [ ] T9-7 [지출 승인 관리] PC 화면: 상태 탭, 25/75 분할, 법인/개인 배지, 계정과목, 한도 초과 배지, 정산 안내 열, 마감 요약, 정산완료 처리 (`admin-expense-approvals.md`)
- [ ] T9-5 직원 소명서 상세 (결재 타임라인, 반려 사유·지목 항목, 재상신)
- [ ] T9-6 알림톡 발송 연결 (상신, 단계 승인, 최종 승인, 반려, 지급 완료)
- [ ] T9-8 승인 시 정산 필요 여부 판정(정산 없음 → 바로 paid) + A-02 정산 지급 관리 화면·일괄 지급 완료 처리 (`admin-payouts.md`, D-047) + 단위 테스트

## T10. 세무 마감 — 기준: `spec/screens/tax-closing.md`, `spec/features/tax-export.md`
- [ ] T10-1 대상 조회(항목 결제일자 기준, 소명서 상태) + 미포함 경고
- [ ] T10-2 엑셀(시트1 지출내역: 영수증 1행 + 계정과목·사업자번호·증빙구분·확인 필요, 시트2 요약, 시트3 세무 업로드 초안 15컬럼 `tax-upload-format.md`)
- [ ] T10-3 ZIP 패키지 (`2026-10-003_20261015_가맹점_금액` 파일명 1:1 매칭 D-052, 소명서별 PDF, 한글 폰트) — 관리자 브라우저에서 묶기·진행률·실패분 재시도·약 500MB 넘으면 나눠 저장 (D-073, performance.md §5)
- [ ] T10-5 마감 잠금(다운로드 시 마감 완료, closed_month, 전월 추가분, 최고 관리자 마감 해제) + 단위 테스트 (D-045)
- [ ] T10-6 세무 마감 화면 (요약 칩, 낱개 미리보기, 미포함 경고)
- [ ] T10-4 ⛔ 보류(O-02) 세무사무소 확인 결과에 따른 시트3 컬럼 변경 — 세무사무소 답변 대기. 임의로 구현 가능으로 바꾸지 말 것

## T11. 관리자 운영 화면 — 기준: `spec/screens/admin-dashboard.md` ①②③⑩
- [ ] T11-1 대시보드 홈 (체크리스트, 초대 카드, KPI 3종·전월 대비, 할 일, 카테고리 차트)
- [ ] T11-3 지출 승인 관리 상세의 항목별 계정과목 개별 조정 (마감 항목 제외)
- [ ] T11-4 알림 이력 + 재발송 + 개발 모드 배너

## 스킵 기록
(하네스가 스킵한 작업과 사유를 여기에 기록)
