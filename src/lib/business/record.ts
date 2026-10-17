import "server-only";
import { checkBusinessNumber } from "@/lib/business/nts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

// 사업자등록번호 국세청 조회 (D-057). 판정·차단은 DB(create_company, update_company_settings)가 한다 — 여기서는 조회 결과만 기록한다.
export async function recordBusinessCheck(supabase: Awaited<ReturnType<typeof createClient>>, bNo: string) {
  const { data: mode } = await supabase.rpc("business_verify_mode");
  if (!mode || mode === "off" || !/^\d{10}$/.test(bNo)) return;
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  const admin = createAdminClient();
  if (!userId || !admin) return; // 기록할 수 없으면 DB가 '확인 대기'로 처리
  const result = await checkBusinessNumber(bNo, process.env.NTS_SERVICE_KEY);
  await admin.from("business_verifications").insert({
    b_no: bNo,
    auth_user_id: userId,
    status: result.status,
    status_label: result.label,
    raw: result.raw as never,
  });
}
