# 6차 개선사항 4 — 무료 웹푸시: 마감 리마인더·결재 대기 독촉·공지 2채널 (D-116)

- 구현 일시: 2026-10-23
- DB `supabase/migrations/057_web_push.sql`(운영 적용): `push_subscriptions`(본인만, RLS 강제), `announcements`(platform/company, company는 같은 회사만 읽기·관리자만 쓰기, platform은 서버만 쓰기), `push_logs`(서버 전용, 같은 날 한 번), `push_deadline_targets()`·`push_approval_targets()`(service role 전용). 테스트 `supabase/tests/038_web_push.sql`(D-3·D-2·당일·다음 달 N일, 결재 24시간·관리자·청구자 제외, 구독 본인만, 다른 직원 구독 차단, 직원 공지 쓰기 차단, 다른 회사 공지 안 보임·쓰기 차단, 전체 공지 쓰기 차단, push_logs 권한 없음, 대상 함수 직접 호출 차단). test:db 38.
- 서버: `web-push` 패키지, `src/lib/push/server.ts`(보내기·끝난 구독 지우기·하루 한 번), `src/lib/push/reminders.ts`, `/api/cron/morning`(정기 결제 + 리마인더, vercel.json 07:00 KST — cron 2개 유지), 액션 `src/app/push/actions.ts`(구독 저장·삭제·시험 알림), 사내 공지 `admin/announcements`, 전체 공지 `app-admin/announcements`.
- 화면: `public/sw.js`(알림 표시·누르면 그 화면), `src/components/push/push-toggle.tsx`(켜기·시험·끄기, 아이폰 홈 화면 안내, 권한 막힘 안내), `src/app/manifest.ts` + `/icons/[size]`(홈 화면 앱 아이콘), 홈 화면 `NoticeStrip`, 관리자 메뉴 [설정 › 사내 공지], 운영자 머리글 [회사][전체 공지]. Spec `spec/features/web-push.md`.
- VAPID 키는 `.env.local`에 생성(git 제외, 값은 출력하지 않음). **운영에서 쓰려면 Vercel 환경 변수에 같은 3개를 넣어야 함.**
- 검증
  - tsc / test / lint / build 통과, check:responsive 전체 넘침 없음(미리보기 사내 공지·전체 공지 추가).
  - 실제 Chrome E2E(`.responsive/live/e2e-webpush.mjs`, 일반 프로필 — 시크릿 창은 Chrome이 푸시 미지원): 직원 [알림 켜기] → 구독(fcm.googleapis.com) → 시험 알림 0.5~1.0초 도착 → 아침 작업 → "지출 정산 마감 3일 전" 도착(링크 직원 홈) → 같은 날 다시 실행 0건 → 관리자 사내 공지 → 직원 기기 도착·홈 화면 공지 → 관리자 기기 구독 → 30시간 대기 결재 → "결재 대기 1건" 관리자 기기 도착(링크 결재 관리) → 테스트 관리자를 잠시 운영자로 → 전체 공지 → 직원·관리자 기기 모두 도착 → 전체 공지·운영자 권한 바로 삭제 → 직원 [끄기] → 구독 0. 임시 회사 정리 확인.
  - 실행 전 운영 DB 실제 회사는 오늘 리마인더 대상 0건·구독 0건 확인(아침 작업이 실제 회사에 영향 없음).
- 특이 사항: 첫 실행에서 결재 대기 알림이 30초 안에 안 보였고(새 프로필의 첫 푸시가 늦게 온 것으로 보임) 다시 실행에서는 도착 확인.
