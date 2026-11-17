"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { submitFeedbackAction } from "@/app/workspace/[id]/feedback/actions";
import { guarded } from "@/lib/action-guard";
import { CUSTOM_SCREEN_NOTE } from "@/lib/billing/plan-benefits";

// 유료 맞춤 지원 안내(D-279·D-280·D-289): 등록한 양식 하나만의 전용 화면 — 결제가 붙기 전에는 문의로(운영자가 받아 처리)
// 운영자에게는 [의견 보내기] 통로(기능 개선, 운영자 화면 [의견] + 알림)로 간다
const send = guarded(submitFeedbackAction);

export function CustomScreenCard({ forms }: { forms: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(forms[0]?.name ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("category", "feature");
    fd.set("content", `[맞춤 제작 문의] 양식: ${pick || "(아직 등록 전)"}\n${text.trim()}`);
    fd.set("page", location.pathname);
    fd.set("viewport", `${innerWidth}x${innerHeight}`);
    const r = await send(fd);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "문의를 보냈어요. 운영자가 확인하고 연락드릴게요." });
    setText("");
    setOpen(false);
  };
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50/50 px-4 py-3.5" aria-labelledby="custom-screen-title" data-custom-screen>
      <h2 id="custom-screen-title" className="flex items-center gap-1.5 text-[15px] font-bold">
        <Sparkles className="size-4 text-brand-700" aria-hidden /> 이 양식만의 전용 화면이 필요하세요?
      </h2>
      <p className="text-[13.5px] leading-relaxed text-zinc-700">
        등록한 양식은 [결재 문서]·근태 신청 화면에서 바로 써요. 그래도 한 양식만 따로 쓰기 쉬운 화면이 필요하면 맞춤 제작을 요청하세요. <span className="text-zinc-600">{CUSTOM_SCREEN_NOTE.replace("우리 회사 전용 화면이 필요하면 ", "")}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className="h-10 rounded-xl border border-brand-300 bg-white px-3.5 text-sm font-semibold text-brand-800 hover:bg-brand-50" data-custom-open>
          맞춤 제작 문의
        </button>
        {msg && (
          <span role="status" className={`text-[13px] ${msg.ok ? "text-green-800" : "font-semibold text-red-700"}`}>
            {msg.text}
          </span>
        )}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="custom-ask-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl" data-custom-dialog>
            <div className="flex items-center">
              <h2 id="custom-ask-title" className="text-lg font-bold">
                맞춤 제작 문의
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium">
              어떤 양식인가요?
              <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-11 rounded-xl border border-zinc-300 bg-white px-2.5 text-[15px] font-normal" data-custom-form>
                {forms.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
                <option value="">아직 등록 전(새 양식)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              어떤 화면이면 좋을까요?
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1500} placeholder="예: 품목을 바코드로 찍어 넣고 싶어요 / 현장별로 나눠 쓰고 싶어요" className="rounded-xl border border-zinc-300 px-3 py-2.5 text-[15px] font-normal" data-custom-text />
            </label>
            <p className="text-[12.5px] text-zinc-600">양식 1개당 3만 원(VAT 별도)이고 고치기 1번이 들어 있어요. 보내 주시면 운영자가 확인하고 연락드려요(결제는 그때).</p>
            {msg && !msg.ok && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {msg.text}
              </p>
            )}
            <button type="button" onClick={() => void submit()} disabled={busy || text.trim().length < 5} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-50" data-custom-send>
              {busy && <Loader2 className="size-4 animate-spin" />}
              문의 보내기
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
