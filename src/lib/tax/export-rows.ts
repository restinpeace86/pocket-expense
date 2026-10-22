// 세무 마감 엑셀·ZIP 행 규칙 (tax-export.md §3, tax-closing.md §4.B, tax-upload-format.md, D-052, D-088)
// DB 함수 tax_month_export가 돌려준 행(순번 순)을 엑셀 시트·ZIP 파일명으로 바꾼다. 순수 함수 — 서버·브라우저 공용.
import { CATEGORY_LABEL, PURCHASE_TYPE_LABEL, TRIP_TYPE_LABEL, type ExpenseCategory, type PurchaseType, type TripType } from "@/lib/expense/categories";
import { routeFormula } from "@/lib/expense/route";

export type ExportRow = {
  seq: number;
  kind: "current" | "carryover";
  claim_id: string;
  claim_title: string;
  claim_description: string | null;
  exception_memo: string | null;
  is_trip: boolean;
  trip_destination: string | null;
  trip_start: string | null;
  trip_end: string | null;
  trip_purpose: string | null;
  claim_status: "approved" | "paid";
  self_approved: boolean;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  approvers: string | null;
  header_custom: Record<string, unknown> | null;
  item_id: string;
  expense_date: string;
  merchant_name: string | null;
  merchant_business_number: string | null;
  evidence_type: string | null;
  evidence_kind?: string | null; // 증빙 자료 종류(D-108)
  no_evidence_reason?: string | null;
  supply_amount: number | null;
  vat_amount: number | null;
  amount: number | null;
  payment_method: "corporate_card" | "personal_card";
  card_nickname: string | null;
  card_last4: string | null;
  account_title_name: string | null;
  account_title_code: string | null;
  category: ExpenseCategory | null;
  trip_type: TripType | null;
  purchase_type: PurchaseType | null;
  department: string | null;
  member_name: string;
  position: string | null;
  employee_number: string | null;
  vehicle_number: string | null;
  purpose: string | null;
  headcount: number | null;
  attendees: string | null;
  client_name: string | null;
  lodging_in: string | null;
  lodging_out: string | null;
  start_location: string | null;
  end_location: string | null;
  is_round_trip: boolean | null;
  route_one_way_km: number | null;
  distance_km: number | null;
  distance_source: "api" | "manual" | null;
  applied_meal_limit_per_person: number | null;
  applied_fuel_rate_per_km: number | null;
  company_supported_amount: number | null;
  personal_burden_amount: number | null;
  receipt_path: string | null;
  route_card_path: string | null;
  item_custom: Record<string, unknown> | null;
};

export const EVIDENCE_LABEL: Record<string, string> = { card_slip: "카드매출전표", cash_receipt: "현금영수증", tax_invoice: "세금계산서", simple_receipt: "간이영수증", other: "기타" };

export const isOwnCar = (r: Pick<ExportRow, "category" | "trip_type">) => r.category === "trip" && r.trip_type === "own_car";

// 증빙번호 "2026-10-003" — 1,000건 이상이면 4자리
export function evidenceNo(month: string, seq: number, total: number): string {
  return `${month}-${String(seq).padStart(total >= 1000 ? 4 : 3, "0")}`;
}

// 파일명에 쓸 수 없는 문자·공백을 빼고 20자로
export function fileSafe(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]/g, "").slice(0, 20);
}

const extOf = (path: string) => (path.match(/\.([a-z0-9]+)$/i)?.[1] ?? "jpg").toLowerCase();

// ZIP 영수증/ 안의 파일명과 원본 경로. 영수증도 자차 증빙도 없으면 null
export function evidenceFile(r: ExportRow, month: string, total: number): { name: string; path: string } | null {
  const path = r.receipt_path ?? (isOwnCar(r) ? r.route_card_path : null);
  if (!path) return null;
  const who = isOwnCar(r) ? "자차유류비" : fileSafe(r.merchant_name ?? "") || "가맹점미입력";
  return { name: `${evidenceNo(month, r.seq, total)}_${r.expense_date.replaceAll("-", "")}_${who}_${r.amount ?? 0}.${extOf(path)}`, path };
}

export function classLabels(r: ExportRow): { category: string; subtype: string } {
  return {
    category: r.category ? CATEGORY_LABEL[r.category] : "",
    subtype: r.category === "trip" && r.trip_type ? TRIP_TYPE_LABEL[r.trip_type] : r.category === "purchase" && r.purchase_type ? PURCHASE_TYPE_LABEL[r.purchase_type] : "",
  };
}

// 정산 방향 (expense-lifecycle.md §5.5): 개인카드 = 회사가 직원에게 지급, 법인카드 = 개인 부담분을 직원이 납부
export function settlement(r: ExportRow): { kind: "지급" | "납부" | ""; amount: number } {
  if (r.payment_method === "personal_card") return { kind: "지급", amount: r.company_supported_amount ?? 0 };
  const burden = r.personal_burden_amount ?? 0;
  return burden > 0 ? { kind: "납부", amount: burden } : { kind: "", amount: 0 };
}

export function statusLabel(r: ExportRow): string {
  if (r.claim_status === "paid") return "정산완료";
  return r.self_approved ? "승인(결재생략)" : "승인";
}

// 관리자·세무사 확인용 표시
export function checks(r: ExportRow, hasFile: boolean): string[] {
  const out: string[] = [];
  if (isOwnCar(r)) {
    out.push("적격증빙 없음(자차·경로 요약 첨부)");
    if (r.distance_source === "manual") out.push("직접 입력 거리");
    if (!hasFile) out.push("경로 요약 파일 없음");
    return out;
  }
  if (!r.merchant_business_number) out.push("사업자번호 없음");
  if (r.supply_amount == null || r.vat_amount == null) out.push("부가세 미구분");
  if (!hasFile) out.push("영수증 파일 없음");
  return out;
}

export const bizNo = (v: string | null) => (v && /^\d{10}$/.test(v) ? `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}` : v ?? "");

// 세무 업로드 초안(시트3)의 적요: 결의서 지출 사유 + 항목 적요, 자차는 계산식
export function upload적요(r: ExportRow): string {
  if (isOwnCar(r) && r.route_one_way_km != null) {
    const f = routeFormula({ roundTrip: r.is_round_trip === true, oneWayKm: Number(r.route_one_way_km), rate: r.applied_fuel_rate_per_km ?? 0 });
    return [`자차 ${r.start_location ?? ""}→${r.end_location ?? ""}`, f].join(" · ");
  }
  return [r.claim_description, r.purpose].filter((x) => x && x.trim()).join(" · ");
}

// 부가세를 구분하지 못한 영수증: 공급가액 = 합계, 부가세 0 (tax-upload-format.md §2 값 규칙)
export function supplyVat(r: ExportRow): { supply: number; vat: number } {
  if (r.supply_amount != null && r.vat_amount != null) return { supply: r.supply_amount, vat: r.vat_amount };
  return { supply: r.amount ?? 0, vat: 0 };
}
