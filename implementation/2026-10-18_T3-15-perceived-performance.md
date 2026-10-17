# T3-15 화면 체감 시간 측정 기반

- 구현 일시: 2026-10-18
- 기준: D-075, `spec/common/performance.md` §7

## 변경 사항
- DB `022_perf_events.sql`: `perf_events`(RLS 강제·앱 사용자 권한 없음), `record_perf_events(jsonb)`(로그인 사용자만, 30건/요청, 사용자당 10분 300건, 지표·동작 이름 검증, 회사 id는 서버가 채움, 90일 지난 기록 가끔 정리)
- 테스트 `010_perf_events.sql`: 비로그인 불가, 로그인 기록 가능·표 읽기 불가·직접 쓰기 불가, 잘못된 지표·동작 이름 거부, 31건 거부, 회사 id 기록
- 화면: `WebVitals`(루트 레이아웃, `useReportWebVitals` — 첫 화면·화면 이동 모두), `recordPerf`/`measureAction`/`flushPerf`(15초마다·페이지 숨김 시 sendBeacon), 경로 정규화(`route.ts`, 단위 테스트), `/api/perf`(항상 204, 측정 실패가 화면에 영향 없음), `NEXT_PUBLIC_BUILD_ID`(배포 커밋)
- 버튼 결과 시간: 설정 저장, 가입 승인·거절, 멤버 상세 변경, 부서 변경
- `npm run perf:report`(최근 7일 화면·지표·기기별 p50·p75·p95)
- 개발용 점검 화면 `/dev/preview/perf-check`: 브라우저가 보내는 내용 확인(경로 id → [id] 확인, 기록 대상 밖 화면의 동작은 보내지 않음 확인)

## 검증
- tsc·test 50·lint·build, dry-run → migrate → test:db 10종 → db:types, 반응형 전 화면 4폭

## 특이 사항
- 앞서 보고한 "16ms → 2ms"는 DB 쿼리 시간(A)이었다. 이제부터 화면 체감 시간(B)으로 판단한다
- 로그인 후 화면만 기록하므로 배포 후 실제로 써야 데이터가 쌓인다
