# [Spec] 라우트 맵 및 접근 권한

`[id]` = `companies.id`. 모든 `/workspace/[id]/**` 경로는 로그인 + 해당 회사의 `approved` 멤버만 접근할 수 있다. 다른 회사 id로 접근하면 본인 회사 홈으로 리다이렉트한다.

## 1. 공개 / 인증
| 경로 | 화면 | 접근 |
|---|---|---|
| `/` | 랜딩 페이지(`spec/screens/landing-page.md`). 로그인 상태면 아래 분기 | 전체 |
| `/login` | 카카오/Google 로그인. `?next=` 지원 | 비로그인 |
| `/terms` | 서비스 이용약관 (초안, D-059) | 전체 |
| `/privacy` | 개인정보 처리방침 (초안, D-059) | 전체 |
| `/dev/preview/[screen]` | 반응형 점검용 미리보기. `ENABLE_UI_PREVIEW=1`일 때만, 아니면 proxy에서 404 | 개발 전용 |
| `/join/[inviteCode]` | 공용 초대 링크/QR 진입. 회사명 표시 후 로그인 → 직원 온보딩 → 승인 대기 | 전체 |
| `/join/i/[token]` | 개별 초대 링크 진입(D-042). 로그인 → 미리 채워진 정보 확인 → 즉시 활성 | 전체 |
| `/onboarding` | 진입 분기: [초대 코드로 회사 합류] / [새 회사 만들기] | 로그인 + member 없음 |
| `/onboarding/join` | 직원 정보 입력 | 로그인 + member 없음 |
| `/onboarding/create-company` | 회사 생성 위저드 (`spec/screens/admin-onboarding.md`) | 로그인 + member 없음 |
| `/onboarding/pending` | 승인 대기 안내 | `pending` 멤버 |
| `/auth/callback` | OAuth 콜백 | — |

로그인 후 분기: member 없음 → `/onboarding` / `pending` → `/onboarding/pending` / `inactive` → 이용 중지 안내 / `approved` → `next` 또는 역할별 워크스페이스: 관리자 이상(`super_admin`, `admin`)은 관리자 워크스페이스 `/workspace/[id]/admin`, 직원은 직원 워크스페이스 `/workspace/[id]/employee`.

## 2. 직원 (모바일)
| 경로 | 화면 |
|---|---|
| `/workspace/[id]/employee` | E-01 직원 메인 대시보드 (`worker-dashboard.md`) |
| `/workspace/[id]/employee/claims/new` | `draft` 결의서 생성 후 편집 화면으로 리다이렉트 |
| `/workspace/[id]/employee/claims/[claimId]` | 결의서 상세 (결재 타임라인, 반려 정보) |
| `/workspace/[id]/employee/claims/[claimId]/edit` | E-02 결의서 작성·편집 (`worker-tax-processing.md`) |
| `/workspace/[id]/employee/claims/[claimId]/items/[itemId]` | 영수증 항목 편집 |
| `/workspace/[id]/employee/settlements` | E-03 정산 내역 · 입금 타임라인 (`worker-timeline.md`) |
| `/workspace/[id]/employee/profile` | 내 정보 수정, 정산 계좌, 로그아웃 |

## 3. 결재자 (모바일 우선)
| 경로 | 화면 | 접근 |
|---|---|---|
| `/workspace/[id]/approvals` | 내 결재함 (대기 / 처리완료 탭) | 사전 검토자로 지정된 적 있는 멤버, 관리자 이상 |
| `/workspace/[id]/approvals/[claimId]` | 결의서 결재 화면 (**알림톡 링크 도착지**) | 해당 결의서의 사전 검토자 또는 관리자 이상. 처리 권한이 없으면 읽기 전용 |

## 4. 관리자 (PC)
| 경로 | 화면 |
|---|---|
| `/workspace/[id]/admin` | 대시보드 홈 |
| `/workspace/[id]/admin/claims` | 지출 승인 관리 (`spec/screens/admin-expense-approvals.md`) |
| `/workspace/[id]/admin/claims/[claimId]` | 지출 승인 관리에서 결의서 선택 상태(딥링크) |
| `/workspace/[id]/admin/members` | 멤버 관리 (`spec/screens/admin-team-members.md`) |
| `/workspace/[id]/admin/members/[memberId]` | 멤버 상세·편집 (기본 정보, 권한, 퇴사 처리 — `admin-team-members.md` §4.B~D) |
| `/workspace/[id]/admin/departments` | 부서 관리 |
| `/workspace/[id]/admin/approval-lines` | 사전 검토 결재라인 설정 (선택 기능, D-039) |
| `/workspace/[id]/admin/form-template` | 사내 양식 설정 (`spec/screens/template-configuration.md`) |
| `/workspace/[id]/admin/settings` | 회사 정보, 식대 한도, 유류비 단가, 청구 기한, 초대 링크/QR (`spec/screens/admin-settings.md`) |
| `/workspace/[id]/admin/corporate-cards` | 법인카드 등록 (선택 기능, `spec/features/corporate-cards.md`) |
| `/workspace/[id]/admin/account-titles` | 계정과목 목록·내부 분류 매핑 (`spec/features/account-titles.md`) |
| `/workspace/[id]/admin/payouts` | A-02 정산 지급 관리 (`spec/screens/admin-payouts.md`) |
| `/workspace/[id]/admin/billing` | A-05 요금제 (`spec/screens/admin-billing.md`) |
| `/workspace/[id]/admin/export` | 세무 마감 (`spec/screens/tax-closing.md`) |
| `/workspace/[id]/admin/notifications` | 알림톡 발송 이력 |

모든 `/admin/**` 경로는 관리자 이상(`super_admin`, `admin`)만 접근할 수 있다(D-038).
