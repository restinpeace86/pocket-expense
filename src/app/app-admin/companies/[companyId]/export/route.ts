import { NextResponse, type NextRequest } from "next/server";
import { formatMaskedCard, maskCardNumber } from "@/lib/cards/match";
import { CLAIM_STATUS_LABEL, csvCell, EVIDENCE_LABEL, formatKst, PARSE_STATUS_LABEL } from "@/lib/app-admin/labels";
import { getCompanyRecordsForExport } from "@/lib/app-admin/queries";
import { currentMonthKst } from "@/lib/dates";
import { parseMonth } from "@/lib/expense/status";

// 한 회사·한 달의 크레딧 사용 영수증 기록 CSV (D-080). 운영자가 아니면 404. 엑셀에서 한글이 깨지지 않게 BOM을 붙인다.
const HEADER = [
  "크레딧 사용 시각", "직원", "소명서 제목", "소명서 상태", "항목 상태", "지운 시각", "AI 인식",
  "가맹점명", "사업자등록번호", "사용일", "결제 시각", "승인번호", "합계", "공급가액", "부가세", "카드번호(가림)", "증빙 구분", "가맹점 주소", "품목(이름 x수량 = 금액)",
  "기록 ID", "항목 ID",
];

// 영수증 카드번호(서버가 앞 6자리·뒤 4자리 말고는 가려 저장). 예전 기록은 끝 4자리만 있다
function cardText(ai: Record<string, unknown>): string {
  const m = maskCardNumber(ai.card_number_masked ?? ai.card_last4);
  return m ? formatMaskedCard(m) : "";
}

export async function GET(request: NextRequest, ctx: RouteContext<"/app-admin/companies/[companyId]/export">) {
  const { companyId } = await ctx.params;
  const month = parseMonth(request.nextUrl.searchParams.get("month"), currentMonthKst());
  const data = await getCompanyRecordsForExport(companyId, month);
  if (!data) return new NextResponse("Not Found", { status: 404 });
  const lines = [HEADER.map(csvCell).join(",")];
  for (const r of data.records) {
    const ai = (r.ai_parsed_payload ?? {}) as Record<string, unknown>;
    const items = Array.isArray(ai.line_items) ? (ai.line_items as Record<string, unknown>[]) : [];
    lines.push(
      [
        formatKst(r.credited_at), r.member_name, r.claim_title, CLAIM_STATUS_LABEL[r.claim_status ?? ""] ?? r.claim_status, r.item_deleted_at ? "직원이 지움" : "소명서에 있음", formatKst(r.item_deleted_at), PARSE_STATUS_LABEL[r.parse_status ?? ""] ?? r.parse_status,
        ai.merchant_name, ai.merchant_business_number, ai.expense_date, ai.paid_time, ai.approval_number, ai.amount, ai.supply_amount, ai.vat_amount, cardText(ai),
        EVIDENCE_LABEL[String(ai.suggested_evidence_type)] ?? "", ai.merchant_address,
        items.map((l) => `${l.name}${l.quantity ? ` x${l.quantity}` : ""}${typeof l.amount === "number" ? ` = ${l.amount}` : ""}`).join(" / "),
        r.id, r.item_id,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const filename = encodeURIComponent(`${data.companyName}_영수증기록_${month}.csv`);
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}
