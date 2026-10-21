"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { signReceiptUrls } from "@/lib/storage/signed-urls";
import { createClient } from "@/lib/supabase/server";
import { getTaxMonth, MONTH } from "@/lib/tax/closing";
import { evidenceFile } from "@/lib/tax/export-rows";

// 세무 마감 (tax-closing.md §4.C, D-045). 권한(관리자 / 해제는 최고 관리자)·회사 격리는 DB 함수가 다시 확인한다.
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (code: string): { ok: false; error: string } => ({ ok: false, error: messageForDbError({ message: code }) });

async function admin() {
  const m = await getMembership();
  return m && m.status === "approved" && isAdminRole(m.role) ? m : null;
}

export async function closeTaxMonthAction(month: string): Promise<Result<{ count: number; already: boolean }>> {
  if (!(await admin())) return fail("NOT_ALLOWED");
  if (!MONTH.test(month)) return fail("INVALID_MONTH");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_tax_month", { p_month: month });
  if (error) return { ok: false, error: messageForDbError(error) };
  const j = data as { count: number; already: boolean };
  refresh();
  return { ok: true, count: Number(j.count), already: !!j.already };
}

export async function reopenTaxMonthAction(month: string, reason: string): Promise<Result> {
  if (!(await admin())) return fail("NOT_ALLOWED");
  if (!MONTH.test(month)) return fail("INVALID_MONTH");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_tax_month", { p_month: month, p_reason: reason });
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}

// ZIP에 넣을 증빙 파일 목록 + 10분짜리 내려받기 링크. only가 있으면 그 파일만(실패분 다시 받기)
export async function taxEvidenceFilesAction(month: string, only?: string[]): Promise<Result<{ files: { name: string; url: string | null }[] }>> {
  if (!(await admin())) return fail("NOT_ALLOWED");
  if (!MONTH.test(month)) return fail("INVALID_MONTH");
  const res = await getTaxMonth(month);
  if (!res.ok) return { ok: false, error: messageForDbError({ message: res.error }) };
  if (res.data.status !== "closed") return fail("NOT_CLOSED");
  const total = res.data.rows.length;
  let list = res.data.rows.map((r) => evidenceFile(r, month, total)).filter((f): f is { name: string; path: string } => !!f);
  if (only?.length) list = list.filter((f) => only.includes(f.name));
  const supabase = await createClient();
  const urls = new Map<string, string>();
  for (let i = 0; i < list.length; i += 200) {
    const part = await signReceiptUrls(supabase, list.slice(i, i + 200).map((f) => f.path));
    part.forEach((v, k) => urls.set(k, v));
  }
  return { ok: true, files: list.map((f) => ({ name: f.name, url: urls.get(f.path) ?? null })) };
}
