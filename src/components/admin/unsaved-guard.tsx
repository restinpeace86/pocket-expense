"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { findSettingsTab } from "@/lib/admin/settings-groups";
import { SAVED_EVENT } from "@/lib/ui/saved-event";
import { clearAll, clearWithin, dirtyScopes, isSaveButton, markDirty, saveTargetOf, scopeFor, subscribeUnsaved } from "@/lib/ui/unsaved-store";

// 저장 방식 안내(U-2, D-301) — 관리자 설정 화면
//  · [저장]이 있는 화면: 바꾼 게 생기면 화면 아래 "저장하지 않은 변경이 있어요 [저장]" 줄. 그대로 다른 탭·메뉴로 가면 한 번 묻는다(새로고침·창 닫기는 브라우저 확인)
//  · 바로 저장되는 화면: 저장될 때 "저장했어요"를 잠깐(showSaved)
export function UnsavedGuard({ base }: { base: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const onSettings = pathname.startsWith(base) && !!findSettingsTab(pathname.slice(base.length));
  const count = useSyncExternalStore(subscribeUnsaved, () => dirtyScopes().length, () => 0);
  const [leave, setLeave] = useState<{ from: string; to: string } | null>(null);
  const leaveTo = leave?.from === pathname ? leave.to : null;
  const setLeaveTo = (to: string | null) => setLeave(to ? { from: location.pathname, to } : null);

  // 화면이 바뀌면 목록 비움
  useEffect(() => {
    clearAll();
  }, [pathname]);

  // 입력 감시
  useEffect(() => {
    if (!onSettings) return;
    const main = document.querySelector("main");
    if (!main) return;
    const onEdit = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t || t.closest("[data-setup-bar], [data-unsaved-bar]")) return;
      const scope = scopeFor(t, main);
      if (scope) markDirty(scope);
    };
    const onSubmit = (e: Event) => clearWithin(e.target as HTMLFormElement);
    // [저장] 누름 = 그 영역 저장(form 밖 저장 버튼)
    const onClick = (e: Event) => {
      const b = (e.target as HTMLElement | null)?.closest("button");
      if (b && isSaveButton(b) && !b.closest("form")) clearWithin(b);
    };
    main.addEventListener("input", onEdit, true);
    main.addEventListener("change", onEdit, true);
    main.addEventListener("submit", onSubmit, true);
    main.addEventListener("click", onClick, true);
    return () => {
      main.removeEventListener("input", onEdit, true);
      main.removeEventListener("change", onEdit, true);
      main.removeEventListener("submit", onSubmit, true);
      main.removeEventListener("click", onClick, true);
    };
  }, [onSettings, pathname]);

  // 다른 화면으로 가는 링크 · 새로고침/닫기
  useEffect(() => {
    if (!count) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [count]);

  const save = () => {
    const scope = dirtyScopes()[0];
    if (!scope) return;
    const { form, button } = saveTargetOf(scope);
    if (form) form.requestSubmit(button);
    else if (button) button.click();
    else scope.scrollIntoView({ behavior: "smooth", block: "center" }); // 저장 버튼이 아직 잠김(예: 미리보기 확인 전) → 그 자리로
  };

  return (
    <>
      <SavedToast />
      {onSettings && count > 0 && (
        <div className="sticky bottom-4 z-30 md:mr-40" data-unsaved-bar>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg">
            <span className="flex items-center gap-2 font-medium">
              <TriangleAlert className="size-4 shrink-0" />
              저장하지 않은 변경이 있어요
            </span>
            <button type="button" onClick={save} className="min-h-10 rounded-lg bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700" data-unsaved-save>
              저장
            </button>
          </div>
        </div>
      )}
      {leaveTo && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="unsaved-title" data-unsaved-dialog>
          <div className="flex w-full flex-col gap-3 rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-sm sm:rounded-2xl">
            <h2 id="unsaved-title" className="text-base font-bold">
              저장하지 않은 변경이 있어요
            </h2>
            <p className="break-keep text-sm text-zinc-600">이대로 옮기면 이 화면에서 바꾼 내용이 사라져요.</p>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button type="button" onClick={() => setLeaveTo(null)} className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white" data-unsaved-stay>
                돌아가서 저장
              </button>
              <button
                type="button"
                onClick={() => {
                  const to = leaveTo;
                  clearAll();
                  setLeaveTo(null);
                  router.push(to);
                }}
                className="min-h-11 rounded-lg border border-zinc-200 px-4 text-sm font-medium"
                data-unsaved-leave
              >
                저장하지 않고 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SavedToast() {
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      setMsg((m) => ({ text: String((e as CustomEvent).detail ?? "저장했어요"), n: (m?.n ?? 0) + 1 }));
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2200);
    };
    window.addEventListener(SAVED_EVENT, on);
    return () => {
      window.removeEventListener(SAVED_EVENT, on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[65] flex justify-center px-4" aria-live="polite" role="status">
      {msg && (
        <span key={msg.n} className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg" data-saved-toast>
          <CheckCircle2 className="size-4 text-green-400" />
          {msg.text}
        </span>
      )}
    </div>
  );
}
