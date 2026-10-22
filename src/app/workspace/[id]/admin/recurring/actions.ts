"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/supabase/database.types";
import type { ActionResult } from "../actions";

// 정기 결제 (D-110). 관리자만(RLS). 담당자·법인카드는 같은 회사만(복합 FK)
export type RecurringInput = {
  serviceName: string;
  amount: string;
  cycle: "monthly" | "yearly";
  billingDay: number;
  billingMonth: number | null;
  paymentMethod: "corporate_card" | "personal_card";
  corporateCardId: string | null;
  assigneeMemberId: string;
  memo: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Omit<TablesInsert<"recurring_payments">, "company_id">;

function toRow(input: RecurringInput): { error: string } | { row: Row } {
  const name = input.serviceName.trim();
  const amount = Number(String(input.amount).replace(/[^0-9]/g, ""));
  if (!name || name.length > 60) return { error: "서비스명은 1~60자로 입력해 주세요." };
  if (!Number.isInteger(amount) || amount < 1 || amount > 100_000_000) return { error: "금액을 입력해 주세요." };
  if (input.cycle !== "monthly" && input.cycle !== "yearly") return { error: "결제 주기를 골라 주세요." };
  if (!Number.isInteger(input.billingDay) || input.billingDay < 1 || input.billingDay > 31) return { error: "결제일을 골라 주세요." };
  if (input.cycle === "yearly" && !(Number.isInteger(input.billingMonth) && input.billingMonth! >= 1 && input.billingMonth! <= 12)) return { error: "결제 월을 골라 주세요." };
  if (!UUID.test(input.assigneeMemberId)) return { error: "담당자를 골라 주세요." };
  const corporate = input.paymentMethod === "corporate_card";
  return {
    row: {
      service_name: name,
      amount,
      cycle: input.cycle,
      billing_day: input.billingDay,
      billing_month: input.cycle === "yearly" ? input.billingMonth : null,
      payment_method: corporate ? ("corporate_card" as const) : ("personal_card" as const),
      corporate_card_id: corporate && input.corporateCardId && UUID.test(input.corporateCardId) ? input.corporateCardId : null,
      assignee_member_id: input.assigneeMemberId,
      memo: input.memo.trim().slice(0, 200) || null,
    },
  };
}

function errorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23503") return "담당자·법인카드를 다시 골라 주세요.";
  if (error.code === "23514") return "입력값을 확인해 주세요.";
  if (error.code === "42501") return messageForDbError({ message: "NOT_ALLOWED" });
  return messageForDbError(error);
}

export async function addRecurringAction(input: RecurringInput): Promise<ActionResult> {
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") return { error: messageForDbError({ message: "NOT_A_MEMBER" }) };
  const r = toRow(input);
  if ("error" in r) return { error: r.error };
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_payments").insert({ company_id: membership.company_id, ...r.row });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { error: null };
}

export async function updateRecurringAction(id: string, input: RecurringInput): Promise<ActionResult> {
  const r = toRow(input);
  if ("error" in r) return { error: r.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring_payments").update(r.row).eq("id", id).select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}

// 해지한 구독은 사용 안 함(지난 결의서 연결 보존). 다시 사용하면 그날부터 다시 만든다
export async function setRecurringActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("recurring_payments")
    .update(active ? { is_active: true, starts_on: today } : { is_active: false })
    .eq("id", id)
    .select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}
