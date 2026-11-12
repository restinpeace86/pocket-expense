import { BRAND, BRAND_JOSA } from "@/lib/brand";
// 의견 보내기(버그 신고 · 기능 개선, D-246, spec/features/improvement-2026-11.md §C) — 화면·서버 공통
export type FeedbackCategory = "bug" | "feature";
export type FeedbackStatus = "pending" | "reviewing" | "resolved";

export const FEEDBACK_DAILY_LIMIT = 5; // 한 회사 하루(한국 시간)
export const FEEDBACK_MIN = 5;
export const FEEDBACK_MAX = 2000;
export const FEEDBACK_BUCKET = "feedback-files";
// 캡처는 화면에서 JPEG로 줄여 보낸다(서버 동작 요청 1MB 안). 보관함 한도는 5MB
export const FEEDBACK_SHOT_MAX_BYTES = 950 * 1024;
export const FEEDBACK_SHOT_TYPES: Record<string, "jpg" | "png" | "webp"> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const FEEDBACK_PLACEHOLDER = "불편하신 점이나 제안할 아이디어를 편하게 남겨주세요.";

export const FEEDBACK_CATEGORY: Record<FeedbackCategory, { emoji: string; label: string; sub: string }> = {
  bug: { emoji: "🐛", label: "버그 신고", sub: "안 되거나 이상해요" },
  feature: { emoji: "💡", label: "기능 개선", sub: "이렇게 바뀌면 좋겠어요" },
};

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = { pending: "접수", reviewing: "검토 중", resolved: "해결" };

// 보낸 뒤 안내(구분마다 다름, 사용자 문구 — 버그는 '24시간 안에 확인'으로 완화, 서비스 이름 Moa-on)
export const FEEDBACK_DONE: Record<FeedbackCategory, { title: string; paragraphs: string[] }> = {
  bug: {
    title: "소중한 제보 감사합니다!",
    paragraphs: ["확인 후 최대한 빨리 처리할게요.", "제보해 주신 내용은 24시간 안에 확인해요."],
  },
  feature: {
    title: "소중한 아이디어 감사드립니다! 💡",
    paragraphs: [
      "보내주신 개선 의견은 긍정적으로 검토해 추후 업데이트에 적극적으로 반영하도록 하겠습니다.",
      "다만, 해당 내용이 저희 서비스의 전체 뼈대와 실무 프로세스에 부합하는지 면밀히 검토하는 과정이 필요하여, 검토를 거쳐 우리 서비스에 가장 적합한 형태로 다듬어 선보이는 데 다소 시간이 소요될 수 있는 점 너른 양해 부탁드립니다.",
      `앞으로도 직원 여러분의 업무를 더 편안하게 만들어 드릴 수 있도록 꾸준히 발전하는 ${BRAND_JOSA.i} 되겠습니다. 고맙습니다!`,
    ],
  },
};

export const FEEDBACK_ERROR = {
  category: "버그 신고와 기능 개선 중 하나를 골라 주세요.",
  short: `내용을 ${FEEDBACK_MIN}자 이상 적어 주세요.`,
  long: `내용은 ${FEEDBACK_MAX.toLocaleString("ko-KR")}자까지 적을 수 있어요.`,
  shotType: "캡처는 사진(JPG·PNG·WEBP)만 붙일 수 있어요.",
  shotSize: "캡처가 너무 커요. 화면 일부만 캡처해 다시 붙여 주세요.",
  failed: "보내지 못했어요. 다시 눌러 주세요.",
} as const;

// 내용 검사(화면·서버 같은 규칙). 통과하면 null
export function feedbackInputError(category: string | null | undefined, content: string): string | null {
  if (category !== "bug" && category !== "feature") return FEEDBACK_ERROR.category;
  const n = content.trim().length;
  if (n < FEEDBACK_MIN) return FEEDBACK_ERROR.short;
  if (n > FEEDBACK_MAX) return FEEDBACK_ERROR.long;
  return null;
}

// 화면 주소는 경로만(주소 뒤 ? · # 은 뺌 — 토큰·검색어가 섞이지 않게)
export function feedbackPagePath(href: string): string {
  try {
    return new URL(href, "https://x.invalid").pathname.slice(0, 500);
  } catch {
    return "";
  }
}

export const viewportLabel = (w: number, h: number) => `${Math.round(w)}x${Math.round(h)}`;

// 운영자 디스코드 알림 한 줄(내용 첫 줄 60자)
export function feedbackNotifyText(companyName: string, reporter: string, category: FeedbackCategory, content: string, hasShot: boolean): string {
  const first = content.trim().split(/\r?\n/)[0] ?? "";
  const line = first.length > 60 ? `${first.slice(0, 60)}…` : first;
  return `${FEEDBACK_CATEGORY[category].emoji} [${BRAND.name}] ${FEEDBACK_CATEGORY[category].label}: ${companyName} · ${reporter}${hasShot ? " · 캡처 있음" : ""} — "${line}" (운영자 화면 [의견])`;
}

// User-Agent를 사람이 읽을 요약으로(운영자 화면)
export function userAgentSummary(ua: string | null | undefined): string {
  if (!ua) return "알 수 없음";
  const os = /Android/i.test(ua) ? "안드로이드" : /iPhone|iPad|iPod/i.test(ua) ? "아이폰·아이패드" : /Windows/i.test(ua) ? "윈도우" : /Mac OS X|Macintosh/i.test(ua) ? "맥" : /Linux/i.test(ua) ? "리눅스" : "기타";
  const browser = /Edg\//.test(ua) ? "엣지" : /SamsungBrowser/.test(ua) ? "삼성 인터넷" : /KAKAOTALK/i.test(ua) ? "카카오톡" : /Chrome\//.test(ua) ? "크롬" : /Firefox\//.test(ua) ? "파이어폭스" : /Safari\//.test(ua) ? "사파리" : "기타";
  return `${os} · ${browser}`;
}
