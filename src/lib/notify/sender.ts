import "server-only";
import { configuredSiteUrl } from "@/lib/site-url";

// 알림톡 발송 어댑터 (kakao-alimtalk.md §2). 드라이버는 ALIMTALK_DRIVER로 고른다.
// - log(기본): 실제로 보내지 않고 서버 로그에 남긴다. notification_logs에는 provider='log', status='sent'
// - 실제 발송대행사 드라이버는 대행사 선정 뒤 추가한다(⛔ O-01 보류) — 여기에 같은 모양의 드라이버 하나만 붙이면 된다
export type OutgoingMessage = { to: string; template: string; text: string; buttonLabel: string; buttonUrl: string };
export type SendResult = { ok: true; providerMessageId: string | null } | { ok: false; error: string; retryable: boolean };

export interface NotificationSender {
  readonly provider: string;
  send(message: OutgoingMessage): Promise<SendResult>;
}

const logSender: NotificationSender = {
  provider: "log",
  async send(m) {
    console.info(`[alimtalk:log] ${m.template} → ${m.to.slice(0, 3)}-****-${m.to.slice(-4)}\n${m.text}\n[${m.buttonLabel}] ${m.buttonUrl}`);
    return { ok: true, providerMessageId: null };
  },
};

export function getSender(): NotificationSender {
  const driver = (process.env.ALIMTALK_DRIVER ?? "log").trim().toLowerCase();
  if (driver === "log" || driver === "") return logSender;
  // 아직 없는 드라이버 이름이면 보내지 못한 것으로 기록한다(조용히 무시하지 않음)
  return {
    provider: driver,
    async send() {
      return { ok: false, error: `알림톡 드라이버 '${driver}'가 아직 연결되지 않았습니다`, retryable: false };
    },
  };
}

// 알림 버튼 링크 앞주소: NEXT_PUBLIC_SITE_URL → 없으면 Vercel 운영 도메인(D-099)
export function siteUrl(): string {
  return configuredSiteUrl();
}
