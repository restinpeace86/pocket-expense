# 자차 경로 요약 증빙 이미지 파일 (D-088)

- 구현 대상: 사용자 지적 — 자차 유류비는 영수증이 없으니 경로 카드가 지출결의서의 근거자료(증빙)여야 함
- 구현 일시: 2026-10-21

## 변경 사항
- migration 041: `expense_items.route_card_path`(경로는 `{company}/route-cards/…`만, 직원 쓰기 권한 없음), 영수증 열람 정책에 포함, 경로·거리·왕복·금액이 바뀌면 연결 해제 트리거.
- `src/lib/claims/route-card-file.tsx`: `renderRouteCardPng`(next/og, 1100×1000, Noto Sans KR 필요한 글자만 Google Fonts에서), `attachRouteCards(claimId)`(service role로 생성·업로드·연결, 이미 연결된 항목은 건너뜀).
- `submitClaimAction`: 상신 성공 뒤 `after()`로 `attachRouteCards`.
- 관리자·검토자·직원 상세의 영수증 패널·썸네일: 증빙 이미지 표시(눌러서 크게), 없으면 값으로 그린 카드.
- 항목 삭제 시 증빙 파일도 서버가 삭제.
- 스펙 `trip-expense.md`, `schema.md`, 결정 D-088(D-085 ⑤ 보완).

## 검증
- DB `supabase/tests/024_route_card_file.sql`: 다른 회사 경로 거부, 직원 열람 가능·연결 칸 쓰기 거부(42501)·route-cards 폴더 업로드 거부, 같은 회사 대표 열람, 다른 회사 대표 안 보임, 관계없는 칸 변경 시 유지·왕복/거리/금액 변경 시 연결 해제. `test:db` 24개 통과.
- 로그인 E2E(임시 회사, 증빙 파일까지 삭제 확인): 상신 → 목록 이동 1.2초(화면 체감, 이미지 생성은 응답 뒤라 상신을 늦추지 않음) → 3.0초 뒤 증빙 이미지 연결(91,753 bytes, 한글 정상) → 관리자 패널에 이미지 표시(원본 폭 1100px).
- tsc / test / lint / build / check:responsive 통과.
