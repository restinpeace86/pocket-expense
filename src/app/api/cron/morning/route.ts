import { connection, NextResponse, type NextRequest } from "next/server";
import { sendRecurringReady } from "@/lib/notify/dispatch";
import { runClosingReminders } from "@/lib/push/closing";
import { runPushReminders } from "@/lib/push/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

// 매일 아침 07:00(KST) 작업 하나로 모음(vercel.json): ① 정기 결제 결의서 만들기(D-110) ② 웹푸시 리마인더(D-116) ③ 관리자 월말 마감 알림(D-161)
// CRON_SECRET이 없거나 맞지 않으면 아무것도 하지 않는다. 여러 번 불려도 같은 날 같은 일은 한 번만.
export async function GET(request: NextRequest) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  const out: Record<string, unknown> = { ok: true };
  const { data, error } = await admin.rpc("generate_recurring_claims");
  if (error) out.recurring_error = error.message;
  else {
    const rows = (data ?? []) as { claim_id: string; company_id: string; member_id: string; service_name: string; period_label: string; amount: number }[];
    out.recurring = { created: rows.length, notified: await sendRecurringReady(rows) };
  }
  try {
    out.push = await runPushReminders();
  } catch (e) {
    out.push_error = e instanceof Error ? e.message : String(e);
  }
  try {
    out.closing = await runClosingReminders();
  } catch (e) {
    out.closing_error = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(out);
}
