# T3-4 멤버 관리 마무리 + T3-3 부서 관리

- 구현 일시: 2026-10-17
- 기준: `spec/screens/admin-team-members.md` §2·§4.B~D, `spec/features/roles-and-permissions.md` §3·§5, `spec/screens/admin-dashboard.md` 0·⑤, `spec/screens/admin-settings.md` §4, D-038, D-058, D-061

## 변경 사항
- DB (마이그레이션 `013_member_management_functions.sql`)
  - `update_member` — 이름·휴대폰·부서·직급·사번. 관리자는 일반 멤버·본인만, 최고 관리자는 모두. 다른 회사 부서 지정 불가(`INVALID_DEPARTMENT`)
  - `set_member_role` — 관리자 지정·해제, 최고 관리자만. 최고 관리자 역할은 바꿀 수 없음(`SUPER_ADMIN_LOCKED`)
  - `transfer_super_admin` — 한 트랜잭션으로 대상 super_admin, 본인 admin (회사당 1명 유지)
  - `member_deactivation_check` — 경고: 정산 대기 건수·지급/납부 합계(`private.claim_settlement`), 작성중·반려 건수 / 차단: 결재라인 검토자, 검토 차례
  - `deactivate_member` — 차단 조건이면 `MEMBER_IN_APPROVAL_LINE`/`MEMBER_HAS_PENDING_REVIEW`. 최고 관리자·본인 불가, 관리자 비활성화는 최고 관리자만
  - 모든 함수: 다른 회사 대상은 `NOT_FOUND`
- 부서: 기존 departments RLS(관리자 이상·자기 회사)로 추가·이름 변경·순서 변경·삭제. 회사 id는 서버에서 본인 소속으로 정함. 삭제 시 소속 멤버는 부서 없음(FK set null), 부서 결재라인은 cascade 삭제 — 삭제 확인창에 인원·결재라인 경고
- 화면
  - 사이드바: 하단 [설정] 하위 메뉴(정책·법인카드·양식·부서·결재라인·계정과목·요금제·알림 이력, 부서 외 "준비 중")
  - 멤버 목록: 총/활성 인원, 이름·부서 검색, 부서 필터(부서 없음 포함), 행별 [편집]
  - 멤버 상세 `/admin/members/[memberId]`: 기본 정보 편집(권한 없으면 읽기 전용), 권한(관리자 지정·해제, 최고 관리자 넘기기 + 결재라인 안내), 퇴사 처리(점검 결과 경고/차단 → 확정)
  - 부서 `/admin/departments`
  - 버튼 노출 기준 `src/lib/admin/capabilities.ts`(단위 테스트). 실제 권한은 DB 함수가 다시 검사
- 로그인 안 한 상태로 `/workspace/*` 접근 시 proxy에서 `/login?next=<원래 경로>`로 보냄(이전에는 관리자 홈으로 돌아가던 문제)
- 공통: `formatPhone`(`src/lib/format.ts`), 오류 문구 추가

## 검증
- typegen+tsc, `npm run test`(21개), `npm run lint`, `npm run build` 통과
- DB: dry-run(013+005 한 트랜잭션 후 롤백) → `db:migrate` → `test:db` 5종(…, MEMBER_MANAGEMENT_OK) → `db:types`
- 변이 테스트: 권한 검사 제거, 회사 조건 제거 → 각각 테스트가 FAIL로 잡음
- 반응형: 새 미리보기 4개 포함 전 화면 360/390/768/1280 가로 넘침 없음, 스크린샷 직접 확인(모바일 메뉴의 설정 하위 메뉴 펼침, 긴 부서명 줄바꿈 포함)

## 특이 사항
- 재활성화는 spec에 없어 구현하지 않음(O-08)
- 개인별 식대 예외 한도는 T3-7, 개별 초대는 T3-6
