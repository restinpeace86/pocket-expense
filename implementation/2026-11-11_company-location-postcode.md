# 회사 위치 = 우편번호 검색 (todo_improvement 개선사항 2) — 2026-11-11

- 근거: D-251 ⑥, spec/features/bus.md(회사 위치)
- 구현 대상: 아무 글자나 넣고 [위치 찾기]를 누르면 엉뚱한 곳이 잡히던 회사 위치 입력을 표준 우편번호 검색으로

## 변경 사항
- migration 142: `company_locations.jibun_address`·`zonecode`(5자리), `company_location_save(..., p_jibun, p_zonecode)`, `bus_company_nearby()`가 지번·우편번호도 돌려줌
- `postcode-dialog.tsx`: 다음(카카오) 우편번호 서비스를 화면 가운데 창 안에 넣음(embed). 도로명·지번·건물명 검색, 키·비용 없음. 스크립트 주소는 **t1.kakaocdn.net**(위젯 공지: t1.daumcdn.net 2026-11-30 종료)
- `company-location-card.tsx`: [주소 검색] → 고르면 바로 저장 → 도로명(건물명)·지번·우편번호 칸 + 주변 정류장 결과
- `location-actions.ts`: 도로명으로 카카오 좌표, 안 되면 지번으로. 좌표·시도도 함께 저장(위치 기반 기능 대비, 4번 지도에서 씀)
- DB 테스트 084: 우편번호 5자리 검사, 지번·우편번호 저장·조회

## 검증
- tsc, test(417), test:db, build 통과
- E2E `e2e-location.mjs` ALL_OK — 지번 "삼평동 670" 검색 → 대왕판교로 660 / 삼평동 670 / 13494 / 좌표 저장, 휴대폰 저장 주소 보임·검색 창 가로 넘침 없음, leftovers []
- 화면: 검색 창 390, 저장 1440·390 확인

## 특이 사항
- 이전에 저장한 회사는 지번·우편번호가 비어 있음("다시 고르면 함께 저장돼요")
- 검색 창 안(다른 도메인 iframe)에 커서가 있으면 Esc가 안 먹어서 X·바깥 누르기로 닫음
