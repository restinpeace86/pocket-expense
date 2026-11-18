// 운영자 디스코드 알림(D-293): 신규 회사 가입 · 의견 · 저장 공간 신청 · 회계 양식 접수 · 후기
// 디스코드는 바깥 서비스라 개인정보는 보내지 않는다 — 회사 이름 + 내용 요약 + 운영자 화면 링크만(사용자 2026-11-18)
// - 보낸 사람 이름·전화·이메일·사업자번호는 넣지 않는다
// - 사용자가 내용에 직접 적은 이메일·전화번호·사업자번호 모양은 요약에서 가린다
import { BRAND } from "@/lib/brand";
import { FEEDBACK_CATEGORY, type FeedbackCategory } from "@/lib/feedback-desk/format";

export type OpsEvent =
  | { kind: "signup"; company: string; companyId: string }
  | { kind: "feedback"; company: string; category: FeedbackCategory; content: string; hasShot: boolean }
  | { kind: "storage"; company: string; gb: number }
  | { kind: "format"; company: string; program: string }
  | { kind: "review"; company: string; rating: number; review: string };

export type DiscordPayload = {
  embeds: { title: string; description: string; url?: string; color: number; footer: { text: string }; timestamp: string }[];
};

const SUMMARY_MAX = 100;

// 요약: 줄바꿈·여러 칸을 한 칸으로, 개인정보 모양은 가리고, 100자에서 자름
export function opsSummary(text: string, max = SUMMARY_MAX): string {
  const masked = text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "(이메일)")
    .replace(/\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, "(전화번호)")
    .replace(/\b\d{3}-\d{2}-\d{5}\b/g, "(사업자번호)")
    .replace(/\s+/g, " ")
    .trim();
  return masked.length > max ? `${masked.slice(0, max)}…` : masked;
}

// smoke-e2e 자동 점검 회사는 제목에 '테스트'를 붙여 실제 가입·의견과 헷갈리지 않게
export const isTestCompany = (name: string) => name.startsWith("smoke-e2e-");

const COLOR = { signup: 0x22c55e, feedback: 0x4f46e5, storage: 0xf59e0b, format: 0x0ea5e9, review: 0xec4899 } as const;

export function opsPayload(e: OpsEvent, origin: string, now: Date = new Date()): DiscordPayload {
  const company = opsSummary(e.company, 60);
  let title: string;
  let description: string;
  let path: string;
  switch (e.kind) {
    case "signup":
      title = "🏢 신규 회사 가입";
      description = `**${company}**`;
      path = `/app-admin/companies/${e.companyId}`;
      break;
    case "feedback": {
      const c = FEEDBACK_CATEGORY[e.category];
      title = `${c.emoji} 새 의견 · ${c.label}`;
      description = `**${company}**${e.hasShot ? " · 캡처 있음" : ""}\n> ${opsSummary(e.content) || "(내용 없음)"}`;
      path = "/app-admin/feedback";
      break;
    }
    case "storage":
      title = "💾 저장 공간 추가 신청";
      description = `**${company}** · ${e.gb === 0 ? "추가 공간 해지" : `${e.gb}GB`}`;
      path = "/app-admin/storage";
      break;
    case "format":
      title = "📥 회계 양식 맞춤 요청";
      description = `**${company}** · ${e.program}`;
      path = "/app-admin/format-requests";
      break;
    case "review": {
      const r = Math.max(0, Math.min(5, Math.round(e.rating)));
      const text = opsSummary(e.review);
      title = "⭐ 새 후기·설문";
      description = `**${company}** · ${"★".repeat(r)}${"☆".repeat(5 - r)}${text ? `\n> ${text}` : ""}`;
      path = "/app-admin/reviews";
      break;
    }
  }
  const base = origin.replace(/\/+$/, "");
  return {
    embeds: [
      {
        title: `${isTestCompany(e.company) ? "🧪 테스트 · " : ""}${title}`,
        description,
        ...(base ? { url: `${base}${path}` } : {}),
        color: COLOR[e.kind],
        footer: { text: `${BRAND.name} 운영 알림 · 제목을 누르면 운영자 화면으로` },
        timestamp: now.toISOString(),
      },
    ],
  };
}
