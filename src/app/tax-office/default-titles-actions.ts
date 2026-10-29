"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// 세무사무소 기본 계정과목 (D-160, D-167): 고객사 설정을 기본값으로 저장(= 모든 고객사 자동 적용) / 개별 설정 고객사를 기본값으로 되돌리기. 사무소 관리자·볼 수 있는 고객사만(DB 함수가 확인)
type Fail = { ok: false; error: string };

// 저장하면 개별 설정이 아닌 모든 고객사에 바로 적용된다(D-167)
export async function saveDefaultTitlesAction(companyId: string): Promise<{ ok: true; companies: number; changes: number } | Fail> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_tax_office_default_titles", { p_company_id: companyId });
  if (error) return { ok: false, error: messageForDbError(error) };
  const r = data as { companies: number; changes: number };
  refresh();
  return { ok: true, companies: Number(r.companies), changes: Number(r.changes) };
}

export async function applyDefaultTitlesAction(companyIds: string[]): Promise<{ ok: true; companies: number; changes: number } | Fail> {
  if (companyIds.length === 0) return { ok: false, error: "되돌릴 고객사를 골라 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_tax_office_default_titles", { p_company_ids: companyIds });
  if (error) return { ok: false, error: messageForDbError(error) };
  const r = data as { companies: number; changes: number };
  refresh();
  return { ok: true, companies: Number(r.companies), changes: Number(r.changes) };
}
