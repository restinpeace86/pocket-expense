import Link from "next/link";
import { Suspense } from "react";
import { Panel, TableWrap, td, th } from "@/components/app-admin/app-admin-shell";
import { formatKst } from "@/lib/app-admin/labels";
import { requireAppAdmin } from "@/lib/app-admin/guard";
import { maskPhone } from "@/lib/notify/templates";

export const metadata = { title: "알림 이력 · PocketExpense 운영자" };

// 회사별 알림톡 발송 이력·실패 사유 (D-159, 개선사항 2): 회사 관리자 화면에서 옮겨 온 CS용 조회 화면(읽기 전용, D-080).
// ?company=회사 id & status=failed. 최근 200건
const TEMPLATE_LABEL: Record<string, string> = {
  APPROVAL_REQUEST: "결재 요청",
  APPROVAL_COMPLETED: "승인 완료",
  APPROVAL_REJECTED: "반려",
  PAYOUT_COMPLETED: "지급 완료",
  INVITE: "초대",
  REMINDER: "독촉",
  RECURRING_READY: "정기 결제 준비",
  CLOSING: "월말 마감",
};
const STATUS: Record<string, [string, string]> = {
  queued: ["대기", "bg-zinc-100 text-zinc-700"],
  sent: ["성공", "bg-emerald-50 text-emerald-700"],
  failed: ["실패", "bg-red-50 text-red-700"],
};

export default function AppAdminNotificationsPage({ searchParams }: PageProps<"/app-admin/notifications">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/app-admin/notifications">, "searchParams">) {
  const sp = await searchParams;
  const companyId = typeof sp.company === "string" && /^[0-9a-f-]{36}$/.test(sp.company) ? sp.company : null;
  const failedOnly = sp.status === "failed";
  const { admin } = await requireAppAdmin();
  let q = admin
    .from("notification_logs")
    .select("id, company_id, claim_id, recipient_member_id, recipient_phone, template_code, status, provider, error_message, created_at, sent_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (companyId) q = q.eq("company_id", companyId);
  if (failedOnly) q = q.eq("status", "failed");
  const [{ data, error }, { data: companies }] = await Promise.all([q, admin.from("companies").select("id, name").order("name").limit(1000)]);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const memberIds = [...new Set(rows.map((r) => r.recipient_member_id).filter((x): x is string => !!x))];
  const claimIds = [...new Set(rows.map((r) => r.claim_id).filter((x): x is string => !!x))];
  const [{ data: members }, { data: claims }] = await Promise.all([
    memberIds.length ? admin.from("members").select("id, name").in("id", memberIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    claimIds.length ? admin.from("expense_claims").select("id, title").in("id", claimIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const companyName = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const memberName = new Map((members ?? []).map((m) => [m.id, m.name]));
  const claimTitle = new Map((claims ?? []).map((c) => [c.id, c.title]));
  const failed = rows.filter((r) => r.status === "failed").length;
  const href = (c: string | null, f: boolean) => {
    const p = new URLSearchParams();
    if (c) p.set("company", c);
    if (f) p.set("status", "failed");
    const s = p.toString();
    return s ? `/app-admin/notifications?${s}` : "/app-admin/notifications";
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">알림 이력</h1>
        <p className="mt-1 break-keep text-sm text-zinc-500">
          회사별 카카오 알림톡 발송 기록과 실패 사유예요(최근 200건). 고객 문의를 받을 때 확인하세요. 회사 관리자 화면에는 보이지 않아요.
          {(process.env.ALIMTALK_DRIVER ?? "log") === "log" && " 지금은 개발 모드라 실제로 보내지 않고 기록만 남아요."}
        </p>
      </div>
      <Panel
        title={`발송 ${rows.length.toLocaleString("ko-KR")}건 · 실패 ${failed.toLocaleString("ko-KR")}건`}
        action={
          <form action="/app-admin/notifications" className="flex flex-wrap items-center gap-2 text-sm">
            <label className="sr-only" htmlFor="nl-company">
              회사
            </label>
            <select id="nl-company" name="company" defaultValue={companyId ?? ""} className="min-h-9 max-w-[14rem] rounded-lg border border-zinc-300 bg-white px-2">
              <option value="">전체 회사</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="inline-flex min-h-9 items-center gap-1.5">
              <input type="checkbox" name="status" value="failed" defaultChecked={failedOnly} />
              실패만
            </label>
            <button type="submit" className="inline-flex min-h-9 items-center rounded-lg bg-zinc-900 px-3 font-medium text-white">
              보기
            </button>
            {(companyId || failedOnly) && (
              <Link href={href(null, false)} className="text-zinc-500 underline underline-offset-2">
                초기화
              </Link>
            )}
          </form>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">{failedOnly ? "실패한 알림이 없어요." : "보낸 알림이 없어요."}</p>
        ) : (
          <TableWrap>
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className={th}>시각</th>
                  <th className={th}>회사</th>
                  <th className={th}>종류</th>
                  <th className={th}>받는 사람</th>
                  <th className={th}>결의서</th>
                  <th className={th}>상태</th>
                  <th className={th}>실패 사유</th>
                  <th className={th}>발송 경로</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const [label, tone] = STATUS[r.status] ?? [r.status, "bg-zinc-100 text-zinc-700"];
                  return (
                    <tr key={r.id} className={r.status === "failed" ? "bg-red-50/40" : undefined}>
                      <td className={`${td} whitespace-nowrap`}>{formatKst(r.created_at)}</td>
                      <td className={td}>
                        <Link href={href(r.company_id, failedOnly)} className="hover:underline">
                          {companyName.get(r.company_id) ?? "(삭제된 회사)"}
                        </Link>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{TEMPLATE_LABEL[r.template_code] ?? r.template_code}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {r.recipient_member_id ? (memberName.get(r.recipient_member_id) ?? "알 수 없음") : "초대 받는 사람"}
                        <span className="block text-xs text-zinc-500">{maskPhone(r.recipient_phone)}</span>
                      </td>
                      <td className={td}>{r.claim_id ? (claimTitle.get(r.claim_id) ?? "(삭제됨)") : "-"}</td>
                      <td className={td}>
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                      </td>
                      <td className={`${td} min-w-48 break-all text-red-700`}>{r.error_message ?? ""}</td>
                      <td className={`${td} whitespace-nowrap text-zinc-500`}>{r.provider}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
