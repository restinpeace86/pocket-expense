// 저장 공간 추가(8-103, D-262): 요금제에 더해 매월 함께 결제. 결제가 붙을 때까지는 신청 → 운영자가 켜 줌(무료)
// 상품 가격은 storage_addons 표에서 읽는다(코드에 적지 않음). 추가 공간은 채팅 사진·파일과 파일 보관함이 함께 쓴다
export type StorageAddon = { code: string; storage_gb: number; monthly_price: number };

export type StorageStatus = {
  extra_gb: number;
  pending: { id: string; kind: "add" | "change" | "cancel"; storage_gb: number; monthly_price: number; created_at: string; by: string | null } | null;
  last: { status: "done" | "rejected"; storage_gb: number; reject_reason: string | null; done_at: string | null } | null;
  chat_used: number;
  chat_limit: number;
  vault_used: number;
  vault_limit: number;
  total_used?: number; // D-271 회사 공용(채팅 + 보관함)
  total_limit?: number;
};

// 고른 추가 공간(GB, 0 = 없음)의 월 가격
export function addonPrice(addons: StorageAddon[], gb: number): number {
  return gb > 0 ? (addons.find((a) => a.storage_gb === gb)?.monthly_price ?? 0) : 0;
}

// 요금제 + 추가 공간 = 매월 결제 금액
export function monthlyTotal(planPrice: number, addons: StorageAddon[], gb: number): number {
  return planPrice + addonPrice(addons, gb);
}

// 신청 버튼 글자: 지금과 같으면 null(누를 것 없음)
export function requestLabel(current: number, picked: number): string | null {
  if (picked === current) return null;
  if (picked === 0) return "추가 공간 해지 신청";
  return current === 0 ? `${picked}GB 공간 지금 신청` : `${picked}GB로 바꾸기 신청`;
}

export function storageErrorText(message: string | undefined): string {
  if (!message) return "신청하지 못했어요. 잠시 후 다시 시도해 주세요.";
  if (message.includes("ALREADY_REQUESTED")) return "이미 확인 중인 신청이 있어요. 먼저 [신청 취소]를 눌러 주세요.";
  if (message.includes("SAME_AS_NOW")) return "지금 쓰는 공간과 같아요.";
  if (message.includes("NO_SUCH_ADDON")) return "없는 상품이에요. 화면을 새로 고쳐 주세요.";
  if (message.includes("NOT_ALLOWED")) return "관리자만 신청할 수 있어요.";
  return "신청하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export const KIND_LABEL: Record<"add" | "change" | "cancel", string> = { add: "추가", change: "바꾸기", cancel: "해지" };
