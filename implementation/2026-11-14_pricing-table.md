# 요금표 개편 + 원가 실측 (9-26·9-27, D-271)

- 구현 일시: 2026-11-13 ~ 14 (migration 158 운영 적용: 사용자 승인 "DB 운영 적용 승인할께")

## 변경 사항
- DB `158_storage_total.sql`: `billing_plans.storage_mb`(10240·51200·204800)·`form_slots_unlimited`·`support_label`, max_members 모두 null, 비즈니스 영수증 무제한*(1,000)·서류 300건, 양식 칸 0·5·무제한, `private.storage_total_limit`(요금제 + 추가 공간 = 누적 합산 한도), `chat_storage_limit`·`vault_limit` = 전체 − 다른 쪽 사용량, `private.form_slot_limit`(effective_plan, 무제한 = 1,000), `storage_addon_status`에 total_used·total_limit
- DB 테스트: 012·065·073·085·089·092·093을 새 값에 맞춤(085·089·065는 테스트 안에서만 한도를 줄여 예전 흐름 확인)
- 앱: `plan-benefits.ts`(+test) 비교표 줄, 요금 기준 문구, 요금제 읽기 칸, `storage-status.tsx` 공용 막대, 회사 양식 화면에서 2만 원·칸 추가 신청 없앰, 미리보기 샘플
- E2E: `shot-pricing`(비교표 문구), `e2e-storage`(공용 20GB), `e2e-forms`(칸 5장, 2만 원 없음)

## 원가 실측 (`.responsive/live/bench-ai-cost.mjs`, 2026-11-13)
- 앱과 같은 지시문·응답 스키마·모델(gemini-flash-lite-latest → gemini-3.5-flash-lite)로 견본 파일 전송, usageMetadata
- 영수증 7장(2000px JPEG 36~139KB): 입력 2,002~2,011토큰(사진 1,066~1,075) · 출력 268~414토큰 · 생각 0 → 장당 약 $0.0014 ≈ 2원
- 서류(휴가신청서 1쪽) 3번: 입력 1,462 · 출력 849~1,049 · 생각 0 → 쪽당 약 $0.0029 ≈ 4원(복잡한 표는 쪽당 10원 안팎으로 봄)
- 단가(집계 사이트 기준, 공식 요금표 재확인 필요): 3.5 Flash-Lite 입력 $0.30·출력 $2.50 / 100만 토큰, 1달러 = 1,400원
- 저장소 실제 파일 크기(전체 통계): 영수증 원본 평균 283~415KB · 미리보기 10~15KB, 채팅 첨부 평균 512KB
- 화면은 미리보기만 받고 원본은 누를 때·ZIP 받을 때만(영수증·채팅·보관함 모두 이미 그렇게 됨)
- 원가율(한도까지 다 씀, 고정비 50곳 기준 · 카드 수수료 3.3% 포함): 스타터 약 12% · 프로 약 14% · 비즈니스 약 18%(복잡한 서류 300건 최악 약 32%)
