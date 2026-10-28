// 홈택스 자료 종류·파일 이름 (D-158) — 화면·서버 공용
export const HOMETAX_KINDS = ["tax_invoice", "cash_receipt", "business_card", "other"] as const;
export type HometaxKind = (typeof HOMETAX_KINDS)[number];

export const HOMETAX_KIND_LABEL: Record<HometaxKind, string> = {
  tax_invoice: "전자세금계산서(매입)",
  cash_receipt: "현금영수증(매입)",
  business_card: "사업용 신용카드(매입)",
  other: "기타 홈택스 자료",
};

export const HOMETAX_BUCKET = "hometax-files";
export const HOMETAX_MAX_BYTES = 10 * 1024 * 1024;
export const HOMETAX_EXT = /\.(xlsx|xls|csv)$/i;

export type HometaxUpload = {
  id: string;
  month: string;
  kind: HometaxKind;
  file_name: string;
  file_size: number;
  header: string[];
  preview: string[][];
  row_count: number;
  memo: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

// ZIP 안 이름: 홈택스자료/전자세금계산서(매입)_원래이름 — 같은 이름이면 뒤에 번호
export function hometaxZipNames(list: { id: string; kind: HometaxKind; file_name: string }[]): Map<string, string> {
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const u of list) {
    const label = HOMETAX_KIND_LABEL[u.kind].replace(/[()]/g, "");
    const clean = u.file_name.replace(/[\\/:*?"<>|]/g, "_");
    let name = `${label}_${clean}`;
    for (let n = 2; used.has(name); n++) name = clean.replace(/(\.[^.]+)?$/, (ext) => `_${n}${ext}`).replace(/^/, `${label}_`);
    used.add(name);
    out.set(u.id, name);
  }
  return out;
}
