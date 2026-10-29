"use client";

import { BookCopy } from "lucide-react";
import { useState, useTransition } from "react";
import { applyDefaultTitlesAction, saveDefaultTitlesAction } from "@/app/tax-office/default-titles-actions";
import { thrownActionMessage } from "@/lib/action-guard";
import { formatDateTimeKst } from "@/lib/claims/format";

export type DefaultTitles = { titles: { name: string; code: string | null }[]; mapping_count: number; source_name: string | null; saved_at: string } | null;
type Msg = { kind: "ok" | "error"; text: string } | null;

const btn = "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl px-4 text-sm font-semibold disabled:opacity-50";

function Summary({ value }: { value: NonNullable<DefaultTitles> }) {
  return (
    <p className="mt-1 break-keep text-sm text-zinc-600">
      ‘{value.source_name ?? "고객사"}’ 설정으로 {formatDateTimeKst(value.saved_at)}에 저장 · 계정과목 {value.titles.length}개 · 분류 연결 {value.mapping_count}개
    </p>
  );
}

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.kind === "error" ? "alert" : "status"} className={`mt-2 break-keep text-sm ${msg.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
      {msg.text}
    </p>
  );
}

const applied = (r: { companies: number; changes: number }) =>
  r.changes ? `${r.companies}곳에 적용했어요(바뀐 곳 ${r.changes}군데). 회사 관리자 화면에 변경 이력·알림으로 보여요.` : `${r.companies}곳 모두 이미 기본값과 같아요.`;

// 고객사 계정과목 화면(사무소 관리자): 이 회사 설정을 사무소 기본값으로 저장 / 기본값을 이 회사에 적용
export function DefaultTitlesForCompany({ companyId, companyName, value }: { companyId: string; companyName: string; value: DefaultTitles }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setMsg(null);
      try {
        await fn();
      } catch {
        setMsg({ kind: "error", text: thrownActionMessage() });
      }
    });
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="사무소 기본 계정과목">
      <h2 className="flex items-center gap-1.5 font-semibold">
        <BookCopy className="size-4 text-zinc-500" aria-hidden />
        사무소 기본 계정과목
      </h2>
      {value ? <Summary value={value} /> : <p className="mt-1 break-keep text-sm text-zinc-600">아직 없어요. 기준이 되는 고객사 설정을 기본값으로 저장해 두면, 다른 고객사에 버튼 하나로 똑같이 맞출 수 있어요.</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (value && !confirm(`사무소 기본값을 ‘${companyName}’ 설정으로 바꿀까요? 이미 적용한 고객사는 그대로예요.`)) return;
            run(async () => {
              const r = await saveDefaultTitlesAction(companyId);
              setMsg(r.ok ? { kind: "ok", text: "이 회사 설정을 사무소 기본값으로 저장했어요." } : { kind: "error", text: r.error });
            });
          }}
          className={`${btn} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`}
        >
          이 회사 설정을 사무소 기본값으로 저장
        </button>
        {value && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`‘${companyName}’의 계정과목을 사무소 기본값에 맞출까요? 같은 이름은 코드를 맞추고, 없는 계정과목은 추가하고, 분류 연결은 기본값대로 바꿔요. 이 회사에만 있는 계정과목은 지우지 않아요.`)) return;
              run(async () => {
                const r = await applyDefaultTitlesAction([companyId]);
                setMsg(r.ok ? { kind: "ok", text: applied(r) } : { kind: "error", text: r.error });
              });
            }}
            className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}
          >
            사무소 기본값을 이 회사에 적용
          </button>
        )}
      </div>
      <Message msg={msg} />
    </section>
  );
}

// 사무소 관리(관리자): 기본값을 고른 고객사에 한 번에 적용
export function DefaultTitlesApply({ value, clients }: { value: DefaultTitles; clients: { id: string; name: string }[] }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(clients.map((c) => c.id)));
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const all = picked.size === clients.length;
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5" aria-label="기본 계정과목 일괄 적용">
      <h2 className="flex items-center gap-1.5 text-lg font-semibold">
        <BookCopy className="size-5 text-zinc-500" aria-hidden />
        기본 계정과목
      </h2>
      {!value ? (
        <p className="mt-1 break-keep text-sm text-zinc-600">
          아직 사무소 기본값이 없어요. 고객사 → [계정과목]에서 기준이 되는 회사를 우리 사무소 기준으로 맞춘 뒤 [이 회사 설정을 사무소 기본값으로 저장]을 눌러 주세요.
        </p>
      ) : (
        <>
          <Summary value={value} />
          <p className="mt-1 break-keep text-sm text-zinc-600">고른 고객사의 계정과목·코드·분류 연결을 기본값에 맞춰요. 회사에만 있는 계정과목은 지우지 않고, 바뀐 내용은 회사에 이력·알림으로 전해져요.</p>
          {clients.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">연결된 고객사가 없어요.</p>
          ) : (
            <>
              <label className="mt-3 flex min-h-10 items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={all} onChange={() => setPicked(all ? new Set() : new Set(clients.map((c) => c.id)))} className="size-4" />
                전체 고객사 ({clients.length}곳)
              </label>
              <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                {clients.map((c) => (
                  <li key={c.id} className="min-w-0">
                    <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg px-2 text-sm hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={picked.has(c.id)}
                        onChange={() => {
                          const n = new Set(picked);
                          if (n.has(c.id)) n.delete(c.id);
                          else n.add(c.id);
                          setPicked(n);
                        }}
                        className="size-4 shrink-0"
                      />
                      <span className="min-w-0 truncate">{c.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={pending || picked.size === 0}
                onClick={() => {
                  if (!confirm(`고른 고객사 ${picked.size}곳의 계정과목을 사무소 기본값에 맞출까요?`)) return;
                  start(async () => {
                    setMsg(null);
                    try {
                      const r = await applyDefaultTitlesAction([...picked]);
                      setMsg(r.ok ? { kind: "ok", text: applied(r) } : { kind: "error", text: r.error });
                    } catch {
                      setMsg({ kind: "error", text: thrownActionMessage() });
                    }
                  });
                }}
                className={`${btn} mt-3 w-full bg-brand-600 text-white hover:bg-brand-700 sm:w-auto`}
              >
                {pending ? "적용하는 중..." : `고른 고객사 ${picked.size}곳에 적용`}
              </button>
            </>
          )}
        </>
      )}
      <Message msg={msg} />
    </section>
  );
}
