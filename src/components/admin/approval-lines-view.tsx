"use client";

import { ArrowDown, ArrowUp, Loader2, Lock, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveApprovalLineAction } from "@/app/workspace/[id]/admin/approval-lines/actions";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";
import type { ApprovalLineView, LineMember } from "@/lib/admin/approval-lines";
import { measureAction } from "@/lib/perf/client";

// 화면 ⑥ 사전 검토 결재라인 (admin-dashboard.md ⑥, approval-workflow.md §2) — 선택 기능, 기본은 관리자 직통
const MAX_REVIEWERS = 4;

export function ApprovalLinesHeading() {
  return (
    <SectionHeading
      as="h1"
      title="사전 검토 결재라인"
      summary="관리자 승인 전에 팀장 같은 사람이 먼저 확인하게 하려면 검토자를 넣어 주세요. 넣지 않으면 관리자에게 바로 갑니다."
      helpId="approval-lines"
      help={
        <>
          <p>부서별 결재라인이 있으면 그 부서 직원에게 먼저 적용되고, 없으면 기본 결재라인을 따릅니다.</p>
          <p>검토자는 최대 {MAX_REVIEWERS}명, 순서대로 검토합니다. 누구든 반려하면 직원에게 돌아가요. 마지막 관리자 승인은 항상 들어갑니다.</p>
          <p>바꾼 결재라인은 이후 상신되는 결의서부터 적용되고, 이미 진행 중인 결재에는 영향이 없어요.</p>
        </>
      }
    />
  );
}

function preview(reviewers: { name: string }[]) {
  return [...reviewers.map((r) => `${r.name} 검토`), "관리자 승인"].join(" → ");
}

function LineEditor({ line, members, onSaved }: { line: ApprovalLineView; members: LineMember[]; onSaved: (msg: string) => void }) {
  const [list, setList] = useState(line.reviewers);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(list.map((r) => r.id)) !== JSON.stringify(line.reviewers.map((r) => r.id));
  const candidates = members.filter((m) => !list.some((r) => r.id === m.id));
  const move = (i: number, d: number) => setList((l) => {
    const n = [...l];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    return n;
  });
  const save = (ids: string[], done: string) =>
    start(async () => {
      setError(null);
      const res = await measureAction("admin.save_approval_line", () => saveApprovalLineAction(line.department_id, ids));
      if (res.error) setError(res.error);
      else onSaved(done);
    });

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div>
        <h2 className="font-semibold">{line.name}</h2>
        <p className="text-sm text-zinc-500">적용: {line.department_id ? "이 부서" : "부서별 결재라인이 없는"} 직원 {line.appliesTo}명</p>
      </div>
      <ol className="flex flex-col gap-2">
        {list.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              {r.name} 검토{r.position && <span className="ml-1 text-xs text-zinc-500">{r.position}</span>}
            </span>
            <button type="button" aria-label="위로" disabled={i === 0} onClick={() => move(i, -1)} className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-zinc-100 disabled:opacity-30">
              <ArrowUp className="size-4" />
            </button>
            <button type="button" aria-label="아래로" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-zinc-100 disabled:opacity-30">
              <ArrowDown className="size-4" />
            </button>
            <button type="button" aria-label={`${r.name} 빼기`} onClick={() => setList((l) => l.filter((x) => x.id !== r.id))} className="inline-flex size-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-red-600">
              <X className="size-4" />
            </button>
          </li>
        ))}
        <li className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
          <Lock className="size-4 shrink-0" />
          관리자 최종 승인 <span className="text-xs text-zinc-400">(항상 마지막, 바꿀 수 없음)</span>
        </li>
      </ol>
      {list.length < MAX_REVIEWERS && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label="검토자 추가" value={pick} onChange={(e) => setPick(e.target.value)} className={`${inputClass} sm:flex-1`}>
            <option value="">검토자 고르기</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.position ? ` (${m.position})` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pick}
            onClick={() => {
              const m = members.find((x) => x.id === pick);
              if (m) setList((l) => [...l, { id: m.id, name: m.name, position: m.position }]);
              setPick("");
            }}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-brand-600 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40"
          >
            <Plus className="size-4" />
            검토자 추가
          </button>
        </div>
      )}
      <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">미리보기: {preview(list)}</p>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {line.department_id ? (
          <button type="button" disabled={pending} onClick={() => save([], "부서별 결재라인을 지웠어요. 이 부서는 기본 결재라인을 따라요.")} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm text-zinc-500 hover:text-red-600">
            <Trash2 className="size-4" />
            이 결재라인 지우기
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => save(list.map((r) => r.id), "저장했어요. 이후 상신되는 결의서부터 적용돼요.")}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}저장
        </button>
      </div>
    </section>
  );
}

export function ApprovalLinesView({ lines, departments, members }: { lines: ApprovalLineView[]; departments: { id: string; name: string; hasLine: boolean }[]; members: LineMember[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("default");
  const [adding, setAdding] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const key = (l: ApprovalLineView) => l.department_id ?? "default";
  const free = departments.filter((d) => !d.hasLine);
  const draft: ApprovalLineView | null = adding ? { department_id: adding, name: `${departments.find((d) => d.id === adding)?.name ?? "부서"} 결재라인`, reviewers: [], appliesTo: 0 } : null;
  const current = draft ?? lines.find((l) => key(l) === selected) ?? lines[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-2">
        {message && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
            {message}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {lines.map((l) => (
            <li key={key(l)}>
              <button
                type="button"
                onClick={() => {
                  setAdding(null);
                  setSelected(key(l));
                }}
                className={`w-full rounded-xl border p-3 text-left ${!adding && key(l) === key(current) ? "border-brand-500 bg-brand-50" : "border-zinc-200 bg-white hover:border-brand-300"}`}
              >
                <span className="block font-medium">{l.name}</span>
                <span className="block text-xs text-zinc-500">
                  {preview(l.reviewers)} · 직원 {l.appliesTo}명
                </span>
              </button>
            </li>
          ))}
        </ul>
        {free.length > 0 && (
          <select
            aria-label="부서별 결재라인 추가"
            value=""
            onChange={(e) => e.target.value && setAdding(e.target.value)}
            className={`${inputClass} text-sm`}
          >
            <option value="">+ 부서별 결재라인 추가</option>
            {free.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {current && (
        <LineEditor
          key={`${key(current)}:${current.reviewers.map((r) => r.id).join(",")}:${adding ?? ""}`}
          line={current}
          members={members}
          onSaved={(msg) => {
            setMessage(msg);
            if (adding) {
              setSelected(adding);
              setAdding(null);
            }
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
