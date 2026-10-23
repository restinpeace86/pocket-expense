# 6차 개선사항 1 — 카카오톡 공유 링크가 localhost로 열리던 문제 (D-113)

- 구현 일시: 2026-10-23
- 확인한 것: 코드에 하드코딩된 localhost는 없음(D-099에서 로컬 주소면 운영 주소를 쓰게 고쳐 둠). 공유 코드는 `src/components/admin/kakao-share-button.tsx`(`Kakao.Share.sendDefault`), 링크는 `src/components/admin/invite-link-card.tsx` → `publicOrigin()`.
- 남은 원인: 카카오는 공유 링크 도메인이 콘솔에 등록되지 않았으면 등록된 첫 번째 도메인(localhost:3000)으로 바꾼다. 지금 규칙은 운영이 아닌 배포 주소(Vercel 미리보기 `pocket-expense-git-…`)에서는 그 주소를 그대로 보내 → 카카오가 localhost로 바꿈.
- 변경: `src/lib/site-url.ts` `publicOrigin()` — 어디서 만들든 배포 주소(NEXT_PUBLIC_SITE_URL → Vercel 운영 도메인 `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_PROJECT_PRODUCTION_URL`), 둘 다 없을 때만 지금 주소. 카카오 공유(링크·버튼·이미지)·공용 초대 링크·QR·개별 초대 링크·알림톡 버튼이 모두 이 주소를 쓴다. 테스트 5개(미리보기 주소에서도 운영 주소 포함).
- 검증: tsc / test / lint 통과. 로그인 E2E(`.responsive/live/e2e-share-origin.mjs`, localhost에서, 카카오 SDK는 가짜로 공유 내용만 받음): 공용·복사·카톡 공유 링크/버튼·개별 초대 링크 모두 `https://pocket-expense-ruby.vercel.app/...`, 공유 이미지·개별 초대 링크 운영에서 200.
- 권장(사용자 작업): 카카오 디벨로퍼스 도메인 목록에서 `https://pocket-expense-ruby.vercel.app`을 **첫 번째**로 두면, 혹시 다른 주소가 섞여도 localhost가 아니라 운영으로 바뀐다. Vercel 환경 변수 `NEXT_PUBLIC_SITE_URL`(Production·Preview 모두)에 운영 주소가 있는지도 확인.
