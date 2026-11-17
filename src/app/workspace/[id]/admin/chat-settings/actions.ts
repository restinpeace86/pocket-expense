"use server";

import { refresh } from "next/cache";
import { requireWorkspace } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 채팅 사진·파일 보관 기간(D-212): 관리자만·자기 회사만·메신저가 켜진 회사만·30·60·90일만 — DB 함수(chat_set_attachment_days)가 확인
const ERRORS: Record<string, string> = {
  INVALID_DAYS: "30일·60일·90일 중에서 골라 주세요.",
  FEATURE_DISABLED: "사내 채팅이 켜진 회사만 바꿀 수 있어요.",
};

export async function setChatAttachmentDaysAction(days: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("chat_set_attachment_days", { p_days: days });
  if (error) {
    const code = Object.keys(ERRORS).find((k) => error.message?.includes(k));
    return { error: code ? ERRORS[code] : error.code === "42501" ? "관리자만 바꿀 수 있어요." : "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  refresh();
  return { error: null };
}

// 결재 문서 첨부 일괄 정리(D-291): 승인된 지 n개월(0 = 전부) 지난 결재 문서의 첨부를 지운다.
// DB가 관리자·우리 회사·승인된 문서만 골라 경로를 주고(approval_doc_purge_list) → 저장소에서 지우고 → 저장소에서 정말 없어진 것만 기록을 지운다(approval_doc_purge_done)
export type PurgeResult = { error: string | null; files: number; bytes: number; left: number };
export async function purgeApprovalFilesAction(companyId: string, months: number): Promise<PurgeResult> {
  const fail = (error: string): PurgeResult => ({ error, files: 0, bytes: 0, left: 0 });
  if (![0, 3, 6, 12].includes(months)) return fail("기간을 다시 골라 주세요.");
  const me = await requireWorkspace(companyId, { admin: true });
  const supabase = await createClient();
  const storage = createAdminClient()?.storage.from("approval-files");
  if (!storage) return fail("지금은 정리할 수 없어요. 잠시 후 다시 시도해 주세요.");
  const before = await supabase.rpc("approval_doc_purge_status");
  let files = 0;
  const seen = new Set<string>();
  for (let round = 0; round < 20; round++) {
    const { data: list, error } = await supabase.rpc("approval_doc_purge_list", { p_months: months });
    if (error) return fail(error.code === "42501" ? "관리자만 정리할 수 있어요." : "정리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    // 한 번 지우려다 못 지운 것은 다시 잡지 않는다(같은 목록을 계속 돌지 않게)
    const paths = ((list ?? []) as string[]).filter((p) => p.startsWith(`${me.company_id}/`) && !seen.has(p));
    if (!paths.length) break;
    paths.forEach((p) => seen.add(p));
    const rm = await storage.remove(paths);
    if (rm.error) console.error("approval-purge storage", rm.error.message);
    const { data: n, error: de } = await supabase.rpc("approval_doc_purge_done", { p_paths: paths });
    if (de) console.error("approval-purge done", de.message);
    files += Number(n ?? 0);
  }
  const after = await supabase.rpc("approval_doc_purge_status");
  const pick = (d: unknown) => (d as Record<string, { files: number; bytes: number }> | null)?.[String(months)];
  refresh();
  // left = 이 기간에 아직 남은 첨부(저장소에서 못 지운 것) — 화면이 "다시 해 주세요"로 알림
  return { error: null, files, bytes: Math.max(0, Number(pick(before.data)?.bytes ?? 0) - Number(pick(after.data)?.bytes ?? 0)), left: Number(pick(after.data)?.files ?? 0) };
}
