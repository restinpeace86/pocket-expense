# [Spec] 라우트 맵 및 접근 권한

`[id]` = `companies.id`. 모든 `/workspace/[id]/**` 경로는 로그인 + 해당 회사의 `approved` 멤버만 접근할 수 있다. 다른 회사 id로 접근하면 본인 회사 홈으로 리다이렉트한다.

## 1. 공개 / 인증
| 경로 | 화면 | 접근 |
|---|---|---|
| `/` | 랜딩 → 로그인 상태에 따라 분기 | 전체 |
| `/login` | 카카오/Google 로그인. `?next=` 지원 | 비로그인 |
| `/join/[inviteCode]` | 초대 링크/QR 진입. 회사명 표시 후 로그인 → 직원 온보딩 | 전체 |
| `/onboarding` | 진입 분기: [초대 코드로 회사 합류] / [새 회사 만들기] | 로그인 + member 없음 |
| `/onboarding/join` | 직원 정보 입력 | 로그인 + member 없음 |
| `/onboarding/create-company` | 회사 생성 (첫 관리자) | 로그인 + member 없음 |
| `/onboarding/pending` | 승인 대기 안내 | `pending` 멤버 |
| `/auth/callback` | OAuth 콜백 | — |

로그인 후 분기: member 없음 → `/onboarding` / `pending` → `/onboarding/pending` / `inactive` → 이용 중지 안내 / `approved` → `next` 또는 `/workspace/[id]/employee`(admin은 `/workspace/[id]/admin`).

## 2. 직원 (모바일)
| 경로 | 화면 |
|---|---|
| `/workspace/[id]/employee` | 홈 / 내 경비 리스트 |
| `/workspace/[id]/employee/new` | 경비 작성 |
| `/workspace/[id]/employee/expenses/[expenseId]` | 경비 상세 (결재 타임라인, 수정·재상신) |
| `/workspace/[id]/employee/expenses/[expenseId]/edit` | `draft`·`rejected` 경비 수정 |
| `/workspace/[id]/employee/profile` | 내 정보 수정, 정산 계좌, 로그아웃 |

## 3. 결재자 (모바일 우선)
| 경로 | 화면 | 접근 |
|---|---|---|
| `/workspace/[id]/approvals` | 내 결재함 (대기 / 처리완료 탭) | 결재라인에 지정된 적 있는 멤버 (메뉴는 결재 대기·이력이 있을 때만 노출) |
| `/workspace/[id]/approvals/[expenseId]` | 결재 화면 (**알림톡 링크 도착지**) | 해당 경비의 결재자. 현재 차례가 아니면 읽기 전용 |

## 4. 관리자 (PC)
| 경로 | 화면 |
|---|---|
| `/workspace/[id]/admin` | 대시보드 홈 |
| `/workspace/[id]/admin/expenses` | 전체 경비 목록 |
| `/workspace/[id]/admin/expenses/[expenseId]` | 경비 상세 (읽기 + 정산완료 처리) |
| `/workspace/[id]/admin/members` | 멤버 관리 (가입 승인, 역할, 부서, 비활성) |
| `/workspace/[id]/admin/departments` | 부서 관리 |
| `/workspace/[id]/admin/approval-lines` | 결재라인 설정 |
| `/workspace/[id]/admin/form-template` | 사내 양식 업로드·보정·미리보기 |
| `/workspace/[id]/admin/settings` | 회사 정보, 식대 한도, 유류비 단가, 초대 링크/QR |
| `/workspace/[id]/admin/export` | 월말 마감·출력 |
| `/workspace/[id]/admin/notifications` | 알림톡 발송 이력 |

모든 `/admin/**` 경로는 `role = 'admin'`만 접근할 수 있다.
