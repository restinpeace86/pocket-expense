import "server-only";
import { validDoc, type DocModel } from "@/lib/doc-convert/model";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fillForm, leaveDocNumber, type LeaveDocData } from "./fill";
import type { Field } from "./model";

const kstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);

// 휴가신청서(회사 양식) 만들기(8-104 C). 볼 수 있는 휴가인지는 RLS(본인 또는 관리자)로 먼저 확인하고,
// 그때 쓴 양식 버전(지운 양식이어도)·사람 정보는 서버 키로 같은 회사 안에서만 읽는다
export async function getLeaveDoc(leaveId: string): Promise<{ doc: DocModel; fileName: string } | null> {
  if (!/^[0-9a-f-]{36}$/.test(leaveId)) return null;
  const supabase = await createClient();
  const { data: l } = await supabase
    .from("attendance_leaves")
    .select("id, company_id, member_id, member_name, type_name, unit, start_date, end_date, start_time, hours, workdays, reason, status, decided_by, decided_by_name, decided_at, created_at, form_id, custom_payload, remaining_days")
    .eq("id", leaveId)
    .maybeSingle();
  if (!l?.form_id) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const cid = l.company_id;
  const ids = [l.member_id, l.decided_by].filter((x): x is string => !!x);
  const [{ data: form }, { data: company }, { data: people }, { count: files }] = await Promise.all([
    admin.from("company_forms").select("name, sheets, fields").eq("id", l.form_id).eq("company_id", cid).maybeSingle(),
    admin.from("companies").select("name").eq("id", cid).single(),
    admin.from("members").select("id, name, position, employee_number, departments(name)").eq("company_id", cid).in("id", ids),
    admin.from("attendance_leave_files").select("id", { count: "exact", head: true }).eq("leave_id", l.id).eq("company_id", cid),
  ]);
  if (!form || !validDoc(form.sheets)) return null;
  const who = new Map((people ?? []).map((p) => [p.id, p as unknown as { name: string; position: string | null; employee_number: string | null; departments: { name: string } | null }]));
  const me = who.get(l.member_id);
  const boss = l.decided_by ? who.get(l.decided_by) : undefined;
  const docDate = kstDate(l.created_at);
  const data: LeaveDocData = {
    company: company?.name ?? "",
    member: { name: me?.name ?? l.member_name, department: me?.departments?.name ?? null, position: me?.position ?? null, employee_number: me?.employee_number ?? null },
    docDate,
    docNumber: leaveDocNumber(l.id, docDate),
    leave: {
      type: l.type_name,
      start: l.start_date,
      end: l.end_date,
      unit: l.unit === "hour" ? "hour" : "day",
      startTime: l.start_time,
      hours: l.hours,
      workdays: l.workdays,
      reason: l.reason,
      remaining: l.remaining_days === null ? null : Number(l.remaining_days),
      proof: (files ?? 0) > 0,
    },
    applicant: { name: me?.name ?? l.member_name, position: me?.position ?? null, date: docDate },
    approver:
      l.status === "approved"
        ? { name: boss?.name ?? l.decided_by_name ?? "", position: boss?.position ?? null, date: l.decided_at ? kstDate(l.decided_at) : null }
        : l.status === "rejected"
          ? "rejected"
          : "pending",
    custom: (l.custom_payload ?? {}) as Record<string, string>,
  };
  const doc = fillForm(form.sheets as unknown as DocModel, form.fields as unknown as Field[], data);
  return { doc, fileName: `${form.name}_${me?.name ?? l.member_name}_${l.start_date}` };
}
