import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { HelpCategory, HelpFeature, HelpGuide } from "./guides";

// 도움말 글 읽기(D-255): RLS가 공개 글만·관리자 글은 관리자에게만 준다. 화면 그림은 공개 버킷 help-images 주소로
export const HELP_IMAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/help-images/`;

type Row = {
  id: string;
  category: string;
  audience: string;
  needs: string | null;
  title: string;
  summary: string;
  keywords: string[];
  path: string | null;
  admin_path: string | null;
  path_label: string | null;
  sim: string | null;
  help_steps: { idx: number; body: string; image_path: string | null; image_alt: string | null }[];
};

export const loadHelp = cache(async (): Promise<HelpGuide[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("help_articles")
    .select("id, category, audience, needs, title, summary, keywords, path, admin_path, path_label, sim, help_steps(idx, body, image_path, image_alt)")
    .order("sort");
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    cat: r.category as HelpCategory,
    audience: r.audience === "admin" ? "admin" : "all",
    needs: (r.needs as HelpFeature | null) ?? null,
    title: r.title,
    summary: r.summary,
    keywords: r.keywords ?? [],
    path: r.path,
    adminPath: r.admin_path,
    pathLabel: r.path_label,
    sim: r.sim,
    steps: [...(r.help_steps ?? [])].sort((a, b) => a.idx - b.idx).map((s) => ({ body: s.body, image: s.image_path ? `${HELP_IMAGE_BASE}${s.image_path}` : null, alt: s.image_alt })),
  }));
});
