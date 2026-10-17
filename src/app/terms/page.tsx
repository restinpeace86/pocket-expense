import Link from "next/link";
import { TermsContent } from "@/components/legal/documents";
import { Card, PageShell } from "@/components/ui/page-shell";

export const metadata = { title: "이용약관 · PocketExpense" };

export default function TermsPage() {
  return (
    <PageShell>
      <div className="pt-6">
        <Link href="/" className="text-sm text-zinc-500 underline underline-offset-2">
          PocketExpense
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">서비스 이용약관</h1>
      </div>
      <Card>
        <TermsContent />
      </Card>
    </PageShell>
  );
}
