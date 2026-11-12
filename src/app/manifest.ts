import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// 홈 화면에 추가(PWA) — 아이폰은 홈 화면에 추가한 앱에서만 웹 알림을 받을 수 있다 (D-116)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    start_url: "/login",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: BRAND.color.main,
    lang: "ko",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
