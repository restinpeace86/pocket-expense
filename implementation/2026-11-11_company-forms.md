# 회사 양식 등록 (8-104 B) — 2026-11-11

- 근거: spec/features/company-forms.md §B, D-249(시안 승인), D-250(결제 꺼진 동안 1장 등 구현 결정)
- 구현 대상: 관리자가 회사 서류(휴가신청서·일반 결재 문서) 사진·PDF를 올리면 AI가 표 모양과 값 칸을 읽고, PC에서 칸마다 채우는 방법을 정해 등록

## 변경 사항

### DB — `supabase/migrations/140_company_forms.sql`
- `billing_plans.form_slots`(스타터 0·프로 1·비즈니스 3), `companies.extra_form_slots`
- `company_forms`: 버전마다 한 줄(`group_id` + `version`), 상태 draft/active/old/deleted, `sheets`(서류 → 엑셀과 같은 표 모델), `fields`(값 칸), `reads`(AI 읽은 횟수 ≤ 3)
  - 부분 유니크: 양식마다 active 하나·draft 하나, 회사마다 active 휴가신청서 하나
  - RLS 강제: 관리자는 전부, 직원은 active·old만(C의 출력용). 쓰기는 함수로만
- `form_slot_requests`(추가 신청, 회사마다 열린 신청 하나)
- 비공개 버킷 `form-files/{company}/{id}.{ext}` — 사용자 정책 없음, 서버가 관리자 확인 뒤 서명 주소
- 함수(관리자): `company_form_slots`, `company_form_check`(채팅 파일), `company_form_start`, `company_form_read_begin`(종류·칸 확인, 휴가신청서가 있으면 그 양식 새 버전으로 옮김), `company_form_read_done`, `company_form_save`, `company_form_publish`(정할 칸·직원 입력 수·칸 확인 → 새 버전), `company_form_edit`, `company_form_delete`, `form_slot_request`
- 함수(서버 전용): `company_form_due`(30일 지난 초안), `form_slot_grant`(운영자 칸 ±)
- 결제가 꺼진 동안 칸 = 프로(standard) 1장 + 추가 칸(`private.form_slot_limit`) — 결제 연동 때 회사 요금제로

### 서버·라이브러리
- `src/lib/company-forms/model.ts`: 우리 데이터 키(공통·결재란 1~5·휴가), 칸 바인딩(pending/data/input/fixed/blank/drop), `formFromAi`(AI 값 칸 → 칸 목록, 같은 데이터 중복은 정해 주세요), 행 추가/삭제 시 칸 위치 따라가기, `applyDrops`, `validFields`, 오류 문구
- `src/lib/company-forms/gemini.ts`: 서류 → 엑셀 표 읽기 지시문 + 값 칸(slot_label·slot_data) 표시. 크레딧 안 씀
- `src/lib/doc-convert/gemini.ts`: `readPagesWithGemini`로 일반화(서류 → 엑셀과 공용), `sheetFromAi`에 칸 콜백 추가
- `src/lib/company-forms/server.ts`: 채팅/기기 파일 → form-files 옮기기 → 초안, AI 읽기(5쪽·20MB), 지우기, 원본 서명 주소, 새벽 정리(nightly ⑩)
- `src/app/workspace/[id]/admin/company-forms/actions.ts`

### 화면
- 관리자 설정 › **회사 양식**(`/admin/company-forms`): 칸 막대(n/n장·1장 2만 원·[칸 추가 신청]), 등록된 양식(미리보기·고치기·새 버전 올리기(무료)·지우기), 등록 대기(이어 하기·지우기). 휴대폰은 보기만, [양식 추가]·고치기는 "PC에서 해 주세요"
- **어떤 문서인가요** 창: 칸 사용, 휴가신청서 / 일반 결재 문서(2단계) / 지출결의서(→ 지출결의서 양식), 칸을 다 쓰면 B-4 문구 + [추가 신청] / [등록된 양식 바꾸기]
- **편집기**(`/admin/company-forms/[fid]`, PC): ① 레이아웃(원본 ↔ 엑셀 같은 표, 글자·행 추가/삭제·되돌리기 — 칸 위치 따라감) ② 칸 연결(초록 = 정해짐, 노랑 = 정해 주세요, 칸 누르면 정하기·값 칸 추가) ③ 이름 → [등록하기](정할 칸이 남으면 막힘), AI 다시 읽기 2번, 자동 저장
- **칸 정하기** 창: 우리 데이터 / 직원 입력(글·긴 글·날짜·숫자·선택지·직원 고르기, 필수, 휴가 5개·일반 15개) / 고정 값 / 비워 두기 / 빼기 + "값 칸이 아니에요"
- 채팅 사진·PDF 메뉴 **[회사 양식으로 등록]**(관리자만): PC = 어떤 문서인가요 창, 휴대폰 = "PC에서 해 주세요" + [담아 두고 PC에서 이어 하기]
- 운영자 **양식 칸 신청**(`/app-admin/form-slots`): 신청 목록 + [+1장 늘려 주기]/[−1장]
- 공용 표 훅 `src/components/doc-convert/use-sheet-grid.tsx`로 서류 → 엑셀 편집기와 양식 편집기가 같은 표를 씀(리팩터, 동작 같음)

## 검증
- `npx tsc --noEmit`, `npm run test`(417), `npm run build` 통과
- DB 테스트 `supabase/tests/089_company_forms.sql`(관리자만·회사 격리·칸·휴가 하나·읽기 3번·정할 칸·버전·지우기·신청·운영자·새벽 정리) 통과
- 로컬 E2E `e2e-forms.mjs` ALL_OK(실제 Gemini: 빈 휴가신청서에서 칸 10개 — 결재란 2·성명·부서·직급·휴가 종류·기간·사유 자동 연결, 비상연락처·업무 대행자 "정해 주세요"), `e2e-convert.mjs` ALL_OK(리팩터 회귀), leftovers []
- 화면 확인: 칸 연결 1440, 칸 정하기 창, 칸 다 씀 창, 목록 1440/390, 담아 두기 390 — 가로 넘침 없음

## 특이 사항
- Next(cacheComponents)가 이동 전 화면 상태를 남겨 두어, 등록 뒤 목록으로 돌아오면 "어떤 문서인가요" 창이 다시 열리던 문제 → 성공하면 창을 먼저 닫고 이동
- 지운 양식은 줄을 남김(C에서 이미 낸 휴가신청서를 그때 버전으로 출력하기 위해). 원본 파일은 다른 버전이 쓰지 않을 때만 지움
- 결제 연동 때 할 일: `private.form_slot_limit`를 회사 요금제로, [추가 신청] → 1장 2만 원 결제
