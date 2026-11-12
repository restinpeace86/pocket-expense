import { Suspense } from "react";
import { HelpAdmin } from "@/components/app-admin/help-admin";
import { requireAppAdmin } from "@/lib/app-admin/guard";
import type { AdminArticle } from "./actions";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `도움말 글 · ${BRAND.name} 운영자` };

// 운영자 › 도움말 글(D-255 §A-5): 목록(카테고리·대상·공개) + 글 고치기(단계 글·그림·이동·시뮬레이션)
export default function HelpAdminPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { admin } = await requireAppAdmin();
  const { data } = await admin
    .from("help_articles")
    .select("id, category, audience, needs, title, summary, keywords, path, admin_path, path_label, sim, published, sort, help_steps(idx, body, image_path)")
    .order("sort");
  const articles: AdminArticle[] = (data ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    audience: r.audience === "admin" ? "admin" : "all",
    needs: r.needs,
    title: r.title,
    summary: r.summary,
    keywords: r.keywords ?? [],
    path: r.path,
    admin_path: r.admin_path,
    path_label: r.path_label,
    sim: r.sim,
    published: r.published,
    steps: [...(r.help_steps ?? [])].sort((a, b) => a.idx - b.idx).map((s) => ({ body: s.body, image_path: s.image_path })),
  }));
  return <HelpAdmin articles={articles} imageBase={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/help-images/`} />;
}
