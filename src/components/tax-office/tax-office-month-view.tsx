import { Download, FileImage } from "lucide-react";
import Link from "next/link";
import type { TaxMonth } from "@/lib/tax/closing";
import { bizNo, checks, classLabels, EVIDENCE_LABEL, statusLabel, supplyVat, type ExportRow } from "@/lib/tax/export-rows";
import { MonthPicker } from "./month-picker";
import { TemplateDownloads, type TemplateLink } from "./template-downloads";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const th = "whitespace-nowrap border-b border-zinc-200 px-2 py-2 text-left text-xs font-medium text-zinc-500";
const td = "border-b border-zinc-100 px-2 py-2 align-top text-sm";
const num = `${td} whitespace-nowrap text-right tabular-nums`;
const payLabel = (r: ExportRow) => (r.payment_method === "corporate_card" ? `법인카드${r.card_last4 ? ` ${r.card_last4}` : ""}` : "개인(사비)");
const titleLabel = (r: ExportRow) => (r.account_title_name ? `${r.account_title_name}${r.account_title_code ? ` (${r.account_title_code})` : ""}` : "미지정");

// 세무사무소: 한 고객사·한 달의 세무 자료 (D-149). 요약 → 계정과목별 → 지출 내역(영수증 보기). 엑셀은 관리자 세무 마감과 같은 장부
export function TaxOfficeMonthView({
  companyId,
  companyName,
  businessNumber,
  data,
  months,
  receiptUrls,
  templates = [],
}: {
  companyId: string;
  companyName: string;
  businessNumber: string;
  data: TaxMonth;
  months: string[];
  receiptUrls: Record<string, string>;
  templates?: TemplateLink[];
}) {
  const rows = data.rows;
  const totals = rows.reduce(
    (s, r) => {
      const { supply, vat } = supplyVat(r);
      return { supply: s.supply + supply, vat: s.vat + vat, amount: s.amount + (r.amount ?? 0) };
    },
    { supply: 0, vat: 0, amount: 0 },
  );
  const byTitle = new Map<string, { count: number; amount: number }>();
  for (const r of rows) {
    const k = titleLabel(r);
    const v = byTitle.get(k) ?? { count: 0, amount: 0 };
    byTitle.set(k, { count: v.count + 1, amount: v.amount + (r.amount ?? 0) });
  }
  const [y, m] = data.month.split("-").map(Number);
  const excluded = data.excluded.draft + data.excluded.submitted + data.excluded.rejected;
  const base = `/tax-office/${companyId}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{companyName}</h1>
          <p className="text-sm text-zinc-500">사업자등록번호 {bizNo(businessNumber)}</p>
        </div>
        <nav aria-label="회사 메뉴" className="flex gap-1 text-sm">
          <span aria-current="page" className="inline-flex min-h-10 items-center rounded-lg bg-zinc-900 px-3 font-semibold text-white">
            세무 자료
          </span>
          <Link href={`${base}/account-titles`} className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-white px-3 hover:bg-zinc-50">
            계정과목
          </Link>
        </nav>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker months={months} value={data.month} base={base} />
          {data.status === "closed" ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">회사 마감 완료</span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">마감 전 · 승인분이 더 늘 수 있어요</span>
          )}
        </div>
        <a
          href={`${base}/xlsx?month=${data.month}`}
          aria-disabled={rows.length === 0}
          className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 font-semibold ${
            rows.length === 0 ? "pointer-events-none bg-zinc-200 text-zinc-500" : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          <Download className="size-4" aria-hidden />
          세무용 엑셀 다운로드
        </a>
      </section>
      <TemplateDownloads templates={templates} hrefFor={(id) => `${base}/template?id=${id}&month=${data.month}`} disabled={rows.length === 0} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${m}월 승인 지출`} value={`${rows.length.toLocaleString("ko-KR")}건`} />
        <Stat label="공급가액" value={won(totals.supply)} />
        <Stat label="부가세" value={won(totals.vat)} />
        <Stat label="합계" value={won(totals.amount)} strong />
      </div>
      {excluded > 0 && (
        <p className="break-keep rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
          아직 승인되지 않은 지출 {excluded}건(작성 중 {data.excluded.draft} · 결재 중 {data.excluded.submitted} · 반려 {data.excluded.rejected})은 빠져 있어요.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          {y}년 {m}월에 승인된 지출이 없어요.
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white">
            <h2 className="border-b border-zinc-100 px-4 py-3 font-semibold">계정과목별</h2>
            <ul className="divide-y divide-zinc-100">
              {[...byTitle.entries()]
                .sort((a, b) => b[1].amount - a[1].amount)
                .map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{k}</span>
                    <span className="whitespace-nowrap tabular-nums text-zinc-700">
                      {v.count}건 · <b className="text-zinc-900">{won(v.amount)}</b>
                    </span>
                  </li>
                ))}
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white">
            <h2 className="border-b border-zinc-100 px-4 py-3 font-semibold">지출 내역 · 증빙</h2>
            {/* 휴대폰: 카드 */}
            <ul className="divide-y divide-zinc-100 md:hidden">
              {rows.map((r) => {
                const url = r.receipt_path ? receiptUrls[r.receipt_path] : undefined;
                const warn = checks(r, !!r.receipt_path || !!r.route_card_path);
                return (
                  <li key={r.item_id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-keep font-medium text-zinc-900">{r.merchant_name ?? classLabels(r).category}</span>
                      <span className="whitespace-nowrap font-semibold tabular-nums">{won(r.amount ?? 0)}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {r.expense_date} · {titleLabel(r)} · {EVIDENCE_LABEL[r.evidence_type ?? ""] ?? "증빙 없음"} · {payLabel(r)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {r.member_name} · {statusLabel(r)}
                      {r.merchant_business_number && ` · ${bizNo(r.merchant_business_number)}`}
                    </p>
                    {warn.length > 0 && <p className="text-xs text-amber-700">확인: {warn.join(", ")}</p>}
                    {url && (
                      <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-10 w-fit items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm">
                        <FileImage className="size-4" aria-hidden />
                        영수증 보기
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
            {/* PC: 표 */}
            <div className="hidden overflow-x-auto px-4 pb-2 md:block">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr>
                    <th className={th}>번호</th>
                    <th className={th}>사용일</th>
                    <th className={th}>가맹점 · 사업자번호</th>
                    <th className={th}>계정과목</th>
                    <th className={th}>증빙</th>
                    <th className={th}>결제</th>
                    <th className={`${th} text-right`}>공급가액</th>
                    <th className={`${th} text-right`}>부가세</th>
                    <th className={`${th} text-right`}>합계</th>
                    <th className={th}>사용자</th>
                    <th className={th}>확인</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const url = r.receipt_path ? receiptUrls[r.receipt_path] : undefined;
                    const { supply, vat } = supplyVat(r);
                    const warn = checks(r, !!r.receipt_path || !!r.route_card_path);
                    return (
                      <tr key={r.item_id}>
                        <td className={`${td} tabular-nums text-zinc-500`}>
                          {r.seq}
                          {r.kind === "carryover" && <span className="block text-xs text-amber-700">전월 추가</span>}
                        </td>
                        <td className={`${td} whitespace-nowrap`}>{r.expense_date}</td>
                        <td className={td}>
                          {r.merchant_name ?? classLabels(r).category}
                          {r.merchant_business_number && <span className="block text-xs text-zinc-500">{bizNo(r.merchant_business_number)}</span>}
                          {url && (
                            <a href={url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-700 underline underline-offset-2">
                              <FileImage className="size-3.5" aria-hidden />
                              영수증 보기
                            </a>
                          )}
                        </td>
                        <td className={td}>{titleLabel(r)}</td>
                        <td className={`${td} whitespace-nowrap`}>{EVIDENCE_LABEL[r.evidence_type ?? ""] ?? "증빙 없음"}</td>
                        <td className={`${td} whitespace-nowrap`}>{payLabel(r)}</td>
                        <td className={num}>{supply.toLocaleString("ko-KR")}</td>
                        <td className={num}>{vat.toLocaleString("ko-KR")}</td>
                        <td className={`${num} font-semibold`}>{(r.amount ?? 0).toLocaleString("ko-KR")}</td>
                        <td className={`${td} whitespace-nowrap`}>
                          {r.member_name}
                          <span className="block text-xs text-zinc-500">{statusLabel(r)}</span>
                        </td>
                        <td className={`${td} min-w-24 text-xs text-amber-700`}>{warn.join(", ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <p className="text-xs text-zinc-500">영수증 링크는 10분 동안 열려요. 지나면 화면을 새로고침해 주세요.</p>
        </>
      )}
    </>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "border-brand-200 bg-brand-50" : "border-zinc-200 bg-white"}`}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 break-all text-lg font-bold tabular-nums ${strong ? "text-brand-800" : ""}`}>{value}</p>
    </div>
  );
}
