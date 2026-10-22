import { ArrowRight, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

// 법인카드 내역 대조로 가는 바로가기 (D-111) — 법인카드·세무 마감 화면. 선택 기능이라 부담 없게(D-112)
export function ReconcileLink({ href }: { href: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm hover:bg-zinc-50">
      <FileSpreadsheet className="size-5 shrink-0 text-brand-700" />
      <span className="min-w-0 flex-1">
        <b className="font-semibold">법인카드 내역 대조</b> <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">선택</span>
        <span className="block text-zinc-600">필요할 때만 쓰세요. 카드사 사용 내역을 올리면 결의서가 없는 결제를 찾아 줘요.</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-zinc-400" />
    </Link>
  );
}
