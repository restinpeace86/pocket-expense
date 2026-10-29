"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { notifyFormatRequest, prepareFormatUpload } from "@/lib/accounting-format/server";
import { createClient } from "@/lib/supabase/server";

// 회사 관리자: 다른 회계 프로그램(이카운트·세무사랑) 엑셀 업로드 서식 등록 (D-180). 권한·회사 격리는 DB 함수가 다시 확인한다
export async function addFormatRequestAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const up = await prepareFormatUpload(m.company_id, formData);
  if ("error" in up) return { ok: false, error: up.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_accounting_format_request", {
    p_program: up.program,
    p_file_path: up.path,
    p_file_name: up.fileName,
    p_file_size: up.fileSize,
    p_memo: up.memo,
  });
  if (error) {
    await up.cleanup();
    return { ok: false, error: messageForDbError(error) };
  }
  await notifyFormatRequest(m.company_name, up.program);
  refresh();
  return { ok: true };
}
