import "server-only";
import { postNoticeCards } from "@/lib/notify/card";
import { pushConfigured, pushToMembers } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMonthlyReport, prevMonthOf, reportCard, type ReportItem } from "./monthly";

// 지난달 지출 리포트(D-319): 매월 1일 아침 cron(service role). 회사마다 관리자(대표·관리자)에게 [알림]방 카드 + 앱 알림.
// 같은 달 리포트는 사람마다 한 번(push_logs kind=closing, ref=report:YYYY-MM). opts.companyId·month = 한 회사만(시험용, CRON_SECRET 뒤)
type ItemRow = { company_id: string; amount: number | null; expense_date: string | null; account_title_name: string | null; expense_claims: { member_id: string; status: string } };

export async function runMonthlyReports(opts: { today?: string; companyId?: string; month?: string } = {}): Promise<{ companies: number; sent: number; skipped?: string }> {
  const today = opts.today ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  if (!opts.month && today.slice(8, 10) !== "01") return { companies: 0, sent: 0, skipped: "not-first-day" };
  const admin = createAdminClient();
  if (!admin) return { companies: 0, sent: 0 };
  const month = opts.month ?? prevMonthOf(today.slice(0, 7));
  const from = `${prevMonthOf(month)}-01`;
  const [y, m] = month.split("-").map(Number);
  const nextFirst = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  const rows: ItemRow[] = [];
  for (let off = 0; ; off += 1000) {
    let q = admin
      .from("expense_items")
      .select("company_id, amount, expense_date, account_title_name, expense_claims!inner(member_id, status)")
      .in("expense_claims.status", ["submitted", "approved", "paid"])
      .gte("expense_date", from)
      .lt("expense_date", nextFirst)
      .order("id")
      .range(off, off + 999);
    if (opts.companyId) q = q.eq("company_id", opts.companyId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as ItemRow[]));
    if (!data || data.length < 1000) break;
  }
  const byCompany = new Map<string, ItemRow[]>();
  for (const r of rows) byCompany.set(r.company_id, [...(byCompany.get(r.company_id) ?? []), r]);

  let companies = 0;
  let sent = 0;
  for (const [companyId, list] of byCompany) {
    if (!list.some((r) => r.expense_date?.startsWith(month))) continue; // 지난달 지출이 없으면 보내지 않음
    const [{ data: people }, { data: budget }] = await Promise.all([
      admin.from("members").select("id, name, role, status").eq("company_id", companyId),
      admin.from("company_budgets").select("monthly_amount").eq("company_id", companyId).is("account_title_id", null).maybeSingle(),
    ]);
    const names = new Map((people ?? []).map((p) => [p.id, p.name as string]));
    const items: ReportItem[] = list.map((r) => ({ ym: (r.expense_date ?? "").slice(0, 7), amount: r.amount ?? 0, account: r.account_title_name, member: names.get(r.expense_claims.member_id) ?? "(퇴사자)" }));
    const card = reportCard(buildMonthlyReport(month, items, budget?.monthly_amount ?? null));
    const admins = (people ?? []).filter((p) => p.status === "approved" && (p.role === "admin" || p.role === "super_admin")).map((p) => p.id);
    const fresh: string[] = [];
    for (const memberId of admins) {
      const { data: f } = await admin
        .from("push_logs")
        .upsert({ company_id: companyId, member_id: memberId, kind: "closing", ref: `report:${month}` }, { onConflict: "member_id,kind,ref,sent_on", ignoreDuplicates: true })
        .select("member_id");
      if (f?.length) fresh.push(memberId);
    }
    if (!fresh.length) continue;
    companies++;
    const url = `/workspace/${companyId}/admin/spending?month=${month}`;
    await postNoticeCards(admin, companyId, fresh, { title: card.title, lines: card.lines, url }).catch(() => 0);
    if (pushConfigured()) {
      const r = await pushToMembers(companyId, fresh, { title: card.title, body: card.lines[0], url, tag: `report-${month}` }).catch(() => ({ sent: 0 }));
      sent += r.sent;
    }
  }
  return { companies, sent };
}
