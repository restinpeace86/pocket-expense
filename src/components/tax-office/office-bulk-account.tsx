"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { officeBulkItemAccountAction } from "@/app/tax-office/[companyId]/item-actions";
import { thrownActionMessage } from "@/lib/action-guard";

// 세무사무소: 영수증 여러 건 계정과목 한 번에 바꾸기 (D-165). 표·카드의 체크 칸과 위쪽 막대가 같은 선택을 쓴다
type Ctx = { selected: Set<string>; toggle: (id: string, on: boolean) => void; setAll: (ids: string[], on: boolean) => void };
const BulkCtx = createContext<Ctx | null>(null);

export function BulkAccountProvider({ itemIds, titles, children }: { itemIds: string[]; titles: { id: string; name: string; code: string | null }[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const setAll = (ids: string[], on: boolean) => setSelected(on ? new Set(ids) : new Set());
  const all = itemIds.length > 0 && itemIds.every((id) => selected.has(id));
  return (
    <BulkCtx.Provider value={{ selected, toggle, setAll }}>
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-zinc-100 bg-white/95 px-4 py-2.5 backdrop-blur sm:flex-row sm:flex-wrap sm:items-center" aria-label="계정과목 한 번에 바꾸기">
        <label className="inline-flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={all} onChange={(e) => setAll(itemIds, e.target.checked)} aria-label="영수증 전체 선택" />
          {selected.size ? `${selected.size}건 선택` : "여러 건 고르기"}
        </label>
        {selected.size > 0 && (
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <select value={title} onChange={(e) => setTitle(e.target.value)} aria-label="바꿀 계정과목" className="min-h-10 min-w-0 rounded-lg border border-zinc-300 bg-white px-2 text-sm sm:max-w-[16rem]">
              <option value="">계정과목 고르기</option>
              <option value="__reset">분류 기준으로 되돌리기</option>
              {titles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.code ? ` (${t.code})` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!title || pending}
              onClick={() =>
                start(async () => {
                  setMsg(null);
                  try {
                    const r = await officeBulkItemAccountAction([...selected], title === "__reset" ? null : title);
                    setMsg(r.failed ? { kind: "error", text: `${r.changed}건 바꿨고 ${r.failed}건은 못 바꿨어요: ${r.error}` } : { kind: "ok", text: `${r.changed}건을 바꿨어요. 회사에 변경 이력으로 보여요.` });
                    setSelected(new Set());
                    setTitle("");
                  } catch {
                    setMsg({ kind: "error", text: thrownActionMessage() });
                  }
                })
              }
              className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "바꾸는 중..." : `${selected.size}건 바꾸기`}
            </button>
          </div>
        )}
        {msg && (
          <p role={msg.kind === "error" ? "alert" : "status"} className={`break-keep text-sm ${msg.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
            {msg.text}
          </p>
        )}
      </div>
      {children}
    </BulkCtx.Provider>
  );
}

export function BulkCheck({ itemId, label }: { itemId: string; label: string }) {
  const ctx = useContext(BulkCtx);
  if (!ctx) return null;
  return (
    <label className="-m-2 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center">
      <input type="checkbox" className="size-4" checked={ctx.selected.has(itemId)} onChange={(e) => ctx.toggle(itemId, e.target.checked)} aria-label={`${label} 고르기`} />
    </label>
  );
}
