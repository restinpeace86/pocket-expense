import Link from "next/link";
import { OptionalPrivacyContent, PrivacyContent } from "@/components/legal/documents";
import { Card, PageShell } from "@/components/ui/page-shell";

export const metadata = { title: "개인정보 처리방침 · PocketExpense" };

// 개인정보 처리방침 (초안, D-059). 정식 처리방침 본문은 전문가 검토 후 보완한다(O-07).
export default function PrivacyPage() {
  return (
    <PageShell>
      <div className="pt-6">
        <Link href="/" className="text-sm text-zinc-500 underline underline-offset-2">
          PocketExpense
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">개인정보 처리방침</h1>
      </div>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">필수 항목</h2>
        <PrivacyContent />
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">선택 항목</h2>
        <OptionalPrivacyContent />
      </Card>
    </PageShell>
  );
}
