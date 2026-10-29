import { Download, FileImage } from "lucide-react";
import Link from "next/link";
import type { TaxMonth } from "@/lib/tax/closing";
import { bizNo, checks, classLabels, EVIDENCE_LABEL, statusLabel, supplyVat, type ExportRow } from "@/lib/tax/export-rows";
import { MonthPicker } from "./month-picker";
import { OfficeItemAccount } from "./office-item-account";
import { CardReconcileStatus } from "@/components/admin/card-reconcile-status";
import { SavedReconcilePanel } from "@/components/admin/card-reconcile-saved";
import type { SavedReconcile } from "@/lib/cards/saved";
import { OfficeZipButton } from "./office-zip-button";
import { TemplateDownloads, type TemplateLink } from "./template-downloads";
import { HometaxFiles } from "./hometax-files";
import { deleteOfficeHometaxAction, uploadOfficeHometaxAction } from "@/app/tax-office/[companyId]/hometax-actions";
import { TaxRequests } from "./tax-requests";
import type { TaxRequest } from "@/lib/tax-office/requests";
import { BulkAccountProvider, BulkCheck } from "./office-bulk-account";
import type { HometaxUpload } from "@/lib/hometax/kinds";

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
  cardReconcile = null,
  accountTitles = [],
  hometax = [],
  requests = [],
}: {
  companyId: string;
  companyName: string;
  businessNumber: string;
  data: TaxMonth;
  months: string[];
  receiptUrls: Record<string, string>;
  templates?: TemplateLink[];
  cardReconcile?: SavedReconcile | null;
  accountTitles?: { id: string; name: string; code: string | null }[]; // 영수증별 계정과목 조정(D-156)
  hometax?: HometaxUpload[]; // 회사가 올린 홈택스 자료(D-158)
  requests?: TaxRequest[]; // 회사에 남긴 자료 요청(D-169)
}) {
  const locked = data.status === "closed"; // 회사가 마감한 달은 바꿀 수 없음(D-045)
  const bulk = accountTitles.length > 0 && !locked;
  const accountCell = (r: ExportRow) =>
    accountTitles.length ? (
      <OfficeItemAccount
        itemId={r.item_id}
        current={{ id: accountTitles.find((t) => t.name === r.account_title_name)?.id ?? null, name: r.account_title_name, code: r.account_title_code }}
        overridden={!!r.account_title_overridden}
        titles={accountTitles}
        locked={locked}
        pendingRequest={!!r.tax_review_request && !r.tax_review_resolved_at}
      />
    ) : (
      titleLabel(r)
    );
  const reviewNote = (r: ExportRow) =>
    r.tax_review_request ? (
      <span className={`mt-1 block break-keep rounded-md px-2 py-1 text-xs ${r.tax_review_resolved_at ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
        {r.tax_review_resolved_at ? "확인 요청 처리됨: " : "회사 확인 요청: "}
        {r.tax_review_request}
      </span>
    ) : null;
  const pendingReviews = data.rows.filter((r) => r.tax_review_request && !r.tax_review_resolved_at).length;
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
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
        <OfficeZipButton companyId={companyId} companyName={companyName} month={data.month} closed={data.status === "closed"} disabled={rows.length === 0} />
        <a
          href={`${base}/xlsx?month=${data.month}`}
          aria-disabled={rows.length === 0}
          className={`inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 font-semibold ${
            rows.length === 0 ? "pointer-events-none bg-zinc-200 text-zinc-500" : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          <Download className="size-4" aria-hidden />
          세무용 엑셀 다운로드
        </a>
        </div>
      </section>
      {/* 위하고 일반전표(사비) 시트 안내 (D-176) */}
      <p className="-mt-2 break-keep text-xs text-zinc-500">세무용 엑셀의 [위하고 일반전표(사비)] 시트는 사비 지출을 두 줄 전표(차변 비용 / 대변 253 미지급금·직원)로 만든 거예요. 위하고 일반전표 [엑셀올리기]에 올리세요. 법인카드는 넣지 않았어요(위하고 카드 자동수집과 겹치지 않게).</p>
      {/* 회사가 한 법인카드 대조 결과와 처리(D-154) — 보기만 */}
      <CardReconcileStatus saved={cardReconcile} month={data.month} />
      {cardReconcile && cardReconcile.issues.length > 0 && <SavedReconcilePanel saved={cardReconcile} editable={false} />}
      <TemplateDownloads templates={templates} hrefFor={(id) => `${base}/template?id=${id}&month=${data.month}`} disabled={rows.length === 0} />
      <HometaxFiles key={`ht-${data.month}`} uploads={hometax} month={data.month} downloadBase={`${base}/hometax?id=`} viewer="tax_office" uploadAction={uploadOfficeHometaxAction.bind(null, companyId)} deleteAction={deleteOfficeHometaxAction} />
      <TaxRequests
        mode="office"
        requests={requests}
        month={data.month}
        companyId={companyId}
        items={rows.map((r) => ({ id: r.item_id, label: `${r.expense_date} · ${r.merchant_name ?? classLabels(r).category} · ${won(r.amount ?? 0)}` }))}
      />

      {pendingReviews > 0 && (
        <p className="break-keep rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          회사가 계정과목 확인을 요청한 영수증이 {pendingReviews}건 있어요. 아래 지출 내역에서 계정과목을 바꾸거나, 지금 계정과목이 맞으면 [이대로 확인]을 눌러 주세요.
        </p>
      )}
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
            {/* 여러 건 계정과목 한 번에(D-165) — 계정과목을 고를 수 있고 마감 전인 달만 */}
            <BulkWrap on={bulk} itemIds={rows.map((r) => r.item_id)} titles={accountTitles}>
            {/* 휴대폰: 카드 */}
            <ul className="divide-y divide-zinc-100 md:hidden">
              {rows.map((r) => {
                const url = r.receipt_path ? receiptUrls[r.receipt_path] : undefined;
                const warn = checks(r, !!r.receipt_path || !!r.route_card_path).filter((w) => !w.startsWith("세무사 확인 요청"));
                return (
                  <li key={r.item_id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      {bulk && <BulkCheck itemId={r.item_id} label={r.merchant_name ?? classLabels(r).category} />}
                      <span className="min-w-0 flex-1 break-keep font-medium text-zinc-900">{r.merchant_name ?? classLabels(r).category}</span>
                      <span className="whitespace-nowrap font-semibold tabular-nums">{won(r.amount ?? 0)}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {r.expense_date} · {EVIDENCE_LABEL[r.evidence_type ?? ""] ?? "증빙 없음"} · {payLabel(r)}
                    </p>
                    <div className="text-sm">
                      {accountCell(r)}
                      {reviewNote(r)}
                    </div>
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
                    {bulk && <th className={th}><span className="sr-only">고르기</span></th>}
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
                    const warn = checks(r, !!r.receipt_path || !!r.route_card_path).filter((w) => !w.startsWith("세무사 확인 요청"));
                    return (
                      <tr key={r.item_id}>
                        {bulk && (
                          <td className={td}>
                            <BulkCheck itemId={r.item_id} label={`${r.seq}번 ${r.merchant_name ?? ""}`} />
                          </td>
                        )}
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
                        <td className={td}>
                          {accountCell(r)}
                          {reviewNote(r)}
                        </td>
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
            </BulkWrap>
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

function BulkWrap({ on, itemIds, titles, children }: { on: boolean; itemIds: string[]; titles: { id: string; name: string; code: string | null }[]; children: React.ReactNode }) {
  return on ? (
    <BulkAccountProvider itemIds={itemIds} titles={titles}>
      {children}
    </BulkAccountProvider>
  ) : (
    <>{children}</>
  );
}
