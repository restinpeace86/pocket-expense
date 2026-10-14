# [Spec] 관리자 설정 — 회사 정보 · 정산 정책 · 초대

라우트: `/workspace/[id]/admin/settings` / 사이드바 [설정] 그룹의 첫 화면 (`admin-dashboard.md` 레이아웃)
데이터: `companies`

## 1. 회사 정보
- 회사명, 사업자등록번호.

## 2. 정산 정책
| 항목 | 컬럼 | 기본값 | 효과 |
|---|---|---|---|
| 1식 1인당 식대 한도 | `meal_limit_per_person` | 10,000원 | 일반 식대·출장 식비 모두 1인 한도 × 인원수 기준(D-040). 멤버별 예외 한도 가능(D-044, `admin-team-members.md` §4.C) |
| 한도 초과 처리 방식 | `meal_limit_mode` | 절사 | **절사**: 초과분을 개인 부담으로 잘라 지급 / **알림(자율 승인)**: 영수증 금액 그대로 지원하고 "한도 초과" 배지만 표시 (D-041) |
| 자차 km당 유류비 단가 | `fuel_rate_per_km` | 200원 | 자차 청구액 = 주행거리 × 단가(`spec/features/trip-expense.md`) |
| 청구 기한 | `claim_deadline_type`, `claim_deadline_days` | 사용 안 함 | 아래 §2.1 |

- 저장 시 "변경 내용은 이후 상신되는 경비부터 적용됩니다" 안내(D-018).

### 2.1 청구 기한 (D-031)
- 선택지: **사용 안 함** / **결제한 달의 말일까지** / **결제일로부터 N일 이내**(N: 1~90).
- 기한이 지난 경비도 상신은 **막지 않는다**. 대신 다음처럼 표시한다:
  - 직원 작성 화면: "청구 기한(10/31)이 지났습니다. 지출 목적에 사유를 남겨 주세요" 노란 경고.
  - 결재 화면·관리자 소명서 목록: 해당 항목과 소명서에 "기한 초과" 확인 포인트 배지.
- 기한 초과 여부는 항목별로, 상신 시점(`submitted_at`, 미상신이면 현재) 기준으로 화면에서 계산하며 따로 저장하지 않는다.

## 3. 직원 초대
- 초대 링크 복사, QR 보기/다운로드(PNG), [초대 코드 재발급](이전 링크 즉시 무효). 멤버 관리 화면과 같은 기능.

## 4. 같은 [설정] 그룹의 다른 화면
- 계정과목: `/admin/account-titles` (`admin-dashboard.md` ⑪)
- 부서: `/admin/departments` (`admin-dashboard.md` ⑤)
- 결재라인: `/admin/approval-lines` (`admin-dashboard.md` ⑥)
- 사내 양식: `/admin/form-template` (`template-configuration.md`)
- 알림 이력: `/admin/notifications` (`admin-dashboard.md` ⑩)
