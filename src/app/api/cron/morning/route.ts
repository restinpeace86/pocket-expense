import { connection, NextResponse, type NextRequest } from "next/server";
import { sendRecurringReady } from "@/lib/notify/dispatch";
import { runClosingReminders } from "@/lib/push/closing";
import { runPushReminders } from "@/lib/push/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

// 매일 아침 07:00(KST) 작업 하나로 모음(vercel.json): ① 개인카드 정기 결제 결제일 알림(D-110→D-171) ② 웹푸시 리마인더(D-116) ③ 관리자 월말 마감 알림(D-161)
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
  // 정기 결제(D-171): 결의서는 카드 내역 대조에서 결제가 확인될 때만 만든다. 개인카드 정기 결제는 결제일에 담당자에게 알림만
  const { data, error } = await admin.rpc("recurring_personal_due");
  if (error) out.recurring_error = error.message;
  else {
    const rows = ((data ?? []) as { company_id: string; member_id: string; service_name: string; period_label: string; amount: number }[]).map((r) => ({ ...r, claim_id: null }));
    out.recurring = { reminded: await sendRecurringReady(rows) };
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
