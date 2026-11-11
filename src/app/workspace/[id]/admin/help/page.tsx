import { Suspense } from "react";
import { HelpCenter } from "@/components/help/help-center";
import { requireWorkspace } from "@/lib/auth/guards";
import { helpFeatures } from "@/lib/help/features";
import { guidesFor } from "@/lib/help/guides";
import { loadHelp } from "@/lib/help/store";

export const metadata = { title: "도움말 · Moa-on" };

// AI 도움말 센터 — 관리자(D-251 개선사항 7): 머리글 [?]에서. 관리자용 글까지 보인다
export default function AdminHelpPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/help">) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">도움말</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/help">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireWorkspace(id, { admin: true });
  return <HelpCenter companyId={id} guides={guidesFor(await loadHelp(), true, await helpFeatures())} mode="admin" admin initialQ={typeof sp.q === "string" ? sp.q : ""} initialDoc={typeof sp.doc === "string" ? sp.doc : null} />;
}
