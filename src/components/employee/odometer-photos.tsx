"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { attachOdometerPhotoAction, detachOdometerPhotoAction, evidenceUploadedAction } from "@/app/workspace/[id]/employee/claims/actions";
import type { EditorItem } from "@/lib/employee/editor-types";
import { guardAction } from "@/lib/action-guard";
import { measureAction } from "@/lib/perf/client";
import { isPdf, processReceiptFile, RECEIPT_MAX_BYTES, TOO_LARGE_MESSAGE } from "@/lib/receipts/image";
import { createClient } from "@/lib/supabase/client";

// 자차 출발·도착 계기판 사진 (trip-expense.md §4, D-070 ②, D-144) — 회사가 '계기판 사진 받기'를 켰을 때만 보인다.
// 경로는 서버(DB)가 정하고, 사진은 영수증과 같이 줄여서 그 경로에 올린다. AI로 읽지 않는다(크레딧 없음).
const SLOTS = [
  { which: "start", label: "출발 계기판" },
  { which: "end", label: "도착 계기판" },
] as const;

export function OdometerPhotos({ item, editable, onError }: { item: EditorItem; editable: boolean; onError: (message: string | null) => void }) {
  const urls = { start: item.odometerStartUrl, end: item.odometerEndUrl };
  const has = { start: !!item.odometer_start_path, end: !!item.odometer_end_path };
  return (
    <section className="flex flex-col gap-2" aria-labelledby={`odo-title-${item.id}`}>
      <p id={`odo-title-${item.id}`} className="text-sm font-medium text-zinc-800">
        계기판 사진<span className="ml-0.5 text-red-600">*</span>
        <span className="ml-1.5 font-normal text-zinc-500">출발할 때와 도착했을 때 주행거리(km)가 보이게 찍어 주세요</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {SLOTS.map(({ which, label }) => (
          <Slot key={which} itemId={item.id} which={which} label={label} url={urls[which]} has={has[which]} editable={editable} onError={onError} />
        ))}
      </div>
    </section>
  );
}

function Slot({
  itemId,
  which,
  label,
  url,
  has,
  editable,
  onError,
}: {
  itemId: string;
  which: "start" | "end";
  label: string;
  url: string | null;
  has: boolean;
  editable: boolean;
  onError: (message: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null); // 올린 직후 서버가 새 링크를 줄 때까지 보여 줄 사진

  const upload = (file: File) =>
    start(async () => {
      onError(null);
      if (isPdf(file) || !file.type.startsWith("image/")) return onError("계기판은 사진으로 올려 주세요.");
      const processed = await processReceiptFile(file).catch(() => null);
      if (!processed || processed.kind !== "image") return onError("올릴 수 없는 사진이에요. 다시 찍어 주세요.");
      if (processed.original.size > RECEIPT_MAX_BYTES) return onError(TOO_LARGE_MESSAGE);
      const r = await guardAction(() => measureAction("employee.odometer_attach", () => attachOdometerPhotoAction(itemId, which)));
      if (!r.ok) return onError(r.error);
      const up = await createClient().storage.from("receipts").upload(r.path, processed.original, { contentType: "image/jpeg", upsert: true });
      if (up.error) {
        await detachOdometerPhotoAction(itemId, which, { quiet: true }).catch(() => undefined);
        return onError("사진을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      }
      setPreview(URL.createObjectURL(processed.original));
      await evidenceUploadedAction().catch(() => undefined);
    });
  const remove = () =>
    start(async () => {
      onError(null);
      const r = await guardAction(() => measureAction("employee.odometer_detach", () => detachOdometerPhotoAction(itemId, which)));
      if (!r.ok) return onError(r.error);
      setPreview(null);
    });

  const shown = has ? (preview ?? url) : null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      {shown ? (
        <a href={shown} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100" aria-label={`${label} 사진 크게 보기`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크 / 올린 직후 미리보기 */}
          <img src={shown} alt={`${label} 사진`} className="aspect-[4/3] w-full object-cover" />
        </a>
      ) : (
        <button
          type="button"
          disabled={!editable || busy}
          onClick={() => input.current?.click()}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-brand-300 bg-brand-50 text-sm font-medium text-brand-800 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
          {busy ? "올리는 중…" : "사진 올리기"}
        </button>
      )}
      {shown && editable && (
        <div className="flex gap-1.5">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="min-h-11 flex-1 rounded-xl border border-zinc-300 bg-white px-2 text-sm text-zinc-700 disabled:opacity-50">
            {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : "바꾸기"}
          </button>
          <button type="button" disabled={busy} onClick={remove} aria-label={`${label} 사진 지우기`} className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-600 disabled:opacity-50">
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
      {/* 카메라·앨범 둘 다 고를 수 있게(미리 찍어 둔 사진도 올림) */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file);
        }}
      />
    </div>
  );
}
