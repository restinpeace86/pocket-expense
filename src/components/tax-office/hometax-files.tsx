"use client";

import { Download, FileSpreadsheet, Table2, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { deleteHometaxAction, uploadHometaxAction } from "@/app/workspace/[id]/admin/export/hometax-actions";
import { thrownActionMessage } from "@/lib/action-guard";
import { formatDateTimeKst } from "@/lib/claims/format";
import { HOMETAX_KIND_LABEL, HOMETAX_KINDS, type HometaxKind, type HometaxUpload } from "@/lib/hometax/kinds";
import { inputClass } from "@/components/ui/page-shell";

const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

// 홈택스 자료 (D-158): 회사가 홈택스에서 내려받은 파일을 그 달 세무 자료에 올리면, 세무사무소가 앱에서 표로 보고 원본을 받는다.
// 회사 세무 마감 화면(editable: 올리기·지우기)과 세무사무소 세무 자료 화면(보기·받기) 공용
export function HometaxFiles({ uploads, month, downloadBase, editable = false }: { uploads: HometaxUpload[]; month: string; downloadBase: string; editable?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const [y, m] = month.split("-").map(Number);

  function upload(fd: FormData) {
    setMessage(null);
    start(async () => {
      try {
        const r = await uploadHometaxAction(fd);
        if (!r.ok) return setMessage({ kind: "error", text: r.error });
        form.current?.reset();
        setMessage({ kind: "ok", text: `올렸어요 (${r.rowCount.toLocaleString("ko-KR")}줄). 세무사무소도 바로 볼 수 있어요.` });
      } catch {
        setMessage({ kind: "error", text: thrownActionMessage() });
      }
    });
  }

  function remove(u: HometaxUpload) {
    if (!confirm(`‘${u.file_name}’을(를) 지울까요? 세무사무소 화면에서도 사라져요.`)) return;
    setMessage(null);
    start(async () => {
      try {
        const r = await deleteHometaxAction(u.id);
        setMessage(r.ok ? { kind: "ok", text: "지웠어요." } : { kind: "error", text: r.error });
      } catch {
        setMessage({ kind: "error", text: thrownActionMessage() });
      }
    });
  }

  return (
    <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5" aria-label="홈택스 자료">
      <h2 className="flex items-center gap-1.5 font-semibold">
        <FileSpreadsheet className="size-4 text-zinc-500" aria-hidden />
        홈택스 자료 · {y}년 {m}월
      </h2>
      <p className="mt-0.5 break-keep text-sm text-zinc-600">
        {editable
          ? "홈택스에서 이 달을 조회해 내려받은 엑셀·CSV(전자세금계산서·현금영수증·사업용 신용카드 매입 등)를 그대로 올려 두면, 세무사무소가 홈택스에 다시 들어가지 않고 여기서 보고 받아요. 세무 마감 ZIP에도 함께 들어가요."
          : "고객사가 홈택스에서 내려받아 올린 원본이에요. 표로 바로 보거나 원본을 받을 수 있고, 증빙 묶음(ZIP)에도 함께 들어가요."}
      </p>

      {editable && (
        <form ref={form} action={upload} className="mt-3 flex min-w-0 flex-col gap-2 rounded-lg bg-zinc-50 p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <input type="hidden" name="month" value={month} />
          <label className="flex min-w-0 flex-col gap-1 text-sm sm:w-52">
            <span className="font-medium text-zinc-700">자료 종류</span>
            <select name="kind" defaultValue="tax_invoice" className={inputClass}>
              {HOMETAX_KINDS.map((k) => (
                <option key={k} value={k}>
                  {HOMETAX_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm sm:flex-1">
            <span className="font-medium text-zinc-700">파일 (.xlsx · .xls · .csv, 10MB까지)</span>
            <input name="file" type="file" required accept=".xlsx,.xls,.csv" className="block w-full min-w-0 text-sm file:mr-2 file:min-h-10 file:rounded-lg file:border-0 file:bg-white file:px-3 file:font-medium file:text-zinc-800 file:ring-1 file:ring-zinc-300" />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm sm:w-full">
            <span className="font-medium text-zinc-700">메모 (선택)</span>
            <input name="memo" maxLength={200} className={inputClass} placeholder="예: 9월 매입분, 수정 반영본" />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Upload className="size-4" aria-hidden />
            {pending ? "올리는 중..." : "올리기"}
          </button>
        </form>
      )}
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`mt-2 break-keep text-sm ${message.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {message.text}
        </p>
      )}

      {uploads.length === 0 ? (
        <p className="mt-3 break-keep text-sm text-zinc-500">
          {editable ? "아직 올린 홈택스 자료가 없어요." : "고객사가 이 달 홈택스 자료를 아직 올리지 않았어요."}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
          {uploads.map((u) => (
            <li key={u.id} className="min-w-0 py-3">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{HOMETAX_KIND_LABEL[u.kind as HometaxKind]}</span>
                    <span className="min-w-0 break-all text-sm font-medium text-zinc-900">{u.file_name}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {u.row_count.toLocaleString("ko-KR")}줄 · {size(u.file_size)} · {u.uploaded_by_name ?? "관리자"} · {formatDateTimeKst(u.created_at)}
                  </p>
                  {u.memo && <p className="mt-1 break-keep text-sm text-zinc-700">{u.memo}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(open === u.id ? null : u.id)}
                    aria-expanded={open === u.id}
                    className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
                  >
                    <Table2 className="size-4" aria-hidden />
                    {open === u.id ? "표 닫기" : "표 보기"}
                  </button>
                  <a href={`${downloadBase}${u.id}`} className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg border border-brand-300 bg-white px-3 text-sm font-medium text-brand-800 hover:bg-brand-50">
                    <Download className="size-4" aria-hidden />
                    원본 받기
                  </a>
                  {editable && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(u)}
                      aria-label={`${u.file_name} 지우기`}
                      className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      지우기
                    </button>
                  )}
                </div>
              </div>
              {open === u.id && (
                <div className="mt-2 min-w-0">
                  <div className="max-h-96 overflow-auto rounded-lg border border-zinc-200">
                    <table className="min-w-full text-xs">
                      <thead className="sticky top-0 bg-zinc-50">
                        <tr>
                          {u.header.map((h, i) => (
                            <th key={i} className="whitespace-nowrap border-b border-zinc-200 px-2 py-1.5 text-left font-medium text-zinc-600">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {u.preview.map((r, i) => (
                          <tr key={i}>
                            {u.header.map((_, j) => (
                              <td key={j} className="whitespace-nowrap border-b border-zinc-100 px-2 py-1.5 text-zinc-800">
                                {r[j] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {u.row_count > u.preview.length ? `앞 ${u.preview.length}줄만 보여요. 전체는 [원본 받기]로 받아 주세요.` : `전체 ${u.row_count}줄`}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
