# 5차 — 정기 결제(D-110) + 법인카드 내역 대조(D-111), 출장 일비 보류

- 구현 일시: 2026-10-23 (사용자 지시: 정기 결제는 결제일마다 담당자 앞으로 내용이 채워진 결의서 + 관리자 등록 화면, 카드 내역 대조 진행, 출장 일비는 기록만)
- 정기 결제
  - DB `supabase/migrations/056_recurring_payments.sql`(운영 적용): `recurring_payments`(RLS 강제, 관리자만, 회사 복합 FK로 카드·담당자), 결의서 `recurring_payment_id`·`recurring_period`(기간당 하나), 알림 종류 RECURRING_READY, `private.recurring_due_period`, `generate_recurring_claims(p_today)`(service role 전용).
  - 서버: `/api/cron/recurring-payments`(CRON_SECRET, vercel.json 매일 22:00 UTC = 07:00 KST) → 생성 → `sendRecurringReady` 알림.
  - 화면: 관리자 `/admin/recurring`(등록·수정·사용 안 함, 일정·결제수단·담당자·다음 결의서·최근 결의서 상태), 메뉴 [설정 › 정기 결제], 결의서 화면 안내 "🔁 정기 결제로 자동으로 만든 결의서예요…". `src/lib/recurring/schedule.ts`(DB와 같은 규칙, 테스트 4개).
  - 테스트 `supabase/tests/037_recurring_payments.sql`(결제일 전·당일·중복·짧은 달 말일·매년·사용 안 함·비활성 담당자·등록일 이전, 관리자 외 접근·다른 회사·서버 함수 직접 호출 차단, 증빙 필요). test:db 37 통과.
- 법인카드 내역 대조
  - `src/lib/cards/statement.ts`(머리글·열 찾기, 날짜·금액·카드 끝 4자리·취소), `reconcile.ts`(짝 맞추기), `read-statement.ts`(xlsx·CSV UTF-8/EUC-KR·HTML .xls, 바이너리 .xls 안내). 테스트 9개(엑셀 일련번호·KST 날짜·합계 줄·취소·할부 열 제외·다른 카드·개인으로 올림·한 영수증 한 결제·CSV 따옴표).
  - 서버 액션 `reconcileCardStatementAction`(관리자만, 파일 저장 안 함), 화면 `/admin/corporate-cards/reconcile`(파일 → 열 확인 → 대조 → 4가지 결과), 법인카드·세무 마감 화면 바로가기, 미리보기 `admin-reconcile`.
- 출장 일비: todo 5-3 ⛔ 보류(사용자 지시), 설명은 `spec/features/recurring-subscriptions.md` §3.
- 검증
  - tsc / test 153 / lint / build 통과, check:responsive 전체 넘침 없음.
  - 로그인 E2E(`.responsive/live/e2e-round5.mjs`, 로컬 개발 서버를 임시 CRON_SECRET으로 실행): 관리자 등록(결제일 = 오늘) → cron 호출 0.6~2.2초 → 담당자 앞 결의서 "[온라인 SaaS 구독료] 노션 팀 플랜 2026년 10월" 48,000원 + 알림 기록 → 다시 호출해도 중복 없음, 비밀값 없으면 404 → 담당자 안내 확인·카드 결제 내역 붙여 상신(지급수수료) → 관리자 목록 "최근 10/23분 검토 대기" / 실제 xlsx(제목 줄·날짜 셀·문자 금액·취소·합계 포함) 올리기 → 자동 열 찾기 → 대조 0.3초(화면) → 결의서 없음 1(SK주유소)·개인으로 올림 1(다이소)·내역에 없음 1(편의점)·짝 맞음 1, 390 가로 넘침 0, 직원은 관리자 화면이 직원 홈으로 막힘. 이전 E2E 4개 재실행 통과. 임시 회사 정리 확인.
- 특이 사항
  - 처음 대조가 "요청을 처리하지 못했어요" — 결의서→멤버 외래키가 둘(작성자·지급 처리자)이라 조회가 모호 → 이름을 따로 조회하도록 수정.
  - 운영 cron은 Vercel에 CRON_SECRET이 설정돼 있어야 동작(밖에서는 확인 불가, 이전과 같음). 운영 DB의 실제 회사 정기 결제는 0건이라 로컬 cron 실행이 영향 없었음.
- 추가(D-112): 사용자 지시로 법인카드 내역 대조를 선택 기능으로 표시 — 바로가기에 "선택" 배지와 "필요할 때만 쓰세요", 대조 화면 요약·도움말에 "꼭 해야 하나요? 아니요". 세무 마감은 대조 없이 그대로.
