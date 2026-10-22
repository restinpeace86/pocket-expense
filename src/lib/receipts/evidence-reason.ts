// 증빙 구분 AI 판별 이유 한 줄 (todo_improvement(2차) 7, D-100)
// 직원은 증빙 구분을 잘 모르므로 AI가 정하고(없으면 카드매출전표), 왜 그렇게 봤는지 연한 글씨로 보여 준다. 직원이 바꾼 값이면 이유를 보이지 않는다.
import type { EvidenceType } from "@/lib/employee/editor-types";

export type EvidenceAi = {
  suggested: EvidenceType | null; // AI가 고른 증빙 구분(못 가렸으면 null)
  hasApproval: boolean; // 승인번호를 읽음
  hasCardNumber: boolean; // 카드번호(가린 번호)를 읽음
};

export function evidenceReason(current: EvidenceType | null, ai: EvidenceAi | null): string | null {
  if (!current || !ai) return null;
  if (ai.suggested && ai.suggested !== current) return null; // 직원이 바꿈
  if (!ai.suggested) return current === "card_slip" ? "증빙 종류가 보이지 않아 가장 흔한 카드매출전표로 두었어요" : null;
  switch (current) {
    case "card_slip":
      return ai.hasApproval ? "카드 승인번호를 확인했어요" : ai.hasCardNumber ? "카드번호를 확인했어요" : "카드 결제 영수증으로 확인했어요";
    case "cash_receipt":
      return "현금영수증 번호가 확인되었어요";
    case "tax_invoice":
      return "세금계산서 항목으로 확인했어요";
    case "simple_receipt":
      return "별도 승인번호가 없어 간이 영수증으로 분류했어요";
    default:
      return null;
  }
}
