import type { EvidenceType, ParseStatus, PaymentMethod } from "@/lib/employee/editor-types";
import type { ExpenseCategory, PurchaseType, TripType } from "@/lib/expense/categories";
import type { ClaimStatus } from "@/lib/expense/status";
import type { LineItem } from "@/lib/receipts/parse-result";

// 소명서 상세(직원 읽기 전용 E-④, 관리자 지출 승인 관리) 공용 데이터
export type DetailItem = {
  id: string;
  sort_order: number;
  category: ExpenseCategory | null;
  trip_type: TripType | null;
  purchase_type: PurchaseType | null;
  payment_method: PaymentMethod;
  corporate_card_id: string | null;
  card_last4: string | null;
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
  applied_meal_limit_per_person: number | null;
  applied_meal_limit_mode: "split" | "notify" | null;
  account_title_id: string | null;
  account_title_name: string | null;
  account_title_code: string | null;
  account_title_overridden: boolean;
  closed_month: string | null; // 세무 마감된 항목이면 계정과목 조정 불가(D-045)
  paid_time: string | null;
  approval_number: string | null;
  merchant_address: string | null;
  line_items: LineItem[];
  ai: Record<string, unknown> | null; // AI 응답 원본(직원 수정 표시용)
  thumbUrl: string | null;
  isPdf: boolean;
  duplicate: { mine: number; others: number } | null;
};

export type DetailApproval = {
  id: string;
  round: number;
  step_order: number;
  step_kind: "review" | "final";
  status: "waiting" | "pending" | "approved" | "rejected" | "skipped" | "canceled";
  approver_member_id: string | null;
  approver_name: string | null;
  acted_by_name: string | null;
  acted_at: string | null;
  comment: string | null;
  flagged_item_ids: string[];
};

export type ClaimDetail = {
  claim: {
    id: string;
    member_id: string;
    status: ClaimStatus;
    title: string;
    description: string | null;
    is_business_trip: boolean;
    trip_destination: string | null;
    trip_start_date: string | null;
    trip_end_date: string | null;
    trip_purpose: string | null;
    item_count: number;
    total_amount: number;
    total_company_supported: number;
    total_personal_burden: number;
    settlement_required: boolean | null;
    self_approved: boolean;
    current_round: number;
    rejection_reason: string | null;
    created_at: string;
    submitted_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    paid_at: string | null;
  };
  owner: { name: string; department: string | null; position: string | null };
  items: DetailItem[];
  approvals: DetailApproval[];
  cards: { id: string; nickname: string; last4: string }[];
  payout: number; // 회사 → 직원 지급액 (사비 항목 회사 지원금 합계)
  payback: number; // 직원 → 회사 납부액 (법인카드 항목 개인 부담 합계)
  flaggedItemIds: string[]; // 가장 최근 반려에서 지목된 항목
  pendingStep: DetailApproval | null; // 지금 처리할 차례인 단계
};

// 처리할 수 있는지 (approval-workflow.md, expense-lifecycle.md §3)
export function canActOnClaim(detail: ClaimDetail, viewer: { member_id: string; role: string }): { can: boolean; reason: string | null } {
  if (detail.claim.status !== "submitted" || !detail.pendingStep) return { can: false, reason: null };
  const step = detail.pendingStep;
  if (step.step_kind === "review") {
    if (step.approver_member_id === viewer.member_id) return { can: true, reason: null };
    return { can: false, reason: `${step.approver_name ?? "사전 검토자"} 검토 중이에요. 검토가 끝나면 승인할 수 있어요.` };
  }
  if (viewer.role !== "super_admin" && viewer.role !== "admin") return { can: false, reason: null };
  if (detail.claim.member_id === viewer.member_id) return { can: false, reason: "본인 소명서는 다른 관리자가 승인합니다." };
  return { can: true, reason: null };
}
