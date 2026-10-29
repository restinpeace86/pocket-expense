"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import { prepareHometaxUpload, removeHometaxFile } from "@/lib/hometax/upload";
import { createClient } from "@/lib/supabase/server";
import { getTaxOfficeClients } from "@/lib/tax-office/queries";

// 세무사무소: 세무대리로 직접 받은 홈택스 자료를 고객사 달별 [홈택스 자료]에 올리기·지우기 (D-172). 볼 수 있는 고객사인지는 DB 함수가 다시 확인
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function uploadOfficeHometaxAction(companyId: string, formData: FormData): Promise<Result<{ rowCount: number }>> {
  if (!(await getTaxOfficeClients()).some((c) => c.company_id === companyId)) return { ok: false, error: messageForDbError({ message: "NOT_FOUND" }) };
  const up = await prepareHometaxUpload(companyId, formData);
  if ("error" in up) return { ok: false, error: up.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_hometax_upload_office", {
    p_company_id: companyId,
    p_month: up.month,
    p_kind: up.kind,
    p_file_path: up.path,
    p_file_name: up.fileName,
    p_file_size: up.fileSize,
    p_header: up.table.header,
    p_preview: up.table.preview,
    p_row_count: up.table.rowCount,
    p_memo: up.memo,
  });
  if (error) {
    await up.cleanup();
    return { ok: false, error: messageForDbError(error) };
  }
  refresh();
  return { ok: true, rowCount: up.table.rowCount };
}

export async function deleteOfficeHometaxAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("delete_hometax_upload_office", { p_id: id });
  if (error) return { ok: false, error: messageForDbError(error) };
  await removeHometaxFile(path);
  refresh();
  return { ok: true };
}
