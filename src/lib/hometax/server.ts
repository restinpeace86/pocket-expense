import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logTaxExport } from "@/lib/tax/download-log";
import { HOMETAX_BUCKET, hometaxZipNames, type HometaxKind, type HometaxUpload } from "./kinds";

// 홈택스 자료 조회·받기 (D-158). 볼 수 있는지는 RLS(회사 관리자 / 그 회사를 볼 수 있는 세무사무소 구성원)가 정하고,
// 그 행의 파일만 운영 키로 읽는다(보관함은 비공개)
const COLS = "id, month, kind, file_name, file_size, header, preview, row_count, memo, uploaded_by_name, created_at";

export async function listHometax(companyId: string, month: string): Promise<HometaxUpload[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("hometax_uploads").select(COLS).eq("company_id", companyId).eq("month", month).order("created_at");
  return (data ?? []) as unknown as HometaxUpload[];
}

async function visibleRow(companyId: string, id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("hometax_uploads").select("id, month, kind, file_name, file_path, row_count").eq("company_id", companyId).eq("id", id).maybeSingle();
  return data && data.file_path.startsWith(`${companyId}/`) ? data : null;
}

const MIME: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
};

// 원본 한 개 받기 + 받은 기록
export async function hometaxFileResponse(companyId: string, id: string): Promise<NextResponse> {
  const row = /^[0-9a-f-]{36}$/.test(id) ? await visibleRow(companyId, id) : null;
  const admin = createAdminClient();
  if (!row || !admin) return new NextResponse("Not Found", { status: 404 });
  const { data: blob } = await admin.storage.from(HOMETAX_BUCKET).download(row.file_path);
  if (!blob) return new NextResponse("Not Found", { status: 404 });
  await logTaxExport(companyId, row.month, "hometax", row.row_count, false, row.file_name);
  const ext = row.file_path.split(".").pop() ?? "";
  return new NextResponse(blob, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="hometax.${ext}"; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

// ZIP에 넣을 홈택스 원본(홈택스자료/ 폴더) + 10분짜리 링크
export async function hometaxZipFiles(companyId: string, month: string): Promise<{ name: string; url: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("hometax_uploads").select("id, kind, file_name, file_path").eq("company_id", companyId).eq("month", month).order("created_at");
  const list = (data ?? []).filter((r) => r.file_path.startsWith(`${companyId}/`));
  const admin = createAdminClient();
  if (!list.length || !admin) return [];
  const names = hometaxZipNames(list.map((r) => ({ id: r.id, kind: r.kind as HometaxKind, file_name: r.file_name })));
  const { data: signed } = await admin.storage.from(HOMETAX_BUCKET).createSignedUrls(list.map((r) => r.file_path), 600);
  const urls = new Map((signed ?? []).filter((s) => s.path && s.signedUrl && !s.error).map((s) => [s.path as string, s.signedUrl]));
  return list.map((r) => ({ name: names.get(r.id) as string, url: urls.get(r.file_path) ?? null }));
}
