# 구현 기록 — T2. 랜딩 · 로그인 · 회사 생성 · 직원 가입

- **구현 대상**: `implementation/todo.md` T2-0 ~ T2-4
- **구현 일시**: 2026-10-17
- **기준 문서**: `spec/screens/landing-page.md`, `spec/features/auth-onboarding.md`, `spec/screens/admin-onboarding.md`, `spec/common/routes.md` §1, `spec/features/roles-and-permissions.md`

## 변경 사항
| 구분 | 파일 | 내용 |
|---|---|---|
| DB | `supabase/migrations/007_onboarding_functions.sql` | `create_company`(회사·부서·최고 관리자·기본 결재라인 0단계·계정과목 3종+매핑 9건·무료 100장), `get_invite_company`(로그인 전 회사명만), `get_invite_departments`, `join_company`(승인 대기), `get_invitation_public`/`get_invitation_detail`/`accept_invitation`(개별 초대 → 즉시 활성), `my_membership`(본인 소속만). 초대 코드 생성기(혼동 문자 제외 8자리), 휴대폰 정규화 |
| DB 테스트 | `supabase/tests/002_onboarding_isolation.sql` | 회사 생성·가입·초대 수락 격리 테스트. `npm run test:db`가 001·002를 모두 실행 |
| 세션 | `src/proxy.ts` | 매 요청 세션 갱신(`getClaims`), 인증 쿠키 응답에 no-cache 헤더(다른 사용자에게 세션이 캐시되어 넘어가는 것 방지) |
| 인증 | `src/app/auth/callback/route.ts`, `src/app/auth/signout/route.ts`, `src/lib/auth/{paths,session,guards}.ts` | 로그인 후 소속 상태별 분기, 오픈 리다이렉트 차단, 화면 접근 가드(다른 회사 id로 들어오면 본인 회사로) |
| 화면 | `/`(랜딩), `/login`, `/onboarding`, `/onboarding/create-company`, `/onboarding/join`, `/onboarding/pending`, `/join/[inviteCode]`, `/join/i/[token]`, `/workspace/[id]/admin`·`/employee`(도착 화면) | 모바일 우선, 버튼 44px 이상, 카카오·Google 버튼, 개인정보 동의, 부서 태그 입력, 모드 전환 버튼(관리자 이상) |
| 공통 | `src/lib/errors.ts`, `src/lib/supabase/public.ts`, `src/components/**` | DB 오류 코드 → 안내 문구(내부 메시지 미노출), 공용 데이터용 쿠키 없는 클라이언트(랜딩 요금제 캐시) |
| 테스트 | `src/lib/auth/paths.test.ts`, `src/lib/errors.test.ts` | 로그인 후 이동 경로(다른 회사 경로·관리자 경로 차단, 외부 URL 차단), 오류 문구 |
| 규칙 | CLAUDE.md | 타입 체크를 `npx next typegen && npx tsc --noEmit`로 변경(라우트 추가 시 라우트 타입 재생성 필요) |

## 격리 관련 결정
- 회사에 속하기 전 사용자는 RLS상 회사 데이터를 직접 읽을 수 없으므로, 가입 전 단계(회사명 확인·부서 목록·초대 정보)는 **필요한 최소 값만 돌려주는 서버 함수**로 처리했다. 로그인 전(anon)에는 회사명·초대받은 사람 이름만 보인다.
- 모든 가입 함수는 호출자가 **아직 어느 회사에도 속하지 않았는지** 확인한다(1계정 1회사, D-004). 부서는 **가입하려는 회사의 부서인지** 함수와 복합 외래키 양쪽에서 검사한다.
- 로그인 후 `next` 경로는 **같은 사이트의 자기 회사 워크스페이스 경로일 때만** 따른다. 다른 회사 id가 들어간 링크로는 보내지 않는다.

## 검증
| 항목 | 결과 |
|---|---|
| 007 + 002 격리 테스트 드라이런 | ✅ `ONBOARDING_ISOLATION_OK` |
| 실제 DB 적용 후 `npm run test:db` | ✅ `TENANT_ISOLATION_OK`, `ONBOARDING_ISOLATION_OK` |
| `npx next typegen && npx tsc --noEmit` | ✅ |
| `npm run test` | ✅ 3 files, 11 tests |
| `npm run build` / `npm run lint` | ✅ / ✅ |
| 실제 화면(`next start`) | ✅ 랜딩(요금제 3종 DB에서 표시, "완벽 호환" 문구 없음), 로그인 버튼, 비로그인 시 온보딩·워크스페이스 → 로그인으로 이동(복귀 경로 유지), 잘못된 초대 코드 안내, 코드 없는 콜백 → 로그인 |

## 특이 사항 / 남은 확인
1. **카카오·Google 실제 로그인은 사람이 브라우저에서 한 번 확인해야 한다**(외부 계정 로그인 필요). 확인 순서: `npm run dev` → `http://localhost:3000` → [무료로 시작하기] → 카카오 로그인 → 회사 등록 → 관리자 도착 화면 → 초대 코드로 다른 계정 가입 → 승인 대기 화면.
2. 초대 링크·QR 화면, 멤버 승인 화면은 T3(관리자 기본)에서 구현한다. 지금은 관리자 도착 화면에 초대 코드만 보여 준다.
3. 랜딩 소개 동영상은 파일이 준비되면 `HeroMockup`을 교체한다.

## 추가 수정 (2026-10-17, 사용자 피드백)
- **사업자등록번호 필수**(D-056): `008_business_number_required.sql`(`companies.business_number` NOT NULL, `create_company`에서 10자리 필수), 회사 등록 폼 필수·형식 검사, 격리 테스트 002에 번호 없음·형식 오류 거부 케이스 추가, 테스트 001·벤치 데이터에 번호 추가. 드라이런 → 적용 → `test:db` ✅ → `bench:db` ✅(목록 1.17ms).
- **로그인 버튼 아이콘**: 카카오 말풍선 심볼, Google 4색 "G" 로고 추가.
- **배포**: Vercel 프로젝트 프레임워크가 비어 있어(문서만 있던 시점 생성) 404 → Next.js로 지정·재배포. `NEXT_PUBLIC_SITE_URL`을 `https://pocket-expense-ruby.vercel.app`으로 수정, `ALIMTALK_DRIVER`·`CREDIT_EVENT_BONUS_*` 추가, Supabase 리디렉션 허용 목록에 배포 도메인 추가. 불필요·위험 환경변수(`SUPABASE_ACCESS_TOKEN`, `KAKAO_ACCESS_TOKEN`)는 사용자가 삭제.
