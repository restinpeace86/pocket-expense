import Link from "next/link";
import { formatMaskedCard, maskCardNumber } from "@/lib/cards/match";
import type { getReceiptRecord } from "@/lib/app-admin/queries";
import { CLAIM_STATUS_LABEL, EVIDENCE_LABEL, formatBizNo, formatKst, PARSE_STATUS_LABEL } from "@/lib/app-admin/labels";
import { CATEGORY_LABEL, PURCHASE_TYPE_LABEL, TRIP_TYPE_LABEL } from "@/lib/expense/categories";
import { Panel, TableWrap, td, th } from "./app-admin-shell";

export type ReceiptRecordData = NonNullable<Awaited<ReturnType<typeof getReceiptRecord>>>;

type Obj = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const won = (v: unknown) => (typeof v === "number" ? `${v.toLocaleString("ko-KR")}원` : str(v));

function Dl({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,11rem)_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-zinc-500">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? <span className="text-zinc-400">-</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

// 영수증 한 장: 사진 · AI가 읽은 전체 내용 · 직원이 확정한 값 · 이력
export function ReceiptRecordView({ data, base = "/app-admin" }: { data: ReceiptRecordData; base?: string }) {
  const { record: r, company, photoUrl, thumbUrl } = data;
  const ai = (r.ai_parsed_payload ?? {}) as Obj;
  const deleted = !!r.item_deleted_at;
  const item = (deleted ? r.item_snapshot : data.item) as Obj | null;
  const lines = Array.isArray(ai.line_items) ? (ai.line_items as Obj[]) : [];
  const lineSum = lines.reduce((s, l) => s + (typeof l.amount === "number" ? l.amount : 0), 0);
  const claimTitle = data.claim?.title ?? r.claim_title;
  const claimStatus = data.claim?.status ?? r.claim_status;

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`${base}/companies/${r.company_id}?month=${formatKst(r.credited_at).slice(0, 7)}`} className="w-fit text-sm text-zinc-500 hover:underline">
          ← {company?.name ?? "회사"} 영수증 목록
        </Link>
        <h1 className="text-2xl font-bold">
          {str(item?.merchant_name) ?? str(ai.merchant_name) ?? "가맹점 미확인"}{" "}
          <span className="text-lg font-normal text-zinc-500">{won(item?.amount ?? ai.amount)}</span>
        </h1>
        {deleted && (
          <p className="w-fit rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
            직원이 {formatKst(r.item_deleted_at)}에 지운 영수증입니다. 크레딧은 {formatKst(r.credited_at)}에 1장 사용됐습니다.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="영수증 사진 (2000px 보관본)">
          {photoUrl ? (
            <a href={photoUrl} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크 */}
              <img src={photoUrl} alt="영수증" className="mx-auto max-h-[80vh] w-auto rounded-lg border border-zinc-200" />
              <span className="mt-2 block text-center text-xs text-zinc-500">눌러서 새 창으로 크게 보기 (링크는 10분 동안 유효)</span>
            </a>
          ) : thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크
            <img src={thumbUrl} alt="영수증 썸네일" className="mx-auto rounded-lg border border-zinc-200" />
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">
              {r.photo_purged_at ? `보관 기간이 지나 ${formatKst(r.photo_purged_at).slice(0, 10)}에 사진을 지웠습니다.` : "사진을 불러오지 못했습니다(PDF는 새 창으로 열림, 또는 파일 없음)."}
            </p>
          )}
          {deleted && r.photo_purge_after && !r.photo_purged_at && (
            <p className="mt-3 text-xs text-amber-700">운영 보관함 사진은 {formatKst(r.photo_purge_after).slice(0, 10)}에 자동으로 지워집니다(삭제 후 3개월).</p>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="기록">
            <Dl
              rows={[
                ["회사", company?.name],
                ["직원", r.member_name],
                ["크레딧 사용", formatKst(r.credited_at)],
                ["AI 인식", `${PARSE_STATUS_LABEL[r.parse_status ?? "none"] ?? r.parse_status ?? "-"}${r.parsed_at ? ` · ${formatKst(r.parsed_at)}` : ""}`],
                ["결의서", claimTitle ? `${claimTitle} (${CLAIM_STATUS_LABEL[claimStatus ?? ""] ?? claimStatus ?? ""})` : "(제목 없음)"],
                ["항목 상태", deleted ? `직원이 지움 · ${formatKst(r.item_deleted_at)}` : "결의서에 있음"],
                ["기록 ID", <span key="id" className="font-mono text-xs">{r.id}</span>],
              ]}
            />
          </Panel>

          <Panel title="AI가 읽은 내용">
            <Dl
              rows={[
                ["가맹점명", str(ai.merchant_name)],
                ["사업자등록번호", str(ai.merchant_business_number) && formatBizNo(String(ai.merchant_business_number))],
                ["가맹점 주소", str(ai.merchant_address)],
                ["결제일 · 시각", [str(ai.expense_date), str(ai.paid_time)].filter(Boolean).join(" ") || null],
                ["승인번호", str(ai.approval_number)],
                ["카드번호(가림)", (() => { const m = maskCardNumber(ai.card_number_masked ?? ai.card_last4); return m ? formatMaskedCard(m) : null; })()],
                ["증빙 구분", EVIDENCE_LABEL[String(ai.suggested_evidence_type)] ?? null],
                ["소득공제용 현금영수증", ai.cash_receipt_income_deduction === true ? "예" : ai.cash_receipt_income_deduction === false ? "아니오(지출증빙)" : null],
                ["합계 / 공급가액 / 부가세", [won(ai.amount), won(ai.supply_amount), won(ai.vat_amount)].map((v) => v ?? "-").join(" / ")],
                [
                  "추천 분류",
                  [
                    CATEGORY_LABEL[ai.suggested_category as keyof typeof CATEGORY_LABEL],
                    TRIP_TYPE_LABEL[ai.suggested_trip_type as keyof typeof TRIP_TYPE_LABEL],
                    PURCHASE_TYPE_LABEL[ai.suggested_purchase_type as keyof typeof PURCHASE_TYPE_LABEL],
                  ]
                    .filter(Boolean)
                    .join(" · ") || null,
                ],
              ]}
            />
            <h3 className="mb-2 mt-5 text-sm font-semibold">품목별 내역 ({lines.length}줄)</h3>
            {lines.length === 0 ? (
              <p className="text-sm text-zinc-500">읽은 품목이 없습니다.</p>
            ) : (
              <TableWrap>
                <table className="w-full min-w-[420px] border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>#</th>
                      <th className={th}>품목</th>
                      <th className={`${th} text-right`}>수량</th>
                      <th className={`${th} text-right`}>단가</th>
                      <th className={`${th} text-right`}>금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td className={`${td} text-zinc-400`}>{i + 1}</td>
                        <td className={td}>{str(l.name)}</td>
                        <td className={`${td} text-right tabular-nums`}>{str(l.quantity) ?? ""}</td>
                        <td className={`${td} text-right tabular-nums`}>{typeof l.unit_price === "number" ? l.unit_price.toLocaleString("ko-KR") : ""}</td>
                        <td className={`${td} text-right tabular-nums ${typeof l.amount === "number" && l.amount < 0 ? "text-red-600" : ""}`}>{typeof l.amount === "number" ? l.amount.toLocaleString("ko-KR") : ""}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className={td} colSpan={4}>
                        품목 합
                        {typeof ai.amount === "number" && lineSum !== ai.amount && <span className="ml-2 text-xs text-amber-700">(영수증 합계 {ai.amount.toLocaleString("ko-KR")}원과 다름)</span>}
                      </td>
                      <td className={`${td} text-right font-semibold tabular-nums`}>{lineSum.toLocaleString("ko-KR")}</td>
                    </tr>
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>

          <Panel title={deleted ? "지울 때의 항목 값 (직원이 확정한 값)" : "지금 항목 값 (직원이 확정한 값)"}>
            {item ? (
              <Dl
                rows={[
                  ["가맹점명", str(item.merchant_name)],
                  ["사용일", str(item.expense_date)],
                  ["합계 / 공급가액 / 부가세", [won(item.amount), won(item.supply_amount), won(item.vat_amount)].map((v) => v ?? "-").join(" / ")],
                  ["카테고리", [CATEGORY_LABEL[item.category as keyof typeof CATEGORY_LABEL], TRIP_TYPE_LABEL[item.trip_type as keyof typeof TRIP_TYPE_LABEL], PURCHASE_TYPE_LABEL[item.purchase_type as keyof typeof PURCHASE_TYPE_LABEL]].filter(Boolean).join(" · ") || null],
                  ["결제수단", item.payment_method === "corporate_card" ? "법인카드" : item.payment_method === "personal_card" ? "개인(사비)" : null],
                  ["증빙 구분", EVIDENCE_LABEL[String(item.evidence_type)] ?? null],
                  ["인원", str(item.headcount)],
                  ["목적 · 거래처 · 참석자", [str(item.purpose), str(item.client_name), str(item.attendees)].filter(Boolean).join(" · ") || null],
                  ["회사 지원 / 개인 부담", [won(item.company_supported_amount), won(item.personal_burden_amount)].map((v) => v ?? "-").join(" / ")],
                ]}
              />
            ) : (
              <p className="text-sm text-zinc-500">항목을 찾을 수 없습니다.</p>
            )}
          </Panel>

          <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">AI 응답 원본 (JSON)</summary>
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">{JSON.stringify(r.ai_parsed_payload, null, 2)}</pre>
          </details>
        </div>
      </div>
    </>
  );
}
