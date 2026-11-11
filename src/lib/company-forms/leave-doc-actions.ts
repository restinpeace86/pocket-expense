"use server";

import { getMembership } from "@/lib/auth/session";
import type { DocModel } from "@/lib/doc-convert/model";
import { getLeaveDoc } from "./leave-doc";

// 휴가신청서 PDF는 브라우저에서 만든다(서류 → 엑셀과 같은 방식) — 채운 표만 넘긴다
export async function leaveDocAction(companyId: string, leaveId: string): Promise<{ doc: DocModel; fileName: string } | null> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || m.company_id !== companyId) return null;
  return getLeaveDoc(leaveId);
}
