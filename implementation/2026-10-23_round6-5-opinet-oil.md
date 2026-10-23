# 구현 기록 — 6차 개선사항 5: 오피넷 전국 평균 유가 기준 자차 유류비 (D-117)

- 구현 일시: 2026-10-23
- 근거: `implementation/todo_improvement.md` [개선사항 5], `project/decision-log.md` D-117
- Spec: `spec/features/trip-expense.md` §4.2, `spec/screens/admin-settings.md` §2

## 구현 대상
1. 유가 표 `oil_price_history`(날짜별 휘발유·경유·LPG) + 받기 기록 `oil_price_fetch_logs`
2. 매일 03:00(KST) 오피넷 `avgAllPrice.do` 호출 → B027/D047/K015 upsert, 오류 처리·기록
3. 관리자 설정: 계산 방식(km당 고정 단가 / 전국 평균 유가 기준), 기본 200원 근거 안내, 최근 유가 표시
4. 직원 [내 정보]: 차량 유종(휘발유·경유·LPG)
5. 금액 = 올림(출장 당일 유가 ÷ 12km/L × 총 주행 거리)

## 변경 사항
- DB
  - `058_oil_prices.sql`: 위 두 표, `companies.fuel_rate_mode`, `members.fuel_type`, `expense_items.applied_fuel_mode/price/type`, `private.oil_price_on(날짜, 유종)`(7일 안 최근 값), `recompute_claim` 재정의(유가 없으면 고정 단가로), RPC `set_company_fuel_mode`(관리자), `set_my_fuel_type`(본인)
  - `059_tax_export_fuel.sql`: `tax_month_export`에 유가 스냅샷 열 추가
  - 테스트 `supabase/tests/039_oil_prices.sql`(고정 40,000 / 경유 25,675·단가 128 / 휘발유 123.4km 17,278 / 유가 없음 → 고정 24,680, 권한)
- 서버
  - `src/lib/fuel/opinet.ts`(응답 해석·호출, 10초 제한, 5초 뒤 1회 재시도), `src/lib/fuel/sync.ts`(upsert + 기록, 키 없으면 실패만 기록)
  - `src/app/api/cron/nightly/route.ts`(영수증 정리 + 유가, `src/lib/receipts/purge.ts`로 분리), `vercel.json` 18:00 UTC
- 화면
  - `company-settings-form.tsx`: 계산 방식 라디오, 200원 근거, 최근 전국 평균·계산 예·출처
  - `profile-form.tsx`: 차량 유종 칩
  - `own-car-editor.tsx`, `claim-editor.tsx`: 유가 기준 안내 문구·왕복 미리 보기
  - `src/lib/expense/route.ts`: `fuelAmountByPrice`, `cardAmount`, `fuelOf`, 계산식 "(경유 1,540.5원 ÷ 12km/L) × 200km(왕복) = 25,675원" — 증빙 카드·PNG·세무 자료 공통

## 검증
- tsc / lint / unit 162 / DB 테스트 39 / build 통과, check:responsive 전 화면 가로 넘침 없음
- 로그인 E2E `.responsive/live/e2e-oil.mjs`: 관리자 유가 기준 저장, 직원 경유 저장, 편도 100km 왕복 → DB 25,675원(opinet·diesel·1540.5·단가 128), 카드 계산식 확인, 키 없는 새벽 작업은 실패 기록만 남기고 정상 응답. 테스트 유가(2026-01-02)·기록·임시 회사 삭제
- 회귀 E2E: owncar-inline, trip-company-car, claim-category, round3, round4 통과
  - `e2e-trip.mjs`(커밋 안 된 옛 스크립트)는 옛 카테고리 이름 "출장 경비"를 눌러서 실패 — 이번 변경과 무관, 같은 흐름은 위 두 스크립트가 덮음

## 특이 사항
- **실제 오피넷 호출 확인(2026-10-23)**: 사용자가 `OPINET_API_KEY`를 `.env.local`·Vercel에 등록. 로컬에서 새벽 작업(`/api/cron/nightly`)을 1회 실행 → `{oil:{ok:true, logDate:"2026-10-23"}}`, `oil_price_history`에 2026-10-23 휘발유 1,855.97 · 경유 1,842.18 · LPG 1,143.86(source opinet) 저장, `oil_price_fetch_logs` 성공 기록. 호출 한도 하루 300건 중 1건 사용. 이후 매일 03:00(KST) Vercel cron이 쌓는다.
- 유가 표는 회사와 무관한 공개 정보라 로그인 사용자 모두 읽기만 가능, 쓰기는 서버(service_role)만.
