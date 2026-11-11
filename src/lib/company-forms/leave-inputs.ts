import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Field } from "./model";

// 휴가 신청 화면의 [회사 추가 항목](8-104 C): 회사 휴가신청서(active)의 직원 입력 칸(양식 위→아래, 왼→오), 지난 값, 직원 고르기 목록
export type LeaveInputs = { formName: string; fields: Field[]; last: Record<string, string>; members: { id: string; name: string }[] };

export async function getLeaveInputs(memberId: string): Promise<LeaveInputs | null> {
  const supabase = await createClient();
  const { data: form } = await supabase.from("company_forms").select("id, name, fields").eq("kind", "leave").eq("status", "active").maybeSingle();
  if (!form) return null;
  const fields = ((form.fields ?? []) as unknown as Field[]).filter((f) => f.b.k === "input").sort((a, b) => a.s - b.s || a.r - b.r || a.c - b.c);
  if (!fields.length) return null;
  const needMembers = fields.some((f) => f.b.k === "input" && f.b.type === "member");
  const [{ data: lastRow }, { data: members }] = await Promise.all([
    supabase.from("attendance_leaves").select("custom_payload").eq("member_id", memberId).not("form_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    needMembers ? supabase.from("members").select("id, name").eq("status", "approved").order("name") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const prev = (lastRow?.custom_payload ?? {}) as Record<string, string>;
  const list = (members ?? []) as { id: string; name: string }[];
  // 지난 값 미리 채움: 같은 칸 key만, 직원 고르기는 이름 → 지금 목록의 id
  const last: Record<string, string> = {};
  for (const f of fields) {
    const v = prev[f.key];
    if (!v || f.b.k !== "input") continue;
    if (f.b.type === "member") {
      const m = list.find((x) => x.name === v);
      if (m) last[f.key] = m.id;
    } else if (f.b.type !== "choice" || f.b.options?.includes(v)) last[f.key] = v;
  }
  return { formName: form.name, fields, last, members: list };
}
