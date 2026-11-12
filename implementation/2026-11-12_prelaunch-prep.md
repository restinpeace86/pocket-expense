# 서비스명 확정 전 준비 (D-260) — 2026-11-12

- 근거: 사용자 2026-11-12 "서비스명 한 곳으로 모아(로고·아이콘도, 성능 영향 없게) / 약관 보완 / 입력 칸 나머지 / 고장 난 테스트 정리"
- Spec: ui-rules.md §3, calendar.md(일정 만들기), admin-expense-approvals.md(공통 필터), 약관·처리방침 본문(`components/legal/documents.tsx`)

## 변경 사항
### ① 이름·로고 한 곳 (9-14a)
- `src/lib/brand.ts`: `BRAND`(name·batchim·color·mark), `BRAND_JOSA`(을/이/은/으로), `BRAND_TAG_RE`
- 웹: "Moa-on" 글자 195곳을 코드 구조 변환으로 `BRAND.name`으로(문자열·템플릿·JSX 글자·속성, 주석 제외) + 알림 정규식 3곳 + 조사 11곳. 출력 글자는 그대로
- 로고: `components/brand/mark-svg.tsx` `markSvg()` 하나를 화면 로고·탭 아이콘·앱 아이콘(icons/[size])·공유 이미지·OG 이미지가 같이 씀, 경로 카드·초대 QR 이미지·manifest 색도 brand 색
- `scripts/apply-brand.mjs`: 안드로이드(앱 이름·런처 5크기·알림 아이콘)·아이폰(앱 이름·아이콘 1024·시작 화면)·capacitor appName·www 제목·`public/sw.js` 이름을 brand.ts로 맞춤(이번 실행: 모양 같음, 아이콘 다시 그려짐). 예전 `scripts/ios-assets.mjs`는 이걸로 합침
- 성능: 빌드 때 박히는 상수 — 실행 시 비용 없음
- 이름 바꿀 때: brand.ts(name, batchim) → `node scripts/apply-brand.mjs` → 배포 + APK·아이폰 빌드 → DB 저장 이름(도우미 방 'Moa-on 도우미' 등)은 migration

### ② 약관·처리방침 2026-11-12판 (9-14b, 8-93)
- 처리방침: 수집 항목(입사일·출퇴근 기록·실패 기록·휴가·휴가 증빙 민감정보·보관함·버스 알림·의견·AI 도우미·서류 변환·설치 앱 토큰), 목적, 보관 기간(실패 90일·증빙 휴가 끝 + 3년·보관함 나만 보기 퇴사 30일·버스 30분·의견 해결 1년·변환 초안 30일·근태 서류 3년은 고객사 의무), 위탁(Firebase·Apple·Discord, Gemini 범위), 국외 이전, 11-2 휴대폰 앱 접근 권한(카메라·사진·알림 모두 선택, 위치 안 씀)
- 약관: 제1조 서비스 범위, 제5조(근태·보관함·버스·도우미·변환·설치 앱), 제13조의3(출퇴근·휴가), 제14조 AI 범위
- 버전 2026-11-12 + `supabase/migrations/152_legal_version_20261112.sql`(동의 기록 버전) — **운영 DB 적용 승인 대기**

### ③ 입력 칸 ⑤⑥⑦ (9-14c, 9-12 검토안)
- ⑤ `calendar-view.tsx` 일정 길이 칩 ⑥ `room-board.tsx` 이번 주 띠 ⑦ `claim-filters.tsx` 빠른 기간 + `lib/claims/filters.ts` `RECENT3`·`filterDateRange`·`quickMonths`(테스트), `admin-list.ts`가 범위 사용

### ④ 테스트·lint 정리 (9-14d)
- `e2e-vacation`: 달력으로 날짜 고르기, 설정 탭으로 [휴가 종류]
- `e2e-attendance`: 켜기 = 설정 › 기능 사용, 사용 안내 접힘 → 펼침, 근무 기준·출근 단말·변경 이력 탭, 화면 이름 '출퇴근 기록', 창이 주소로 열리는 것 기다리기, 정정 칸은 #req-in
- lint 13개: 따옴표 1곳, 브라우저 값 읽기 3곳 → useSyncExternalStore, 받은 값 맞추기 3곳 → 그릴 때 비교, 이펙트 안 바로 부르기 3곳 → 다음 틱(동작 같음)

## 검증
- tsc, lint(src 전체 0), test(443), build 통과
- E2E 로컬 ALL_OK: `e2e-prelaunch`(신규: 제목·아이콘·⑦·⑤·⑥·처리방침·약관), `e2e-vacation`, `e2e-attendance`, `e2e-inputs`, `e2e-androidapp`, `e2e-onepage`, `e2e-landing-sims`. leftovers []
- 캡처 확인: 회의실 390, 일정 1280, 거르기 1280, 처리방침 390, 안드로이드 아이콘 전·후 같은 모양

## 특이 사항
- migration 151(아이폰 토큰)·152(약관 버전): 2026-11-12 사용자 승인 후 운영 DB 적용, test:db 통과, 반영 확인(ios 토큰 저장·약관 버전 2026-11-12)
- 처리방침에 적은 '디스코드 알림은 해결 후 1년 안에 삭제'는 운영자가 지켜야 하는 일(자동 삭제 아님)
