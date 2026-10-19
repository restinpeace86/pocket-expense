# T6-1 직원 메인 (E-01) + T6 작성용 DB 함수

- 구현 일시: 2026-10-20
- 기준: `spec/screens/worker-dashboard.md`, `spec/common/ui-rules.md` §4, D-046·D-054·D-067(모바일 우선)·D-073

## 변경 사항
- DB `027_claim_drafting.sql`: `expense_claims.default_payment_method`, `private.item_amounts`(식대·출장 식비 1식 한도: 개인 한도 우선 × 인원, 절사/알림), `private.lock_my_editable_claim`, `refresh_claim_totals`, `create_receipt_item`(소명서당 30장, 출장 소명서는 출장비 고정), `apply_receipt_parse`(빈칸만 채움, 미래 날짜 무시, 첫 인식 때만 법인카드 판별), `my_employee_summary`
- 테스트 `013_claim_drafting.sql`: 본인 소명서만, 다른 회사·다른 사람 NOT_FOUND, 30장 제한, 한도 계산, 빈칸 채움
- 화면
  - `employee/layout.tsx` + `EmployeeShell`: 헤더, 휴대폰 폭 가운데 정렬, 하단 고정 메뉴(홈 / 정산·내 정보는 준비 중, safe-area 여백). 소명서 편집 경로(`/claims/`)에서는 하단 메뉴 숨김
  - `EmployeeHomeView`: 사비 정산 대기금 카드, 반려 배너(누르면 반려 필터), 월 이동(미래 달 막음)·상태 필터(URL `?month=&status=`), 소명서 카드(분류·제목·사용일 기간·결제수단 요약·장수·합계·상태 배지), 커서 "더 보기"(20건씩), 반려 카드 → 하단 팝업(사유 붉은 글씨 + [수정 후 재상신하기]), 하단 고정 [영수증 찍고 지출 올리기](크레딧 0 + 이벤트 꺼짐이면 안내 문구)
  - `createDraftClaimAction`: 본인 회사·본인으로 draft 생성 → 편집 화면(`?add=1`)으로. `loadMoreMyClaimsAction`
  - 모든 버튼 동작은 `measureAction`으로 체감 시간 기록(employee.create_claim, employee.load_more_claims)
- 공통: `src/lib/expense/status.ts`(배지 5종·필터·월 파싱/이동, 단위 테스트), `src/lib/employee/{queries,types}.ts`, `src/lib/credits.ts`(이벤트 설정: 값이 없으면 켜짐)
- 미리보기: employee-home / -empty / -blocked / -rejected / ?theme=emerald

## 특이 사항
- 조회는 본인 소명서만 명시적으로 고른다(company_id + member_id, 인덱스 `expense_claims_company_member_idx`). 관리자가 직원 모드에서 봐도 본인 것만 보인다
- 편집 화면(`/claims/[id]/edit`)·읽기 전용 상세(`/claims/[id]`)는 T6-2에서 만든다(지금은 카드를 눌러도 404)

## 검증
- tsc·test 54·lint·build, test:db 13종(027 dry → migrate)
- 반응형 전 화면 4폭 가로 넘침 없음 + 직원 메인 360·768·1280 스크린샷(전체 페이지·화면 크기 둘 다) 확인: 하단 버튼이 하단 메뉴 위에 붙고 목록을 가리지 않음, 반려 팝업, 크레딧 0 안내
