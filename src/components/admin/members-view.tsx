"use client";

import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { approveMemberAction, rejectMemberAction } from "@/app/workspace/[id]/admin/actions";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";
import { formatPhone } from "@/lib/format";

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
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

type Tab = "all" | "pending" | "inactive";

export function MembersHeading() {
  return (
    <SectionHeading
      as="h1"
      title="멤버 관리"
      summary="직원 가입을 승인하고, 정보·권한·퇴사를 관리해요."
      helpId="admin.members"
      helpLabel="권한과 상태 알아보기"
      help={
        <>
          <p>
            <b>권한</b> 관리자는 직원 지출소명서 승인·반려, 회사 설정, 멤버 관리를 할 수 있어요. 일반 멤버는 자기 경비만 올리고 확인해요. 회사를 등록한
            사람은 &lsquo;최고 관리자&rsquo;로, 관리자 지정·해제와 최고 관리자 넘기기는 최고 관리자만 할 수 있어요.
          </p>
          <p>
            <b>거절과 비활성화</b> 거절은 가입 신청을 지우는 것이라 그 사람이 다시 신청할 수 있어요. 비활성화(퇴사 처리)는 지난 경비 기록은 남기고 로그인만
            막아요. 실수로 비활성화했다면 [편집]에서 다시 활성화할 수 있어요.
          </p>
        </>
      }
    />
  );
}

// 멤버 관리 (spec/screens/admin-team-members.md): 탭, 이름/부서 검색·부서 필터, 가입 승인·거절, [편집]으로 상세 이동
export function MembersView({ members, tab, basePath, preview = false }: { members: MemberRow[]; tab: Tab; basePath: string; preview?: boolean }) {
  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status === "approved");
  const inactive = members.filter((m) => m.status === "inactive");
  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: `전체 (${active.length})` },
    { key: "pending", label: `가입 승인 대기 (${pending.length})` },
    { key: "inactive", label: `비활성 (${inactive.length})` },
  ];
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const NO_DEPT = "__none__";
  const deptNames = useMemo(
    () => [...new Set(members.map((m) => m.department).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, "ko")),
    [members],
  );
  const q = query.trim().toLowerCase();
  const list = (tab === "pending" ? pending : tab === "inactive" ? inactive : active).filter(
    (m) =>
      (!q || m.name.toLowerCase().includes(q) || (m.department ?? "").toLowerCase().includes(q)) &&
      (!dept || (dept === NO_DEPT ? !m.department : m.department === dept)),
  );

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600">
        총 {members.filter((m) => m.status !== "pending").length}명 / 활성 {active.length}명
      </p>
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">이름·부서 검색</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름·부서 검색" />
        </label>
        <select className={`${inputClass} sm:w-48`} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="부서 필터">
          <option value="">전체 부서</option>
          {deptNames.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          <option value={NO_DEPT}>부서 없음</option>
        </select>
      </div>

      {tab === "pending" && pending.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          우리 회사 직원이 맞는지 이름·연락처를 확인해 주세요. <b>승인</b>하면 바로 직원 화면을 쓸 수 있고, <b>거절</b>하면 신청이 지워져요(다시
          신청할 수 있어요).
        </p>
      )}

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          {q || dept
            ? "조건에 맞는 멤버가 없어요."
            : tab === "pending"
              ? "가입 승인을 기다리는 직원이 없어요. 위 초대 링크를 직원에게 보내 주세요."
              : tab === "inactive"
                ? "비활성 멤버가 없어요."
                : "멤버가 없어요."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((m) => (
            <MemberItem key={m.id} member={m} preview={preview} href={`${basePath}/${m.id}`} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberItem({ member: m, preview, href }: { member: MemberRow; preview: boolean; href: string }) {
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
          <>
            <span className={`mr-auto whitespace-nowrap rounded-full px-2.5 py-1 text-xs md:mr-0 ${m.role === "employee" ? "bg-zinc-100 text-zinc-600" : "bg-blue-50 text-blue-700"}`}>
              {ROLE_LABEL[m.role]}
            </span>
            <Link
              href={href}
              className="inline-flex min-h-11 items-center gap-0.5 whitespace-nowrap rounded-xl border border-zinc-300 pl-4 pr-2 text-sm font-medium hover:bg-zinc-50"
            >
              편집 <ChevronRight className="size-4" />
            </Link>
          </>
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
