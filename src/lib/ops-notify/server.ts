import "server-only";
import { after } from "next/server";
import { configuredSiteUrl } from "@/lib/site-url";
import { opsPayload, type DiscordPayload, type OpsEvent } from "./format";

// 운영 채널 웹훅: DISCORD_OPS_WEBHOOK_URL(운영 알림 전용 채널) → 없으면 예전 DISCORD_WEBHOOK_URL
export function opsWebhookUrl(): string | null {
  const u = (process.env.DISCORD_OPS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || "").trim();
  return /^https:\/\//.test(u) ? u : null;
}

export async function postOps(payload: DiscordPayload | { content: string }): Promise<void> {
  const url = opsWebhookUrl();
  if (!url) return;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(4000) });
  } catch {
    // 알림 실패는 무시(접수·가입은 이미 끝남, 운영자 화면에 남는다)
  }
}

// 응답을 돌려준 뒤에 보낸다(after) — 디스코드가 느리거나 막혀도 사용자 동작은 늦어지거나 실패하지 않는다
export function notifyOps(e: OpsEvent): void {
  if (!opsWebhookUrl()) return;
  const payload = opsPayload(e, configuredSiteUrl() || "https://damo-on.com");
  try {
    after(() => postOps(payload));
  } catch {
    void postOps(payload);
  }
}
