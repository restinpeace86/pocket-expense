// 증빙 자료 종류 (D-108) — 영수증만이 증빙은 아니다. 모든 경비에는 자료(사진·PDF)가 있어야 하고, 정말 없을 때만 '증빙 없음' + 사유.
export type EvidenceKind = "receipt" | "invoice" | "app_history" | "card_history" | "invitation" | "other" | "none";

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  receipt: "영수증",
  invoice: "인보이스·결제 메일",
  app_history: "앱 이용 내역",
  card_history: "카드 결제 내역",
  invitation: "청첩장·부고 안내",
  other: "기타 자료",
  none: "증빙 없음",
};

// 자료를 올릴 때 고르는 종류(증빙 없음 제외)
export const FILE_EVIDENCE_KINDS: EvidenceKind[] = ["receipt", "invoice", "app_history", "card_history", "invitation", "other"];

// 저장된 값이 비어 있는 예전 항목: 사진이 있으면 영수증
export function effectiveEvidenceKind(i: { evidence_kind: EvidenceKind | null; receipt_path: string | null }): EvidenceKind | null {
  return i.evidence_kind ?? (i.receipt_path ? "receipt" : null);
}

export const NO_EVIDENCE_MIN = 5;
