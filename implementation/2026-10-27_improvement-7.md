# 구현 기록 — 7차 개선사항 (`implementation/todo_improvement.md`, 2026-10-27)

## 1. 사용자 워크플로우 E2E 시나리오 명세서
- `spec/e2e-workflow.md`: 8개 시나리오(영수증 등록·상신 / 알림·승인 / 반려·재상신 / 권한별 화면 / 세무 마감 엑셀 / 크레딧 소진 / 설문 +100장 / 월말 마감·보관 주기)를 사용자 행동 → 시스템 반응 → 확인할 것으로 정리
- 요청 원문과 실제 결정이 다른 곳은 §0.2 표로 밝힘: 무로그인 승인 없음(D-013), 알림톡은 로그 드라이버(O-01), 역할 3단계(D-038·D-039 — 사장도 경리도 관리자 이상이면 회사 전체), 세무 대상은 승인+정산 완료(D-016), 구글 폼 쿠폰 대신 앱 안 설문(개선사항 7)

## 2. 랜딩 히어로 카피
- `src/app/page.tsx`: 배지 "소기업·스타트업을 위한 AI 경비 정산" → H1 "복잡한 경비처리, / 사진 한 장으로 끝."(두 줄 고정, "사진 한 장" 파란색, 휴대폰 40px·태블릿 60px·PC 56px, `break-keep`) → 서브 "영수증 등록부터 월말 세무회계용 엑셀 정리까지 한 번에."(보조 글자색, 최대 28rem, `text-balance`로 PC에서 "한 번에."만 떨어지지 않게) → CTA(위 여백 36px)
- 예전 보조 문장(엑셀도, 무거운 그룹웨어도…)은 기능 카드와 겹쳐 뺌. spec `landing-page.md` §3 갱신
- 확인: check:responsive `/` 4폭 통과, 360·390·1280 스크린샷으로 줄바꿈 확인

## 3. 관리자 1:1 카카오톡 문의 (D-127)
- `src/lib/feedback.ts`(+테스트): `NEXT_PUBLIC_KAKAO_CHANNEL_CHAT_URL`이 `https://pf.kakao.com/_…/chat` 형식일 때만 주소, 아니면 숨김
- `admin-shell.tsx`: PC(md 이상) 오른쪽 아래 노란 떠 있는 버튼 [관리자 피드백], 화면 아래 고정 버튼 줄(`.kb-hide.fixed`)이 있으면 `bottom-28`로 비켜 섬(`body:has()`). 휴대폰은 떠 있는 버튼 숨기고 햄버거 메뉴 › 설정 맨 아래 [관리자 1:1 문의](44px, 새 창)
- 직원 워크스페이스에는 넣지 않음(관리자 레이아웃은 `requireWorkspace(id, { admin: true })` 뒤에서만 그려짐)
- 확인(`.responsive/live/shot-feedback.mjs`, 로컬): PC 1280 결의서 상세에서 버튼 아래 688px < 승인 줄 위 727px(겹침 없음), 360·390은 떠 있는 버튼 안 보임·서랍 항목 보임(44px, `target=_blank`), check:responsive 관리자 3화면 통과
- **사용자 할 일**: Vercel 환경변수 `NEXT_PUBLIC_KAKAO_CHANNEL_CHAT_URL`에 카카오톡 채널 채팅 주소를 넣고 다시 배포(넣기 전에는 버튼이 보이지 않음)

## 4. 알림톡 Mock 점검·보완 (D-128)
- 점검 결과: 어댑터(`NotificationSender`)·로그 드라이버·발송 이력·1회 재시도·재발송은 이미 있음(T8-1·T8-2). 실제 대행사 드라이버는 ⛔ O-01 그대로
- `src/lib/notify/mock-format.ts`(새): Mock 콘솔 출력(템플릿 이름·템플릿 ID·가린 번호·본문·버튼·변수)
- `sender.ts`: 드라이버 표(DRIVERS) + `templateIdOf()`(ALIMTALK_TEMPLATE_<코드>) + 교체 방법 주석, 로그 드라이버가 Mock 출력 사용
- `templates.ts`: `vars`(템플릿 변수)·`TEMPLATE_LABEL`·`merchantSummary`. 상신(사용처 추가)·승인(신청자·사용처, "결재가 정상 완료되었습니다")·반려(신청자·금액·사용처·사유 필수)
- `dispatch.ts`: 항목 가맹점을 영수증 순서로 읽어 사용처 요약, 이력 payload에 vars 저장, 재발송에도 vars
- `.env.example`: ALIMTALK_API_KEY·SECRET·SENDER_KEY·템플릿 ID 7개(빈 값), spec `notification-rule.md` 문구·§3 갱신
- 확인: 단위 테스트(문구 3종·사용처 요약·Mock 출력, 번호 가림), 운영 빌드 `e2e-flow` 16단계 OK·알림 9건 sent, 서버 콘솔에 상신·반려·승인 Mock 상자 출력 확인(받는 번호 010-****-0004)
