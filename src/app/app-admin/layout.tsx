import type { Metadata } from "next";
import { Suspense } from "react";
import { AppAdminShell } from "@/components/app-admin/app-admin-shell";
import { requireAppAdmin } from "@/lib/app-admin/guard";

// 앱관리자(운영자) 화면 (D-080). 운영자 계정이 아니면 404. 검색 노출 금지.
export const metadata: Metadata = { title: "PocketExpense", robots: { index: false, follow: false } };

export default function AppAdminLayout({ children }: LayoutProps<"/app-admin">) {
  return (
    <Suspense fallback={<div className="m-6 h-64 flex-1 animate-pulse rounded-xl bg-zinc-100" />}>
      <Guarded>{children}</Guarded>
    </Suspense>
  );
}

async function Guarded({ children }: { children: React.ReactNode }) {
  await requireAppAdmin();
  return <AppAdminShell>{children}</AppAdminShell>;
}
