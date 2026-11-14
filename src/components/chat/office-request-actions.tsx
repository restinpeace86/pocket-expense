"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ackOfficeRequestAction as ackOfficeRequestActionRaw, replyOfficeRequestAction as replyOfficeRequestActionRaw } from "@/app/workspace/[id]/chat/office-actions";
import { guarded } from "@/lib/action-guard";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const ackOfficeRequestAction = guarded(ackOfficeRequestActionRaw);
const replyOfficeRequestAction = guarded(replyOfficeRequestActionRaw);

export type OfficeRequestRef = { id: string; status: "open" | "answered" | "resolved"; origin: "office" | "company"; month: string; acked_by_name: string | null; answer: string | null };

// 세무 알림방 카드 버튼(D-269): 사무소가 보낸 열린 요청 → [자료 올리기] [확인했어요] [문의 남기기]. 처리된 요청은 "완료"
export function OfficeRequestActions({ req, uploadHref }: { req: OfficeRequestRef; uploadHref: string | null }) {
  const [acked, setAcked] = useState<string | null>(req.acked_by_name);
  const [replied, setReplied] = useState<boolean>(!!req.answer);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (req.status === "resolved" || req.origin !== "office") {
    return req.status === "resolved" ? (
      <p className="border-t border-zinc-100 px-3 py-2 text-xs font-semibold text-emerald-700" data-office-done>
        완료된 요청이에요
      </p>
    ) : null;
  }
  const btn = "flex min-h-10 flex-1 items-center justify-center rounded-lg px-2 text-[13px] font-semibold disabled:opacity-60";
  return (
    <div className="flex flex-col gap-2 border-t border-zinc-100 p-2.5" data-office-actions>
      {(acked || replied) && (
        <p className="text-xs text-zinc-600" data-office-acked>
          {acked && <>확인함 · {acked}</>}
          {acked && replied && " · "}
          {replied && "문의를 남겼어요"}
        </p>
      )}
      <div className="flex gap-1.5">
        {uploadHref && (
          <Link href={uploadHref} className={`${btn} bg-brand-600 text-white hover:bg-brand-700`} data-office-upload>
            자료 올리기
          </Link>
        )}
        {!acked && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await ackOfficeRequestAction(req.id);
                if (!r.ok) return setError(r.error);
                setAcked(r.name ?? "확인함");
              })
            }
            className={`${btn} border border-brand-200 text-brand-700 hover:bg-brand-50`}
            data-office-ack
          >
            확인했어요
          </button>
        )}
        {!replied && !writing && (
          <button type="button" onClick={() => setWriting(true)} className={`${btn} bg-zinc-100 text-zinc-800 hover:bg-zinc-200`} data-office-reply>
            문의 남기기
          </button>
        )}
      </div>
      {writing && (
        <div className="flex flex-col gap-1.5">
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={2} placeholder="세무사무소에 남길 한 줄 (예: 영수증은 내일 올릴게요)" aria-label="세무사무소에 남길 말" className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-base md:text-sm" data-office-reply-text />
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setWriting(false)} className={`${btn} border border-zinc-300 text-zinc-700`}>
              취소
            </button>
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await replyOfficeRequestAction(req.id, text);
                  if (!r.ok) return setError(r.error);
                  setReplied(true);
                  setWriting(false);
                })
              }
              className={`${btn} bg-brand-600 text-white`}
              data-office-reply-send
            >
              {busy && <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />}
              보내기
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">대화방이 아니라 한 번 보내는 회신이에요. 세무사무소 화면의 이 요청에 답변으로 붙어요.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
