# 서비스 이름 WORKON → Moa-on (todo_improvement 개선사항 3) — 2026-11-11

- 근거: D-251 ⑦(이름 Moa-on — M만 대문자, on 소문자 / 로고는 시안 A 먼저, 시안 더 제안)
- 범위: 화면·알림·공유·메일 문구의 서비스 이름(153파일), 로고, manifest·검색 정보·공유 이미지, 안드로이드 앱 이름(소스), 약관·처리방침 버전, 도우미 방 이름

## 변경 사항
- `WORKON` → `Moa-on` 일괄(조사는 그대로 맞음: 둘 다 받침 'ㄴ'으로 끝남 — 을/은/이/으로)
- 로고 `brand/logo.tsx` 시안 A: "Moa" + 브랜드색 하이픈 + 켜진 스위치(o) + "n". 두 줄은 "Moa- / ⏺n". 아이콘(스위치)은 그대로
- 코드 이름: CSS `moaon-edge-pulse`·`moaon-toast-in`, 화면 이벤트 `moaon:*`, 검색어 "모아온", 도우미 부르기 `@Moa-on`·`@모아온`(예전 `@workon`도 받음)
- migration 143: 약관·처리방침 버전 2026-11-11(이름만 바뀜 — 다시 동의 받지 않음, 119와 같은 방식), 도우미 방 이름 `Moa-on 도우미`(기존 방도)
- 안드로이드: `strings.xml`·`capacitor.config.json`·`www/index.html` 앱 이름 Moa-on(설치 앱에 반영하려면 APK 새로 빌드·올리기 필요)

## 일부러 그대로 둔 것
- 브라우저 저장 키 `workon-attend-terminal`(바꾸면 연결된 출근 단말이 풀림)·`workon-feedback-draft`
- APK 파일 경로 `android/workon.apk`(이미 받은 링크·앱 업데이트 확인), 패키지 `kr.damounlab.app`, 서명 키, `mobile/package.json` 이름
- 문의 이메일 `damoun.workon@gmail.com`(실제 계정), 주소 `pocket-expense-ruby.vercel.app`(도메인 정할 때, B-6)
- Supabase 로그인 메일 틀(인증 설정 — 사용자 허락 뒤), 카카오 개발자 앱 이름(사용자 콘솔)

## 검증
- tsc, test(417), test:db, build 통과
- E2E `e2e-brand.mjs` ALL_OK — 랜딩·로그인·약관·처리방침·앱 받기·관리자·직원 홈에 WORKON 없음, manifest 이름, 약관 버전, 로고 aria-label. leftovers []
- 화면: 랜딩 390, 로그인 390, 공유 이미지, 머리글 로고 확인
