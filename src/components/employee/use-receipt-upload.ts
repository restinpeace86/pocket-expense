"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { deleteItemAction, finishReceiptUploadAction, startReceiptUploadAction } from "@/app/workspace/[id]/employee/claims/actions";
import { runPool } from "@/lib/concurrency";
import { recordPerf } from "@/lib/perf/client";
import { processReceiptFile } from "@/lib/receipts/image";
import { createClient } from "@/lib/supabase/client";

// 영수증 여러 장 올리기 (performance.md §1·§6, D-073):
// 브라우저에서 2000px 보관본·320px 썸네일 만들기 → 항목 만들기(경로는 서버가 정함) → 저장소에 바로 올리기 → 크레딧 차감 + AI 인식
// 한 번에 최대 10장, 소명서당 최대 30장, 동시에 3장씩. 인터넷 끊김 같은 일시적 실패는 단계마다 1회 자동 재시도하고,
// 크레딧 부족·장수 초과처럼 이유가 분명한 실패는 바로 알린다.
export const MAX_PER_PICK = 10;
export const MAX_PER_CLAIM = 30;

export type UploadRow = { key: string; name: string; phase: "preparing" | "uploading" | "reading" | "failed"; error?: string; itemId?: string };

export const BONUS_TOAST = "회사 무료 영수증 100장을 모두 사용했습니다. 현재 이벤트 기간이라 추가 100장을 무료로 더 드립니다.";
const NETWORK_ERROR = "올리지 못했어요. 인터넷 연결을 확인하고 다시 골라 주세요.";

class StepError extends Error {}

async function twice<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

export function useReceiptUpload(claimId: string, currentCount: number) {
  const router = useRouter();
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const active = rows.filter((r) => r.phase !== "failed").length;
  const remaining = Math.max(MAX_PER_CLAIM - currentCount - active, 0);

  const upload = useCallback(
    async (fileList: FileList | File[]) => {
      let files = Array.from(fileList);
      const notes: string[] = [];
      if (files.length > MAX_PER_PICK) {
        notes.push(`한 번에 ${MAX_PER_PICK}장까지 올릴 수 있어요. 앞의 ${MAX_PER_PICK}장만 올리고, 나머지는 한 번 더 골라 주세요.`);
        files = files.slice(0, MAX_PER_PICK);
      }
      if (files.length > remaining) {
        notes.push(`소명서 한 건에는 영수증을 ${MAX_PER_CLAIM}장까지 담을 수 있어요. ${remaining}장만 올립니다.`);
        files = files.slice(0, remaining);
      }
      setNotice(notes.join(" ") || null);
      if (files.length === 0) return;

      const stamp = Date.now();
      const keys = files.map((_, i) => `${stamp}-${i}`);
      setRows((prev) => [...prev, ...files.map((f, i) => ({ key: keys[i], name: f.name, phase: "preparing" as const }))]);
      const set = (key: string, patch: Partial<UploadRow>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
      const bucket = createClient().storage.from("receipts");
      let bonus = false;

      await runPool(
        files,
        3,
        async (file, i) => {
          const key = keys[i];
          const t0 = performance.now();
          const processed = await processReceiptFile(file).catch(() => {
            throw new StepError("올릴 수 없는 파일이에요. 사진 또는 PDF를 골라 주세요.");
          });
          set(key, { phase: "uploading" });
          const start = await twice(() =>
            startReceiptUploadAction(claimId, { isPdf: processed.kind === "pdf", thumbExt: processed.kind === "image" ? processed.thumbExt : "webp" }),
          );
          if (!start.ok) throw new StepError(start.error);
          set(key, { itemId: start.itemId });
          try {
            await twice(async () => {
              const up = await bucket.upload(start.receiptPath, processed.original, {
                contentType: processed.kind === "pdf" ? "application/pdf" : "image/jpeg",
                upsert: true,
              });
              if (up.error) throw up.error;
            });
            if (processed.kind === "image" && start.thumbPath) {
              const thumbPath = start.thumbPath;
              // 썸네일이 없어도 목록에서 아이콘으로 대신하므로 실패해도 진행한다
              await twice(async () => {
                const up = await bucket.upload(thumbPath, processed.thumb, { contentType: processed.thumbExt === "webp" ? "image/webp" : "image/jpeg", upsert: true });
                if (up.error) throw up.error;
              }).catch(() => undefined);
            }
          } catch {
            await deleteItemAction(start.itemId).catch(() => undefined); // 빈 항목이 남지 않게
            throw new StepError(NETWORK_ERROR);
          }
          set(key, { phase: "reading" });
          // 크레딧 차감은 항목당 한 번만 되므로(credit_charged) 다시 시도해도 두 번 빠지지 않는다
          const done = await twice(() => finishReceiptUploadAction(start.itemId)).catch(() => null);
          if (done && !done.ok) throw new StepError(done.error);
          if (done?.bonusGranted) bonus = true;
          recordPerf("ACTION", performance.now() - t0, { action: "employee.receipt_upload_one" });
          return done?.parsed ?? false;
        },
        {
          onSettled: (i, result) => {
            if (result.ok) {
              setRows((prev) => prev.filter((r) => r.key !== keys[i]));
            } else {
              const e = result.error;
              set(keys[i], { phase: "failed", error: e instanceof StepError ? e.message : NETWORK_ERROR });
            }
            router.refresh();
          },
        },
      );
      if (bonus) setNotice(BONUS_TOAST);
    },
    [claimId, remaining, router],
  );

  const dismiss = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  return { rows, notice, setNotice, upload, remaining, dismiss };
}
