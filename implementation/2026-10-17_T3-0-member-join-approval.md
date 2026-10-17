# T3-0 직원 합류: 초대 링크·QR + 가입 승인/거절

- 구현 일시: 2026-10-17
- 기준: `spec/screens/admin-team-members.md` §4.A·가입 승인 대기 탭, `spec/screens/admin-dashboard.md` 0(레이아웃), D-038, D-042
- 계기: 직원이 가입 신청을 해도 승인할 화면이 없어 계속 승인 대기에 머무는 문제. 사용자 지시로 초대는 "코드"가 아니라 "링크(`/join/{코드}`)"를 기본으로 안내한다.

## 변경 사항
- DB (마이그레이션 `012_member_admin_functions.sql`)
  - `private.require_admin()` — 승인된 admin/super_admin만 통과
  - `public.approve_member(uuid)` — 같은 회사의 pending 멤버만 approved로 변경(approved_at 기록)
  - `public.reject_member(uuid)` — 같은 회사의 pending 멤버 행 삭제(정산 계좌 cascade). 거절된 사람은 다시 가입 신청 가능
  - `public.regenerate_invite_code()` — 공용 초대 코드 재발급(이전 링크·QR 즉시 무효)
  - 다른 회사 멤버 id는 존재 여부와 상관없이 `NOT_FOUND`, 이미 처리된 신청은 `NOT_PENDING`
- 테스트: `supabase/tests/004_member_admin.sql` — 타사 관리자·일반 직원·미승인자 차단, 타사 멤버 승인/거절 불가, 초대 코드 재발급은 자기 회사만·관리자만 가능하고 새 코드로 바뀌는지 확인 (`npm run test:db` 4개 파일 통과)
- 화면
  - `src/app/workspace/[id]/admin/layout.tsx` + `components/admin/admin-shell.tsx`: PC 좌측 사이드바, 모바일 햄버거 메뉴. 아직 없는 메뉴는 "준비 중" 표시
  - 관리자 홈 `admin/page.tsx` + `admin-home-view.tsx`: 가입 승인 대기 n명 안내(멤버 관리로 이동), 초대 링크 카드, 무료 영수증 잔량
  - `components/admin/invite-link-card.tsx`: 링크 표시·[링크 복사]·[QR 이미지 저장](PNG 다운로드)·[새 링크 만들기]. 링크 주소는 실제 접속 주소 기준(로컬·배포 모두 맞게)
  - 멤버 관리 `admin/members/page.tsx` + `members-view.tsx`: 탭(전체·가입 승인 대기·비활성), 대기자 [거절]/[승인]. 대기자가 있으면 대기 탭이 기본
  - `src/lib/errors.ts`: NOT_ALLOWED·NOT_A_MEMBER·NOT_FOUND·NOT_PENDING 안내 문구
- 패키지: `qrcode`, `@types/qrcode`

## 검증
- typegen+tsc, `npm run test`, `npm run lint`, `npm run build` 통과
- DB: dry-run → `db:migrate` → `test:db`(TENANT_ISOLATION_OK, ONBOARDING_ISOLATION_OK, BUSINESS_VERIFICATION_OK, MEMBER_ADMIN_OK) → `db:types`
- 반응형: `/dev/preview/admin-home`, `/dev/preview/admin-members` 포함 전 화면 360/390/768/1280 가로 넘침 없음, 스크린샷 직접 확인(모바일 메뉴 열림 상태 포함)

## 특이 사항
- 역할 변경·비활성화·최고 관리자 넘기기·부서 편집·개별 초대는 T3-4/T3-6 범위로 남김
- Split View는 지출 승인 관리 화면(T7)과 함께 구현
