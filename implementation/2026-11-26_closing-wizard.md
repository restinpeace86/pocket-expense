# 2026-11-26 월 마감 도우미 · 저장 공간 80% 알림 · 랜딩 문구 (D-315·D-316·D-317)

## 구현 대상
- 사용자 지시(2026-11-26): 마감일 할 일을 설정 마법사처럼 순서대로(홈택스 세금계산서 올리기 유도, 연결된 사무소면 마감 완료 + 세무사 알림), 저장 공간 80% 알림, 랜딩 문구 정리

## 변경 사항
- 월 마감 도우미: src/lib/admin/closing-wizard.ts(+test) · closing-wizard-server.ts · app/workspace/[id]/admin/closing/page.tsx · components/admin/closing-handoff.tsx · closing-home-card.tsx
- 홈택스 안내: components/tax-office/hometax-guide.tsx(검색어 3종), 회사 쪽 홈택스 자료 상자에 접힌 안내(도우미에서는 펼침)
- 관리자 홈 카드, 세무 마감 화면 링크, 마감 알림 버튼 → 도우미(notify/templates.ts), 도우미 답 링크 글자(chat/format.ts)
- 저장 공간 알림: migration 175 + supabase/tests/108 + nightly cron 호출 + database.types
- 랜딩: app/page.tsx(히어로·고민→해결·안심 띠·다른 점 문구), feature-preview(쉬운 말), faq(마감하고 알리기)

## 검증
- tsc · vitest 530 · build 통과
- migration 175 dry-run + test 108(80%·반복 없음·100%·내려갔다 다시·다른 회사·직원·권한) 통과 — 운영 적용은 승인 대기
- 로컬 E2E e2e-closing-wizard ALL_OK: 홈 카드 → ① 대기 1건 → 처리 후 ② → ③ 화면에서 홈택스 CSV 올림 → ④ 마감하고 알리기 → DB 마감·사무소 현황판 마감 완료·홈 카드 사라짐, 390·1280 넘침 없음, leftovers []
- 랜딩 shot-landing-copy ALL_OK(390·1280 넘침 없음, 스크린샷 확인)

## 특이 사항
- 홈택스 메뉴 경로는 개편 후 출처마다 달라 '검색창에 넣을 말'로 안내(126 상담·세무사 수임 시 건너뛰기 안내 포함)
- 도우미 단계 상태는 저장하지 않음(실제 데이터) — 새 표 없음
