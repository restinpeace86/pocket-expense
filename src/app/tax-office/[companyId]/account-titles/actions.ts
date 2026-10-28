"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import type { Classification } from "@/lib/expense/categories";
import { createClient } from "@/lib/supabase/server";
import { getTaxOfficeClients } from "@/lib/tax-office/queries";

// 세무사무소: 고객사의 계정과목·분류 연결 고치기 (D-149). 추가·수정만(삭제 없음). 회사 범위는 RLS(사무소 배정)가 다시 막는다
type Result = { error: string | null };

function errorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "같은 이름의 계정과목이 이미 있어요.";
  if (error.code === "23514") return "계정과목 이름은 1~30자, 코드는 20자 이내로 입력해 주세요.";
  if (error.code === "42501") return messageForDbError({ message: "NOT_ALLOWED" });
  return messageForDbError(error);
}

async function linked(companyId: string): Promise<boolean> {
  return (await getTaxOfficeClients()).some((c) => c.company_id === companyId);
}
const NOT_LINKED = { error: "이 고객사를 더 볼 수 없어요(연결 해제·배정 변경). 화면을 새로고침해 주세요." };

export async function taxAgentAddTitleAction(companyId: string, name: string, code: string): Promise<Result> {
  if (!(await linked(companyId))) return NOT_LINKED;
  const supabase = await createClient();
  const { data: last } = await supabase.from("account_titles").select("sort_order").eq("company_id", companyId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("account_titles").insert({ company_id: companyId, name: name.trim(), code: code.trim() || null, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { error: null };
}

export async function taxAgentUpdateTitleAction(companyId: string, id: string, name: string, code: string): Promise<Result> {
  if (!(await linked(companyId))) return NOT_LINKED;
  const supabase = await createClient();
  const { data, error } = await supabase.from("account_titles").update({ name: name.trim(), code: code.trim() || null }).eq("id", id).eq("company_id", companyId).select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}

export async function taxAgentSetMappingAction(companyId: string, c: Classification, accountTitleId: string): Promise<Result> {
  if (!(await linked(companyId))) return NOT_LINKED;
  const supabase = await createClient();
  let q = supabase.from("account_title_mappings").update({ account_title_id: accountTitleId }).eq("company_id", companyId).eq("category", c.category);
  q = c.tripType ? q.eq("trip_type", c.tripType) : q.is("trip_type", null);
  q = c.purchaseType ? q.eq("purchase_type", c.purchaseType) : q.is("purchase_type", null);
  q = c.condolenceTarget ? q.eq("condolence_target", c.condolenceTarget) : q.is("condolence_target", null);
  const { data, error } = await q.select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) {
    const { error: insertError } = await supabase
      .from("account_title_mappings")
      .insert({ company_id: companyId, category: c.category, trip_type: c.tripType, purchase_type: c.purchaseType, condolence_target: c.condolenceTarget ?? null, account_title_id: accountTitleId });
    if (insertError) return { error: errorMessage(insertError) };
  }
  refresh();
  return { error: null };
}
