import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW, siteOrigin } from "@/lib/seo";

// robots.txt — 공개 화면(랜딩·약관·처리방침)은 모든 검색 로봇(구글·네이버 Yeti 포함)에 열고, 로그인 뒤 화면은 막는다 (7차 개선사항 6)
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
