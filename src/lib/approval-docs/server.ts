import "server-only";
import { validDoc, type DocModel } from "@/lib/doc-convert/model";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fillForm, fitSigners, formDocNumber, type LeaveDocData, type SignCell } from "@/lib/company-forms/fill";
import type { Field } from "@/lib/company-forms/model";
import { docTypeOf } from "@/lib/company-forms/doc-types";
import { displayValue, inputFields, progressLine, type DocFile, type DocRow, type DocStatus, type DocStep, type Payload } from "./model";

// [결재 문서] 읽기(9-33e). 볼 수 있는지는 RLS(쓴 사람·결재선 검토자·관리자는 올린 뒤부터)가 먼저 정한다
type Supabase = Awaited<ReturnType<typeof createClient>>;
export type DocForm = { id: string; group_id: string; name: string; doc_type: string; fields: Field[] };

const DOC_COLS = "id, member_id, member_name, form_id, doc_type, title, status, current_round, self_approved, rejection_reason, submitted_at, decided_at, updated_at, payload";
type RawDoc = Omit<DocRow, "form_name" | "form_group" | "amount" | "progress"> & { payload: unknown };

// 지금 쓸 수 있는(등록된) 결재 문서 양식 — 탭 순서 = 등록 순
export async function getDocForms(): Promise<DocForm[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("company_forms").select("id, group_id, name, doc_type, fields").eq("kind", "general").eq("status", "active").order("published_at", { ascending: true });
  return (data ?? []).map((f) => ({ ...f, doc_type: f.doc_type ?? "other", fields: (f.fields ?? []) as unknown as Field[] }));
}
export async function hasDocForms(): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase.from("company_forms").select("id", { count: "exact", head: true }).eq("kind", "general").eq("status", "active");
  return (count ?? 0) > 0;
}

// 목록 줄 만들기: 양식 이름·금액(표준 칸 amount)·진행 한 줄
async function toRows(supabase: Supabase, docs: RawDoc[]): Promise<DocRow[]> {
  if (!docs.length) return [];
  const ids = docs.map((d) => d.id);
  const formIds = [...new Set(docs.map((d) => d.form_id))];
  const [{ data: steps }, { data: forms }] = await Promise.all([
    supabase.from("approval_document_steps").select("document_id, round, step_order, step_kind, status, approver_member_id, acted_by_name").in("document_id", ids).order("step_order"),
    supabase.from("company_forms").select("id, name, fields, group_id").in("id", formIds),
  ]);
  const names = await memberNames(supabase, [...new Set((steps ?? []).map((s) => s.approver_member_id).filter((x): x is string => !!x))]);
  const formMap = new Map((forms ?? []).map((f) => [f.id, { name: f.name, group: f.group_id, fields: (f.fields ?? []) as unknown as Field[] }]));
  return docs.map((d) => {
    const f = formMap.get(d.form_id);
    const amountKey = f?.fields.find((x) => x.b.k === "input" && x.b.std === "amount")?.key;
    const p = (d.payload ?? {}) as Payload;
    const raw = amountKey ? p[amountKey] : undefined;
    const n = typeof raw === "string" ? Number(raw.replace(/[^0-9]/g, "")) : NaN;
    const st = (steps ?? []).filter((s) => s.document_id === d.id).map((s) => ({ ...s, step_kind: s.step_kind as DocStep["step_kind"], status: s.status as DocStep["status"], approver_name: s.approver_member_id ? (names.get(s.approver_member_id) ?? null) : null }));
    const { payload: _p, ...rest } = d;
    void _p;
    return { ...rest, form_name: f?.name ?? docTypeOf(d.doc_type).label, form_group: f?.group ?? d.form_id, amount: Number.isFinite(n) && typeof raw === "string" && raw.trim() ? n : null, progress: progressLine(d.status as DocStatus, st, d.current_round, d.self_approved) };
  });
}

async function memberNames(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from("members").select("id, name").in("id", ids);
  return new Map((data ?? []).map((m) => [m.id, m.name]));
}

// 내 문서(최근 고친 순)
export async function getMyDocs(memberId: string): Promise<DocRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("approval_documents").select(DOC_COLS).eq("member_id", memberId).order("updated_at", { ascending: false }).limit(200);
  return toRows(supabase, (data ?? []) as unknown as RawDoc[]);
}

