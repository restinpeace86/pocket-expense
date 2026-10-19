import Link from "next/link";
import { formatBizNo, formatKst } from "@/lib/app-admin/labels";
import { MonthNav, Panel, TableWrap, td, th } from "./app-admin-shell";

export type CompanyOverviewRow = {
  company_id: string;
  name: string;
  business_number: string;
  created_at: string;
  billing_status: string;
  credits_granted: number;
  credits_used: number;
  members_approved: number;
  members_pending: number;
  receipts_total: number;
  receipts_month: number;
  receipts_deleted: number;
  last_receipt_at: string | null;
};

// 운영자 첫 화면: 회사별 크레딧·영수증 현황
export function CompaniesView({ rows, month, base = "/app-admin" }: { rows: CompanyOverviewRow[]; month: string; base?: string }) {
  const sum = (k: keyof CompanyOverviewRow) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const cards: [string, string][] = [
    ["가입 회사", `${rows.length.toLocaleString("ko-KR")}곳`],
    [`${Number(month.slice(5))}월 영수증(크레딧 사용)`, `${sum("receipts_month").toLocaleString("ko-KR")}장`],
    ["전체 크레딧 사용", `${sum("credits_used").toLocaleString("ko-KR")}장`],
    ["직원이 지운 영수증", `${sum("receipts_deleted").toLocaleString("ko-KR")}장`],
  ];
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">회사별 영수증 현황</h1>
          <p className="text-sm text-zinc-500">크레딧을 쓴 영수증은 직원이 지워도 기록이 남습니다. 회사를 누르면 영수증 한 장씩 볼 수 있어요.</p>
        </div>
        <MonthNav month={month} hrefFor={(m) => `${base}?month=${m}`} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{k}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <Panel title="회사 목록">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">가입한 회사가 없습니다.</p>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>회사</th>
                  <th className={th}>사업자번호</th>
                  <th className={th}>가입일</th>
                  <th className={`${th} text-right`}>멤버(대기)</th>
                  <th className={`${th} text-right`}>크레딧 지급 / 사용 / 남음</th>
                  <th className={`${th} text-right`}>{Number(month.slice(5))}월 영수증</th>
                  <th className={`${th} text-right`}>전체 / 지움</th>
                  <th className={th}>마지막 업로드</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.company_id} className="hover:bg-zinc-50">
                    <td className={td}>
                      <Link href={`${base}/companies/${r.company_id}?month=${month}`} className="font-medium text-blue-700 underline-offset-2 hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{formatBizNo(r.business_number)}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatKst(r.created_at).slice(0, 10)}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {r.members_approved}
                      {r.members_pending > 0 && <span className="text-amber-700"> ({r.members_pending})</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                      {r.credits_granted} / {r.credits_used} / <b>{r.credits_granted - r.credits_used}</b>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{r.receipts_month}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                      {r.receipts_total} / <span className={r.receipts_deleted > 0 ? "text-red-600" : undefined}>{r.receipts_deleted}</span>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatKst(r.last_receipt_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
