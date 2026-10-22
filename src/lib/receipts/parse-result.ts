// AI 영수증 인식 결과의 형식·범위 검사 (receipt-parser.md §3). 서버(apply_receipt_parse)도 한 번 더 검사한다.
import { maskCardNumber } from "@/lib/cards/match";
export type LineItem = { name: string; quantity: number | null; unit_price: number | null; amount: number | null };

export type ParsedReceipt = {
  merchant_name: string | null;
  merchant_business_number: string | null; // 숫자 10자리
  card_number_masked: string | null; // 영수증에 보이는 카드번호(가린 자리 *). 앞 6자리·뒤 4자리 말고는 가려 둔다(D-083)
  card_last4: string | null; // 위 번호의 뒤 4자리가 모두 숫자일 때만
  suggested_evidence_type: "card_slip" | "cash_receipt" | "tax_invoice" | "simple_receipt" | null;
  suggested_evidence_kind: "receipt" | "invoice" | "app_history" | "card_history" | "invitation" | "other" | null; // 자료 종류(D-108)
  cash_receipt_income_deduction: boolean | null; // 현금영수증이 "소득공제용"으로 발행됐는지
  amount: number | null;
  supply_amount: number | null;
  vat_amount: number | null;
  expense_date: string | null; // YYYY-MM-DD
  suggested_category: "meal" | "trip" | "meeting" | "purchase" | null;
  suggested_trip_type: "meal" | "public_transport" | "taxi" | "toll_parking" | "lodging" | "other" | "car_fuel" | null;
  suggested_purchase_type: "pantry" | "office_supplies" | "small_equipment" | null;
  suggested_purpose: string | null; // 지출 사유 초안 한 줄(D-086) — 결의서 [지출 사유] 초안에 쓴다
  // 참고 정보(D-079): 지출결의서 양식에는 넣지 않고 화면에 보여 주기·중복 영수증 확인에 쓴다
  paid_time: string | null; // HH:MM
  approval_number: string | null;
  merchant_address: string | null;
  line_items: LineItem[];
};

const EVIDENCE = ["card_slip", "cash_receipt", "tax_invoice", "simple_receipt"] as const;
const EVIDENCE_KINDS = ["receipt", "invoice", "app_history", "card_history", "invitation", "other"] as const;
const CATEGORY = ["meal", "trip", "meeting", "purchase"] as const;
const TRIP = ["meal", "public_transport", "taxi", "toll_parking", "lodging", "other", "car_fuel"] as const; // 자차(own_car)는 영수증이 없어 추천하지 않는다. car_fuel = 주유소(회사차량 출장이면 차량유지비, D-106)
const PURCHASE = ["pantry", "office_supplies", "small_equipment"] as const;

function oneOf<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null;
}

function won(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9-]/g, "")) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 999_999_999 ? n : null;
}

function digits(v: unknown, len: number): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = String(v).replace(/[^0-9]/g, "");
  return d.length === len ? d : null;
}

// 사유 한 줄: 줄바꿈·끝 마침표 제거, 40자까지
function purposeText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().replace(/[.。]+$/, "").slice(0, 40).trim();
  return t || null;
}

function lineItems(v: unknown): LineItem[] {
  if (!Array.isArray(v)) return [];
  const out: LineItem[] = [];
  for (const e of v) {
    if (out.length >= 50) break;
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 100) : "";
    if (!name) continue;
    const q = typeof r.quantity === "string" ? Number(r.quantity) : r.quantity;
    const signed = typeof r.amount === "string" ? Number(r.amount.replace(/[^0-9-]/g, "")) : r.amount;
    out.push({
      name,
      quantity: typeof q === "number" && Number.isFinite(q) && q > 0 && q < 10000 ? Math.round(q * 100) / 100 : null,
      unit_price: won(r.unit_price),
      amount: typeof signed === "number" && Number.isInteger(signed) && Math.abs(signed) <= 999_999_999 ? signed : null, // 할인은 음수
    });
  }
  return out;
}

export function normalizeParsed(raw: unknown, today: string): ParsedReceipt {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const date = typeof r.expense_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.expense_date) && !Number.isNaN(Date.parse(r.expense_date)) ? r.expense_date : null;
  const merchant = typeof r.merchant_name === "string" ? r.merchant_name.trim().slice(0, 100) : "";
  const masked = maskCardNumber(r.card_number_masked ?? r.card_last4);
  return {
    merchant_name: merchant || null,
    merchant_business_number: digits(r.merchant_business_number, 10),
    card_number_masked: masked,
    card_last4: masked && /^\d{4}$/.test(masked.slice(-4)) ? masked.slice(-4) : null,
    suggested_evidence_type: oneOf(r.suggested_evidence_type, EVIDENCE),
    suggested_evidence_kind: oneOf(r.suggested_evidence_kind, EVIDENCE_KINDS),
    cash_receipt_income_deduction: typeof r.cash_receipt_income_deduction === "boolean" ? r.cash_receipt_income_deduction : null,
    amount: won(r.amount),
    supply_amount: won(r.supply_amount),
    vat_amount: won(r.vat_amount),
    expense_date: date && date <= today ? date : null, // 오늘 이후 날짜는 버린다
    suggested_category: oneOf(r.suggested_category, CATEGORY),
    suggested_trip_type: oneOf(r.suggested_trip_type, TRIP),
    suggested_purchase_type: oneOf(r.suggested_purchase_type, PURCHASE),
    suggested_purpose: purposeText(r.suggested_purpose),
    paid_time: typeof r.paid_time === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(r.paid_time) ? r.paid_time.slice(0, 5) : null,
    approval_number: typeof r.approval_number === "string" && /^[0-9A-Za-z]{4,20}$/.test(r.approval_number.replace(/[\s-]/g, "")) ? r.approval_number.replace(/[\s-]/g, "") : null,
    merchant_address: typeof r.merchant_address === "string" && r.merchant_address.trim() ? r.merchant_address.trim().slice(0, 200) : null,
    line_items: lineItems(r.line_items),
  };
}
