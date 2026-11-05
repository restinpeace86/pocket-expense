"use client";

import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { bytesLabel } from "@/lib/chat/format";
import type { MeetingFile } from "@/lib/calendar/calendar";
import type { createClient } from "@/lib/supabase/client";

// 회의 자료(D-217, spec/features/calendar.md §15): 비공개 보관함 meeting-files/{회사}/{일정}/{uuid}.{확장자}
// 일정마다 10개, 파일마다 20MB, PDF·문서·표·발표·한글·이미지·글·압축만. 회사 첨부 저장 공간(1/3/10GB)에 함께 센다
type Supa = ReturnType<typeof createClient>;
export const MEETING_FILE_MAX = 10;
export const MEETING_FILE_BYTES = 20 * 1024 * 1024;
export const MEETING_FILE_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "hwp", "hwpx", "txt", "png", "jpg", "jpeg", "gif", "webp", "heic", "zip"];
const ACCEPT = MEETING_FILE_EXT.map((x) => `.${x}`).join(",");

// 1MB 아래는 KB로(작은 문서가 "0MB"로 보이지 않게)
const sizeLabel = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.ceil(n / 1024))}KB` : bytesLabel(n));
const extOf = (name: string) => (name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? "").toLowerCase();
export function meetingFileProblem(f: File): string | null {
  if (!MEETING_FILE_EXT.includes(extOf(f.name))) return `${f.name}: 올릴 수 없는 파일이에요(PDF·워드·엑셀·파워포인트·한글·이미지·txt·zip).`;
  if (f.size > MEETING_FILE_BYTES) return `${f.name}: 20MB까지 올릴 수 있어요.`;
  return null;
}

const ADD_ERR: Record<string, string> = {
  STORAGE_FULL: "회사 저장 공간이 다 찼어요. 관리자 설정 › 채팅에서 사용량을 확인해 주세요.",
  TOO_MANY_FILES: `회의 자료는 ${MEETING_FILE_MAX}개까지예요.`,
  FILE_TYPE: "올릴 수 없는 파일이에요.",
  FILE_TOO_LARGE: "20MB까지 올릴 수 있어요.",
};

// 저장한 일정에 고른 파일들을 올린다. 실패한 파일 이름·이유를 돌려준다(올라간 것은 그대로)
export async function uploadMeetingFiles(supabase: Supa, companyId: string, eventId: string, files: File[]): Promise<string[]> {
  const errors: string[] = [];
  for (const f of files) {
    const path = `${companyId}/${eventId}/${crypto.randomUUID()}.${extOf(f.name)}`;
    const up = await supabase.storage.from("meeting-files").upload(path, f, { contentType: f.type || undefined, upsert: false });
    if (up.error) {
      errors.push(`${f.name}: 올리지 못했어요.`);
      continue;
    }
    const { error } = await supabase.rpc("calendar_event_file_add", { p_event: eventId, p_path: path, p_name: f.name, p_mime: f.type || null } as never);
    if (error) {
      await supabase.storage.from("meeting-files").remove([path]);
      const code = Object.keys(ADD_ERR).find((k) => error.message?.includes(k));
      errors.push(`${f.name}: ${code ? ADD_ERR[code] : "올리지 못했어요."}`);
    }
  }
  return errors;
}

// 자료 지우기(만든 사람): 줄 → 파일. 파일을 못 지우면 새벽 정리가 지운다
export async function deleteMeetingFile(supabase: Supa, id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("calendar_event_file_delete", { p_id: id });
  if (error) return false;
  if (data) await supabase.storage.from("meeting-files").remove([data as string]);
  return true;
}

// 상세: 안건 아래 자료 목록 — 누르면 새 창에서 바로 보기(PDF·이미지) 또는 내려받기
export function MeetingFilesView({ files, supabase }: { files: MeetingFile[]; supabase: Supa }) {
  const [opening, setOpening] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!files.length) return null;
  const open = async (f: MeetingFile) => {
    setErr(null);
    // 팝업 차단을 피하려고 창을 먼저 연 뒤 주소를 넣는다
    const w = window.open("", "_blank");
    setOpening(f.id);
    const viewable = /^(application\/pdf|image\/|text\/plain)/.test(f.mime ?? "");
    const { data, error } = await supabase.storage.from("meeting-files").createSignedUrl(f.path, 300, viewable ? undefined : { download: f.name });
    setOpening(null);
    if (error || !data) {
      w?.close();
      return setErr("자료를 열지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
    if (w) w.location.href = data.signedUrl;
    else window.location.assign(data.signedUrl);
  };
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-sm font-semibold">
        <Paperclip className="size-4 text-zinc-500" />
        회의 자료 {files.length}
      </p>
      <ul className="flex flex-col gap-1" aria-label="회의 자료">
        {files.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => void open(f)} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-zinc-200 px-3 text-left text-sm hover:bg-zinc-50">
              <FileText className="size-4 shrink-0 text-brand-600" />
              <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">{sizeLabel(f.size)}</span>
              {opening === f.id && <Loader2 className="size-4 shrink-0 animate-spin text-zinc-400" />}
            </button>
          </li>
        ))}
      </ul>
      {err && <p className="mt-1 text-sm text-red-700">{err}</p>}
    </div>
  );
}

// 편집: 이미 올린 자료(× = 저장할 때 지움) + 새로 고른 파일(저장할 때 올림)
export function MeetingFilesEdit({
  existing,
  removed,
  pending,
  onRemoveExisting,
  onAdd,
  onRemovePending,
}: {
  existing: MeetingFile[];
  removed: string[];
  pending: File[];
  onRemoveExisting: (id: string) => void;
  onAdd: (files: File[], problems: string[]) => void;
  onRemovePending: (i: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const kept = existing.filter((f) => !removed.includes(f.id));
  const left = MEETING_FILE_MAX - kept.length - pending.length;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">
        회의 자료 <span className="font-normal text-zinc-500">(선택 · {MEETING_FILE_MAX}개, 파일마다 20MB까지)</span>
      </span>
      {(kept.length > 0 || pending.length > 0) && (
        <ul className="flex flex-col gap-1" aria-label="올릴 회의 자료">
          {kept.map((f) => (
            <li key={f.id} className="flex min-h-10 items-center gap-2 rounded-xl border border-zinc-200 pl-3 text-sm">
              <FileText className="size-4 shrink-0 text-brand-600" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">{sizeLabel(f.size)}</span>
              <button type="button" onClick={() => onRemoveExisting(f.id)} aria-label={`${f.name} 빼기`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100">
                <X className="size-4" />
              </button>
            </li>
          ))}
          {pending.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex min-h-10 items-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 pl-3 text-sm">
              <FileText className="size-4 shrink-0 text-brand-600" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-brand-700">저장하면 올라가요</span>
              <button type="button" onClick={() => onRemovePending(i)} aria-label={`${f.name} 빼기`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        aria-label="회의 자료 고르기"
        onChange={(e) => {
          const list = [...(e.target.files ?? [])];
          e.target.value = "";
          const problems = list.map(meetingFileProblem).filter((x): x is string => !!x);
          const ok = list.filter((f) => !meetingFileProblem(f));
          if (ok.length > left) problems.push(`회의 자료는 ${MEETING_FILE_MAX}개까지예요.`);
          onAdd(ok.slice(0, Math.max(0, left)), problems);
        }}
      />
      {left > 0 && (
        <button type="button" onClick={() => input.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-xl border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50">
          <Paperclip className="size-4" />
          파일 첨부
        </button>
      )}
      <p className="text-xs text-zinc-500">PDF·워드·엑셀·파워포인트·한글·이미지·txt·zip. 회사 저장 공간에 함께 들어가고, 회의를 지우면 자료도 지워져요.</p>
    </div>
  );
}
