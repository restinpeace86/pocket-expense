import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExportRow } from "./export-rows";

// 세무 마감 데이터 (tax-closing.md, tax-export.md). 권한(관리자)·회사 격리는 DB 함수 tax_month_export가 확인한다.
export type TaxMonth = {
  month: string;
  status: "pending" | "closed";
  closedAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  rows: ExportRow[];
  excluded: { draft: number; submitted: number; rejected: number; claims: number };
};

export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function getTaxMonth(month: string): Promise<{ ok: true; data: TaxMonth } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tax_month_export", { p_month: month });
  if (error || !data) return { ok: false, error: error?.message ?? "NOT_FOUND" };
  const j = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      month,
      status: j.status === "closed" ? "closed" : "pending",
      closedAt: (j.closed_at as string | null) ?? null,
      reopenedAt: (j.reopened_at as string | null) ?? null,
      reopenReason: (j.reopen_reason as string | null) ?? null,
      rows: (j.rows as ExportRow[]) ?? [],
      excluded: (j.excluded as TaxMonth["excluded"]) ?? { draft: 0, submitted: 0, rejected: 0, claims: 0 },
    },
  };
}
