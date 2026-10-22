# 개선사항(2차) 6 — 초대·카톡 공유 링크의 localhost 문제 (D-099)

- 구현 일시: 2026-10-22
- 원인: 공용 초대 링크·카톡 공유·개별 초대 링크가 `window.location.origin`(지금 접속한 주소)으로 만들어져, 로컬에서 열어 공유하면 `http://localhost:3000/...`가 그대로 나갔다.
- 변경
  - `src/lib/site-url.ts`(+ 테스트 4개): `publicOrigin()` — localhost·127.x·사설 IP면 배포 주소, 아니면 지금 주소(프리뷰 배포는 그 프리뷰). `configuredSiteUrl()` — `NEXT_PUBLIC_SITE_URL` → 없으면 Vercel 운영 도메인(`VERCEL_PROJECT_PRODUCTION_URL`).
  - `invite-link-card.tsx`(공용 링크·QR·카톡 공유), `invite-panel.tsx`(개별 초대 링크 복사), `notify/sender.ts` `siteUrl()`(알림톡 버튼)이 이 함수를 쓴다. 카톡 공유 이미지는 링크와 같은 앞주소.
- 검증
  - tsc / test 135 / lint / build 통과.
  - 로그인 E2E(`.responsive/live/e2e-share-origin.mjs`, localhost:3100에서 실행, 카카오 SDK는 가짜로 바꿔 공유 내용만 확인): 공용 초대 링크·복사된 링크·카톡 공유 링크/버튼·개별 초대 링크 모두 `https://pocket-expense-ruby.vercel.app/...`, 공유 이미지 운영 주소 공개 접근 200 image/png, 개별 초대 링크 운영에서 열기 200. 임시 회사 정리 확인.
  - 운영(https://pocket-expense-ruby.vercel.app) 배포 뒤 같은 E2E 재실행: 공용·복사·카톡 공유·개별 초대 링크 모두 운영 주소, 공유 이미지 200, 개별 초대 링크 200, 임시 회사 정리 확인.
