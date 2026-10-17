# T3-2 회사·정책 설정

- 구현 일시: 2026-10-17
- 기준: `spec/screens/admin-settings.md` §1~§3, `spec/features/business-verification.md`, D-018, D-031, D-040, D-041, D-056, D-057, D-063

## 변경 사항
- DB (마이그레이션 `015_company_settings.sql`)
  - 보안 보완: 관리자가 `companies`의 회사명·사업자번호·정책 컬럼을 직접 UPDATE할 수 있던 권한 회수. 직접 UPDATE로 사업자번호를 바꾸면 국세청 판정(D-057)을 우회할 수 있었음
  - `update_company_settings(...)`: 관리자 이상, 호출자 소속 회사만. 검증(회사명 1~100자, 사업자번호 10자리, 식대 한도 0~1,000,000, 유류비 0~10,000, 청구 기한 N일 1~90). 사업자번호가 바뀐 경우에만 `private.check_business_number`로 재판정하고 상태·확인 시각 갱신. `days_after`가 아니면 N일은 비움
  - `event_bonus_acknowledged_at`은 기존대로 직접 갱신 가능
- 테스트 `supabase/tests/007_company_settings.sql`: 저장·검증 오류, 직접 UPDATE 차단, 직원 불가, 다른 회사 불변, enforce에서 폐업 번호 거부·체크섬 오류 거부·번호 미변경 시 재판정 없음·계속사업자 통과(상태 active)
- 변이 테스트: 재판정 제거, 권한 회수 제거 → 각각 FAIL로 잡음
- 서버: 국세청 조회 기록 `recordBusinessCheck`를 `src/lib/business/record.ts`로 옮겨 회사 등록·설정 저장이 같이 사용
- 화면 `/admin/settings`([설정 ▸ 지출 한도·정책]): 회사 정보, 식대 한도 + 초과 처리(절사/알림), 자차 km당 단가, 청구 기한(사용 안 함/말일/N일), 저장 시 "이후 상신 경비부터 적용" 안내, 직원 초대 카드(간단)
- 진위확인 모드는 운영자 설정이라 넣지 않음(사용자 확정, D-063)

## 검증
- typegen+tsc, `npm run test`(22개), `npm run lint`, `npm run build` 통과
- DB: dry-run → `db:migrate` → `test:db` 7종(…, COMPANY_SETTINGS_OK) → `db:types`
- 반응형: `/dev/preview/admin-settings` 포함 전 화면 4폭 가로 넘침 없음. 스크린샷에서 태블릿 [저장] 글자 세로 줄바꿈, N일 입력칸 늘어남 발견 → 수정 후 재확인

## 특이 사항
- 청구 기한 날짜 계산(N일의 기준일 포함 여부 등)은 직원 작성 화면(T6)에서 구현할 때 정한다. 설정 화면 예시는 계산 규칙을 단정하지 않게 적음

## 추가 (2026-10-17): 청구 기한 "결제한 다음 달 N일까지" + 설명 보강 (D-064)
- 사용자 결정: 국내 서비스(고위드·비즈플레이 등)의 범용 방식(월 마감 + 다음 달 초 여유)을 따른다
- DB: `016`(enum 값 `next_month_day` 추가 — 같은 트랜잭션에서 못 쓰므로 분리), `017`(제약: next_month_day면 N 1~28 필수, 새 회사 기본값 next_month_day·5, `update_company_settings` 검증 갱신)
- 테스트 007에 추가: N 29·null 거부, 저장, 새 회사 기본값
- 화면: `claim-deadline-section.tsx` — 무엇의 기한인지 / 왜 정해 두나요? / 선택지(추천 먼저, 10월 30일 영수증 예시, 선택지별 자기 N으로 예시) / 기한이 지나면?
- 진행 메모: `db:migrate`가 대기 중인 016·017을 함께 적용해 017의 dry-run이 적용 뒤에 실행됨. 적용 후 dry-run·`test:db` 7종 모두 통과
- 검증: tsc·test 22·lint·build, test:db 7종, 반응형 4폭 + 청구 기한 영역 스크린샷(선택 전환 포함) 확인. 선택하지 않은 선택지 예시에 다른 선택지의 N이 나오던 문제 발견 → 수정
