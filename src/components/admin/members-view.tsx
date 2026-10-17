"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { approveMemberAction, rejectMemberAction } from "@/app/workspace/[id]/admin/actions";

export type MemberRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  position: string | null;
  role: "super_admin" | "admin" | "employee";
  status: "pending" | "approved" | "inactive";
  department: string | null;
  created_at: string;
};

const ROLE_LABEL = { super_admin: "관리자 (최고 관리자)", admin: "관리자", employee: "일반 멤버" } as const;
const formatPhone = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

type Tab = "all" | "pending" | "inactive";

// 멤버 관리 (spec/screens/admin-team-members.md). 이번 범위: 가입 승인·거절 + 목록 조회
export function MembersView({ members, tab, basePath, preview = false }: { members: MemberRow[]; tab: Tab; basePath: string; preview?: boolean }) {
  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status === "approved");
  const inactive = members.filter((m) => m.status === "inactive");
  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: `전체 (${active.length})` },
    { key: "pending", label: `가입 승인 대기 (${pending.length})` },
    { key: "inactive", label: `비활성 (${inactive.length})` },
  ];
  const list = tab === "pending" ? pending : tab === "inactive" ? inactive : active;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1" role="tablist">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${basePath}?tab=${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm ${tab === t.key ? "bg-white font-semibold shadow-sm" : "text-zinc-600"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          {tab === "pending" ? "가입 승인을 기다리는 직원이 없어요." : tab === "inactive" ? "비활성 멤버가 없어요." : "멤버가 없어요."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((m) => (
            <MemberItem key={m.id} member={m} preview={preview} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberItem({ member: m, preview }: { member: MemberRow; preview: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(kind: "approve" | "reject") {
    if (preview) return;
    if (kind === "reject" && !confirm(`${m.name}님의 가입 신청을 거절할까요? 거절하면 다시 가입 신청해야 합니다.`)) return;
    setError(null);
    startTransition(async () => {
      const r = kind === "approve" ? await approveMemberAction(m.id) : await rejectMemberAction(m.id);
      if (r.error) setError(r.error);
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 md:flex-row md:flex-wrap md:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {m.name}
          {m.position && <span className="ml-1 text-sm font-normal text-zinc-500">({m.position})</span>}
        </p>
        <p className="mt-0.5 break-all text-sm text-zinc-600">
          {m.department ?? "부서 없음"} · {formatPhone(m.phone)}
          {m.email && <span className="text-zinc-400"> · {m.email}</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {m.status === "pending" ? (
          <>
            <span className="mr-auto text-xs text-zinc-500 md:mr-2">{formatDate(m.created_at)} 신청</span>
            <button type="button" onClick={() => run("reject")} disabled={pending} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50">
              거절
            </button>
            <button type="button" onClick={() => run("approve")} disabled={pending} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "처리 중..." : "승인"}
            </button>
          </>
        ) : (
          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${m.role === "employee" ? "bg-zinc-100 text-zinc-600" : "bg-blue-50 text-blue-700"}`}>
            {ROLE_LABEL[m.role]}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 md:basis-full">
          {error}
        </p>
      )}
    </li>
  );
}
