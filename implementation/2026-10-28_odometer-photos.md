# 2026-10-28 자차 계기판 사진 2장 + 세무 양식·할인 정리 (D-144, D-145)

## 구현 대상
- T7-5 자차 출발·도착 계기판 사진 2장(회사 설정을 켰을 때만 필수, D-070 ②) — 사용자 지시 2026-10-28
- 계정코드 안내 보강, 거래처코드·업로드 양식·연속 결제 보너스 결정 기록, todo 정리 — 사용자 결정 2026-10-28

## 변경 사항
### DB (migration 073, 테스트 `supabase/tests/045_odometer_photos.sql` — test:db에 등록)
- `expense_items.odometer_start_path`·`odometer_end_path`(자기 회사 경로만 check). 직원 열 권한 없음
- `public.attach_odometer_photo(item, 'start'|'end')`: 본인 작성 중 결의서의 자차 항목만, 경로 `{company}/{member}/{claim}/{item}_odo_{which}.jpg`를 정해 적고 돌려줌
- `public.detach_odometer_photo(item, which)`: 칸 비우고 지운 경로 돌려줌
- `receipts_select` 정책에 두 칸 추가(자기 회사 항목에 적힌 경로만 열람)
- `private.claim_problems`: 회사 `odometer_photo_required`면 자차 항목에 두 장 없을 때 `odometer_photos`

### 화면
- 관리자 [지출 한도·정책] 자차 유류비 지원 안에 "출발·도착 계기판 사진 받기 (선택)" 다시 보임(D-121 해제), 도움말 문구 복원
- 직원 결의서 자차 경로 아래 `OdometerPhotos`(새 `src/components/employee/odometer-photos.tsx`): [출발 계기판] [도착 계기판] 두 칸, 카메라·앨범, 이미지만, 영수증처럼 줄여 저장, [바꾸기]·지우기. 업로드 실패 시 칸 되돌림. 영수증 목록 '확인 필요'(`odometerMissing`), 상신 막힘 안내 "출발·도착 계기판 사진 2장"
- 결재 화면 영수증 패널: 경로 증빙 아래 두 장(누르면 크게)
- 영수증 패널 휴대폰 배치 수정: 줄 높이를 내용 높이로(`auto-rows-max`) — 사진 칸 내용이 아래 정보와 겹치던 문제(계기판 사진으로 드러남, 긴 영수증 사진에도 해당)
- 항목·작성 중 결의서를 지우면 계기판 사진도 지움
- 계정과목 화면·세무 마감 화면: "더존 기본 계정코드라 회계 프로그램과 다를 수 있어요. 확인하고 다르면 바꿔 주세요"

### 문서
- spec: trip-expense §4, schema, admin-settings, tax-upload-format(거래처코드 빈칸·양식 파일 입수 시 반영), pricing-policy(O-09 보류 유지)
- decision-log: D-144, D-145, O-02·O-09 갱신
- todo: 맨 위 "오픈 전 — 사업자등록 후 할 일"(B-1~B-6)로 흩어진 보류 항목 모음(중복 제거), T7-5 완료, T10-4 갱신, 7-14

## 확인
- `npx tsc --noEmit` 통과, `npm run test` 190개 통과, 전 DB 테스트 드라이런 통과 → `db:migrate` 적용 → `db:types`
- `npm run build` 통과(이 PC 메모리가 부족해 검증할 때만 빌드 작업자 2개로 실행, 설정 파일은 되돌림)
- `.responsive/live/e2e-odometer.mjs`(운영 빌드): 360·1280 두 칸·넘침 0 / 사진 없이 상신 → 막힘("출발·도착 계기판 사진 2장") / 두 장 올림 → 저장소 파일 2개 → 상신 성공 / 결재 화면 390·1280 두 장 표시·패널 넘침 0 / 설정 끄면 칸 없음
- `.responsive/live/shot-odometer-setting.mjs`: 설정 360·1280 표시·넘침 0·저장
- 회귀: e2e-flow 17개 OK, e2e-routecard 통과. 테스트 회사(smoke-e2e) 0개 남음(도중 실패한 실행 2건의 잔여분도 정리)

## 특이 사항
- 세무 마감 ZIP에는 계기판 사진을 넣지 않았다(스펙에 정해지지 않음) — 필요하면 따로 결정
- 상신 막힘 안내에서 자차 항목 이름이 "영수증 1 (가맹점 미입력)"으로 보인다(기존 동작, 자차 경로 칸도 같음). 경로 이름으로 바꾸는 건 별도 개선 후보
