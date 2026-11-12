// 서비스 이름·로고 한 곳(9-14a). 화면·알림·메일·공유 이미지·앱 아이콘이 모두 여기서 가져간다.
// 이름·로고가 바뀌면:
//   1) 이 파일만 고친다(name, mark, color)
//   2) node scripts/apply-brand.mjs — 설치 앱(안드로이드·아이폰) 이름·아이콘, 서비스 워커·앱 첫 화면 이름을 맞춘다
//   3) 배포 + 안드로이드 APK·아이폰 앱 새로 빌드
//   4) DB에 이미 저장된 이름(예: 도우미 대화방 이름 'Moa-on 도우미' — migration 143)은 따로 migration으로 바꾼다
// 빌드 때 글자로 박히는 상수라 화면 속도에 영향이 없다.
// 이 파일은 Node 스크립트(scripts/*.mjs)도 직접 읽으므로 TypeScript 문법은 타입 표시 정도만 쓴다(경로 별칭·enum 금지).

export const BRAND = {
  name: "Moa-on",
  // 이름을 소리 내 읽을 때 끝 글자에 받침이 있나("모아온" → 있음). 이름을 바꾸면 같이 정한다 — 을/를·이/가·은/는·으로/로가 따라 바뀜
  batchim: true,
  // 브랜드 색(웹 화면 색은 src/app/globals.css의 --color-brand-* 토큰 — 바꾸면 같이 맞춘다)
  color: { main: "#4f46e5", deep: "#312e81", ink: "#1e1b4b" },
  // 로고 표시(D-252 "모이는 M"): 44×44 판에 선 하나 + 위 점
  mark: { viewBox: 44, path: "M8 34V14l14 12 14-12v20", stroke: 6, dot: { cx: 22, cy: 8, r: 4 } },
} as const;

// 이름 + 조사(예: "Moa-on을 써요") — 이름이 바뀌어도 조사가 맞게
const b = BRAND.batchim;
export const BRAND_JOSA = {
  eul: `${BRAND.name}${b ? "을" : "를"}`,
  i: `${BRAND.name}${b ? "이" : "가"}`,
  eun: `${BRAND.name}${b ? "은" : "는"}`,
  euro: `${BRAND.name}${b ? "으로" : "로"}`,
} as const;

// 알림 제목 앞 "[이름] " 붙이기·떼기용
export const BRAND_TAG = `[${BRAND.name}]`;
export const BRAND_TAG_RE = new RegExp(`^\\[${BRAND.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\s*`);
