// 영수증 저장 경로 (spec/data/schema.md §4, migration 021). 첫 폴더는 반드시 회사 id(저장소 격리 규칙).
export function receiptPaths(p: {
  companyId: string;
  memberId: string;
  claimId: string;
  itemId: string;
  pdf?: boolean;
  thumbExt?: "webp" | "jpg"; // 기본 webp, WebP를 못 만드는 브라우저면 jpg
}) {
  const dir = `${p.companyId}/${p.memberId}/${p.claimId}`;
  return {
    original: `${dir}/${p.itemId}.${p.pdf ? "pdf" : "jpg"}`,
    thumb: p.pdf ? null : `${dir}/${p.itemId}_thumb.${p.thumbExt ?? "webp"}`,
  };
}
