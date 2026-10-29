"use client";

import { FileUp, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { thrownActionMessage } from "@/lib/action-guard";
import { formatDateTimeKst } from "@/lib/claims/format";
import { FORMAT_PROGRAM_LABEL, FORMAT_PROGRAMS, type FormatProgram, type FormatRequest } from "@/lib/accounting-format/programs";
import { inputClass } from "@/components/ui/page-shell";

type Add = (fd: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;

// 다른 회계 프로그램 양식 등록 (D-180): 이카운트 ERP·뉴젠 세무사랑을 쓰는 회사가 실제 엑셀 업로드 서식을 등록하면 운영자가 맞는 파일을 준비한다(지금은 접수만)
export function AccountingFormatRequest({ requests, addAction }: { requests: FormatRequest[]; addAction: Add }) {
  const [program, setProgram] = useState<FormatProgram | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5" aria-label="다른 회계 프로그램 양식">
      <h2 className="font-semibold">다른 회계 프로그램을 쓰시나요?</h2>
      <p className="mt-0.5 break-keep text-sm text-zinc-600">
        세무 자료 엑셀에는 더존 위하고 일반전표 시트가 들어 있어요. 다른 프로그램을 쓰시면 실제 쓰는 엑셀 업로드 서식을 등록해 주세요.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FORMAT_PROGRAMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setDone(null);
              setProgram(p);
            }}
            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <FileUp className="size-4 text-zinc-500" aria-hidden />
            {FORMAT_PROGRAM_LABEL[p]}
          </button>
        ))}
      </div>
      {done && (
        <p role="status" className="mt-2 break-keep text-sm text-emerald-700">
          {done}
        </p>
      )}
      {requests.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-zinc-100 border-t border-zinc-100">
          {requests.map((r) => (
            <li key={r.id} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                {r.status === "done" ? "준비 완료" : "접수됨"}
              </span>
              <span className="shrink-0 font-medium text-zinc-800">{FORMAT_PROGRAM_LABEL[r.program]}</span>
              <span className="min-w-0 break-all text-zinc-600">{r.file_name}</span>
              <span className="text-xs text-zinc-500">{formatDateTimeKst(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
      {program && (
        <FormatDialog
          program={program}
          addAction={addAction}
          onClose={() => setProgram(null)}
          onDone={() => {
            setDone(`${FORMAT_PROGRAM_LABEL[program]} 양식을 등록했어요. 확인한 뒤 최대한 빠르게 그 양식에 맞는 파일을 준비해 드릴게요.`);
            setProgram(null);
          }}
        />
      )}
    </section>
  );
}

// 모바일: 전체 화면 / 넓은 화면: 가운데 팝업
function FormatDialog({ program, addAction, onClose, onDone }: { program: FormatProgram; addAction: Add; onClose: () => void; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      try {
        const r = await addAction(fd);
        if (!r.ok) return setError(r.error);
        onDone();
      } catch {
        setError(thrownActionMessage());
      }
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="format-dialog-title"
      className="m-0 h-dvh max-h-none w-full max-w-none bg-white p-0 backdrop:bg-black/50 sm:m-auto sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl"
    >
      <form action={submit} className="flex h-full max-h-[inherit] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <h2 id="format-dialog-title" className="font-semibold">
            {FORMAT_PROGRAM_LABEL[program]} 양식 파일 등록
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          <p className="break-keep text-sm text-zinc-700">
            실제 사용 중인 <b>엑셀 업로드 서식</b>을 등록해 주시면, 최대한 빠르게 그 양식에 맞는 파일을 만들어 드릴게요.
          </p>
          <input type="hidden" name="program" value={program} />
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">양식 파일 (.xlsx · .xls · .csv, 5MB까지)</span>
            <input name="file" type="file" required accept=".xlsx,.xls,.csv" className="block w-full min-w-0 text-sm file:mr-2 file:min-h-10 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:font-medium file:text-zinc-800 file:ring-1 file:ring-zinc-300" />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">메모 (선택)</span>
            <textarea name="memo" maxLength={300} rows={3} className={inputClass} placeholder="예: 지출결의서 업로드 양식이에요. 사비는 미지급금으로 처리해요." />
          </label>
          <p className="break-keep text-xs text-zinc-500">예시 줄이 들어 있어도 괜찮아요. 암호가 걸린 파일은 암호를 풀어서 올려 주세요.</p>
          {error && (
            <p role="alert" className="break-keep text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
        <footer className="border-t border-zinc-200 p-4">
          <button type="submit" disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {pending ? "등록하는 중..." : "등록하기"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
