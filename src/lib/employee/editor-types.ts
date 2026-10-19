import type { MealPolicy } from "@/lib/expense/amounts";
import type { ExpenseCategory, PurchaseType, TripType } from "@/lib/expense/categories";
import type { ClaimStatus } from "@/lib/expense/status";

// 소명서 편집 화면(E-02)이 주고받는 데이터
export type PaymentMethod = "corporate_card" | "personal_card";
export type EvidenceType = "card_slip" | "cash_receipt" | "tax_invoice" | "simple_receipt" | "other";
export type ParseStatus = "none" | "parsing" | "success" | "failed";

export type EditorClaim = {
  id: string;
  status: ClaimStatus;
  title: string;
  description: string | null;
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
  aiCardLast4: string | null; // AI가 읽은 카드 끝 4자리(법인카드 판별 안내용)
  aiIncomeDeduction: boolean; // 현금영수증이 소득공제용으로 발행됨
};

export type EditorCard = { id: string; nickname: string; last4: string };

export type EditorData = {
  claim: EditorClaim;
  items: EditorItem[];
  cards: EditorCard[];
  mealPolicy: MealPolicy;
  mealOverride: number | null;
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
  defaultPaymentMethod: PaymentMethod;
  isBusinessTrip: boolean;
  tripDestination: string;
  tripStartDate: string;
  tripEndDate: string;
  tripPurpose: string;
};
