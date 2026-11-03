# 채팅 첨부 저장·트래픽 줄이기 (D-204)

- 구현 대상: 사내 메신저 첨부 — 사진 화질, 미리보기, 주소 재사용·캐시, 90일 보관, 요금제별 저장 한도, 새벽 정리
- 구현 일시: 2026-11-03
- 근거: 사용자 결정(카톡 일반 화질 수준, 보관 90일, 한도 1/3/10GB, "전부 다"), `spec/features/messenger.md` §7, decision-log D-204

## 변경 사항
- DB `supabase/migrations/108_chat_attachment_limits.sql`
  - `billing_plans.chat_storage_mb`(1024/3072/10240), `chat_messages.attachment_thumb_path`·`attachment_thumb_size`·`attachment_purged_at`, 인덱스 2개, `app_settings.chat_attachment_days = 90`
  - `private.chat_storage_limit`(지금은 스타터) · `private.chat_storage_used` · `public.chat_storage_status()`
  - `chat_send`: 미리보기 경로도 그 회사·그 방 경로만, 크기는 저장소 실제 크기 우선, 한도 넘으면 `STORAGE_FULL`
  - `chat_message_json`: `attachment_thumb_path`, `expired`(지운 파일은 경로 숨김)
  - 서버 전용 `chat_files_due`(90일 지남·삭제한 메시지·메시지 안 된 하루 지난 파일), `chat_files_mark_purged`
- 화면
  - `src/lib/receipts/image.ts` `processChatImage`(1280 JPEG 0.8 + 480 WebP 0.75), 단위 테스트 추가
  - `src/components/chat/signed-urls.ts`: 서명 주소 50분 재사용(메모리 + sessionStorage)
  - `chat-room.tsx`: 원본·미리보기 업로드(cacheControl 1년), 말풍선 = 미리보기, 크게 보기 = 원본, 삭제 때 둘 다 지움, 한도 초과 안내, 만료 말풍선
  - `src/lib/chat/purge.ts` + `/api/cron/nightly`에 ③ 채팅 첨부 정리
- 테스트: `supabase/tests/065_messenger.sql` ⑤-3(한도·미리보기 경로·90일 정리·서버 전용·expired), E2E `.responsive/live/e2e-chat.mjs`(1280×960 + 미리보기 2개 파일, cacheControl, 말풍선=미리보기, 크게 보기=원본, 90일 정리 뒤 만료 말풍선)

## 특이 사항
- 결제 연동 전이라 회사에 요금제가 없음 → 모든 회사 한도 = 스타터 1GB. 결제 연동(B-4) 때 `private.chat_storage_limit`가 회사 요금제를 읽게 바꾼다.
- 예전(이 변경 전) 사진은 미리보기가 없어 말풍선에 원본을 쓴다(페이퍼컴퍼니 2장).
- Supabase 이미지 변환(서버에서 크기 바꾸기)은 Pro 전용이라 쓰지 않고 브라우저에서 만든다.
- 새벽 정리는 Vercel cron(`CRON_SECRET`)으로 돈다 — 로컬에는 비밀값이 없어 E2E에서 같은 순서(due → remove → mark)로 직접 실행해 확인.

## 추가 (2026-11-04, D-205) 요금 카드 표시
- `src/lib/billing/plan-benefits.ts` `storageLabel`·혜택 줄 "사내 채팅 사진·파일 저장 nGB"(sub "사진·파일은 90일 보관"), 랜딩 `pricing.tsx`·`getBillingPlans`가 `chat_storage_mb`를 읽음, 미리보기 샘플 값 채움.
- 확인: tsc·test(269)·build, `.responsive/live/check-pricing-storage.mjs` ALL_OK(랜딩 390·1280, 관리자 요금제 390·1280 — 1GB·3GB·10GB, 넘침 없음), 스크린샷 확인.
