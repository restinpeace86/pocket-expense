# 랜딩 색 보완 (9-15, D-263)

- 구현 일시: 2026-11-13
- 근거: 사용자 2026-11-12 "밝은색으로 바꾼 뒤 밋밋해짐, 다우오피스 캡처 참고(색은 똑같이 말고)" → 시안 artifact(https://claude.ai/artifact/5g15b4pxE36pkpC9KcgUn5) → 2026-11-13 "어 일단 이렇게 해줘"(진행 / 버튼 그라데이션 통일 / 보조색 5개 추천안)
- Spec: `spec/screens/landing-page.md` §0-2

## 변경 사항
- `src/components/landing/accent.ts`(새): 구역 보조색 클래스 묶음 `ACCENT`(expense 인디고·attend 청록·collab 주황·docs 하늘·tax 분홍), 브랜드 버튼 `BRAND_BUTTON`(인디고→보라)
- `src/components/landing/why-art.tsx`(새): "다른 점" 카드 안 작은 화면 그림 4개(구독 하나·AI 채움·양식 엑셀·마감 파일) — HTML만, aria-hidden
- `src/app/page.tsx`: 상단·히어로·끝 CTA 버튼 그라데이션, 히어로 빛 바탕·그라데이션 이름·인디고 배지, 섹션 소제목(eyebrow), 다른 점 벤토, 기둥 색 띠·타일·체크, 이어짐·흐름·누구에게 구역색 타일, "모든 플랜에 전부 포함" 그라데이션 카드, 경비 카드 인디고 선
- `src/components/landing/hero-mockup.tsx`: 구역색 태그, [결재 올리기], 떠 있는 결과 카드 3개(`data-hero-chip`), 진한 인디고 테두리
- `src/components/landing/feature-preview.tsx`: 고른 탭·CTA 버튼을 브랜드 그라데이션으로(진한 띠는 그대로)

## 확인
- tsc · test 80/446 · lint · build 통과
- `.responsive/live/shot-landing-color.mjs` 1280·768·390 ALL_OK, 스크린샷 직접 확인(PC에서 결과 카드가 휴대폰 글자를 가려 위·아래 바깥으로 옮김, 768에서 벤토 글자가 좁아 카드 안 가로 배치는 lg부터로 바꿈)
- `e2e-landing-sims.mjs` ALL_OK, `shot-pricing.mjs` OK

## 특이 사항
- 문구·섹션 순서·기능은 바꾸지 않음(색·그림만). 요금제 카드(초록 추천)·후기·FAQ는 그대로
- 휴대폰에서 히어로 목업은 처음 보일 때 재생되는 방식 그대로(재생 전 순간엔 알림톡 말풍선 자리가 비어 보임)
