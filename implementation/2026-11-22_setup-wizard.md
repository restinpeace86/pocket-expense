# 최초 1회 설정(설정 마법사) — D-300 / todo 9-44a (U-1 A안)

- 구현 일시: 2026-11-22
- 구현 대상: 새로 가입한 회사 관리자가 설정 메뉴를 순서대로 한 번 훑는 단계 안내(시작 안내 창 · 진행 띠 · 홈 진행 카드 · 요약 화면)

## 변경 사항
- DB `supabase/migrations/171_setup_wizard.sql`: `setup_wizards`(legacy·intro_answered_at·finished_at) · `setup_wizard_steps`(단계별 done/skipped). 관리자만 select(RLS force), 쓰기는 `setup_wizard_answer_intro()`·`setup_wizard_mark()`(require_admin). 기존 회사 전부 legacy로 채움
- 테스트 `supabase/tests/106_setup_wizard.sql`(직원 거절·회사 격리·완료 유지·직접 쓰기 막힘·legacy), `src/lib/admin/setup-wizard.test.ts`
- `src/lib/admin/setup-wizard.ts`: 단계 목록·시간·이유, 진행률/이어서/다음 계산
- `src/lib/admin/setup-wizard-server.ts`: 기록 읽기, 진행 띠 쿠키 `pe_setup_on`
- `src/app/workspace/[id]/admin/setup/`: 서버 동작(시작·나중에·멈춤·완료/건너뜀) + 요약 화면
- `src/components/admin/setup-wizard-bar.tsx`(진행 띠·[설정 마법사] 버튼·저장 안 함 확인), `setup-intro.tsx`(시작 안내 창·홈 진행 카드)
- `admin-shell.tsx`(진행 띠 자리·메뉴 ✓/건너뜀), `admin/layout.tsx`(기록 읽기), `admin/page.tsx`·`admin-home-view.tsx`(안내 창·카드, legacy는 예전 체크리스트)

## 특이 사항
- 서버 동작 뒤 redirect만 하면 관리자 틀(진행 띠)이 예전 값으로 남아 `revalidatePath(admin, "layout")`를 같이 부름
- 시간: 단계별 분 합(근태 없이 18분 → "약 20분", 근태 포함 24분 → "약 25분")
- 검증: tsc · vitest 511 · db test 106 · build · 로컬/운영 E2E(`.responsive/live/e2e-setup-wizard.mjs`, 1280·390) · leftovers []
