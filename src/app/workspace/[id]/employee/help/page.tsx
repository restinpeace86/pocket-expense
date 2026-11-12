import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { HelpCenter } from "@/components/help/help-center";
import { requireWorkspace } from "@/lib/auth/guards";
import { helpFeatures } from "@/lib/help/features";
import { guidesFor } from "@/lib/help/guides";
import { loadHelp } from "@/lib/help/store";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `도움말 · ${BRAND.name}` };

// AI 도움말 센터 — 직원(D-251 개선사항 7): 홈 맨 아래 검색창에서. 직원용 글만
export default function EmployeeHelpPage({ params, searchParams }: PageProps<"/workspace/[id]/employee/help">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-64 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: Pick<PageProps<"/workspace/[id]/employee/help">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireWorkspace(id);
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-28 pt-3 md:max-w-2xl md:px-6 md:pt-6">
      <div className="flex items-center gap-1">
        <Link href={`/workspace/${id}/employee`} aria-label="홈으로" className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="text-xl font-bold md:text-2xl">도움말</h1>
      </div>
      <HelpCenter companyId={id} guides={guidesFor(await loadHelp(), false, await helpFeatures())} mode="employee" admin={false} initialQ={typeof sp.q === "string" ? sp.q : ""} initialDoc={typeof sp.doc === "string" ? sp.doc : null} />
    </main>
  );
}
