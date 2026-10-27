import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, siteOrigin } from "@/lib/seo";

// 사이트맵(/sitemap.xml) — 공개 화면만 (7차 개선사항 6). 로그인 뒤 화면은 robots.ts에서 막는다.
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const now = new Date();
  return PUBLIC_PAGES.map((p) => ({ url: `${origin}${p.path === "/" ? "" : p.path}`, lastModified: now, changeFrequency: p.changeFrequency, priority: p.priority }));
}
