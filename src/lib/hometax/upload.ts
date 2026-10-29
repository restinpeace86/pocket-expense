import "server-only";
import { messageForDbError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { MONTH } from "@/lib/tax/closing";
import { HOMETAX_BUCKET, HOMETAX_EXT, HOMETAX_KINDS, HOMETAX_MAX_BYTES, type HometaxKind } from "./kinds";
import { readHometaxTable } from "./parse";

// 홈택스 파일 올리기 공통(회사 관리자 D-158 · 세무사무소 D-172): 확인 → 표 읽기 → 보관함 저장. 기록(DB 함수)은 부르는 쪽이, 실패하면 cleanup으로 파일을 지운다
export type PreparedHometax = {
  month: string;
  kind: HometaxKind;
  memo: string;
  path: string;
  fileName: string;
  fileSize: number;
  table: { header: string[]; preview: string[][]; rowCount: number };
  cleanup: () => Promise<void>;
};

export async function prepareHometaxUpload(companyId: string, formData: FormData): Promise<PreparedHometax | { error: string }> {
  const month = String(formData.get("month") ?? "");
  const kind = String(formData.get("kind") ?? "") as HometaxKind;
  const memo = String(formData.get("memo") ?? "").slice(0, 200);
  const file = formData.get("file");
  if (!MONTH.test(month)) return { error: messageForDbError({ message: "INVALID_MONTH" }) };
  if (!HOMETAX_KINDS.includes(kind)) return { error: "자료 종류를 골라 주세요." };
  if (!(file instanceof File) || file.size === 0) return { error: "파일을 골라 주세요." };
  if (file.size > HOMETAX_MAX_BYTES) return { error: "10MB 이하 파일만 올릴 수 있어요." };
  const ext = HOMETAX_EXT.exec(file.name)?.[1]?.toLowerCase();
  if (!ext) return { error: "홈택스에서 내려받은 엑셀(.xlsx·.xls)이나 .csv 파일만 올릴 수 있어요." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const table = readHometaxTable(bytes, file.name);
  if (!table) return { error: "파일을 읽지 못했어요. 홈택스에서 내려받은 그대로인지, 암호가 걸려 있지 않은지 확인해 주세요." };
  const storage = createAdminClient();
  if (!storage) return { error: "지금은 파일을 저장할 수 없어요. 잠시 뒤 다시 시도해 주세요." };
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await storage.storage.from(HOMETAX_BUCKET).upload(path, bytes, { contentType: file.type || "application/octet-stream" });
  if (error) return { error: "파일을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  return {
    month,
    kind,
    memo,
    path,
    fileName: file.name.slice(0, 200),
    fileSize: file.size,
    table,
    cleanup: async () => {
      await storage.storage.from(HOMETAX_BUCKET).remove([path]);
    },
  };
}

export async function removeHometaxFile(path: string | null | undefined): Promise<void> {
  const storage = createAdminClient();
  if (path && storage) await storage.storage.from(HOMETAX_BUCKET).remove([path]);
}
