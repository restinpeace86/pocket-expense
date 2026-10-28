"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice, isActiveMember } from "@/lib/tax-office/queries";
import { validColumns, type TemplateColumn, type TemplateTarget } from "@/lib/tax-office/template-fields";
import { parseTemplateXlsx, TEMPLATE_BUCKET, TEMPLATE_MAX_BYTES } from "@/lib/tax-office/template-workbook";

// 세무사무소 월말 결산 양식 (D-150). 쓰기는 사무소 관리자만 — DB 함수가 다시 확인한다
type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

async function officeAdmin() {
  const s = await getMyTaxOffice();
  return isActiveMember(s) && s.role === "admin" ? s : null;
}

export type UploadedTemplate = { ok: true; filePath: string; fileName: string; sheetName: string; headerRow: number; columns: TemplateColumn[] };

// 양식 파일 올리기: 엑셀(.xlsx)만, 5MB까지. 머리글 줄을 찾아 칸마다 항목을 추정해 돌려준다(저장은 다음 단계)
export async function uploadTemplateFileAction(formData: FormData): Promise<UploadedTemplate | Fail> {
  const me = await officeAdmin();
  if (!me) return fail(messageForDbError({ message: "NOT_ALLOWED" }));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("파일을 골라 주세요.");
  if (file.size > TEMPLATE_MAX_BYTES) return fail("5MB 이하 파일만 올릴 수 있어요.");
  if (/\.xls$/i.test(file.name)) return fail("예전 엑셀(.xls) 파일이에요. 엑셀에서 [다른 이름으로 저장 › Excel 통합 문서(.xlsx)]로 저장한 뒤 올려 주세요.");
  if (!/\.xlsx$/i.test(file.name)) return fail("엑셀(.xlsx) 파일만 올릴 수 있어요.");
  const buf = await file.arrayBuffer();
  const parsed = await parseTemplateXlsx(buf);
  if (!parsed) return fail("양식에서 머리글 줄(거래일자·거래처명처럼 칸 이름이 적힌 줄)을 찾지 못했어요. 머리글이 위쪽 20줄 안에 있는 엑셀인지 확인해 주세요.");
  const admin = createAdminClient();
  if (!admin) return fail("지금은 파일을 저장할 수 없어요. 잠시 뒤 다시 시도해 주세요.");
  const filePath = `${me.office_id}/${crypto.randomUUID()}.xlsx`;
  const { error } = await admin.storage
    .from(TEMPLATE_BUCKET)
    .upload(filePath, buf, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  if (error) return fail("파일을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return { ok: true, filePath, fileName: file.name.slice(0, 200), ...parsed };
}

export type SaveTemplateInput = {
  id: string | null;
  name: string;
  target: TemplateTarget;
  filePath: string | null;
  fileName: string | null;
  sheetName: string | null;
  headerRow: number;
  columns: TemplateColumn[];
};

export async function saveTemplateAction(input: SaveTemplateInput): Promise<{ ok: true } | Fail> {
  if (!validColumns(input.columns)) return fail(messageForDbError({ message: "INVALID_TEMPLATE" }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_tax_office_template", {
    p_id: input.id as string, // null = 새 양식(생성 타입은 null을 표현하지 못함)
    p_name: input.name,
    p_target: input.target,
    p_file_path: input.filePath as string,
    p_file_name: input.fileName as string,
    p_sheet_name: input.sheetName as string,
    p_header_row: input.headerRow,
    p_columns: input.columns,
  });
  if (error) return fail(messageForDbError(error));
  refresh();
  return { ok: true };
}

export async function deleteTemplateAction(id: string): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("delete_tax_office_template", { p_id: id });
  if (error) return fail(messageForDbError(error));
  const admin = createAdminClient();
  if (path && admin) await admin.storage.from(TEMPLATE_BUCKET).remove([path]);
  refresh();
  return { ok: true };
}
