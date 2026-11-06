# 랜딩 사업자 정보 접기·축소 (D-233)

- 구현 일시: 2026-11-07
- 구현 대상: 사용자 결정 — 랜딩 사업자 정보는 상호·이메일만, [사업자 정보 ▾]로 접기, 전화·주소는 나중에 사용자가 정할 때

## 변경 사항
- `src/components/legal/documents.tsx`: `OPERATOR.phone = ""`(휴대폰 번호 비공개), `SHOW_FULL_BUSINESS_INFO = false` 추가, 약관 운영자 정보에서 빈 주소·전화는 숨김.
- `src/app/page.tsx`: 푸터 사업자 정보를 `<details>`로 접기(기본 접힘), 보이는 칸 = 상호·이메일(스위치 true면 채워진 칸 모두).

## 특이 사항
- 전체 표시로 바꾸려면 `SHOW_FULL_BUSINESS_INFO = true` + `OPERATOR.phone`·`address` 채우기(todo 8-84, 사용자 결정 대기).

## 검증
- tsc · `npm run test`(318개) · build 통과
- e2e-bizinfo(360·1280, 로컬·운영): 접힘 기본 · 펼치면 상호·이메일만 · 전화·대표·사업자번호·주소 없음 · 넘침 없음 · /terms·/privacy 휴대폰 번호 없음·이메일 있음. 스크린샷 확인.
