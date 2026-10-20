"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { getMembership } from "@/lib/auth/session";
import { messageForDbError } from "@/lib/errors";
import { signReceiptUrls } from "@/lib/storage/signed-urls";
import { notifyClaimEvent, notifyPayouts } from "@/lib/notify/dispatch";
import { createClient } from "@/lib/supabase/server";
import type { ClaimProblems } from "./problems";

// 상신·결재·지급 서버 액션 (T9). 권한·회사 일치·상태 전이는 모두 DB 함수(004·033)가 원자적으로 확인한다.
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (code: string) => ({ ok: false as const, error: messageForDbError({ message: code }) });

async function member() {
  const m = await getMembership();
  return m && m.status === "approved" ? m : null;
}

// 알림톡은 응답을 보낸 뒤(after) 보낸다 — 화면 체감 시간에 영향을 주지 않고, 실패해도 결재는 그대로다

// 직원: 상신 전 확인 → 빠진 칸이 있으면 목록을 돌려준다
export async function submitClaimAction(claimId: string): Promise<Result<{ status: string }> | { ok: false; error: string; problems: ClaimProblems }> {
  const m = await member();
  if (!m) return fail("NOT_A_MEMBER");
  if (!UUID.test(claimId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data: problems, error: checkError } = await supabase.rpc("check_claim_for_submit", { p_claim_id: claimId });
  if (checkError) return { ok: false, error: messageForDbError(checkError) };
  const p = problems as unknown as ClaimProblems;
  if (p.header.length || p.items.length) return { ok: false, error: messageForDbError({ message: "CLAIM_INCOMPLETE" }), problems: p };
  const { data, error } = await supabase.rpc("submit_claim", { p_claim_id: claimId });
  if (error) return { ok: false, error: messageForDbError(error) };
  if (data === "submitted") after(() => notifyClaimEvent(m.company_id, claimId, "submitted"));
  refresh();
  return { ok: true, status: String(data) };
}

export async function approveClaimAction(claimId: string, comment?: string): Promise<Result<{ status: string }>> {
  const m = await member();
  if (!m) return fail("NOT_A_MEMBER");
  if (!UUID.test(claimId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_claim", { p_claim_id: claimId, p_comment: comment?.trim() || undefined });
  if (error) return { ok: false, error: messageForDbError(error) };
  after(() => notifyClaimEvent(m.company_id, claimId, "approved"));
  refresh();
  return { ok: true, status: String(data) };
}

export async function rejectClaimAction(claimId: string, reason: string, flaggedItemIds: string[]): Promise<Result> {
  const m = await member();
  if (!m) return fail("NOT_A_MEMBER");
  if (!UUID.test(claimId) || !flaggedItemIds.every((id) => UUID.test(id))) return fail("NOT_FOUND");
  if (reason.trim().length > 500) return fail("REASON_TOO_LONG");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_claim", { p_claim_id: claimId, p_reason: reason.trim(), p_flagged_item_ids: flaggedItemIds });
  if (error) return { ok: false, error: messageForDbError(error) };
  after(() => notifyClaimEvent(m.company_id, claimId, "rejected"));
  refresh();
  return { ok: true };
}

export async function markClaimsPaidAction(claimIds: string[]): Promise<Result<{ count: number }>> {
  const m = await member();
  if (!m) return fail("NOT_A_MEMBER");
  if (claimIds.length === 0 || claimIds.length > 200 || !claimIds.every((id) => UUID.test(id))) return fail("INVALID_CLAIMS");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_claims_paid", { p_claim_ids: claimIds });
  if (error) return { ok: false, error: messageForDbError(error) };
  after(() => notifyPayouts(m.company_id, claimIds));
  refresh();
  return { ok: true, count: Number(data) };
}

// 영수증 원본 크게 보기 (볼 수 있는 소명서의 항목만 — 저장소 열람 정책이 다시 확인)
export async function receiptOriginalUrlAction(itemId: string): Promise<Result<{ url: string | null }>> {
  if (!(await member())) return fail("NOT_A_MEMBER");
  if (!UUID.test(itemId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data: item } = await supabase.from("expense_items").select("receipt_path").eq("id", itemId).maybeSingle();
  if (!item?.receipt_path) return { ok: true, url: null };
  return { ok: true, url: (await signReceiptUrls(supabase, [item.receipt_path])).get(item.receipt_path) ?? null };
}
