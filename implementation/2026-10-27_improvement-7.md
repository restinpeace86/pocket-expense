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

## 5. 영수증 압축·중복 제출 방지·월말 엑셀 정합성 점검
### 점검 결과(이미 있던 것 — 유지)
- 압축: `src/lib/receipts/image.ts` — 올리기 전에 브라우저에서 긴 변 2000px JPEG(품질 0.85) + 320px 썸네일, 다시 그리며 위치정보(EXIF) 제거, 회전 반영. 영수증 여러 장 올리기·증빙 붙이기·양식 사진 모두 이 함수 사용
- 중복 제출: 새 결의서·상신·승인·반려·지급 완료 버튼 모두 처리 중 비활성 + 스피너(useTransition), 서버도 상태를 다시 확인(작성중만 상신, 먼저 처리한 사람만 승인, 크레딧은 항목당 1회)
- 엑셀: DB 함수가 결의서 상태 `approved`·`paid`만(D-016 — paid는 승인 뒤 정산까지 끝난 건) 결제일 순(그 달 → 전월 추가분, 같은 날은 직원·결의서 순)으로, 시트1 맨 아래 합계 줄(공급가액·부가세·합계·회사지원·개인부담·정산금액), 시트2 요약(계정과목·사용자·카테고리·결제수단·결의서별)
### 보완
- 큰 PDF: PDF는 줄이지 않아 10MB(저장소 한도)를 넘으면 올리다 실패하고 "네트워크 오류"로 잘못 안내되던 것 → 올리기 전에 막고 "파일이 10MB를 넘어요…" 안내(항목·크레딧이 생기기 전). `use-receipt-upload.ts`·`item-editor.tsx`
- 엑셀 요약에 **부서별** 합계 추가(요청의 "현장별 분류" — 우리 데이터에서 현장에 가장 가까운 단위가 부서, 시트3도 "부서 / 프로젝트" 칸). 부서 없음(대표·임원)은 따로
- 단위 테스트 `workbook.test.ts`(합계 줄 = 행 합계, 부서별 묶음)
### 확인
- 연타 점검 `.responsive/live/e2e-double-submit.mjs`(로컬, 운영 빌드): 새 결의서·상신 확인·일괄 승인·지급 완료를 40ms 간격 3번씩 → 결의서 1개, 상신 1회(결재 단계 1), 결재 요청 알림 2건(관리자 2명), 승인 1회·알림 1건, 지급 1회·알림 1건 — 7개 모두 OK
- `e2e-tax`(운영 빌드): 승인 건 3장만, 엑셀 파일명 = ZIP 파일명, 마감 잠금·해제, 직원 엑셀 요청 404, 390폭 넘침 0

## 6. 테크니컬 SEO (D-129)
- `src/lib/seo.ts`(+테스트): 사이트 이름·제목·설명·키워드, 운영 주소, 소유 확인 태그(값 있는 것만), robots 막을 경로, 사이트맵 화면
- `src/app/layout.tsx`: metadataBase·title·description·keywords·openGraph·twitter·verification
- `src/app/page.tsx`: canonical `/`
- `src/app/opengraph-image.tsx`(새): 1200×630 공유 이미지. 처음 그렸을 때 글자가 겹쳐 나와(이미지 생성기는 자식이 여럿인 상자마다 flex 필요) 세로 상자로 감싸 고침
- `src/app/sitemap.ts`·`robots.ts`(새), `.env.example`에 GOOGLE_SITE_VERIFICATION·NAVER_SITE_VERIFICATION
- 확인(운영 빌드): 시험 값으로 빌드하면 `google-site-verification`·`naver-site-verification` 태그가 나오고 값을 비우면 0개, og:title·description·image(1200×630)·locale·twitter 태그, canonical, robots.txt·sitemap.xml 내용, 공유 이미지를 열어 한글 카피 확인
- **사용자 할 일**: 구글 서치 콘솔·네이버 서치어드바이저에서 "HTML 태그" 방식으로 받은 content 값을 Vercel 환경변수 `GOOGLE_SITE_VERIFICATION`·`NAVER_SITE_VERIFICATION`에 넣고 다시 배포 → 각 콘솔에서 [확인] → 사이트맵 `https://pocket-expense-ruby.vercel.app/sitemap.xml` 제출
