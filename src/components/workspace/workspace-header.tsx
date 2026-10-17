import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { isAdminRole, type Membership } from "@/lib/auth/paths";

// 워크스페이스 공통 헤더: 회사명, 모드 전환(관리자 이상만, D-049), 로그아웃
export function WorkspaceHeader({ membership, mode }: { membership: Membership; mode: "admin" | "employee" }) {
  const base = `/workspace/${membership.company_id}`;
  return (
    <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-xs text-zinc-500">{mode === "admin" ? "관리자 모드" : "직원 모드"}</p>
        <p className="truncate font-semibold">{membership.company_name}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {isAdminRole(membership.role) && (
          <Link
            href={mode === "admin" ? `${base}/employee` : `${base}/admin`}
            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50"
          >
            <ArrowLeftRight className="size-4" />
            <span className="sm:hidden">{mode === "admin" ? "직원 모드" : "관리자 모드"}</span>
            <span className="hidden sm:inline">{mode === "admin" ? "직원 모드로 전환" : "관리자 모드로 전환"}</span>
          </Link>
        )}
        <SignOutButton />
      </div>
    </header>
  );
}
