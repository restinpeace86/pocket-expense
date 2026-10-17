"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { OptionalPrivacyContent, PrivacyContent, TermsContent } from "./documents";

type Key = "terms" | "privacy" | "optional";
const DOCS: Record<Key, { label: string; title: string; required: boolean; body: ReactNode }> = {
  terms: { label: "서비스 이용약관 동의", title: "서비스 이용약관", required: true, body: <TermsContent /> },
  privacy: { label: "개인정보 수집·이용 동의", title: "개인정보 수집·이용 안내", required: true, body: <PrivacyContent /> },
  optional: { label: "선택 항목(정산 계좌·차량번호) 수집·이용 동의", title: "선택 항목 수집·이용 안내", required: false, body: <OptionalPrivacyContent /> },
};

// 가입·회사 등록 동의 영역 (D-059): 전체 동의 + 항목별 동의, [보기]는 팝업으로 본문 표시
export function ConsentSection({ withOptional = false, initiallyOpen }: { withOptional?: boolean; initiallyOpen?: Key }) {
  const keys: Key[] = withOptional ? ["terms", "privacy", "optional"] : ["terms", "privacy"];
  const [checked, setChecked] = useState<Record<Key, boolean>>({ terms: false, privacy: false, optional: false });
  const [openKey, setOpenKey] = useState<Key | null>(initiallyOpen ?? null);
  const allChecked = keys.every((k) => checked[k]);

  function setAll(value: boolean) {
    setChecked((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, value])) }));
  }

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-3">
      <label className="flex min-h-11 items-center gap-2 border-b border-zinc-100 pb-2">
        <input type="checkbox" checked={allChecked} onChange={(e) => setAll(e.target.checked)} className="size-5 shrink-0 accent-blue-600" />
        <span className="font-semibold text-zinc-900">전체 동의</span>
      </label>
      {keys.map((k) => (
        <div key={k} className="flex min-h-11 items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="checkbox"
              name={k}
              required={DOCS[k].required}
              checked={checked[k]}
              onChange={(e) => setChecked((prev) => ({ ...prev, [k]: e.target.checked }))}
              className="size-5 shrink-0 accent-blue-600"
            />
            <span className="text-sm text-zinc-800">
              <span className={DOCS[k].required ? "font-medium text-blue-700" : "font-medium text-zinc-500"}>
                [{DOCS[k].required ? "필수" : "선택"}]
              </span>{" "}
              {DOCS[k].label}
            </span>
          </label>
          <button type="button" onClick={() => setOpenKey(k)} className="min-h-11 shrink-0 px-2 text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-800">
            보기
          </button>
        </div>
      ))}
      {openKey && (
        <ConsentDialog
          title={DOCS[openKey].title}
          onClose={() => setOpenKey(null)}
          onAgree={() => {
            setChecked((prev) => ({ ...prev, [openKey]: true }));
            setOpenKey(null);
          }}
        >
          {DOCS[openKey].body}
        </ConsentDialog>
      )}
    </div>
  );
}

// 모바일: 전체 화면 / 넓은 화면: 가운데 팝업. 본문은 안에서 스크롤.
function ConsentDialog({ title, children, onClose, onAgree }: { title: string; children: ReactNode; onClose: () => void; onAgree: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="consent-dialog-title"
      className="m-0 h-dvh max-h-none w-full max-w-none bg-white p-0 backdrop:bg-black/50 sm:m-auto sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl"
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <h2 id="consent-dialog-title" className="font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        <footer className="border-t border-zinc-200 p-4">
          <button type="button" onClick={onAgree} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
            동의하고 닫기
          </button>
        </footer>
      </div>
    </dialog>
  );
}
