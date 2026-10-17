# T3-14 자가운전보조금 받음 + 계기판 사진 받기

- 구현 일시: 2026-10-17
- 기준: D-070, D-071(제품 원칙), `spec/features/trip-expense.md` §4, `admin-team-members.md` §4.C, `admin-settings.md` §2

## 변경 사항
- DB `020_car_allowance_odometer.sql`: `members.receives_car_allowance`(기본 false), `companies.odometer_photo_required`(기본 false). `update_member`·`update_company_settings`에 인자 추가(기본 null = 바꾸지 않음, 기존 호출 그대로 동작). 두 컬럼 모두 직접 UPDATE 불가
- 테스트: 005(관리자 지정·인자 없이 편집해도 유지·직접 수정 차단·다른 회사 NOT_FOUND·직원 본인 수정 불가), 007(저장·인자 없이 저장해도 유지·기본 끔)
- 화면: 멤버 상세 기본 정보에 "자가운전보조금 받음" 체크 + 한 줄 설명 + 도움말, 읽기 전용 보기에 표시. 설정 자차 유류비 "km당 단가로 지원" 안에 "출발·도착 계기판 사진 받기 (선택)" 체크, 도움말에 증빙 방식 안내
- 제품 원칙(D-071)을 `project/overview.md` §1-1에 기록

## 검증
- tsc·test 25·lint·build, dry-run → migrate → test:db 8종 → db:types, 반응형 전 화면 4폭 + 새 체크 영역 스크린샷(390·1280) 확인