// 내 차례(검토자: 내 검토 단계가 대기 / 관리자: 최종 단계 대기 — 내가 쓴 문서 빼고)
export async function getTurnDocs(memberId: string, admin: boolean): Promise<DocRow[]> {
  const supabase = await createClient();
  let q = supabase.from("approval_document_steps").select("document_id").eq("status", "pending");
  q = admin ? q.eq("step_kind", "final") : q.eq("approver_member_id", memberId);
  const { data: steps } = await q.limit(500);
  const ids = [...new Set((steps ?? []).map((s) => s.document_id))];
  if (!ids.length) return [];
  const { data } = await supabase.from("approval_documents").select(DOC_COLS).in("id", ids).eq("status", "submitted").neq("member_id", memberId).order("submitted_at", { ascending: true });
  return toRows(supabase, (data ?? []) as unknown as RawDoc[]);
}
export async function getTurnCount(memberId: string, admin: boolean): Promise<number> {
  return (await getTurnDocs(memberId, admin)).length;
}

// 관리자 메뉴 [결재 문서]: 양식이나 문서가 있을 때만(null = 숨김), 숫자 = 최종 승인 차례(내가 쓴 문서 빼고)
export async function adminDocsBadge(memberId: string): Promise<number | null> {
  const supabase = await createClient();
  const [{ count: forms }, { count: docs }] = await Promise.all([
    supabase.from("company_forms").select("id", { count: "exact", head: true }).eq("kind", "general").in("status", ["active", "old"]),
    supabase.from("approval_documents").select("id", { count: "exact", head: true }).neq("status", "draft"),
  ]);
  if (!(forms ?? 0) && !(docs ?? 0)) return null;
  const { data: steps } = await supabase.from("approval_document_steps").select("document_id").eq("status", "pending").eq("step_kind", "final").limit(500);
  const ids = [...new Set((steps ?? []).map((s) => s.document_id))];
  if (!ids.length) return 0;
  const { count } = await supabase.from("approval_documents").select("id", { count: "exact", head: true }).in("id", ids).eq("status", "submitted").neq("member_id", memberId);
  return count ?? 0;
}

// 내가 처리한 것(최근 100)
export async function getDoneDocs(memberId: string): Promise<DocRow[]> {
  const supabase = await createClient();
  const { data: steps } = await supabase.from("approval_document_steps").select("document_id, acted_at").eq("acted_by_member_id", memberId).in("status", ["approved", "rejected"]).order("acted_at", { ascending: false }).limit(100);
  const ids = [...new Set((steps ?? []).map((s) => s.document_id))];
  if (!ids.length) return [];
  const { data } = await supabase.from("approval_documents").select(DOC_COLS).in("id", ids);
  const order = new Map(ids.map((id, i) => [id, i]));
  return (await toRows(supabase, (data ?? []) as unknown as RawDoc[])).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// 관리자 목록: 종류·달·상태·사람·검색(작성 중은 RLS로 안 보임)
export type AdminDocFilter = { docType?: string; month?: string; status?: string; member?: string; q?: string };
export async function getAdminDocs(f: AdminDocFilter): Promise<DocRow[]> {
  const supabase = await createClient();
  let q = supabase.from("approval_documents").select(DOC_COLS).neq("status", "draft");
  if (f.docType) q = q.eq("doc_type", f.docType);
  if (f.status && ["submitted", "approved", "rejected"].includes(f.status)) q = q.eq("status", f.status);
  if (f.member && /^[0-9a-f-]{36}$/.test(f.member)) q = q.eq("member_id", f.member);
  if (f.month && /^\d{4}-\d{2}$/.test(f.month)) {
    const [y, m] = f.month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1) - 9 * 3600_000).toISOString();
    const end = new Date(Date.UTC(y, m, 1) - 9 * 3600_000).toISOString();
    q = q.gte("submitted_at", start).lt("submitted_at", end);
  }
  if (f.q?.trim()) q = q.ilike("title", `%${f.q.trim().replace(/[%_\\]/g, "")}%`);
  const { data } = await q.order("submitted_at", { ascending: false }).limit(300);
  return toRows(supabase, (data ?? []) as unknown as RawDoc[]);
}

