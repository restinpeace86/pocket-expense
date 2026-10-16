# 구현 기록 — T0. 프로젝트 스캐폴딩

- **구현 대상**: `implementation/todo.md` T0-1 ~ T0-6
- **구현 일시**: 2026-10-16
- **기준 문서**: CLAUDE.md Tech Stack / Agent Commands

## 변경 사항
| 항목 | 내용 |
|---|---|
| T0-1 | `create-next-app@latest`(Next.js 16.4.2, React 19.3, TypeScript, Tailwind v4, ESLint, App Router, `src/` 디렉터리, `@/*` alias)로 생성. 기존 문서(CLAUDE.md, spec/, project/, implementation/, supabase/, scripts/, review/)는 그대로 두고 앱 파일만 추가. `.gitignore`는 기존 것을 유지하고 누락 항목만 덧붙임 |
| T0-2 | `lucide-react`, `@supabase/ssr`, `@supabase/supabase-js` 설치. `src/lib/supabase/{env,client,server}.ts` 작성(브라우저용 / 서버용 클라이언트, 환경변수 누락 시 명확한 오류) |
| T0-3 | `vitest` 설치, `npm run test`(= `vitest run`), `vitest.config.mts`(`@` alias), 샘플 테스트 `src/lib/format.test.ts`(금액 표시 `formatWon`) |
| T0-4 | `.env.example`에 키 이름만 정리(값 없음) |
| T0-5 | `.env.local` 점검 결과는 아래 "특이 사항" 참고. 값은 커밋하지 않음 |
| T0-6 | 검증 루프 통과: `npx tsc --noEmit` ✅ / `npm run test` ✅ 3 passed / `npm run build` ✅ / `npm run lint` ✅ / `next start` 후 `/` 응답 확인(title, `lang="ko"`, 문구) ✅ |
| 기타 | 임시 홈 페이지(`/`)와 레이아웃 메타데이터를 PocketExpense용으로 교체(실제 랜딩은 T2-0) |

## 특이 사항
1. **Next.js 16은 학습 데이터와 API가 다르다.** 생성된 `AGENTS.md` 지시에 따라 코드 작성 전 `node_modules/next/dist/docs/`를 확인할 것.
   - `cookies()`는 async. `next.config.ts`에 `cacheComponents: true`가 켜져 있어 **`cookies()`를 읽는 컴포넌트는 `<Suspense>` 안에 있어야 하며, 밖에서 읽으면 빌드 오류**가 난다(`02-guides/authentication-with-cache-components.md`). 서버용 Supabase 클라이언트를 쓰는 화면은 이 규칙을 따른다.
   - `LayoutProps`/`PageProps` 등은 `next typegen`이 생성하는 전역 타입이다. 새로 clone한 저장소에서도 `tsc`가 통과하도록 `postinstall`에 `next typegen`을 등록했다.
2. **Vitest 5는 `@types/node` 22 이상을 요구**해 템플릿 기본값(20)을 실행 환경(Node 24)에 맞춰 `^24`로 올렸다.
3. **`.env.local`에 이 프로젝트와 무관해 보이는 키**가 있다(삭제하지 않음, 사용자 확인 필요): `TMAP_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `KAKAO_ACCESS_TOKEN`. `NEXT_PUBLIC_KAKAO_MAP_API_KEY`는 자차 주소 검색 UI에서 쓸 수 있어 유지 대상으로 본다. 카카오/Google 로그인 키는 Supabase 대시보드 Auth Provider에 설정하므로 앱 환경변수가 필요 없다.
4. `supabase/migrations/001_initial_schema.sql`은 여전히 DEPRECATED 상태이며 T1-1에서 재작성한다.
