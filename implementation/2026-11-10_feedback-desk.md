# 의견 보내기(버그 신고 · 기능 요청) — 8-100, D-246

- 구현 일시: 2026-11-10
- Spec: `spec/features/improvement-2026-11.md` §C (출처 `implementation/todo_improvement.md` 기능 3)

## 변경 사항
- DB `supabase/migrations/135_feedback.sql`
  - 비공개 보관함 `feedback-files`(5MB, JPG·PNG·WEBP)
  - 표 `feedback_logs`(회사·멤버 복합 FK, RLS 강제, 회사 사용자는 읽기·쓰기 권한 없음 — 운영 키만 읽음)
  - `feedback_submit` — 승인 멤버만, 회사·이름은 로그인에서, 주소는 `?` 앞까지, 한 회사 하루(한국 시간) 5건(회사 단위 잠금으로 동시 저장도 5건), 캡처는 버그 + 내 회사 경로만. 오류 `INVALID_FEEDBACK`·`FEEDBACK_LIMIT`
  - `feedback_today_count`(작성 창 '오늘 n/5건'), `feedback_due`(서버 전용 — 해결 1년 지난 의견 삭제)
- 서버 `src/app/workspace/[id]/feedback/actions.ts` `submitFeedbackAction` — 캡처를 운영 키로 올리고 실패하면 지움, User-Agent는 요청 머리글, 앱 버전은 배포 커밋 7자리, 저장 뒤 디스코드 알림(`DISCORD_WEBHOOK_URL`, 실패해도 저장 유지)
- 화면
  - `src/components/feedback/feedback-button.tsx` — 머리글 아이콘(직원·관리자 공통 `WorkspaceHeader`). 관리자 휴대폰(640px 미만)은 머리글이 좁아 회사 이름이 가려지므로 햄버거 메뉴 아래쪽 [의견 보내기] 줄로(`variant="row"`)
  - 구분(버그/기능) 필수, 내용 5~2,000자, 버그만 캡처 1장(파일 고르기 + PC Ctrl+V, 화면에서 긴 변 1920px JPEG로 줄임 — 서버 동작 1MB 안), 캡처 없이 보내면 한 번 권하고 다시 누르면 보냄, 주소·브라우저 정보 전달 알림, 오늘 n/5건, 5건이면 [보내기] 막음, 로그인 풀리면 내용 임시 저장 + [다시 로그인]
  - 보낸 뒤 안내: 버그 "24시간 안에 확인", 기능 요청 사용자 문구(WORKON)
- 운영자 `/app-admin/feedback` [의견] — 구분·상태 거르기, 내용·회사·보낸 사람·주소·브라우저 요약·화면 크기·버전·캡처, 상태(접수/검토 중/해결)·메모 저장. 캡처 `/app-admin/feedback/shot?id=`(운영자 아니면 404)
- 새벽 정리 ⑧ `purgeFeedback`(해결 1년 지난 의견 + 캡처)
- 공통 `src/lib/feedback-desk/format.ts`(+ 테스트), `src/lib/receipts/image.ts` `processFeedbackShot`, 오류 문구 `src/lib/errors.ts`

## 검증
- DB `supabase/tests/086_feedback.sql`(test:db에 추가) — 저장값·구분/길이/캡처 경로·회사 사용자 표 읽기 막힘(관리자 포함)·회사 하루 5건·다른 회사 따로·어제 건 제외·대기 멤버·새벽 정리
- 화면 `.responsive/live/e2e-feedback.mjs` — 직원 390·관리자 1280·관리자 360(메뉴 안), 캡처 권하기·붙이기·저장, 안내 문구 2종, 5건 막힘, 운영자 목록·캡처·상태 저장, 운영자 아니면 캡처 404

## 특이 사항
- 개인정보처리방침(8-93)에 "의견 보내기: 내용·화면 주소·브라우저 정보·캡처, 해결 후 1년 보관" 항목 추가 필요
- 카카오톡 1:1 문의 버튼(D-127)은 그대로(채널 열리면 함께 보임)
