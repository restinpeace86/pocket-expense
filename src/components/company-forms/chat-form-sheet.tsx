"use client";

import { Check, Loader2, Monitor, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formDialogDataAction, holdChatFormAction, type FormDialogData } from "@/app/workspace/[id]/admin/company-forms/actions";
import { AddFormDialog, SlotFull } from "./add-form-dialog";

// 채팅 사진·PDF 메뉴 [회사 양식으로 등록](관리자만, 8-104 B-1). PC = 어떤 문서인가요 창, 휴대폰 = B⓪ PC에서 해 주세요 + 담아 두기
export function ChatFormSheet({ ws, companyId, me, message, onClose }: { ws: string; companyId: string; me: string; message: { id: string; name: string }; onClose: () => void }) {
  // 메뉴를 누른 뒤에만 그려지므로(브라우저) 바로 읽는다
  const [pc] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  if (pc) return <AddFormDialog ws={ws} companyId={companyId} me={me} source={{ type: "chat", messageId: message.id, name: message.name }} onClose={onClose} />;
  return <HoldSheet ws={ws} message={message} onClose={onClose} />;
}

function HoldSheet({ ws, message, onClose }: { ws: string; message: { id: string; name: string }; onClose: () => void }) {
  const [data, setData] = useState<FormDialogData | null>(null);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void formDialogDataAction().then((r) => r.ok && (setData(r.data), setRequested(r.data.requested)));
  }, []);
  const hold = async () => {
    setBusy(true);
    setError(null);
    const r = await holdChatFormAction(message.id);
    setBusy(false);
    if (r.ok) setDone(true);
    else setError(r.error);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="hold-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5" data-hold-sheet>
        <div className="flex items-center">
          <Monitor className="size-7 text-brand-700" aria-hidden />
          <button type="button" onClick={onClose} disabled={busy} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <h2 id="hold-title" className="text-lg font-bold">
          양식 등록은 PC에서 해 주세요
        </h2>
        <p className="text-[14px] leading-relaxed text-zinc-700">칸을 하나하나 연결해야 해서 큰 화면이 필요해요. 이 파일을 [회사 양식]에 담아 두면 PC에서 바로 이어 할 수 있어요.</p>
        <p className="truncate rounded-xl border border-zinc-200 px-3 py-2 text-[13px] text-zinc-700">
          파일: <b>{message.name}</b>
        </p>
        {data && data.used >= data.limit && !data.forms.some((f) => f.kind === "leave") && (
          <SlotFull used={data.used} limit={data.limit} requested={requested} onRequested={() => setRequested(true)} forms={data.forms} />
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[13px] text-red-800">
            {error}
          </p>
        )}
        {done ? (
          <>
            <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[14px] text-emerald-900" data-held>
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> 담아 뒀어요. PC에서 [설정 › 양식·결재 › 회사 양식 › 등록 대기]를 열어 이어 하세요(30일 동안 보관).
            </p>
            <Link href={`${ws}/admin/company-forms`} className="flex h-12 items-center justify-center rounded-xl border border-zinc-300 text-[15px] font-semibold">
              회사 양식 보기
            </Link>
          </>
        ) : (
          <button type="button" onClick={() => void hold()} disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-60" data-hold>
            {busy && <Loader2 className="size-4 animate-spin" />} 담아 두고 PC에서 이어 하기
          </button>
        )}
      </section>
    </div>
  );
}
