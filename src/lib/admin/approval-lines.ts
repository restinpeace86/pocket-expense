import "server-only";
import { createClient } from "@/lib/supabase/server";

// 사전 검토 결재라인 설정 화면 데이터 (admin-dashboard.md ⑥, approval-workflow.md §2). 자기 회사만(RLS)
export type LineMember = { id: string; name: string; position: string | null; department_id: string | null; role: string };
export type ApprovalLineView = {
  department_id: string | null; // null = 회사 기본 결재라인
  name: string;
  reviewers: { id: string; name: string; position: string | null }[];
  appliesTo: number; // 적용되는 활성 멤버 수
};

export async function getApprovalLines(companyId: string) {
  const supabase = await createClient();
  const [{ data: lines }, { data: steps }, { data: depts }, { data: members }] = await Promise.all([
    supabase.from("approval_lines").select("id, name, department_id").eq("company_id", companyId),
    supabase.from("approval_line_steps").select("approval_line_id, step_order, approver_member_id").eq("company_id", companyId).order("step_order"),
    supabase.from("departments").select("id, name, sort_order").eq("company_id", companyId).order("sort_order"),
    supabase.from("members").select("id, name, position, department_id, role, status").eq("company_id", companyId).eq("status", "approved").order("name"),
  ]);
  const people = (members ?? []) as (LineMember & { status: string })[];
  const byId = new Map(people.map((m) => [m.id, m]));
  const deptLine = new Set((lines ?? []).filter((l) => l.department_id).map((l) => l.department_id as string));
  const view = (lines ?? []).map((l): ApprovalLineView => {
    const reviewers = (steps ?? [])
      .filter((s) => s.approval_line_id === l.id)
      .map((s) => byId.get(s.approver_member_id))
      .filter((m): m is LineMember & { status: string } => !!m)
      .map((m) => ({ id: m.id, name: m.name, position: m.position }));
    const deptName = l.department_id ? (depts ?? []).find((d) => d.id === l.department_id)?.name : null;
    return {
      department_id: l.department_id,
      name: l.department_id ? `${deptName ?? "부서"} 결재라인` : "기본 결재라인",
      reviewers,
      appliesTo: l.department_id ? people.filter((m) => m.department_id === l.department_id).length : people.filter((m) => !m.department_id || !deptLine.has(m.department_id)).length,
    };
  });
  if (!view.some((v) => v.department_id === null)) view.unshift({ department_id: null, name: "기본 결재라인", reviewers: [], appliesTo: people.filter((m) => !m.department_id || !deptLine.has(m.department_id)).length });
  view.sort((a, b) => (a.department_id === null ? -1 : b.department_id === null ? 1 : a.name.localeCompare(b.name, "ko")));
  return {
    lines: view,
    departments: (depts ?? []).map((d) => ({ id: d.id, name: d.name, hasLine: deptLine.has(d.id) })),
    members: people.map(({ id, name, position, department_id, role }) => ({ id, name, position, department_id, role })),
  };
}

// 직원 상신 확인 창의 결재선 미리보기: "박팀장 검토 → 관리자 승인" (본인 단계까지는 건너뜀, D-026)
export async function getApprovalPreview(companyId: string, member: { member_id: string; role: string }): Promise<string> {
  if (member.role === "super_admin") return "최고 관리자 본인 소명서라 결재 없이 바로 승인됩니다.";
  const supabase = await createClient();
  const { data: me } = await supabase.from("members").select("department_id").eq("id", member.member_id).maybeSingle();
  let { data: line } = me?.department_id
    ? await supabase.from("approval_lines").select("id").eq("company_id", companyId).eq("department_id", me.department_id).maybeSingle()
    : { data: null };
  if (!line) ({ data: line } = await supabase.from("approval_lines").select("id").eq("company_id", companyId).is("department_id", null).maybeSingle());
  let reviewers: { id: string; name: string }[] = [];
  if (line) {
    const { data: steps } = await supabase.from("approval_line_steps").select("approver_member_id, step_order").eq("approval_line_id", line.id).order("step_order");
    const ids = (steps ?? []).map((s) => s.approver_member_id);
    if (ids.length) {
      const { data: ms } = await supabase.from("members").select("id, name").in("id", ids);
      reviewers = ids.map((id) => ms?.find((m) => m.id === id)).filter((m): m is { id: string; name: string } => !!m);
    }
  }
  const mine = reviewers.findIndex((r) => r.id === member.member_id);
  const rest = mine >= 0 ? reviewers.slice(mine + 1) : reviewers;
  return [...rest.map((r) => `${r.name} 검토`), "관리자 승인"].join(" → ");
}
