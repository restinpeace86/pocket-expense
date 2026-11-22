import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { SetupState, SetupStatus } from "./setup-wizard";

// 최초 1회 설정 진행(D-300): 기록은 회사 단위(DB, 관리자만 보임) · 진행 띠를 켜 둔 상태는 이 브라우저 쿠키(사람마다)
export const SETUP_COOKIE = "pe_setup_on";

export async function getSetupState(): Promise<SetupState> {
  const supabase = await createClient();
  const [{ data: w }, { data: rows }] = await Promise.all([
    supabase.from("setup_wizards").select("legacy, intro_answered_at, finished_at").maybeSingle(),
    supabase.from("setup_wizard_steps").select("step_key, status"),
  ]);
  const statuses: Record<string, SetupStatus> = {};
  for (const r of rows ?? []) statuses[r.step_key] = r.status as SetupStatus;
  return { legacy: !!w?.legacy, introAnswered: !!w?.intro_answered_at, finished: !!w?.finished_at, statuses };
}

export async function setupBarOn(): Promise<boolean> {
  return (await cookies()).get(SETUP_COOKIE)?.value === "1";
}
