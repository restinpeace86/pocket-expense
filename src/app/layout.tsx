import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WebVitals } from "@/components/perf/web-vitals";
import { KeyboardAware } from "@/components/ui/keyboard-aware";
import { THEME_KEYS, THEME_STORAGE_KEY } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PocketExpense",
  description: "소기업·스타트업을 위한 가장 가벼운 AI 경비 정산",
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
