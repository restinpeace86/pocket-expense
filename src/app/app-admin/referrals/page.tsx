import Link from "next/link";
import { Suspense } from "react";
import { Panel, TableWrap, td, th } from "@/components/app-admin/app-admin-shell";
import { formatKst } from "@/lib/app-admin/labels";
import { requireAppAdmin } from "@/lib/app-admin/guard";
import { formatPhone } from "@/lib/format";

export const metadata = { title: "추천 현황 · PocketExpense 운영자" };

type Filter = "all" | "paid" | "unpaid";
const FILTERS: [Filter, string][] = [
  ["all", "전체"],
  ["paid", "첫 결제 완료"],
  ["unpaid", "미결제"],
];

// 추천(레퍼럴) 현황 (D-147): 가입 회사가 적은 추천 회사·추천인과 첫 결제 여부. 운영자가 보고 직접 보상을 챙긴다(조회만)
export default function ReferralsPage({ searchParams }: PageProps<"/app-admin/referrals">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/app-admin/referrals">, "searchParams">) {
  const sp = await searchParams;
  const filter: Filter = sp.filter === "paid" || sp.filter === "unpaid" ? sp.filter : "all";
  const { admin } = await requireAppAdmin();
  const { data, error } = await admin
    .from("company_referrals")
    .select("company_id, kind, referrer_company_id, referrer_company_name, referrer_name, referrer_phone, created_at, companies!company_referrals_company_id_fkey(name, created_at, first_purchase_at), members(name, phone)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const all = data ?? [];
  const paidCount = all.filter((r) => r.companies?.first_purchase_at).length;
  const rows = all.filter((r) => (filter === "all" ? true : filter === "paid" ? !!r.companies?.first_purchase_at : !r.companies?.first_purchase_at));

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">추천 현황</h1>
        <p className="mt-1 break-keep text-sm text-zinc-500">
          회사를 등록하며 적은 추천 회사·추천인이에요. 첫 결제를 마친 회사는 초록색으로 보여요. 보상은 여기서 확인하고 직접 챙겨 주세요.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="추천 입력" value={`${all.length.toLocaleString("ko-KR")}곳`} />
        <Stat label="첫 결제 완료" value={`${paidCount.toLocaleString("ko-KR")}곳`} strong />
        <Stat label="미결제" value={`${(all.length - paidCount).toLocaleString("ko-KR")}곳`} />
      </div>
      <Panel
        title="추천 목록"
        action={
          <nav className="flex gap-1" aria-label="첫 결제 여부로 보기">
            {FILTERS.map(([key, label]) => (
              <Link
                key={key}
                href={key === "all" ? "/app-admin/referrals" : `/app-admin/referrals?filter=${key}`}
                aria-current={filter === key ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-lg px-3 text-sm ${filter === key ? "bg-zinc-900 font-semibold text-white" : "border border-zinc-300 bg-white hover:bg-zinc-50"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        }
      >
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">{all.length === 0 ? "아직 추천을 적은 회사가 없어요." : "조건에 맞는 회사가 없어요."}</p>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>첫 결제</th>
                  <th className={th}>가입 회사</th>
                  <th className={th}>등록한 사람</th>
                  <th className={th}>추천 유형</th>
                  <th className={th}>추천 대상</th>
                  <th className={th}>적은 날</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const paidAt = r.companies?.first_purchase_at;
                  return (
                    <tr key={r.company_id} className={paidAt ? "bg-emerald-50" : undefined}>
                      <td className={td}>
                        {paidAt ? (
                          <span className="inline-flex flex-col">
                            <span className="inline-flex w-fit rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">결제 완료</span>
                            <span className="mt-1 whitespace-nowrap text-xs text-emerald-800">{formatKst(paidAt)}</span>
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">미결제</span>
                        )}
                      </td>
                      <td className={td}>
                        <Link href={`/app-admin/companies/${r.company_id}`} className="font-medium text-zinc-900 underline-offset-2 hover:underline">
                          {r.companies?.name ?? "(지운 회사)"}
                        </Link>
                        {r.companies?.created_at && <p className="text-xs text-zinc-500">가입 {formatKst(r.companies.created_at)}</p>}
                      </td>
                      <td className={td}>
                        {r.members ? (
                          <>
                            {r.members.name}
                            <p className="whitespace-nowrap text-xs text-zinc-500">{formatPhone(r.members.phone)}</p>
                          </>
                        ) : (
                          <span className="text-zinc-400">(퇴사·삭제)</span>
                        )}
                      </td>
                      <td className={td}>{r.kind === "company" ? "추천 회사" : "추천인"}</td>
                      <td className={td}>
                        {r.kind === "company" ? (
                          r.referrer_company_id ? (
                            <Link href={`/app-admin/companies/${r.referrer_company_id}`} className="underline-offset-2 hover:underline">
                              {r.referrer_company_name}
                            </Link>
                          ) : (
                            <>
                              {r.referrer_company_name} <span className="text-xs text-zinc-400">(지운 회사)</span>
                            </>
                          )
                        ) : (
                          <>
                            {r.referrer_name}
                            <p className="whitespace-nowrap text-xs text-zinc-500">{r.referrer_phone ? formatPhone(r.referrer_phone) : ""}</p>
                          </>
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap text-zinc-600`}>{formatKst(r.created_at)}</td>
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

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white"}`}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${strong ? "text-emerald-700" : ""}`}>{value}</p>
    </div>
  );
}
