"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "./avatar";
import { useChat } from "./chat-app";

type Person = { member_id: string; name: string; position: string | null; department: string | null };

// 대화 상대 고르기: 새 채팅(1명 = 1:1, 여러 명 = 그룹 + 이름) / 초대(이미 있는 사람은 빼고)
export function MemberPicker({
  mode,
  exclude = [],
  onClose,
  onConfirm,
}: {
  mode: "new" | "invite";
  exclude?: string[];
  onClose: () => void;
  onConfirm: (ids: string[], title: string | null) => Promise<string | null>;
}) {
  const { supabase } = useChat();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.rpc("chat_member_directory").then(({ data, error: e }) => {
      if (e) setError("직원 목록을 불러오지 못했어요.");
      setPeople(((data as unknown as Person[]) ?? []).filter((p) => !exclude.includes(p.member_id)));
    });
    // exclude는 열 때 한 번만 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const shown = (people ?? []).filter((p) => !q.trim() || `${p.name} ${p.department ?? ""} ${p.position ?? ""}`.includes(q.trim()));
  const group = mode === "new" && picked.length > 1;
  const confirm = async () => {
    setBusy(true);
    setError(null);
    const err = await onConfirm(picked, group ? title.trim() || null : null);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" role="dialog" aria-modal aria-label={mode === "new" ? "새 채팅" : "대화상대 초대"}>
      <div className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-white md:max-w-md md:rounded-2xl">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-100 px-4">
          <h2 className="flex-1 text-base font-bold">{mode === "new" ? "대화상대 선택" : "대화상대 초대"}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <div className="shrink-0 px-4 py-2">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-zinc-100 px-3 text-zinc-500">
            <Search className="size-4 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·부서 검색" className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none md:text-sm" />
          </label>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2">
          {people === null && <li className="flex justify-center p-6"><Loader2 className="size-5 animate-spin text-zinc-400" /></li>}
          {people !== null && !shown.length && <li className="p-6 text-center text-sm text-zinc-500">{people.length ? "검색 결과가 없어요." : "대화할 수 있는 직원이 없어요."}</li>}
          {shown.map((p) => {
            const on = picked.includes(p.member_id);
            return (
              <li key={p.member_id}>
                <button type="button" onClick={() => toggle(p.member_id)} aria-pressed={on} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-zinc-50">
                  <Avatar id={p.member_id} name={p.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    {(p.department || p.position) && <span className="block truncate text-xs text-zinc-500">{[p.department, p.position].filter(Boolean).join(" · ")}</span>}
                  </span>
                  <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border ${on ? "border-amber-400 bg-amber-400 text-white" : "border-zinc-300"}`}>{on && <Check className="size-4" />}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="shrink-0 border-t border-zinc-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {group && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 50))}
              placeholder="그룹 채팅방 이름(선택)"
              className="mb-2 h-11 w-full rounded-xl border border-zinc-300 px-3 text-base md:text-sm"
            />
          )}
          {error && <p className="mb-2 text-sm text-red-600" role="alert">{error}</p>}
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!picked.length || busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 font-semibold text-zinc-900 hover:bg-amber-300 disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "invite" ? `${picked.length || ""}명 초대` : picked.length > 1 ? `${picked.length}명과 그룹 채팅` : "1:1 채팅"}
          </button>
        </div>
      </div>
    </div>
  );
}
