import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { fetchOpinetAvgAll } from "./opinet";

// 매일 새벽 오피넷 전국 평균 가격을 받아 oil_price_history에 Upsert(같은 날이면 덮어씀) (D-117)
// 키가 없거나 장애면 저장하지 않고 oil_price_fetch_logs에 실패 기록 + 서버 로그. 계산은 7일 안 가장 최근 값으로 이어진다.
export async function syncOilPrices(admin: NonNullable<ReturnType<typeof createAdminClient>>): Promise<{ ok: boolean; logDate?: string; error?: string }> {
  const key = process.env.OPINET_API_KEY;
  if (!key) {
    const error = "OPINET_API_KEY가 없어 유가를 받지 않았어요";
    console.warn(`[oil] ${error}`);
    await admin.from("oil_price_fetch_logs").insert({ ok: false, message: error });
    return { ok: false, error };
  }
  const r = await fetchOpinetAvgAll(key);
  if (!r.ok) {
    console.error(`[oil] 오피넷 호출 실패: ${r.error}`);
    await admin.from("oil_price_fetch_logs").insert({ ok: false, message: r.error.slice(0, 500) });
    return { ok: false, error: r.error };
  }
  const p = r.prices;
  const { error } = await admin
    .from("oil_price_history")
    .upsert({ log_date: p.logDate, gasoline: p.gasoline, diesel: p.diesel, lpg: p.lpg, source: "opinet", fetched_at: new Date().toISOString() }, { onConflict: "log_date" });
  if (error) {
    console.error(`[oil] 저장 실패: ${error.message}`);
    await admin.from("oil_price_fetch_logs").insert({ ok: false, log_date: p.logDate, message: `저장 실패: ${error.message}`.slice(0, 500) });
    return { ok: false, error: error.message };
  }
  console.info(`[oil] ${p.logDate} 휘발유 ${p.gasoline} · 경유 ${p.diesel} · LPG ${p.lpg}`);
  await admin.from("oil_price_fetch_logs").insert({ ok: true, log_date: p.logDate, message: `휘발유 ${p.gasoline} · 경유 ${p.diesel} · LPG ${p.lpg}` });
  return { ok: true, logDate: p.logDate };
}
