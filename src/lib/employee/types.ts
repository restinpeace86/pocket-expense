import type { ClaimStatus } from "@/lib/expense/status";

export type MyClaimRow = {
  id: string;
  title: string;
  status: ClaimStatus;
  is_business_trip: boolean;
  item_count: number;
  total_amount: number;
  settlement_required: boolean | null;
  created_at: string;
  rejection_reason: string | null;
  rejected_at: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  corporateCount: number;
  personalCount: number;
  categories: string[];
};

export type EmployeeSummary = { pending_payout: number; rejected_count: number; credits_left: number };
