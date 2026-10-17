"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  addDepartmentAction,
  deleteDepartmentAction,
  renameDepartmentAction,
  reorderDepartmentsAction,
} from "@/app/workspace/[id]/admin/departments/actions";
import { FormError } from "@/components/onboarding/field";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";
import type { DepartmentRow } from "@/lib/admin/queries";

type Result = { error: string | null };

export function DepartmentsHeading() {
  return (
    <SectionHeading
      as="h1"
      title="부서"
      summary="직원이 가입할 때 고르는 부서 목록이에요."
      helpId="admin.departments"
      help={
        <>
          <p>
            <b>어디에 쓰이나요?</b> 직원 가입 화면의 부서 선택지, 멤버 목록의 부서 필터, 부서별 사전 검토 결재라인(준비 중)에 쓰여요.
          </p>
          <p>
            <b>순서</b> 화살표로 바꾼 순서대로 가입 화면에 보여요. <b>삭제</b>하면 그 부서 직원은 &lsquo;부서 없음&rsquo;이 되고, 그 부서의 결재라인도 함께
            지워져요. 지난 경비 기록은 그대로예요.
          </p>
        </>
      }
    />
  );
}

// 부서 관리 (spec/screens/admin-dashboard.md ⑤): 추가·이름 변경·순서 변경·삭제
export function DepartmentsView({ departments, preview = false }: { departments: DepartmentRow[]; preview?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  function run(action: () => Promise<Result>, onDone?: () => void) {
    if (preview) return;
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (r.error) setError(r.error);
      else onDone?.();
    });
  }

  function move(index: number, delta: -1 | 1) {
    const ids = departments.map((d) => d.id);
    const j = index + delta;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(() => reorderDepartmentsAction(ids));
  }

  function remove(d: DepartmentRow) {
    const lines = [`'${d.name}' 부서를 삭제할까요?`];
    if (d.memberCount > 0) lines.push(`소속 멤버 ${d.memberCount}명은 '부서 없음'이 됩니다. 멤버 관리에서 다시 지정해 주세요.`);
    if (d.hasApprovalLine) lines.push("이 부서의 사전 검토 결재라인도 함께 삭제됩니다.");
    if (!confirm(lines.join("\n\n"))) return;
    run(() => deleteDepartmentAction(d.id));
  }

  return (
    <section className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addDepartmentAction(newName), () => setNewName(""));
        }}
      >
        <input
          className={inputClass}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="새 부서 이름 (예: 영업팀)"
          maxLength={50}
          aria-label="새 부서 이름"
        />
        <button
          type="submit"
          disabled={pending || !newName.trim()}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="size-4" /> 추가
        </button>
      </form>
      <FormError message={error} />

      {departments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          아직 부서가 없어요. 위에서 부서를 추가해 주세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {departments.map((d, i) => (
            <DepartmentItem
              key={d.id}
              department={d}
              first={i === 0}
              last={i === departments.length - 1}
              busy={pending}
              onMove={(delta) => move(i, delta)}
              onRename={(name, done) => run(() => renameDepartmentAction(d.id, name), done)}
              onDelete={() => remove(d)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent";

function DepartmentItem({
  department: d,
  first,
  last,
  busy,
  onMove,
  onRename,
  onDelete,
}: {
  department: DepartmentRow;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onRename: (name: string, done: () => void) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(d.name);

  if (editing) {
    return (
      <li className="rounded-xl border border-blue-200 bg-white p-3">
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            onRename(name, () => setEditing(false));
          }}
        >
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={50} aria-label="부서 이름" autoFocus />
          <button type="submit" disabled={busy || !name.trim()} className={iconButton} aria-label="저장">
            <Check className="size-5 text-blue-600" />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label="취소"
            onClick={() => {
              setName(d.name);
              setEditing(false);
            }}
          >
            <X className="size-5" />
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white py-2 pl-4 pr-2">
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium">{d.name}</p>
        <p className="text-xs text-zinc-500">
          {d.memberCount}명{d.hasApprovalLine && " · 부서 결재라인 있음"}
        </p>
      </div>
      <button type="button" className={iconButton} disabled={busy || first} onClick={() => onMove(-1)} aria-label={`${d.name} 위로`}>
        <ArrowUp className="size-4" />
      </button>
      <button type="button" className={iconButton} disabled={busy || last} onClick={() => onMove(1)} aria-label={`${d.name} 아래로`}>
        <ArrowDown className="size-4" />
      </button>
      <button type="button" className={iconButton} disabled={busy} onClick={() => setEditing(true)} aria-label={`${d.name} 이름 변경`}>
        <Pencil className="size-4" />
      </button>
      <button type="button" className={`${iconButton} hover:text-red-600`} disabled={busy} onClick={onDelete} aria-label={`${d.name} 삭제`}>
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