// 상세: 문서 + 단계(모든 회차) + 첨부 + 양식 + 할 수 있는 일
export type DocDetail = {
  doc: DocRow & { payload: Payload };
  form: { id: string; name: string; fields: Field[]; active: boolean; group_id: string };
  steps: DocStep[];
  files: DocFile[];
  members: { id: string; name: string }[];
  can: { edit: boolean; delete: boolean; submit: boolean; recall: boolean; decide: "review" | "final" | null };
};
export async function getDocDetail(docId: string, me: { member_id: string; role: string }): Promise<DocDetail | null> {
  if (!/^[0-9a-f-]{36}$/.test(docId)) return null;
  const supabase = await createClient();
  const { data: d } = await supabase.from("approval_documents").select(DOC_COLS).eq("id", docId).maybeSingle();
  if (!d) return null;
  const raw = d as unknown as RawDoc;
  const [{ data: steps }, { data: files }, { data: form }, { data: members }] = await Promise.all([
    supabase.from("approval_document_steps").select("id, round, step_order, step_kind, approver_member_id, acted_by_name, status, comment, acted_at").eq("document_id", docId).order("round").order("step_order"),
    supabase.from("approval_document_files").select("id, name, mime, size, path").eq("document_id", docId).order("created_at"),
    supabase.from("company_forms").select("id, name, fields, status, group_id").eq("id", raw.form_id).maybeSingle(),
    supabase.from("members").select("id, name").eq("status", "approved").order("name"),
  ]);
  const names = new Map((members ?? []).map((m) => [m.id, m.name]));
  const st: DocStep[] = (steps ?? []).map((s) => ({ ...s, step_kind: s.step_kind as DocStep["step_kind"], status: s.status as DocStep["status"], approver_name: s.approver_member_id ? (names.get(s.approver_member_id) ?? null) : null }));
  const [row] = await toRows(supabase, [raw]);
  const mine = raw.member_id === me.member_id;
  const status = raw.status as DocStatus;
  const cur = st.filter((s) => s.round === raw.current_round);
  const pending = cur.find((s) => s.status === "pending");
  const admin = me.role === "super_admin" || me.role === "admin";
  const decide = status !== "submitted" || !pending ? null : pending.step_kind === "review" ? (pending.approver_member_id === me.member_id ? "review" : null) : admin && !mine ? "final" : null;
  return {
    doc: { ...row, payload: (raw.payload ?? {}) as Payload },
    form: { id: form?.id ?? raw.form_id, name: form?.name ?? row.form_name, fields: (form?.fields ?? []) as unknown as Field[], active: form?.status === "active", group_id: form?.group_id ?? "" },
    steps: st,
    files: (files ?? []) as DocFile[],
    members: (members ?? []) as { id: string; name: string }[],
    can: {
      edit: mine && (status === "draft" || status === "rejected"),
      delete: mine && status === "draft",
      submit: mine && (status === "draft" || status === "rejected"),
      recall: mine && status === "submitted" && !cur.some((s) => s.status === "approved" || s.status === "rejected"),
      decide,
    },
  };
}

// 올리기 확인 창의 결재선(지출결의서와 같은 결재라인: 내 부서 → 회사 기본). 대표는 본인 승인
export async function getLinePreview(me: { member_id: string; role: string }): Promise<{ self: boolean; reviewers: string[] }> {
  if (me.role === "super_admin") return { self: true, reviewers: [] };
  const supabase = await createClient();
  const { data: m } = await supabase.from("members").select("department_id").eq("id", me.member_id).maybeSingle();
  const { data: lines } = await supabase.from("approval_lines").select("id, department_id");
  const line = (lines ?? []).find((l) => m?.department_id && l.department_id === m.department_id) ?? (lines ?? []).find((l) => l.department_id === null);
  if (!line) return { self: false, reviewers: [] };
  const { data: steps } = await supabase.from("approval_line_steps").select("step_order, approver_member_id").eq("approval_line_id", line.id).order("step_order");
  const names = await memberNames(supabase, (steps ?? []).map((x) => x.approver_member_id));
  const after = (steps ?? []).findIndex((x) => x.approver_member_id === me.member_id); // 결재선에 내가 있으면 내 단계까지 건너뜀
  return { self: false, reviewers: (steps ?? []).slice(after + 1).map((x) => names.get(x.approver_member_id) ?? "검토자") };
}

const kstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);

// 회사 양식 모양으로 채운 문서(보기·PDF·엑셀). 볼 수 있는지 RLS로 확인한 뒤, 양식 버전·사람 정보는 서버 키로 같은 회사 안에서만
export async function getApprovalDocModel(docId: string): Promise<{ doc: DocModel; fileName: string; title: string } | null> {
  if (!/^[0-9a-f-]{36}$/.test(docId)) return null;
  const supabase = await createClient();
  const { data: d } = await supabase.from("approval_documents").select("id, company_id, member_id, member_name, form_id, title, payload, status, current_round, self_approved, submitted_at, created_at, decided_at").eq("id", docId).maybeSingle();
  if (!d) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const cid = d.company_id;
  const { data: steps } = await admin.from("approval_document_steps").select("step_order, step_kind, status, approver_member_id, acted_by_member_id, acted_by_name, acted_at").eq("document_id", d.id).eq("company_id", cid).eq("round", Math.max(d.current_round, 1)).order("step_order");
  const people = [d.member_id, ...(steps ?? []).flatMap((s) => [s.approver_member_id, s.acted_by_member_id])].filter((x): x is string => !!x);
  const [{ data: form }, { data: company }, { data: ppl }] = await Promise.all([
    admin.from("company_forms").select("name, sheets, fields").eq("id", d.form_id).eq("company_id", cid).maybeSingle(),
    admin.from("companies").select("name").eq("id", cid).single(),
    admin.from("members").select("id, name, position, employee_number, departments(name)").eq("company_id", cid).in("id", [...new Set(people)]),
  ]);
  if (!form || !validDoc(form.sheets)) return null;
  const who = new Map((ppl ?? []).map((p) => [p.id, p as unknown as { name: string; position: string | null; employee_number: string | null; departments: { name: string } | null }]));
  const me = who.get(d.member_id);
  const fields = (form.fields ?? []) as unknown as Field[];
  const docDate = kstDate(d.submitted_at ?? d.created_at);
  // 결재란: 쓴 사람 → (이번 회차) 검토자 → 최종 승인자. 건너뛴 내 단계는 뺌
  const live = d.status === "draft" ? [] : (steps ?? []).filter((s) => s.status !== "canceled" && !(s.status === "skipped" && s.step_kind === "review"));
  const all: SignCell[] = [
    { name: me?.name ?? d.member_name, position: me?.position ?? null, date: d.submitted_at ? kstDate(d.submitted_at) : null },
    ...live.map((s): SignCell => {
      if (s.status === "approved" || (s.status === "skipped" && s.step_kind === "final")) {
        const p = s.acted_by_member_id ? who.get(s.acted_by_member_id) : undefined;
        return { name: p?.name ?? s.acted_by_name ?? "", position: p?.position ?? null, date: s.acted_at ? kstDate(s.acted_at) : null };
      }
      return s.status === "rejected" ? "rejected" : "pending";
    }),
  ];
  if (d.status === "draft") all.push("pending");
  const slots = Math.max(0, ...fields.filter((f) => f.b.k === "data" && f.b.src.startsWith("approval.")).map((f) => (f.b.k === "data" ? Number(f.b.src.slice(-1)) : 0)));
  const payload = (d.payload ?? {}) as Payload;
  const custom: Record<string, string> = {};
  for (const f of inputFields(fields)) if (f.b.k === "input") custom[f.key] = displayValue(f.b.type, payload[f.key]);
  const data: LeaveDocData = {
    company: company?.name ?? "",
    member: { name: me?.name ?? d.member_name, department: me?.departments?.name ?? null, position: me?.position ?? null, employee_number: me?.employee_number ?? null },
    docDate,
    docNumber: formDocNumber("문서", d.id, docDate),
    applicant: null,
    approver: "pending",
    custom,
    signers: fitSigners(all, slots),
  };
  const doc = fillForm(form.sheets as unknown as DocModel, fields, data);
  return { doc, fileName: `${form.name}_${me?.name ?? d.member_name}_${docDate}`, title: form.name };
}
