"use client";

import { Check, Copy, Loader2, MessageCircle, Send, UserPlus, X } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { cancelInvitationAction, createInvitationAction, resendInvitationAction } from "@/app/workspace/[id]/admin/members/invite-actions";
import { inputClass } from "@/components/ui/page-shell";
import { formatPhone } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";

// 개별 초대 (admin-team-members.md §A, D-042): 이름·휴대폰·부서·직급 → [알림톡으로 초대] 또는 [초대 링크 만들기].
// 링크로 가입하면 승인 없이 바로 활성. 가입 전에는 "초대 대기"로 보이고 링크 복사·다시 보내기·취소를 할 수 있다.
export type InviteRow = { id: string; name: string; phone: string | null; department: string | null; position: string | null; token: string; last_sent_at: string | null; created_at: string };

const linkOf = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/join/i/${token}`;
const mdhm = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function CopyLink({ token, label = "링크 복사" }: { token: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(linkOf(token));
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // 복사할 수 없는 환경이면 화면의 링크를 직접 선택
        }
      }}
      className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
    >
      {done ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
      {done ? "복사됨" : label}
    </button>
  );
}

export function InvitePanel({ departments, invitations, preview = false, actions }: { departments: { id: string; name: string }[]; invitations: InviteRow[]; preview?: boolean; actions?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", departmentId: "", position: "" });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; token: string; sent: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [rowMsg, setRowMsg] = useState<{ id: string; text: string; kind: "ok" | "error" } | null>(null);

  const submit = (send: boolean) =>
    start(async () => {
      setError(null);
      const r = await measureAction("members.invite", () => createInvitationAction({ ...form, departmentId: form.departmentId || null, send }));
      if (!r.ok) return setError(r.error);
      setResult({ name: form.name.trim(), token: r.token, sent: r.sent });
      setForm({ name: "", phone: "", departmentId: "", position: "" });
    });

  const rowAction = (id: string, kind: "resend" | "cancel", name: string) => {
    if (kind === "cancel" && !confirm(`${name}님 초대를 취소할까요? 보낸 링크로는 더 이상 가입할 수 없어요.`)) return;
    start(async () => {
      const r = kind === "resend" ? await resendInvitationAction(id) : await cancelInvitationAction(id);
      setRowMsg(r.ok ? { id, kind: "ok", text: kind === "resend" ? "알림톡을 다시 보냈어요." : "초대를 취소했어요." } : { id, kind: "error", text: r.error });
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-2">
      <button
        type="button"
        onClick={() => {
          setResult(null);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <UserPlus className="size-4" /> 신규 멤버 초대하기
      </button>
      {actions}
      </div>

      {invitations.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white" aria-labelledby="invites-title">
          <h2 id="invites-title" className="border-b border-zinc-100 px-4 py-3 font-semibold">
            초대 대기 <span className="text-sm font-normal text-zinc-500">({invitations.length}명 · 링크로 가입하면 바로 활성)</span>
          </h2>
          <ul className="divide-y divide-zinc-100">
            {invitations.map((v) => (
              <li key={v.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {v.name}
                    {v.position && <span className="ml-1 text-sm font-normal text-zinc-500">({v.position})</span>}
                    <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">초대 대기</span>
                  </p>
                  <p className="text-sm text-zinc-600">
                    {v.department ?? "부서 없음"} · {v.phone ? formatPhone(v.phone) : "-"} · {v.last_sent_at ? `알림톡 ${mdhm(v.last_sent_at)}` : `만든 날 ${mdhm(v.created_at)}`}
                  </p>
                  {rowMsg?.id === v.id && <p className={`text-sm ${rowMsg.kind === "ok" ? "text-green-700" : "text-red-600"}`}>{rowMsg.text}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyLink token={v.token} />
                  <button type="button" disabled={pending || preview} onClick={() => rowAction(v.id, "resend", v.name)} className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50">
                    <Send className="size-4" /> 다시 보내기
                  </button>
                  <button type="button" disabled={pending || preview} onClick={() => rowAction(v.id, "cancel", v.name)} className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50">
                    <X className="size-4" /> 초대 취소
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="invite-title">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={() => setOpen(false)} />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl">
            <h2 id="invite-title" className="text-lg font-semibold">
              신규 멤버 초대
            </h2>
            {result ? (
              <div className="mt-3 flex flex-col gap-3">
                <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
                  {result.name}님 초대를 만들었어요.{result.sent ? " 알림톡을 보냈어요." : " 아래 링크를 직접 보내 주세요."} 링크로 가입하면 승인 없이 바로 쓸 수 있어요.
                </p>
                <p className="break-all rounded-lg bg-zinc-50 px-3 py-2 font-mono text-sm">{linkOf(result.token)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <CopyLink token={result.token} label="초대 링크 복사" />
                  <button type="button" onClick={() => setResult(null)} className="min-h-11 rounded-xl border border-zinc-300 text-sm font-medium">
                    한 명 더 초대
                  </button>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl text-sm text-zinc-600">
                  닫기
                </button>
              </div>
            ) : (
              <form
                className="mt-3 flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(true);
                }}
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">
                    이름<span className="ml-0.5 text-red-600">*</span>
                  </span>
                  <input className={inputClass} value={form.name} maxLength={50} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 최신입" required />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">
                    휴대폰 번호<span className="ml-0.5 text-red-600">*</span>
                  </span>
                  <input className={inputClass} inputMode="tel" autoComplete="off" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-1234-5678" required />
                  <span className="text-xs text-zinc-500">초대 알림톡과 결재 알림을 이 번호로 받아요.</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">부서</span>
                    <select className={inputClass} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                      <option value="">선택 안 함</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">직급 (선택)</span>
                    <input className={inputClass} value={form.position} maxLength={50} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="예: 사원" />
                  </label>
                </div>
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={pending || preview || !form.name.trim() || !form.phone.trim()} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-[#FEE500] font-semibold text-zinc-900 disabled:opacity-50">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
                  카카오톡 알림톡으로 초대
                </button>
                <button type="button" disabled={pending || preview || !form.name.trim() || !form.phone.trim()} onClick={() => submit(false)} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 font-medium disabled:opacity-50">
                  <Copy className="size-4" /> 초대 링크만 만들기 (직접 보내기)
                </button>
                <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl text-sm text-zinc-600">
                  취소
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
