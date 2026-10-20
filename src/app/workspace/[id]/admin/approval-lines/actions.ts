"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 결재라인 저장 — 권한(관리자 이상)·검토자 검사·회사 일치는 DB의 save_approval_line(034)이 한다
export async function saveApprovalLineAction(departmentId: string | null, approverIds: string[]): Promise<ActionResult> {
  if ((departmentId && !UUID.test(departmentId)) || !approverIds.every((id) => UUID.test(id))) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_approval_line", { p_department_id: departmentId as string /* null = 회사 기본 결재라인 (생성 타입은 null을 표현하지 못함) */, p_approver_ids: approverIds });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}
