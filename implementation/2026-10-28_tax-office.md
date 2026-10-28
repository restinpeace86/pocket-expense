# 2026-10-28 세무사무소 워크스페이스 (todo_improvement 개선사항 2, D-149 — D-148 대체)

## 구현 대상
- 1차(D-148): 세무사 개인 이메일을 회사가 지정 → 세무사 화면. 커밋 fa44c3e
- 사용자 결정으로 다시 설계(D-149): 회사가 계약하는 상대는 **세무사무소**, 담당 세무사는 **사무소가 배정**. 사무소 워크스페이스를 따로 두고 회사별 리스트로. 회사가 사무소 이메일·담당 세무사를 넣으면 사무소 목록에 뜨고(사무소가 없으면 등록하는 순간), 사무소 관리자 = 전체 / 세무사 = 담당만, 사무소는 직접 등록

## 변경 사항
- DB(migration 076): D-148 구조(`tax_agent_links`, 실제 0행) 걷어냄 → `tax_offices`·`tax_office_members`·`company_tax_offices`(모두 RLS 강제). 회사 함수 `set_company_tax_office`·`clear_company_tax_office`·`my_company_tax_office`, 사무소 함수 `my_tax_office`·`register_tax_office`(국세청 확인 `check_business_number` 재사용)·`get_tax_office_by_code`·`join_tax_office`·`tax_office_clients`·`assign_tax_office_agent`·`tax_office_member_list`·`set_tax_office_member_status`·`regenerate_tax_office_code`·`tax_office_month_export`, 내부 `tax_office_company_ids`(관리자 = 전체, 세무사 = 배정)·`attach_tax_office_clients`(등록·합류 시 요청 붙이기·담당 이메일 자동 배정). 세무 마감 행 계산은 075의 `private.tax_month_export_for` 공용(관리자 세무 마감과 같은 행). 계정과목·분류 연결에 사무소 정책(조회·추가·수정)
- 회사: `/workspace/[id]/admin/tax-office`(`company-tax-office-form.tsx`) — 가입 대기/연결됨 + 담당 세무사 표시, 안내 복사, 정보 바꾸기, 연결 끊기. 설정 메뉴 [세무사무소]
- 사무소: `/tax-office` 레이아웃(구성원 아님 → 등록·합류 화면 `tax-office-onboarding.tsx`, 이용 중지 → 안내, 구성원 → 워크스페이스 틀), 고객사 목록·담당 배정(`assign-select.tsx`), `/tax-office/manage`(`office-manage.tsx`), `/tax-join/[code]`(`join-tax-office-form.tsx`), 월별 자료·엑셀·계정과목(D-148 화면 재사용, 조회 함수만 교체). `src/lib/tax-office/queries.ts`, `src/app/tax-office/actions.ts`
- 로그인 이동: 회사 멤버가 아니고 사무소 구성원이거나 내 이메일로 연결 요청이 있으면 `/tax-office`, `next=/tax-join/…` 허용(단위 테스트)
- 처리방침: 세무사무소 정보·세무사무소 이용자 항목, 고객사가 지정한 사무소 열람은 고객사 처리
- spec: `spec/screens/tax-office.md` 다시 씀, schema 2.1a5, roles-and-permissions, admin-settings, routes

## 특이 사항
- 연결은 요청 원문대로 승인 없이 즉시(사무소 이메일 기준). 오타 위험은 저장 전 안내·이메일 변경 확인 창·[연결 끊기]로 줄임. 확인된 이메일만 인정
- 사무소 등록 뒤 같은 주소(/tax-office)로 돌아오면 레이아웃이 예전 등록 화면으로 남는 문제를 E2E에서 발견 → 등록·합류 뒤 `revalidatePath("/tax-office", "layout")`
- 휴대폰 폭에서 회사 이름이 길면 고객사 카드가 넘치던 것 → 카드 `min-w-0`(말줄임)
- 초대 메일 발송 수단이 없어 [세무사무소 안내 복사]·[초대 안내 복사]로 대신
- 회계 프로그램별 양식은 O-02(양식 파일 입수 후), 사무소 내려받기 기록은 요청 범위 밖(제안 4-1 ①)
- 빌드 검증 중 PC 메모리 부족으로 여러 번 실패 → 메모리 여유가 생긴 뒤 통과(빌드 작업자 2개 + Node 4GB, 설정 파일 되돌림)

## 확인
- `npx tsc --noEmit` 통과, `npm run test` 198개 통과
- DB 테스트 `047_tax_offices.sql` 통과(직원 지정 불가·값 검증·등록 전 요청만·등록 시 요청 붙음·승인 지출만·회사 테이블 직접 열람 불가·사업자번호/이메일 중복·미확인 이메일 불가·초대 코드·자동 배정·세무사 = 담당만·배정 권한·멤버 겸 세무사·이용 중지 즉시 차단·사무소 변경·연결 끊기·관리자 세무 마감 그대로) + 025·026·011·001·046 통과
- `npm run build` 통과
- 화면 진입 E2E `.responsive/live/e2e-tax-office.mjs` 34/34: 가입 대기·안내 복사·직원 차단·사무소 이메일 로그인 → 요청 보임·사무소명 미리 채움·등록 → 고객사·다른 회사 자동 누적·초대 코드·합류 → 자동 배정·세무사 사무소 관리 불가·회사 화면 담당 표시·관리자 배정·세무사 = 담당만·승인 지출만·영수증·엑셀·배정 안 된 회사 404·워크스페이스 불가·새로고침 없는 회사 전환·계정코드 수정·삭제 버튼 없음·이용 중지·사무소 변경·연결 끊기·관리자 세무 마감 회귀. 390·1280 넘침 0, 스크린샷 확인. 테스트 회사·사무소 0개 남음
- 회귀: e2e-flow 17 OK, e2e-referral 20/20
