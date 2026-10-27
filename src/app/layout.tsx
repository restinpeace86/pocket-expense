import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WebVitals } from "@/components/perf/web-vitals";
import { KeyboardAware } from "@/components/ui/keyboard-aware";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, siteOrigin, verificationTags } from "@/lib/seo";
import { THEME_KEYS, THEME_STORAGE_KEY } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 검색·공유 메타데이터(7차 개선사항 6, D-129). 화면별 제목은 각 page의 metadata.title("… · PocketExpense")이 덮어쓴다.
// 공유 이미지는 app/opengraph-image.tsx, 사이트맵·robots는 app/sitemap.ts·robots.ts
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  // 구글 서치 콘솔·네이버 서치어드바이저 소유 확인(환경변수 GOOGLE_SITE_VERIFICATION·NAVER_SITE_VERIFICATION, 비우면 태그 없음)
  verification: verificationTags(),
  // 홈 화면에 추가했을 때 아이콘·이름(아이폰 웹 알림은 홈 화면 앱에서만, D-116)
  icons: { apple: "/icons/180" },
  appleWebApp: { capable: true, title: "PocketExpense", statusBarStyle: "default" },
};

// 화면 색상(D-066): 이 브라우저에 저장된 값을 첫 화면을 그리기 전에 적용해 색이 바뀌며 깜빡이지 않게 한다.
// 값이 없으면 기본(A · 딥 네이비). 계정에 저장된 값과 다르면 워크스페이스 헤더가 계정 값으로 맞춘다.
const THEME_BOOT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(THEME_KEYS)}.indexOf(t)>=0)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <WebVitals />
        {children}
        <KeyboardAware />
      </body>
    </html>
  );
}
