import "server-only";
import { validDoc, type DocModel } from "@/lib/doc-convert/model";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fillForm, formDocNumber, type LeaveDocData } from "./fill";
import type { Field } from "./model";

const kstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const kstHM = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(11, 16) : null);
const hm = (t: string) => t.slice(0, 5);

// 근태 정정·휴일근무 신청서(회사 양식) 만들기(9-33c, spec/features/company-forms.md §G-1) — 휴가신청서(leave-doc)와 같은 방식.
// 볼 수 있는 신청인지는 RLS(본인 또는 관리자)로 먼저 확인하고, 그때 쓴 양식 버전·사람 정보는 서버 키로 같은 회사 안에서만 읽는다
export async function getRequestDoc(requestId: string): Promise<{ doc: DocModel; fileName: string } | null> {
  if (!/^[0-9a-f-]{36}$/.test(requestId)) return null;
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("attendance_requests")
    .select("id, company_id, member_id, member_name, kind, work_date, new_in, new_out, reason, before, status, decided_by, decided_by_name, decided_at, created_at, form_id, custom_payload")
    .eq("id", requestId)
    .maybeSingle();
  if (!r?.form_id || r.status === "canceled") return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const cid = r.company_id;
  const ids = [r.member_id, r.decided_by].filter((x): x is string => !!x);
  const [{ data: form }, { data: company }, { data: people }] = await Promise.all([
    admin.from("company_forms").select("name, sheets, fields").eq("id", r.form_id).eq("company_id", cid).maybeSingle(),
    admin.from("companies").select("name").eq("id", cid).single(),
    admin.from("members").select("id, name, position, employee_number, departments(name)").eq("company_id", cid).in("id", ids),
  ]);
  if (!form || !validDoc(form.sheets)) return null;
  const who = new Map((people ?? []).map((p) => [p.id, p as unknown as { name: string; position: string | null; employee_number: string | null; departments: { name: string } | null }]));
  const me = who.get(r.member_id);
  const boss = r.decided_by ? who.get(r.decided_by) : undefined;
  const docDate = kstDate(r.created_at);
  const before = (r.before ?? {}) as { in_at?: string | null; out_at?: string | null };
  const data: LeaveDocData = {
    company: company?.name ?? "",
    member: { name: me?.name ?? r.member_name, department: me?.departments?.name ?? null, position: me?.position ?? null, employee_number: me?.employee_number ?? null },
    docDate,
    docNumber: formDocNumber(r.kind === "holiday" ? "휴일" : "정정", r.id, docDate),
    request: { date: r.work_date, beforeIn: kstHM(before.in_at), beforeOut: kstHM(before.out_at), newIn: hm(r.new_in), newOut: hm(r.new_out), reason: r.reason },
    applicant: { name: me?.name ?? r.member_name, position: me?.position ?? null, date: docDate },
    approver:
      r.status === "approved"
        ? { name: boss?.name ?? r.decided_by_name ?? "", position: boss?.position ?? null, date: r.decided_at ? kstDate(r.decided_at) : null }
        : r.status === "rejected"
          ? "rejected"
          : "pending",
    custom: (r.custom_payload ?? {}) as Record<string, string>,
  };
  const doc = fillForm(form.sheets as unknown as DocModel, form.fields as unknown as Field[], data);
  return { doc, fileName: `${form.name}_${me?.name ?? r.member_name}_${r.work_date}` };
}
