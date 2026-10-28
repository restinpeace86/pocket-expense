import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeLayout, type FormLayout } from "./layout";

// 회사가 지금 쓰는 지출결의서 양식 (D-118). 활성 양식이 없으면 null → 기본 양식으로 그린다.
export type ActiveForm = { id: string; version: number; layout: FormLayout; sourceFilePath: string | null; createdAt: string };

// client: 세무사무소 ZIP처럼 회사 멤버가 아닌 쪽에서 쓸 때(접근 확인 뒤) 운영 키 클라이언트를 넘긴다(D-153)
export async function getActiveForm(companyId: string, client?: Awaited<ReturnType<typeof createClient>>): Promise<ActiveForm | null> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("form_templates")
    .select("id, version, schema, source_file_path, created_at")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, version: data.version, layout: normalizeLayout(data.schema), sourceFilePath: data.source_file_path, createdAt: data.created_at };
}
