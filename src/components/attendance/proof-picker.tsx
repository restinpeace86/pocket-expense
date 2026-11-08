"use client";

import { FileText, ImageIcon, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { addLeaveFileAction } from "@/app/workspace/[id]/employee/vacation/actions";
import { processProof, type ProcessedProof } from "@/lib/attendance/proof-image";
import { fileSizeLabel, PROOF_MAX_FILES, proofPath } from "@/lib/attendance/vacation";
import { createClient } from "@/lib/supabase/client";

// 휴가 증빙 고르기(D-241): 사진은 줄여서, PDF는 그대로. 민감정보 동의 체크가 있어야 올라간다
export function ProofPicker({
  files,
  onChange,
  consent,
  onConsent,
  max = PROOF_MAX_FILES,
  required,
}: {
  files: ProcessedProof[];
  onChange: (f: ProcessedProof[]) => void;
  consent: boolean;
  onConsent: (v: boolean) => void;
  max?: number;
  required: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    const out = [...files];
    for (const f of Array.from(list)) {
      if (out.length >= max) {
        setError(`증빙은 ${max}개까지 올릴 수 있어요.`);
        break;
      }
      try {
        out.push(await processProof(f));
      } catch (e) {
        setError(e instanceof Error ? e.message : "파일을 읽을 수 없어요.");
      }
    }
    onChange(out);
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  return (
    <div className="flex flex-col gap-2" data-proof-picker>
      <span className="text-sm font-semibold">
        증빙 {required ? <span className="text-red-700">(필수)</span> : <span className="font-normal text-zinc-500">(선택)</span>}
      </span>
      <span className="text-xs leading-relaxed text-zinc-600">사진이나 PDF로 올려요. 사진은 자동으로 작게 줄여 저장해요(위치정보도 지워져요).</span>
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <span key={i} className="flex h-16 min-w-0 max-w-full items-center gap-2 rounded-xl border border-zinc-300 bg-white pl-2.5 pr-1 text-[13px]">
            {f.mime === "application/pdf" ? <FileText className="size-5 shrink-0 text-zinc-500" aria-hidden /> : <ImageIcon className="size-5 shrink-0 text-zinc-500" aria-hidden />}
            <span className="min-w-0">
              <span className="block max-w-44 truncate">{f.name}</span>
              <span className="block text-xs text-zinc-500">{f.before !== f.after ? `${fileSizeLabel(f.before)} → ${fileSizeLabel(f.after)}` : fileSizeLabel(f.after)}</span>
            </span>
            <button type="button" aria-label={`${f.name} 빼기`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100">
              <X className="size-4" />
            </button>
          </span>
        ))}
        {files.length < max && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-zinc-400 text-2xl text-zinc-500 hover:bg-zinc-50" aria-label="증빙 파일 고르기">
            {busy ? <Loader2 className="size-5 animate-spin" /> : "+"}
          </button>
        )}
        <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => void pick(e.target.files)} data-proof-input />
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-[13px] leading-relaxed">
          <input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand-600" data-proof-consent />
          <span>
            <b>[필수] 민감정보 수집·이용 동의</b>
            <br />
            진단서 등에 담긴 건강·가족 정보를 휴가 확인에만 써요. 나와 회사 관리자만 볼 수 있고, <b>휴가가 끝난 날로부터 3년 뒤 자동으로 지워져요</b>(근로기준법 제42조 서류 보존 기간).
          </span>
        </label>
      )}
    </div>
  );
}

// 신청을 만든 뒤 증빙 올리기(저장소 → 등록). 실패한 파일 이름을 돌려준다
export async function uploadProofs(companyId: string, memberId: string, leaveId: string, files: ProcessedProof[], consent: boolean): Promise<string[]> {
  const supabase = createClient();
  const failed: string[] = [];
  for (const f of files) {
    const path = proofPath(companyId, memberId, leaveId, f.ext);
    const up = await supabase.storage.from("leave-proofs").upload(path, f.blob, { contentType: f.mime, upsert: false });
    if (up.error) {
      failed.push(f.name);
      continue;
    }
    const r = await addLeaveFileAction(leaveId, path, f.name, f.mime, f.after, consent);
    if (!r.ok) failed.push(f.name);
  }
  return failed;
}

// 증빙 열기(본인·관리자만 — 저장소 정책이 확인)
export async function openProof(path: string) {
  const w = window.open("", "_blank");
  const { data } = await createClient().storage.from("leave-proofs").createSignedUrl(path, 300);
  if (data?.signedUrl && w) w.location.href = data.signedUrl;
  else w?.close();
}
