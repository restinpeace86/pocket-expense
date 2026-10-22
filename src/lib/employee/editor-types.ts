import type { MealPolicy } from "@/lib/expense/amounts";
import type { ExpenseCategory, PurchaseType, TripType } from "@/lib/expense/categories";
import type { ClaimStatus } from "@/lib/expense/status";
import type { EvidenceAi } from "@/lib/receipts/evidence-reason";
import type { LineItem } from "@/lib/receipts/parse-result";

// 결의서 편집 화면(E-02)이 주고받는 데이터
export type PaymentMethod = "corporate_card" | "personal_card";
export type EvidenceType = "card_slip" | "cash_receipt" | "tax_invoice" | "simple_receipt" | "other";
export type ParseStatus = "none" | "parsing" | "success" | "failed";

export type EditorClaim = {
  id: string;
  status: ClaimStatus;
  title: string;
  description: string | null;
  exception_memo: string | null; // 예외 소명 사유 (D-084)
  trip_transport: TripTransport | null; // 출장 이동 수단 (D-085)
  default_payment_method: PaymentMethod;
  is_business_trip: boolean;
  trip_destination: string | null;
  trip_start_date: string | null;
  trip_end_date: string | null;
  trip_purpose: string | null;
  item_count: number;
  total_amount: number;
  total_company_supported: number;
  total_personal_burden: number;
  rejection_reason: string | null;
  // 결의서 대표 카테고리와 카테고리별 입력값 (D-098). 예전 결의서는 category가 비어 있을 수 있다
  category: ExpenseCategory | null;
  purchase_type: PurchaseType | null;
  meeting_purpose: string | null;
  client_name: string | null;
  attendees: string | null;
  purchase_purpose: string | null;
  purchase_items: string | null;
  headcount: number | null;
};

export type EditorItem = {
  id: string;
  sort_order: number;
  category: ExpenseCategory | null;
  trip_type: TripType | null;
  purchase_type: PurchaseType | null;
  payment_method: PaymentMethod;
  corporate_card_id: string | null;
  evidence_type: EvidenceType | null;
  expense_date: string | null;
  merchant_name: string | null;
  merchant_business_number: string | null;
  amount: number | null;
  supply_amount: number | null;
  vat_amount: number | null;
  headcount: number | null;
  purpose: string | null;
  attendees: string | null;
  client_name: string | null;
  trip_start_date: string | null;
  trip_end_date: string | null;
  parse_status: ParseStatus;
  receipt_path: string | null;
  company_supported_amount: number | null;
  personal_burden_amount: number;
  thumbUrl: string | null;
  isPdf: boolean;
  aiFilled: boolean;
  aiCardMasked: string | null; // AI가 읽은 카드번호(가린 자리 *, 법인카드 판별 안내용, D-083)
  aiIncomeDeduction: boolean; // 현금영수증이 소득공제용으로 발행됨
  aiPurpose: string | null; // AI가 쓴 지출 사유 한 줄(D-086)
  aiEvidence: EvidenceAi | null; // 증빙 구분 AI 판별 근거(D-100). AI가 읽지 않은 항목(직접 입력·자차)은 null
  // 참고 정보(D-079, AI가 읽음·보여 주기만)
  paid_time: string | null;
  approval_number: string | null;
  merchant_address: string | null;
  line_items: LineItem[];
  duplicate: { mine: { claim_id: string; title: string; status: ClaimStatus }[]; others: number } | null; // 같은 영수증으로 보이는 다른 항목
  // 자차 유류비 경로 (D-085). 거리·금액은 서버가 정한다
  start_location: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_location: string | null;
  end_lat: number | null;
  end_lng: number | null;
  is_round_trip: boolean | null;
  route_one_way_km: number | null;
  distance_km: number | null;
  distance_source: "api" | "manual" | null;
  route_evidence: unknown;
  applied_fuel_rate_per_km: number | null;
  overdueDeadline: string | null; // 청구 기한이 지났으면 그 기한 (오늘 기준, D-031)
};

// 자차 유류비를 쓸 수 있는지·단가·차량번호 (trip-expense.md §4, D-068·D-070)
export type FuelPolicy = { enabled: boolean; ratePerKm: number; blocked: null | "disabled" | "allowance"; vehicleNumber: string | null };

export type TripTransport = "own_car" | "public_transport";
export type RoutePlaceInput = { name: string; address: string | null; lat: number; lng: number };

export type EditorCard = { id: string; nickname: string; bin6: string | null; last4: string };

export type EditorData = {
  claim: EditorClaim;
  items: EditorItem[];
  cards: EditorCard[];
  mealPolicy: MealPolicy;
  mealOverride: number | null;
  fuel: FuelPolicy;
  deadline: { type: "none" | "end_of_month" | "days_after" | "next_month_day"; days: number | null }; // 회사 청구 기한 (D-031)
};

export type ItemInput = {
  category: ExpenseCategory | null;
  tripType: TripType | null;
  purchaseType: PurchaseType | null;
  paymentMethod: PaymentMethod;
  corporateCardId: string | null;
  evidenceType: EvidenceType | null;
  expenseDate: string;
  merchantName: string;
  merchantBusinessNumber: string;
  amount: string; // 숫자만
  supplyAmount: string;
  vatAmount: string;
  headcount: number;
  purpose: string;
  clientName: string;
  attendees: string;
  tripStartDate: string;
  tripEndDate: string;
};

export type ClaimHeaderInput = {
  title: string;
  description: string;
  exceptionMemo: string;
  defaultPaymentMethod: PaymentMethod;
  isBusinessTrip: boolean;
  tripDestination: string;
  tripStartDate: string;
  tripEndDate: string;
  tripPurpose: string;
  tripTransport: TripTransport | null;
  category: ExpenseCategory | null; // 결의서 대표 카테고리 (D-098)
  purchaseType: PurchaseType | null;
  meetingPurpose: string;
  clientName: string;
  attendees: string;
  purchasePurpose: string;
  purchaseItems: string;
  headcount: number | null;
};
