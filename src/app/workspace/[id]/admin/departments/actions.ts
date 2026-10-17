"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 부서 관리 (spec/screens/admin-dashboard.md ⑤). 권한·회사 일치는 departments RLS(관리자 이상, 자기 회사)가 강제한다.
// 회사 id는 클라이언트에서 받지 않고 서버에서 본인 소속으로 정한다.
function errorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "같은 이름의 부서가 이미 있어요.";
  if (error.code === "42501") return messageForDbError({ message: "NOT_ALLOWED" });
  return messageForDbError(error);
}

function cleanName(name: string): string | null {
  const v = name.trim();
  return v.length >= 1 && v.length <= 50 ? v : null;
}

const INVALID_NAME = { error: "부서 이름을 1~50자로 입력해 주세요." };

export async function addDepartmentAction(name: string): Promise<ActionResult> {
  const v = cleanName(name);
  if (!v) return INVALID_NAME;
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") return { error: messageForDbError({ message: "NOT_A_MEMBER" }) };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("departments")
    .select("sort_order")
    .eq("company_id", membership.company_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("departments")
    .insert({ company_id: membership.company_id, name: v, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { error: null };
}

export async function renameDepartmentAction(id: string, name: string): Promise<ActionResult> {
  const v = cleanName(name);
  if (!v) return INVALID_NAME;
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").update({ name: v }).eq("id", id).select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}

// 화면에 보이는 순서 그대로 다시 번호를 매긴다(1, 2, 3 …)
export async function reorderDepartmentsAction(orderedIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, i) => supabase.from("departments").update({ sort_order: i + 1 }).eq("id", id).select("id")),
  );
  const failed = results.find((r) => r.error || !r.data?.length);
  if (failed) return { error: failed.error ? errorMessage(failed.error) : messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}

// 삭제: 소속 멤버는 '부서 없음'이 되고, 이 부서의 결재라인은 함께 삭제된다(FK on delete set null / cascade)
export async function deleteDepartmentAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").delete().eq("id", id).select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}
