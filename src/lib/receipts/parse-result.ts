// AI 영수증 인식 결과의 형식·범위 검사 (receipt-parser.md §3). 서버(apply_receipt_parse)도 한 번 더 검사한다.
export type ParsedReceipt = {
  merchant_name: string | null;
  merchant_business_number: string | null; // 숫자 10자리
  card_last4: string | null; // 숫자 4자리 (카드번호 전체는 받지 않는다, D-055)
  suggested_evidence_type: "card_slip" | "cash_receipt" | "tax_invoice" | "simple_receipt" | null;
  cash_receipt_income_deduction: boolean | null; // 현금영수증이 "소득공제용"으로 발행됐는지
  amount: number | null;
  supply_amount: number | null;
  vat_amount: number | null;
  expense_date: string | null; // YYYY-MM-DD
  suggested_category: "meal" | "trip" | "meeting" | "purchase" | null;
  suggested_trip_type: "meal" | "public_transport" | "taxi" | "toll_parking" | "lodging" | "other" | null;
  suggested_purchase_type: "pantry" | "office_supplies" | "small_equipment" | null;
};

const EVIDENCE = ["card_slip", "cash_receipt", "tax_invoice", "simple_receipt"] as const;
const CATEGORY = ["meal", "trip", "meeting", "purchase"] as const;
const TRIP = ["meal", "public_transport", "taxi", "toll_parking", "lodging", "other"] as const; // 자차(own_car)는 영수증이 없어 추천하지 않는다
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

export function normalizeParsed(raw: unknown, today: string): ParsedReceipt {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const date = typeof r.expense_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.expense_date) && !Number.isNaN(Date.parse(r.expense_date)) ? r.expense_date : null;
  const merchant = typeof r.merchant_name === "string" ? r.merchant_name.trim().slice(0, 100) : "";
  return {
    merchant_name: merchant || null,
    merchant_business_number: digits(r.merchant_business_number, 10),
    card_last4: digits(r.card_last4, 4),
    suggested_evidence_type: oneOf(r.suggested_evidence_type, EVIDENCE),
    cash_receipt_income_deduction: typeof r.cash_receipt_income_deduction === "boolean" ? r.cash_receipt_income_deduction : null,
    amount: won(r.amount),
    supply_amount: won(r.supply_amount),
    vat_amount: won(r.vat_amount),
    expense_date: date && date <= today ? date : null, // 오늘 이후 날짜는 버린다
    suggested_category: oneOf(r.suggested_category, CATEGORY),
    suggested_trip_type: oneOf(r.suggested_trip_type, TRIP),
    suggested_purchase_type: oneOf(r.suggested_purchase_type, PURCHASE),
  };
}
