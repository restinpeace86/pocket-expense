# T6-2~T6-6 지출소명서 작성 (편집·영수증 올리기·AI 인식·항목 편집·식대 한도)

- 구현 일시: 2026-10-20
- 기준: `spec/screens/worker-tax-processing.md`(E-02), `spec/features/receipt-parser.md`, `spec/features/smart-meal.md`, `spec/features/trip-expense.md` §2, `spec/common/performance.md` §1·§6, D-034·D-035·D-046·D-048·D-050·D-051·D-054·D-055·D-073

## 변경 사항
- DB `028_claims_delete_policy.sql`: **버그 수정** — 작성 중 소명서 삭제 정책이 항목 테이블을 직접 조회해 "infinite recursion detected in policy"로 실패하던 문제(직원이 임시저장 소명서를 지울 수 없었음). 마감 항목 확인을 `private.claim_has_closed_items`(RLS를 거치지 않는 함수)로 바꿈(조건은 그대로). 새 테스트 014에서 발견
- 테스트 `014_claim_editing.sql`: 화면이 직접 쓰는 열 권한·RLS — 본인만 만들기(다른 사람·다른 회사 X, id 지정 X), 헤더·항목 저장 열, 상태·합계·계산값·크레딧·경로·인식 상태 직접 수정 X, 다른 회사 법인카드 연결 X(복합 FK), 상신된 소명서 수정·항목 추가·삭제 X, 같은 회사 다른 직원·다른 회사 관리자 열람·수정·삭제 X, 마감 항목이 든 소명서 삭제 X, 삭제 시 항목도 함께 삭제
- 화면
  - `/employee/claims/[claimId]/edit` (`ClaimEditor`): 제목(영수증·출장 정보로 자동 제안, 고치면 그 값), 소명 내용, 결제수단 기본값, [출장 경비] 스위치 + 출장지·기간·목적, 영수증 목록(썸네일·가맹점·사용일·분류·법인/사비·분석 중/확인 필요/입력 완료, 휴지통으로 삭제), 합계·회사 지원·개인 부담 + "사비 지급 예정 / 법인카드 한도 초과 납부", 소명서 삭제(작성 중만, 확인 후), 하단 [임시저장] [결재 상신(준비 중)]. 반려 건은 사유 표시
  - 영수증 추가 시트: 카메라 촬영(터치 기기만) / 사진·PDF 선택(한 번에 10장) / 영수증 없이 항목 추가. PC에서는 "카메라 촬영은 모바일에서 사용 가능합니다". 새 소명서(`?add=1`)면 바로 열림
  - `/employee/claims/[claimId]/items/[itemId]` (`ItemEditor`): 사진(누르면 크게, PDF는 열기, 링크 실패 시 안내), AI 입력 표시·[AI로 다시 읽기], 결제수단 + 법인카드 판별 안내 + 사용한 카드(2장 이상일 때), 가맹점·사용일·합계, 사업자번호·공급가액·부가세(접힘), 증빙 구분, 카테고리 4종 + 출장 세부 유형(자차 제외, T7)·구매 세부 유형, 미팅(목적·거래처·참석자·인원), 구매(목적·품목), 숙박(체크인~체크아웃), 기타(적요), 인원 스테퍼, 식대 한도 실시간 안내. 경고: 공급가액+부가세가 합계와 다름, 출장 기간 밖, 소득공제용 현금영수증. 하단 [이전] [저장하고 다음 영수증/완료] [다음]
- 업로드 흐름 (`use-receipt-upload.ts`): 브라우저에서 2000px 보관본·320px 썸네일 → `create_receipt_item`(경로는 서버가 정함) → 저장소에 바로 올리기 → `finishReceiptUploadAction`(크레딧 1장 차감·이벤트 자동 지급 → 보관본으로 AI 인식 → `apply_receipt_parse`). 동시 3장, 단계마다 일시적 실패 1회 재시도(크레딧 부족·장수 초과는 바로 안내), 업로드 실패 시 빈 항목 정리, 크레딧 차감은 항목당 1번(다시 시도해도 두 번 빠지지 않음)
- AI 어댑터 `src/lib/receipts/gemini.ts`: JSON 스키마 강제, 15초 시간 제한, 실패 시 다른 모델로 1회 재시도, `parse-result.ts`로 형식·범위 재검사(사업자번호 10자리, 카드는 끝 4자리만, 미래 날짜 버림, 음수 금액 X)
- 공통: `src/lib/expense/amounts.ts`(DB와 같은 식대 계산, 단위 테스트), `src/lib/expense/title.ts`(제목 제안, 단위 테스트), `src/lib/employee/{claim,editor-types}.ts`, 서버 액션 `employee/claims/actions.ts`, 오류 문구 추가
- 미리보기: employee-claim-edit / -empty(추가 시트) / -trip(반려·출장), employee-item-edit / -trip(숙박·경고) / -manual(영수증 없음·미팅)

## 특이 사항
- **AI 모델**: 같은 영수증으로 실측(AI 처리 시간만, 2026-10-20) — `gemini-flash-latest` 40초 무응답(혼잡, 503), `gemini-flash-lite-latest` 1.3~1.9초에 가맹점·사업자번호·카드 끝 4자리·합계·공급가액·부가세·날짜·카테고리 모두 정확, 출장 소명서에서는 출장비·출장 식비로 추천. 목표(1~3초, receipt-parser.md §4) 때문에 lite를 기본으로 두고 `GEMINI_MODEL`로 바꿀 수 있게 함
- 실데이터 점검: 이메일 로그인이 꺼져 있어(카카오·Google만) 테스트 계정으로 앱 흐름 전체를 직접 돌릴 수 없었다. 대신 DB 권한·격리는 SQL 테스트(013·014, 001의 저장소 격리)로, AI 인식은 실제 Gemini 호출로 확인. 점검 중 만든 임시 회사·계정 1건씩은 모두 삭제함
- 체감 시간 측정 이름: employee.save_claim, employee.save_item, employee.add_manual_item, employee.reread_receipt, employee.receipt_upload_one(사진 1장: 준비 → 업로드 → AI → 반영까지)
- 다음 단계: 결재 상신(T9), 사진 교체, 자차 유류비(T7), 청구 기한 경고(T6-8), 회사 양식(T6-7)

## 검증
- tsc·test 70·lint·build, 028 db:dry(014·001 포함) → migrate → test:db 14종 → db:types → bench:db(직원 목록 2.9ms·소명서 상세 5.1ms 등 모두 50ms 이하, DB 시간)
- 반응형 전 화면 4폭 가로 넘침 없음(출장 기간·숙박 날짜 칸이 휴대폰에서 넘쳐 위아래 배치로 수정) + 스크린샷 확인(편집·추가 시트·반려 출장·항목·숙박 경고·영수증 없는 항목)
