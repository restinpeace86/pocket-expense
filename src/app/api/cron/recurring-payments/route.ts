import { connection, NextResponse, type NextRequest } from "next/server";
import { sendRecurringReady } from "@/lib/notify/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

// 정기 결제(D-110): 매일 아침(vercel.json) 결제일이 된 정기 결제마다 담당자 앞으로 작성 중 결의서를 만들고 알린다.
// 같은 기간은 DB가 한 번만 만든다(여러 번 불려도 안전). CRON_SECRET이 없거나 맞지 않으면 아무것도 하지 않는다.
export async function GET(request: NextRequest) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  const { data, error } = await admin.rpc("generate_recurring_claims");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data ?? []) as { claim_id: string; company_id: string; member_id: string; service_name: string; period_label: string; amount: number }[];
  const notified = await sendRecurringReady(rows);
  return NextResponse.json({ ok: true, created: rows.length, notified });
}
