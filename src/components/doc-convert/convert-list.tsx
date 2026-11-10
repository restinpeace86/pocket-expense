"use client";

import { ChevronLeft, ChevronRight, FileSpreadsheet, Lock, Upload, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { convertUploadAction } from "@/app/workspace/[id]/employee/convert/actions";
import { CONVERT_MIMES, draftDaysLeft, isConvertible } from "@/lib/doc-convert/model";
import { createClient } from "@/lib/supabase/client";
import { ConvertSheet } from "./convert-sheet";

export type ConversionRow = { id: string; member_id: string; name: string; mime: string; status: "draft" | "confirmed"; scope: "private" | "company"; pages: number; created_at: string };

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const dateLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(iso));

// 서류 → 엑셀 목록(8-104 A-1): [사진·PDF 고르기] + 내 변환 / 회사 공유. 크레딧은 보여 주지 않는다
export function ConvertList({ ws, companyId, me, rows, people }: { ws: string; companyId: string; me: string; rows: ConversionRow[]; people: Record<string, string> }) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"mine" | "company">("mine");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const mine = rows.filter((r) => r.member_id === me);
  const shared = rows.filter((r) => r.member_id !== me || (r.status === "confirmed" && r.scope === "company"));
  const shown = tab === "mine" ? mine : shared.filter((r) => r.status === "confirmed" && r.scope === "company");

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!isConvertible(f.type)) return setError("사진(JPG·PNG)이나 PDF만 엑셀로 바꿀 수 있어요.");
    if (f.size > 20 * 1024 * 1024) return setError("20MB보다 작은 파일만 바꿀 수 있어요.");
    setFile(f);
  };
  // 브라우저가 내 폴더(doc-files/{회사}/{나}/{id})에 올린 뒤 서버가 변환
  const run = async () => {
    const f = file!;
    const id = crypto.randomUUID();
    const { error: up } = await supabase.storage.from("doc-files").upload(`${companyId}/${me}/${id}.${EXT[f.type]}`, f, { contentType: f.type });
    if (up) return { ok: false as const, error: "파일을 올리지 못했어요. 잠시 후 다시 시도해 주세요." };
    return convertUploadAction(id, f.name, f.type);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-28 pt-3 md:max-w-3xl md:px-6 md:pt-6">
      <div className="flex items-center gap-1">
        <Link href={`${ws}/employee`} aria-label="홈으로" className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="text-xl font-bold md:text-2xl">서류 → 엑셀</h1>
      </div>
      <section className="flex flex-col gap-2.5 rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-[14px] leading-relaxed text-zinc-700">
          종이 서류·PDF를 <b>표 모양 그대로</b> 엑셀로 바꿔요. 앱에서 확인하고 고친 뒤 PDF·엑셀로 받을 수 있어요. 채팅의 사진·PDF는 길게 누르거나 오른쪽 클릭 → [엑셀로 변환].
        </p>
        <button type="button" onClick={() => picker.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-bold text-white hover:bg-brand-700" data-pick>
          <Upload className="size-4" aria-hidden /> 사진·PDF 고르기
        </button>
        <input ref={picker} type="file" accept={CONVERT_MIMES.join(",")} hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} data-pick-input />
        <p className="text-xs text-zinc-500">한 번에 5쪽까지 · 20MB까지 · 회사 업무 서류만</p>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-800">
            {error}
          </p>
        )}
      </section>
      <div role="tablist" aria-label="변환 목록" className="grid grid-cols-2 rounded-xl bg-zinc-200 p-1">
        {(
          [
            ["mine", "내 변환", Lock, mine.length],
            ["company", "회사 공유", Users, shared.filter((r) => r.status === "confirmed" && r.scope === "company").length],
          ] as const
        ).map(([v, label, Icon, n]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm ${tab === v ? "bg-white font-bold shadow-sm" : "text-zinc-600"}`} data-tab={v}>
            <Icon className="size-4" aria-hidden /> {label} <span className={tab === v ? "text-brand-700" : ""}>{n}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-600" data-convert-empty>
          {tab === "mine" ? "아직 변환한 서류가 없어요." : "회사에 공유된 변환이 없어요."}
        </p>
      ) : (
        <ul aria-label={tab === "mine" ? "내 변환" : "회사 공유 변환"} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {shown.map((r) => (
            <li key={r.id} className="border-b border-zinc-100 last:border-b-0">
              <Link href={`${ws}/employee/convert/${r.id}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-zinc-50" data-convert-row={r.name}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <FileSpreadsheet className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{r.name}</b>
                  <span className="block truncate text-xs text-zinc-600">
                    {r.pages}쪽 · {r.member_id === me ? "나" : (people[r.member_id] ?? "동료")} · {dateLabel(r.created_at)}
                  </span>
                </span>
                {r.status === "draft" ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">초안 · {draftDaysLeft(r.created_at)}일</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900">{r.scope === "company" ? "회사 공유" : "나만 보기"}</span>
                )}
                <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {file && <ConvertSheet ws={ws} name={file.name} from="기기에서 고른 파일" run={run} onClose={() => setFile(null)} />}
    </main>
  );
}
