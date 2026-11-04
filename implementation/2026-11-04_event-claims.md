# 일정 ↔ 경비 연결 (D-210)

- 구현 대상: 출장·회의 일정 상세 [경비 올리기] + [이 일정 경비], 결의서에 [연결된 일정]
- 구현 일시: 2026-11-04
- 근거: 사용자 결정 2026-11-04, `spec/features/calendar.md` §12, decision-log D-210

## 변경 사항
- DB `supabase/migrations/112_calendar_event_claims.sql`: `expense_claims.calendar_event_id`(복합 FK, on delete set null), `calendar_create_claim`(참석자·출장/회의·같은 회사·캘린더 켜짐 확인 후 작성 중 결의서 생성, 출장 = 출장지·기간·목적 / 회의 = 제목·목적·참석자), `calendar_event_claims`(직원 = 내 것, 관리자 = 남의 작성 중 제외)
- 화면
  - `calendar-view.tsx` `EventClaims`: 출장·회의 일정 상세의 [이 일정 경비] 칸(건수·합계·결의서별 금액·상태), [출장/회의 경비 올리기] → `calendar/actions.ts` `createClaimFromEventAction` → 편집 화면(영수증 추가 창 열림)
  - `claim-event-link.tsx`(서버): 결의서에 연결된 일정 → 캘린더 그 일정. 직원 편집·상세, 관리자 상세, 사전 검토 결재 화면에 슬롯(`eventLink`)
  - 오류 문구 `EVENT_KIND_NO_CLAIM`·`NOT_ATTENDEE`
- 테스트: `supabase/tests/069_calendar_event_claims.sql`(test:db 추가), E2E `.responsive/live/e2e-eventclaims.mjs` ALL_OK(출장·회의 채움, 외근·불참자 없음, 관리자 작성 중 숨김 → 상신 후 보임, 연결된 일정 왕복, 캘린더 끄면 숨김), e2e-calendar·rooms·tabbar ALL_OK

## 특이 사항
- 회의는 카테고리를 정하지 않는다(내부 회의 식대일 수도, 외부 미팅비일 수도 있어서 — 추측 금지). 외부 미팅비를 고르면 목적·참석자가 이미 채워져 있다.
- 결의서 쪽 표시는 결의서를 볼 수 있는 사람에게만(결의서 읽기는 기존 RLS), 일정 정보는 같은 회사 + 캘린더 켜짐일 때만(`calendar_event`).
