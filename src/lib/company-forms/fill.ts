import type { DocModel } from "@/lib/doc-convert/model";
import type { DataKey, Field } from "./model";

// 휴가신청서를 회사 양식으로 채우기(8-104 C, spec/features/company-forms.md §C)
// 칸 바인딩대로: 우리 데이터 → 아래 값, 직원 입력 → 신청 때 낸 값(custom_payload), 고정 값 → 그 글, 비워 두기 → 빈칸(수기)
// 결재란(D-249: 이름·직급·날짜): 1번째 = 신청한 사람, 2번째 = 승인한 사람(승인 전이면 "결재 전", 반려면 "반려"), 3~5번째 = 빈칸
export type Signer = { name: string; position: string | null; date: string | null } | null;
export type LeaveDocData = {
  company: string;
  member: { name: string; department: string | null; position: string | null; employee_number: string | null };
  docDate: string; // YYYY-MM-DD(신청일)
  docNumber: string;
  leave: { type: string; start: string; end: string; unit: "day" | "hour"; startTime: string | null; hours: number | null; workdays: number; reason: string | null; remaining: number | null; proof: boolean };
  applicant: Signer;
  approver: Signer | "pending" | "rejected";
  custom: Record<string, string>;
};

const dot = (d: string) => d.replaceAll("-", ".");
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));
const signer = (s: Signer) => (s ? [s.name, s.position, s.date ? dot(s.date).slice(5) : null].filter(Boolean).join("\n") : "");

export function dataValue(key: DataKey, d: LeaveDocData): string {
  const l = d.leave;
  switch (key) {
    case "company.name":
      return d.company;
    case "member.name":
      return d.member.name;
    case "member.department":
      return d.member.department ?? "";
    case "member.position":
      return d.member.position ?? "";
    case "member.employee_number":
      return d.member.employee_number ?? "";
    case "doc.date":
      return dot(d.docDate);
    case "doc.number":
      return d.docNumber;
    case "approval.1":
      return signer(d.applicant);
    case "approval.2":
      return d.approver === "pending" ? "결재 전" : d.approver === "rejected" ? "반려" : signer(d.approver);
    case "approval.3":
    case "approval.4":
    case "approval.5":
      return "";
    case "leave.type":
      return l.type;
    case "leave.period":
      if (l.unit === "hour") return `${dot(l.start)} ${l.startTime?.slice(0, 5) ?? ""}부터 ${l.hours ?? ""}시간`.replace(/\s+/g, " ").trim();
      return l.start === l.end ? dot(l.start) : `${dot(l.start)} ~ ${dot(l.end)}`;
    case "leave.start":
      return dot(l.start);
    case "leave.end":
      return dot(l.end);
    case "leave.days":
      return l.unit === "hour" ? `${l.hours ?? 0}시간` : `${l.workdays}일`;
    case "leave.half":
      if (l.unit !== "hour" || !l.startTime) return "";
      return Number(l.startTime.slice(0, 2)) < 12 ? "오전" : "오후";
    case "leave.reason":
      return l.reason ?? "";
    case "leave.remaining":
      return l.remaining === null ? "" : `${num(l.remaining)}일`;
    case "leave.proof":
      return l.proof ? "있음" : "없음";
  }
}

export function fillForm(doc: DocModel, fields: Field[], d: LeaveDocData): DocModel {
  const out: DocModel = structuredClone(doc);
  for (const f of fields) {
    const cell = out.sheets[f.s]?.cells[f.r]?.[f.c];
    if (!cell) continue;
    const b = f.b;
    if (b.k === "data") cell.t = dataValue(b.src, d);
    else if (b.k === "input") cell.t = d.custom[f.key] ?? "";
    else if (b.k === "fixed") cell.t = b.value;
    else if (b.k === "blank") cell.t = "";
  }
  return out;
}

// 문서 번호: 신청일 + 신청 id 앞 6자리(회사 안에서 겹치지 않음)
export function leaveDocNumber(id: string, date: string): string {
  return `휴가-${date.replaceAll("-", "")}-${id.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}
