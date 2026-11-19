// 솔라피(SOLAPI) 알림톡 요청 만들기·응답 읽기 — 순수 함수(단위 테스트). 실제 보내기는 sender.ts의 solapiSender (D-297, B-3/T8-3)
// API: POST https://api.solapi.com/messages/v4/send-many/detail
//  - 인증: Authorization: HMAC-SHA256 apiKey=<키>, date=<ISO 시각>, salt=<임의 글자>, signature=hex(HMAC-SHA256(secret, date + salt))
//  - 본문: { messages: [{ to, from?, kakaoOptions: { pfId, templateId, variables: { "#{변수}": "값" }, disableSms: true } }], showMessageList: true }
//  - 응답: { groupInfo, failedMessageList: [{ statusCode, statusMessage }], messageList: [{ messageId, statusCode, statusMessage }] }
//  접수(=솔라피가 받음)까지가 여기서 아는 결과다. 카카오 실제 도착 여부는 솔라피 콘솔 발송 내역에서 본다
import { createHmac } from "node:crypto";

export const SOLAPI_SEND_URL = "https://api.solapi.com/messages/v4/send-many/detail";

export type SolapiConfig = { apiKey: string; apiSecret: string; pfId: string; from: string | null };

export function solapiAuthHeader(apiKey: string, apiSecret: string, date: string, salt: string): string {
  const signature = createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

// 우리 변수 { 상신자: "김개발" } → 솔라피 변수 { "#{상신자}": "김개발" } (값은 모두 글자)
export function solapiVariables(vars: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars ?? {})) out[`#{${k}}`] = String(v ?? "");
  return out;
}

export function solapiBody(m: { to: string; vars?: Record<string, string> }, templateId: string, cfg: Pick<SolapiConfig, "pfId" | "from">) {
  return {
    messages: [
      {
        to: m.to.replace(/\D/g, ""),
        ...(cfg.from ? { from: cfg.from.replace(/\D/g, "") } : {}),
        // 문자 대체 발송은 하지 않는다(앱 알림·채팅 [알림]방이 이미 갔고, 문자는 비용·발신번호 심사가 따로)
        kakaoOptions: { pfId: cfg.pfId, templateId, variables: solapiVariables(m.vars), disableSms: true },
      },
    ],
    showMessageList: true,
  };
}

export type SolapiResult = { ok: true; providerMessageId: string | null } | { ok: false; error: string; retryable: boolean };

type SolapiResponse = {
  errorCode?: string;
  errorMessage?: string;
  failedMessageList?: { statusCode?: string; statusMessage?: string }[];
  messageList?: { messageId?: string; statusCode?: string; statusMessage?: string }[];
  groupInfo?: { groupId?: string; _id?: string };
};

// HTTP 상태 + 응답 JSON → 결과. 5xx·429는 잠시 뒤 다시(자동 재시도 1회), 4xx·접수 실패는 다시 보내도 같으므로 재시도 안 함
export function parseSolapiResponse(status: number, json: unknown): SolapiResult {
  const r = (json ?? {}) as SolapiResponse;
  if (status >= 500 || status === 429) return { ok: false, error: `솔라피 일시 오류(${status})${r.errorMessage ? `: ${r.errorMessage}` : ""}`, retryable: true };
  if (status < 200 || status >= 300) return { ok: false, error: `솔라피 거절(${status})${r.errorCode ? ` ${r.errorCode}` : ""}${r.errorMessage ? `: ${r.errorMessage}` : ""}`, retryable: false };
  const failed = r.failedMessageList?.[0];
  if (failed) return { ok: false, error: `솔라피 접수 실패${failed.statusCode ? `(${failed.statusCode})` : ""}${failed.statusMessage ? `: ${failed.statusMessage}` : ""}`, retryable: false };
  const msg = r.messageList?.[0];
  return { ok: true, providerMessageId: msg?.messageId ?? r.groupInfo?.groupId ?? r.groupInfo?._id ?? null };
}
