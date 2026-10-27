"use client";

import { Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markClaimsPaidAction } from "@/lib/claims/actions";
import { formatDateTimeKst } from "@/lib/claims/format";
import type { PayoutGroup } from "@/lib/claims/payouts";
import { formatWon } from "@/lib/format";
import { guardAction } from "@/lib/action-guard";
import { measureAction } from "@/lib/perf/client";

// 화면 A-02 정산 지급 관리 (admin-payouts.md). 실제 이체는 회사 은행에서 하고, 여기서는 체크리스트·처리 기록만 남긴다
function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // 복사할 수 없는 환경이면 화면의 글자를 직접 선택하면 된다
        }
      }}
      className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs hover:bg-zinc-50"
      aria-label={label}
    >
      <Copy className="size-3.5" />
      {done ? "복사됨" : "복사"}
    </button>
  );
}

export function PayoutsView({ groups, tab, base, claimsBase }: { groups: PayoutGroup[]; tab: "waiting" | "paid"; base: string; claimsBase: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const all = groups.flatMap((g) => g.claims);
  const sel = all.filter((c) => selected.includes(c.id));
  const selMembers = groups.filter((g) => g.claims.some((c) => selected.includes(c.id))).length;
  const toggle = (ids: string[], on: boolean) => setSelected((s) => (on ? [...new Set([...s, ...ids])] : s.filter((x) => !ids.includes(x))));
  const totalPayout = groups.reduce((s, g) => s + g.payout, 0);
  const totalPayback = groups.reduce((s, g) => s + g.payback, 0);

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 sm:w-80">
        {(
          [
            ["waiting", "정산 대기"],
            ["paid", "지급 완료"],
          ] as const
        ).map(([k, l]) => (
          <Link key={k} href={`${base}?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm ${tab === k ? "bg-white font-semibold shadow-sm" : "text-zinc-600"}`}>
            {l}
          </Link>
        ))}
      </div>

      {tab === "waiting" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              ["미지급 사비 총액", formatWon(totalPayout)],
              ["대상 결의서", `${all.length}건`],
              ["미수 납부액 (법인카드 개인 부담)", formatWon(totalPayback)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">{k}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500">{tab === "waiting" ? "지급할 결의서가 없어요." : "지급 완료한 결의서가 없어요."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((g) => {
            const ids = g.claims.map((c) => c.id);
            const allOn = ids.every((id) => selected.includes(id));
            return (
              <li key={g.member_id} className="rounded-xl border border-zinc-200 bg-white">
                <div className="flex flex-wrap items-start gap-3 border-b border-zinc-100 p-4">
                  {tab === "waiting" && (
                    <label className="-m-3 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center">
                      <input type="checkbox" className="size-5" aria-label={`${g.name} 전체 선택`} checked={allOn} onChange={(e) => toggle(ids, e.target.checked)} />
                    </label>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {g.name}
                      {g.department && <span className="ml-1 text-sm font-normal text-zinc-500">({g.department})</span>}
                    </p>
                    {g.bank ? (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                        <span className="tabular-nums">
                          {g.bank.bank_name} {g.bank.account_number} · {g.bank.account_holder}
                        </span>
                        <CopyButton text={`${g.bank.bank_name} ${g.bank.account_number} ${g.bank.account_holder}`} label={`${g.name} 계좌 복사`} />
                      </p>
                    ) : (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">계좌 미등록</span>
                        <CopyButton text={`${g.name}님, PocketExpense [내 정보]에서 정산 계좌를 등록해 주세요.`} label="계좌 등록 요청 문구 복사" />
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      지급 <b className="tabular-nums">{formatWon(g.payout)}</b>
                    </p>
                    {g.payback > 0 && <p className="text-zinc-600">납부 {formatWon(g.payback)}</p>}
                  </div>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {g.claims.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-4 text-sm">
                      {tab === "waiting" && (
                        <label className="-mx-3 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center">
                          <input type="checkbox" className="size-5" aria-label={`${c.title} 선택`} checked={selected.includes(c.id)} onChange={(e) => toggle([c.id], e.target.checked)} />
                        </label>
                      )}
                      <Link href={`${claimsBase}/${c.id}?tab=done`} className="block min-w-0 flex-1 truncate py-3 hover:underline">
                        {c.title || "제목 없는 결의서"}
                        <span className="ml-1 text-xs text-zinc-500">{tab === "waiting" ? `승인 ${formatDateTimeKst(c.approved_at).slice(0, 10)}` : `지급 ${formatDateTimeKst(c.paid_at)}`}</span>
                      </Link>
                      <span className="shrink-0 text-right tabular-nums">
                        {formatWon(c.payout)}
                        {c.payback > 0 && <span className="block text-xs text-zinc-500">납부 {formatWon(c.payback)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "waiting" && (sel.length > 0 || message) && (
        <div className="kb-hide fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:left-64">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center">
            {message && <p className={`rounded-lg px-3 py-2 text-sm sm:flex-1 ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>}
            {sel.length > 0 && (
              <>
                <p className="text-sm text-zinc-700 sm:flex-1">
                  직원 {selMembers}명 · 결의서 {sel.length}건 · 지급 {formatWon(sel.reduce((s, c) => s + c.payout, 0))}
                  {sel.some((c) => c.payback > 0) && ` / 납부 확인 ${formatWon(sel.reduce((s, c) => s + c.payback, 0))}`}
                </p>
                <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
                  💰 정산 지급 완료 처리
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="pay-title">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={() => setConfirm(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl">
            <h2 id="pay-title" className="text-lg font-semibold">
              지급 완료로 처리할까요?
            </h2>
            <p className="mt-2 text-sm text-zinc-700">
              직원 {selMembers}명 · 결의서 {sel.length}건 · 지급 {formatWon(sel.reduce((s, c) => s + c.payout, 0))}
              {sel.some((c) => c.payback > 0) && ` / 납부 확인 ${formatWon(sel.reduce((s, c) => s + c.payback, 0))}`}
            </p>
            <p className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600">이체는 회사 은행에서 먼저 해 주세요. 처리하면 직원 화면에 &ldquo;정산 지급 완료&rdquo;로 바뀌고 되돌릴 수 없어요.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="min-h-12 rounded-xl border border-zinc-300 font-medium">
                취소
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await guardAction(() => measureAction("admin.mark_paid", () => markClaimsPaidAction(sel.map((c) => c.id))));
                    setConfirm(false);
                    if (!res.ok) return setMessage({ kind: "error", text: res.error });
                    setSelected([]);
                    setMessage({ kind: "ok", text: `결의서 ${res.count}건을 지급 완료로 처리했어요.` });
                    router.refresh();
                  })
                }
                className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-60"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                지급 완료 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
