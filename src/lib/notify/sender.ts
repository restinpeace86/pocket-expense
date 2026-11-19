import "server-only";
import { configuredSiteUrl } from "@/lib/site-url";
import { formatMockAlimtalk } from "./mock-format";
import { parseSolapiResponse, SOLAPI_SEND_URL, solapiAuthHeader, solapiBody, type SolapiConfig } from "./solapi-format";
import { randomBytes } from "node:crypto";

// 알림톡 발송 어댑터 (kakao-alimtalk.md §2, 7차 개선사항 4). 드라이버는 ALIMTALK_DRIVER로 고른다(전략 패턴).
// - log(기본, Mock): 실제로 보내지 않고 서버 콘솔에 템플릿별로 정리된 내용을 찍고 성공으로 돌려준다.
//   notification_logs에는 provider='log', status='sent'
// - solapi(D-297, 발송대행사 = 솔라피, O-01 선정): 환경변수(Vercel)만 넣으면 실제로 보낸다.
//   ALIMTALK_DRIVER=solapi, ALIMTALK_API_KEY·ALIMTALK_API_SECRET(솔라피 API 키), ALIMTALK_SENDER_KEY(카카오 채널 pfId),
//   ALIMTALK_FROM(솔라피에 등록한 발신번호, 없어도 됨), ALIMTALK_TEMPLATE_<템플릿 코드>(심사 통과한 템플릿 ID, 예: ALIMTALK_TEMPLATE_APPROVAL_REQUEST)
//   템플릿 ID가 없는 알림은 보내지 않고 실패로 기록한다(심사 안 된 글을 보내지 않게). 호출하는 쪽(dispatch.ts)·화면은 같다
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

function solapiConfig(): SolapiConfig | null {
  const apiKey = process.env.ALIMTALK_API_KEY?.trim();
  const apiSecret = process.env.ALIMTALK_API_SECRET?.trim();
  const pfId = process.env.ALIMTALK_SENDER_KEY?.trim();
  if (!apiKey || !apiSecret || !pfId) return null;
  return { apiKey, apiSecret, pfId, from: process.env.ALIMTALK_FROM?.trim() || null };
}

const solapiSender: NotificationSender = {
  provider: "solapi",
  async send(m) {
    const cfg = solapiConfig();
    if (!cfg) return { ok: false, error: "솔라피 키(ALIMTALK_API_KEY·ALIMTALK_API_SECRET·ALIMTALK_SENDER_KEY)가 설정되지 않았습니다", retryable: false };
    const templateId = templateIdOf(m.template);
    if (!templateId) return { ok: false, error: `카카오 심사를 통과한 템플릿이 없습니다(${m.template}) — 앱 알림·채팅으로만 전달됩니다`, retryable: false };
    try {
      const res = await fetch(SOLAPI_SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: solapiAuthHeader(cfg.apiKey, cfg.apiSecret, new Date().toISOString(), randomBytes(16).toString("hex")) },
        body: JSON.stringify(solapiBody(m, templateId, cfg)),
        signal: AbortSignal.timeout(10_000),
      });
      return parseSolapiResponse(res.status, await res.json().catch(() => null));
    } catch (e) {
      return { ok: false, error: `솔라피 연결 실패: ${e instanceof Error ? e.message : "알 수 없음"}`, retryable: true };
    }
  },
};

const DRIVERS: Record<string, NotificationSender> = { log: logSender, solapi: solapiSender };

function driverName(): string {
  return (process.env.ALIMTALK_DRIVER ?? "log").trim().toLowerCase() || "log";
}

// 카카오 알림톡을 실제로 보낼 준비가 됐는지(설정 카드에서 켤 수 있는지): 솔라피 드라이버 + 키 + 이 템플릿들의 심사 통과 ID
export function alimtalkReady(codes: readonly string[]): boolean {
  return driverName() === "solapi" && solapiConfig() !== null && codes.every((c) => templateIdOf(c) !== null);
}

export function getSender(): NotificationSender {
  const driver = driverName();
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
