"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";
import type { Classification } from "@/lib/expense/categories";

// 계정과목·매핑 (spec/features/account-titles.md). 권한·회사 일치는 RLS(관리자 이상, 자기 회사), 값 검증은 DB 제약(023)이 강제한다.
function errorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "같은 이름의 계정과목이 이미 있어요.";
  if (error.code === "23503") return "분류에 연결되어 있는 계정과목은 삭제할 수 없어요. 먼저 다른 계정과목으로 바꿔 주세요.";
  if (error.code === "23514") return "계정과목 이름은 1~30자, 코드는 20자 이내로 입력해 주세요.";
  if (error.code === "42501") return messageForDbError({ message: "NOT_ALLOWED" });
  return messageForDbError(error);
}

const clean = (v: string) => v.trim();

export async function addAccountTitleAction(name: string, code: string): Promise<ActionResult> {
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") return { error: messageForDbError({ message: "NOT_A_MEMBER" }) };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("account_titles")
    .select("sort_order")
    .eq("company_id", membership.company_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("account_titles").insert({
    company_id: membership.company_id,
    name: clean(name),
    code: clean(code) || null,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { error: null };
}

export async function updateAccountTitleAction(id: string, name: string, code: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("account_titles").update({ name: clean(name), code: clean(code) || null }).eq("id", id).select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}

export async function deleteAccountTitleAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("account_titles").delete().eq("id", id).select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}

// 분류 하나의 계정과목 바꾸기. 매핑이 없던 분류(옛 회사 등)는 새로 만든다.
export async function setMappingAction(c: Classification, accountTitleId: string): Promise<ActionResult> {
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") return { error: messageForDbError({ message: "NOT_A_MEMBER" }) };
  const supabase = await createClient();
  let q = supabase.from("account_title_mappings").update({ account_title_id: accountTitleId }).eq("company_id", membership.company_id).eq("category", c.category);
  q = c.tripType ? q.eq("trip_type", c.tripType) : q.is("trip_type", null);
  q = c.purchaseType ? q.eq("purchase_type", c.purchaseType) : q.is("purchase_type", null);
  q = c.condolenceTarget ? q.eq("condolence_target", c.condolenceTarget) : q.is("condolence_target", null);
  const { data, error } = await q.select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) {
    const { error: insertError } = await supabase
      .from("account_title_mappings")
      .insert({ company_id: membership.company_id, category: c.category, trip_type: c.tripType, purchase_type: c.purchaseType, condolence_target: c.condolenceTarget ?? null, account_title_id: accountTitleId });
    if (insertError) return { error: errorMessage(insertError) };
  }
  refresh();
  return { error: null };
}
