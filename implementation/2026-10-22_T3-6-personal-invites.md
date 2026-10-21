# T3-6 개별 초대 (D-042, D-095)

- 구현 대상: todo T3-6 (`spec/screens/admin-team-members.md` §A). 직원 쪽 `/join/i/[token]` → 가입 즉시 활성(`accept_invitation`)은 이미 있었고, 이번에 관리자 쪽을 만들었다.
- 구현 일시: 2026-10-22

## 변경 사항
- `invite-actions.ts`: `createInvitationAction`(검증·같은 번호 가입/초대 대기 막기·만들기·알림톡), `resendInvitationAction`, `cancelInvitationAction`. RLS(관리자만·자기 회사만)로 만들고·취소.
- `dispatch.sendInvite`: 같은 회사·초대 대기인 초대만 INVITE 발송, 알림 이력에 `invitation_id`, `last_sent_at` 기록(service role).
- `src/lib/admin/invitations.ts`: 초대 대기 목록. `invite-panel.tsx`: [신규 멤버 초대하기] 창(이름·휴대폰·부서·직급, 알림톡 / 링크만 만들기, 결과 링크 복사·한 명 더), 초대 대기 목록(링크 복사·다시 보내기·초대 취소). 멤버 관리 위 [미제출자 독촉]과 한 줄.
- 고친 것: 취소 때 `updated_at`을 함께 쓰려다 칸 쓰기 권한이 없어 실패 → 상태만 바꿈.
- 스펙 `admin-team-members.md` §A, 결정 D-095.

## 검증
- DB `030_member_invitations_admin.sql`: 관리자 만들기·보기, 다른 회사 부서 거부, 다른 회사에 끼우기 거부, 직원 못 봄·못 만듦, 다른 회사 대표 못 봄·못 취소, 취소하면 공개 링크 무효. `test:db` 30개 통과.
- 로그인 E2E(390폭, 임시 회사 + 새 직원 계정, 모두 삭제): 초대 0.9초(화면 체감) "알림톡을 보냈어요" → DB 초대(번호·직급·부서·발송 시각)·알림 이력 INVITE 1건(invitation_id 연결) → 초대 대기 목록 → 같은 번호 막힘·이미 직원인 번호 막힘 → **새 직원이 링크로 로그인 → 이름·번호·직급 미리 채워짐 → 동의 → 가입 완료 → 직원 화면, 멤버 approved(승인 대기 없이), 초대 accepted** → 다른 초대 취소 → 목록에서 사라지고 링크는 "초대 링크가 만료되었거나…".
- tsc / test / lint / build / check:responsive 통과.
