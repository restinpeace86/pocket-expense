# [Spec] 앱 화면 구조 (화면 목록 · 인덱스)

관련: `spec/common/workspace-architecture.md`(원칙), `spec/common/routes.md`(라우트·권한)
이 문서는 화면 목록만 정의한다. 각 화면의 상세 규칙은 오른쪽 문서가 기준이다.

## 1. 직원 워크스페이스 (Employee Workspace — Mobile First)
사내 직원이 스마트폰으로 영수증을 찍고, 지출소명서를 상신하고, 사비 정산 현황을 확인하는 공간.

| 화면 | 내용 | 상세 문서 |
|---|---|---|
| E-01 직원 메인 대시보드 | 헤더(관리자 모드 스위처), 이번 달 사비 정산 대기금, [📸 + 영수증 찍고 지출 올리기], 내 상신 내역 리스트(임시저장 / 검토 대기 / 승인 완료 / 반려됨 / 정산 지급 완료) | `screens/worker-dashboard.md` |
| E-02 영수증 스냅샷 & 지출소명서 작성 | 촬영·업로드(1장 또는 여러 장) → AI 파싱 → 결제수단(기본 법인카드) → 제목·카테고리·적요 → 임시저장 / 결재 상신 | `screens/worker-tax-processing.md` |
| E-03 개인 정산 내역 · 입금 타임라인 | 입금 대기 사비 / 이번 달 지급받은 정산금, 정산 대기 → 지급 완료 | `screens/worker-timeline.md` |
| 소명서 상세 · 내 정보 | 결재 타임라인, 반려 정보 / 프로필·정산 계좌 | `screens/employee-mobile.md` |
| 결재 화면 (모바일 카드형 승인 뷰) | 알림톡 링크 도착지(관리자·사전 검토자) | `screens/approver.md` |

## 2. 관리자 워크스페이스 (Admin Workspace — Responsive Web & Mobile)
사장님 또는 경리 담당자가 지출을 승인하고, 자금을 집행하고, 양식을 세팅하며, 세무 마감 패키지를 받는 공간.

| 화면 | 내용 | 상세 문서 |
|---|---|---|
| A-01 관리자 대시보드 | 직원 모드 스위처, 이번 달 총 지출액·승인 대기 건수·**미지급 사비 정산 총액**, 할 일, 카테고리 차트 | `screens/admin-dashboard.md` ① |
| A-01 지출 결재 관리 | 소명서 묶음 목록 + 상세(영수증 원본·AI 파싱 대조), [✅ 일괄 승인] / [❌ 반려] | `screens/admin-expense-approvals.md` |
| A-02 자금 집행 및 정산 지급 관리 | 승인된 사비 소명서 대기열, 계좌 확인, 일괄/개별 [💰 정산 지급 완료 처리] | `screens/admin-payouts.md` |
| A-03 AI 템플릿 스냅샷 · 3단 레이아웃 설정 | 양식 촬영·업로드 → Vision 파싱, 원본 / 필드 에디터 / 모바일 미리보기 | `screens/template-configuration.md` |
| A-04 세무 마감 패키지 다운로드 | 월 선택, 마감 검수 요약, [📦 세무사무소 마감 패키지 다운로드] | `screens/tax-closing.md` |
| A-05 요금제 및 구독 관리 | 무료 100장 사용량, 플랜 3종, **결제 비활성(무료 제공 기간)** | `screens/admin-billing.md` |
| 멤버 관리 | 초대, 권한, 개인별 한도, 퇴사 처리, 독촉 | `screens/admin-team-members.md` |
| 설정 허브 | 회사·정책, 부서, 결재라인, 양식, 계정과목, 요금제, 알림 이력 | `screens/admin-settings.md` §4 |

## 3. 공통 진입
| 화면 | 상세 문서 |
|---|---|
| 랜딩 페이지 | `screens/landing-page.md` |
| 회사 생성 위저드 | `screens/admin-onboarding.md` |
| 로그인·직원 가입 | `features/auth-onboarding.md` |
