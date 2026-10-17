# T6-0 성능 기반 구축 (화면 개발 전)

- 구현 일시: 2026-10-17
- 기준: D-073, D-074, `spec/common/performance.md`

## 변경 사항
- DB `021_receipt_thumbnails.sql`: `expense_items.receipt_thumb_path`(회사 폴더 check, 부분 인덱스), 저장소 `receipts_select`를 보관본 또는 썸네일 경로가 항목에 등록된 파일로 확장(항목 열람 권한은 items RLS가 다시 건다)
- 테스트 `009_receipt_thumbnails.sql`: 작성자·관리자 = 보관본+썸네일 2개, 같은 회사 다른 직원 0, 다른 회사 0, 등록 안 된 파일 0, 회사 밖 썸네일 경로 거부. 변이 2종(썸네일 조건 제거 / 모든 _thumb 허용) 모두 FAIL로 잡음
- 벤치 `bench_rls.sql` 확대: 회사 200·직원 6,000·소명서 8.4만·영수증 25.2만, 화면 조회 18종. 결과 모두 10ms 이하
  - 발견: `expense_date`를 timestamp와 비교하면 인덱스 날짜 부분 미사용 → date 비교 규칙(16ms → 2.1ms)
  - 사고: 큰 벤치를 연달아 돌려 롤백된 행이 쌓여 DB 디스크 가득 참(736MB, 실서비스 영향 없음 확인). `vacuum full`로 19MB 복구, `--bench`/`--vacuum` 모드 추가로 벤치 뒤 자동 압축
  - 관리 API 약 100초 제한 → 벤치 데이터 생성 최적화(검토자 조회를 회사당 1번)
- 공용 모듈: `receipts/image.ts`(+WebP 실패 시 JPEG 썸네일), `receipts/paths.ts`, `concurrency.ts`, `storage/signed-urls.ts`, `pagination.ts`, `dates.ts` + 단위 테스트(전체 47개)
- 실제 확인: 커서 조건식을 실제 Supabase API에 보내 통과(따옴표·쉼표·괄호 값 포함). 이미지 줄이기를 Chromium·iPhone(WebKit)에서 실행 — 1.47MB → 445KB + 26KB, 0.1~0.3초
- 개발용 점검 화면 `/dev/preview/receipt-image`

## 검증
- tsc·test 47·lint·build, dry-run → migrate → test:db 9종 → db:types, bench:db(자동 압축), 반응형 전 화면 4폭
