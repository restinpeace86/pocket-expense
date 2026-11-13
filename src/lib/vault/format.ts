// 파일 영구 보관(D-245, spec/features/file-vault.md) — 화면에서 쓰는 순수 계산
export type VaultScope = "private" | "company";
export type VaultFile = {
  id: string;
  owner_member_id: string;
  scope: VaultScope;
  name: string;
  kind: "image" | "file";
  mime: string | null;
  size: number;
  thumb_size: number;
  path: string;
  thumb_path: string | null;
  source_room_id: string | null;
  source_message_id: string | null;
  created_at: string;
  deleted_at?: string | null; // 휴지통(D-266)
};
export type VaultStatus = { used: number; limit: number; company_count: number; mine_private: number; trash_days?: number; trash_count?: number; trash_bytes?: number };

export const VAULT_BUCKET = "vault-files";
export const VAULT_CACHE = "vault-files-v1"; // 기기 저장(Cache Storage) 이름 — 로그아웃 때 지움

export const VAULT_ERROR: Record<string, string> = {
  VAULT_FULL: "회사 보관 공간이 다 찼어요. [파일 보관함]에서 필요 없는 파일을 지워 공간을 비워 주세요.",
  IN_TRASH: "휴지통에 있는 파일이에요. [파일 보관함 › 휴지통]에서 복구해 주세요.",
  ALREADY_KEPT: "이미 보관한 파일이에요. [파일 보관함]에서 볼 수 있어요.",
  EXPIRED: "보관 기간이 지났거나 지워진 파일이라 보관할 수 없어요.",
  NOT_FILE: "사진·파일만 보관할 수 있어요.",
  NOT_FOUND: "파일을 찾지 못했어요.",
  NOT_ALLOWED: "보관한 사람(회사 공유는 관리자도)만 지울 수 있어요.",
  FEATURE_DISABLED: "회사에서 채팅을 쓰지 않아 보관할 수 없어요.",
};
export function vaultErrorMessage(message: string): string {
  for (const [code, text] of Object.entries(VAULT_ERROR)) if (message.includes(code)) return text;
  return "처리하지 못했어요. 잠시 뒤 다시 해 주세요.";
}

// 사용률(0~100, 정수)과 막대 색 단계: 70% 노랑·90% 빨강(채팅 저장 공간과 같은 기준)
export function usagePct(used: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}
export function usageTone(pct: number): "ok" | "warn" | "full" {
  return pct >= 90 ? "full" : pct >= 70 ? "warn" : "ok";
}

// 휴지통에서 영구 삭제까지 남은 날(KST 날짜 차이, 0 이상)
export function trashDaysLeft(deletedAt: string, days: number, now = Date.now()): number {
  const kst = (t: number) => Math.floor((t + 9 * 3600_000) / 86_400_000);
  return Math.max(0, days - (kst(now) - kst(new Date(deletedAt).getTime())));
}

// 목록 아이콘 글자: 확장자 우선(PDF·XLSX·HWP 등), 없으면 "파일"
export function fileBadge(name: string, kind: "image" | "file"): string {
  if (kind === "image") return "사진";
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1];
  return ext ? ext.toUpperCase() : "파일";
}

// 보관 파일 경로: {회사}/{새 id}.{원본 확장자} (+ 사진 미리보기 _thumb.jpg)
export function vaultPaths(companyId: string, newId: string, sourcePath: string, hasThumb: boolean): { path: string; thumb: string | null } {
  const ext = /\.([a-z0-9]{1,8})$/i.exec(sourcePath)?.[1]?.toLowerCase() ?? "bin";
  return { path: `${companyId}/${newId}.${ext}`, thumb: hasThumb ? `${companyId}/${newId}_thumb.jpg` : null };
}

// 탭·검색(파일 이름·보관한 사람 이름)
export function filterVault<T extends Pick<VaultFile, "scope" | "name" | "owner_member_id">>(files: T[], tab: VaultScope, query: string, ownerName: (id: string) => string): T[] {
  const q = query.trim().toLowerCase();
  return files.filter((f) => f.scope === tab && (!q || f.name.toLowerCase().includes(q) || ownerName(f.owner_member_id).toLowerCase().includes(q)));
}
