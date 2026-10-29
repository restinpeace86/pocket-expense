import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 송금 확인증 보관함 읽기 (D-164). 부르는 쪽이 회사·권한을 먼저 확인한다(회사 관리자 RLS / 세무사무소 tax_office_month_export)
const BUCKET = "payout-proofs";

export async function signPayoutProof(path: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

// ZIP의 지급확인증/ 폴더: 그 달 세무 자료에 든 결의서들의 확인증(같은 파일은 한 번)
export async function payoutProofZipFiles(companyId: string, claimIds: string[]): Promise<{ name: string; url: string | null }[]> {
  const admin = createAdminClient();
  if (!admin || !claimIds.length) return [];
  const { data } = await admin
    .from("expense_claims")
    .select("id, title, paid_at, payout_proof_path, payout_proof_name")
    .eq("company_id", companyId)
    .in("id", [...new Set(claimIds)])
    .not("payout_proof_path", "is", null);
  const byPath = new Map<string, { titles: string[]; paid: string; ext: string }>();
  for (const c of data ?? []) {
    const path = c.payout_proof_path as string;
    if (!path.startsWith(`${companyId}/`)) continue;
    const v = byPath.get(path) ?? { titles: [], paid: (c.paid_at ?? "").slice(0, 10), ext: path.split(".").pop() ?? "png" };
    v.titles.push(c.title || "결의서");
    byPath.set(path, v);
  }
  if (!byPath.size) return [];
  const paths = [...byPath.keys()];
  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(paths, 600);
  const urls = new Map((signed ?? []).filter((s) => s.path && s.signedUrl && !s.error).map((s) => [s.path as string, s.signedUrl]));
  const used = new Set<string>();
  return paths.map((p) => {
    const v = byPath.get(p)!;
    const label = `${v.paid}_${v.titles[0]}${v.titles.length > 1 ? `_외${v.titles.length - 1}건` : ""}`.replace(/[\/:*?"<>|]/g, "_").slice(0, 80);
    let name = `${label}.${v.ext}`;
    for (let n = 2; used.has(name); n++) name = `${label}_${n}.${v.ext}`;
    used.add(name);
    return { name, url: urls.get(p) ?? null };
  });
}
