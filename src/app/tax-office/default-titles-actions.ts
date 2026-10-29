"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// 세무사무소 기본 계정과목 (D-160): 고객사 설정을 기본값으로 저장 / 고른 고객사에 적용. 사무소 관리자·볼 수 있는 고객사만(DB 함수가 확인)
type Fail = { ok: false; error: string };

export async function saveDefaultTitlesAction(companyId: string): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_tax_office_default_titles", { p_company_id: companyId });
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}

export async function applyDefaultTitlesAction(companyIds: string[]): Promise<{ ok: true; companies: number; changes: number } | Fail> {
  if (companyIds.length === 0) return { ok: false, error: "적용할 고객사를 골라 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_tax_office_default_titles", { p_company_ids: companyIds });
  if (error) return { ok: false, error: messageForDbError(error) };
  const r = data as { companies: number; changes: number };
  refresh();
  return { ok: true, companies: Number(r.companies), changes: Number(r.changes) };
}
