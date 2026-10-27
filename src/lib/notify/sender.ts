import "server-only";
import { configuredSiteUrl } from "@/lib/site-url";
import { formatMockAlimtalk } from "./mock-format";

// 알림톡 발송 어댑터 (kakao-alimtalk.md §2, 7차 개선사항 4). 드라이버는 ALIMTALK_DRIVER로 고른다(전략 패턴).
// - log(기본, Mock): 실제로 보내지 않고 서버 콘솔에 템플릿별로 정리된 내용을 찍고 성공으로 돌려준다.
//   notification_logs에는 provider='log', status='sent'
// - 실제 발송대행사 드라이버(⛔ O-01 보류 — 대행사 선정·채널 개설·템플릿 심사 뒤):
//   1) 아래 DRIVERS에 같은 모양(NotificationSender)의 드라이버 하나를 추가한다(예: solapi: solapiSender)
//   2) 환경변수만 바꾼다: ALIMTALK_DRIVER=<이름>, ALIMTALK_API_KEY·ALIMTALK_API_SECRET(대행사 키), ALIMTALK_SENDER_KEY(카카오 채널 발신 프로필 키),
//      ALIMTALK_TEMPLATE_<템플릿 코드>(심사 통과한 템플릿 ID, 예: ALIMTALK_TEMPLATE_APPROVAL_REQUEST)
//   3) 드라이버는 templateIdOf(m.template)와 m.vars(#{변수})로 요청을 만든다. 호출하는 쪽(dispatch.ts)·화면은 바꿀 필요 없다
export type OutgoingMessage = { to: string; template: string; text: string; buttonLabel: string; buttonUrl: string; vars?: Record<string, string> };
export type SendResult = { ok: true; providerMessageId: string | null } | { ok: false; error: string; retryable: boolean };

export interface NotificationSender {
  readonly provider: string;
  send(message: OutgoingMessage): Promise<SendResult>;
}

// 심사 통과한 템플릿 ID (없으면 null — 실제 드라이버는 이때 보내지 않고 실패로 기록해야 한다)
export function templateIdOf(template: string): string | null {
  return process.env[`ALIMTALK_TEMPLATE_${template}`]?.trim() || null;
}

const logSender: NotificationSender = {
  provider: "log",
  async send(m) {
    console.info(formatMockAlimtalk(m, templateIdOf(m.template)));
    return { ok: true, providerMessageId: null };
  },
};

const DRIVERS: Record<string, NotificationSender> = { log: logSender };

export function getSender(): NotificationSender {
  const driver = (process.env.ALIMTALK_DRIVER ?? "log").trim().toLowerCase() || "log";
  if (DRIVERS[driver]) return DRIVERS[driver];
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
