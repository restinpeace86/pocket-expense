# 개선사항(2차) 4 — 출장비 결의서 모드 · 자차 경로 원페이지 (D-097)

- 구현 일시: 2026-10-22
- 변경
  - `src/components/employee/item-editor.tsx`: 영수증 카테고리에서 출장비 제외(식대/외부 미팅비/회사 물품 구매). 출장 결의서면 카테고리 칸 대신 "출장비 세부 유형" 칩만(고르면 category=trip). 출장 경비를 끈 결의서에 남은 출장비 영수증은 "카테고리를 다시 골라 주세요" 안내.
  - `src/components/employee/own-car-editor.tsx`: 전체 화면 `OwnCarEditor` → 인라인 `OwnCarInline`. 항목이 없으면 첫 장소를 고를 때 `createOwnCarItemAction`으로 만든 뒤 경로 저장. 사용일·적요는 0.8초 자동 저장 + 상신 전 저장(flush 등록).
  - `src/components/employee/claim-editor.tsx`: 이동 수단 [자차]를 누르면 경로 칸 바로 펼침. 경로마다 접기/펼치기(접으면 요약 카드). 새 경로 칸은 항목이 생겨도 같은 key로 이어 그려 입력 중인 장소가 지워지지 않음. 영수증 목록·상신 안내의 자차 행은 출장 영역의 그 경로를 펼치고 스크롤.
  - 항목 주소(자차 포함)는 모두 `/edit?item=<id>`로 이동. 미리보기 `employee-claim-edit-owncar` 추가(check:responsive 목록에도).
  - `route-evidence-card.tsx`: 360px에서 제목이 잘리던 것 → 줄바꿈 허용.
- 데이터: DB 변경 없음(기존 `create_own_car_item`, `set_own_car_route`, `apply_route_distance`, 출장 결의서 영수증 기본 category=trip 그대로).
- 검증
  - tsc / test 128 / lint / build 통과.
  - 로그인 E2E(`.responsive/live/e2e-owncar-inline.mjs`, 360): 일반 결의서 카테고리에 출장비 없음 · 출장 결의서 영수증은 세부 유형만 → [자차] 누르면 경로 칸 펼침(이때 DB 항목 0) → 출발지 자동완성 0.83초 → 첫 장소 선택 시 항목 1개 생성 → 도착지 선택 후 증빙 카드 표시 2.37초(화면 기준, Kakao 길찾기 포함) → 왕복 표시 0.07초(화면) · DB 754.2km/150,840원 → 적요 자동 저장 → 문서 새로 열림 0회, 주소 그대로 → 접기/목록 행으로 다시 펼침 → 예전 자차 주소 → 결의서 화면에서 펼침. 390·768 가로 넘침 0. 개선사항 3 E2E 재실행 통과, 임시 회사 정리(leftovers []).
  - check:responsive(편집 미리보기 4종 × 4폭) 넘침 없음, 360 스크린샷·브라우저 콘솔 오류 0 확인.
- 특이 사항: 코드 커밋(40b029f) 때 문서 반영 스크립트가 인코딩 오류로 빠져 문서는 뒤따른 docs 커밋으로 반영.
