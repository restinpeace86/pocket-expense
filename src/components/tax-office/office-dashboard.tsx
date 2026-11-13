"use client";

import { Check, FolderArchive, Loader2, Megaphone, MessageSquarePlus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { bulkTaxRequestAction, sendOfficeNoticeAction, setClientCheckAction } from "@/app/tax-office/bulk-actions";
import { AssignSelect } from "@/components/tax-office/assign-select";
import { ReleaseClientButton } from "@/components/tax-office/office-actions";
import { addOfficeCompany, BULK_ZIP_MAX, bulkZipName } from "@/lib/tax/office-bulk-zip";
import { saveBlob, ZipSink } from "@/lib/tax/zip-client";
import { FILTER_LABEL, matchFilter, REQUEST_PRESETS, rowTone, sortRows, todoItems, type ClientRow, type Filter, type Sort, type Tone } from "@/lib/tax-office/dashboard";

const TONE_PILL: Record<Tone, string> = { done: "bg-emerald-50 text-emerald-700", wait: "bg-amber-50 text-amber-800", alert: "bg-red-50 text-red-700" };
const TONE_DOT: Record<Tone, string> = { done: "bg-emerald-500", wait: "bg-amber-500", alert: "bg-rose-600" };
const md = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }) : "–");

function statusLabel(r: ClientRow, mLabel: string): string {
  const s = r.status;
  if (s && s.unread > 0 && !s.closed) return "새 확인 요청";
  if (s?.closed) return `마감 완료 ${md(s.closed_at)}`;
  return `${mLabel} 마감 전`;
}

// 세무사무소 고객사 현황판(D-268): 표(PC)·카드(휴대폰) · 색 상태 · 필터·정렬 · 여러 곳 골라 ZIP·자료 요청·공지 · 사무소 확인
export function OfficeDashboard({ rows, month, isAdmin, staff }: { rows: ClientRow[]; month: string; isAdmin: boolean; staff: { id: string; name: string }[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("todo");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<"request" | "notice" | null>(null);
  const [zip, setZip] = useState<{ step: string; i: number; n: number; name: string } | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const mLabel = `${Number(month.slice(5))}월`;

  const shown = useMemo(() => sortRows(rows.filter((r) => matchFilter(r, filter)), sort), [rows, filter, sort]);
  const counts = useMemo(() => Object.fromEntries((Object.keys(FILTER_LABEL) as Filter[]).map((f) => [f, rows.filter((r) => matchFilter(r, f)).length])) as Record<Filter, number>, [rows]);
  const pickedRows = rows.filter((r) => picked.has(r.company_id));
  const toggle = (id: string) => setPicked((p) => (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set([...p, id])));
  const allShown = shown.length > 0 && shown.every((r) => picked.has(r.company_id));

  const downloadZip = async () => {
    if (pickedRows.length > BULK_ZIP_MAX) return setNote({ ok: false, text: `한 번에 ${BULK_ZIP_MAX}곳까지 받을 수 있어요. 나눠서 받아 주세요.` });
    setNote(null);
    const sink = new ZipSink();
    const bad: string[] = [];
    let missed = 0;
    try {
      for (const [i, r] of pickedRows.entries()) {
        setZip({ step: "장부 만드는 중", i: i + 1, n: pickedRows.length, name: r.company_name });
        const res = await addOfficeCompany({
          companyId: r.company_id,
          companyName: r.company_name,
          month,
          closed: !!r.status?.closed,
          sink,
          onStep: (step, done, total) => setZip({ step: total ? `${step} ${done}/${total}` : step, i: i + 1, n: pickedRows.length, name: r.company_name }),
        });
        if (!res.ok) bad.push(r.company_name);
        missed += res.failed;
      }
      setZip({ step: "ZIP 저장 중", i: pickedRows.length, n: pickedRows.length, name: "" });
      const parts = await sink.finish();
      const base = bulkZipName(month).replace(/\.zip$/, "");
      parts.forEach((b, i) => saveBlob(b, `${base}${parts.length > 1 ? `_${i + 1}` : ""}.zip`));
      setNote(
        bad.length || missed
          ? { ok: false, text: `저장했어요. ${bad.length ? `${bad.join(", ")}은(는) 받지 못했어요. ` : ""}${missed ? `영수증 ${missed}장을 받지 못했어요 — 그 고객사 화면에서 다시 받아 주세요.` : ""}` }
          : { ok: true, text: `${pickedRows.length}곳을 한 ZIP으로 저장했어요(고객사/${month}/ 폴더).` },
      );
    } catch {
      setNote({ ok: false, text: "ZIP을 만들지 못했어요. 잠시 뒤 다시 해 주세요." });
    } finally {
      setZip(null);
    }
  };

  const chip = (on: boolean) => `inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-sm ${on ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`;
  return (
    <div className="flex flex-col gap-3" data-office-dashboard>
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={chip(filter === f)} aria-pressed={filter === f} data-office-filter={f}>
            {FILTER_LABEL[f]} <span className="tabular-nums">{counts[f]}</span>
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-sm text-zinc-600">
          정렬
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm" data-office-sort>
            <option value="todo">할 일 많은 순</option>
            <option value="name">이름순</option>
            <option value="upload">최근 올린 순</option>
          </select>
        </label>
      </div>

      {picked.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white shadow-lg" data-office-selbar>
          <b>{picked.size}곳 선택</b>
          <button type="button" disabled={!!zip} onClick={() => void downloadZip()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-3 font-semibold hover:bg-brand-400 disabled:opacity-60" data-office-zip>
            {zip ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FolderArchive className="size-4" aria-hidden />}
            {zip ? `${zip.i}/${zip.n}곳 · ${zip.name} ${zip.step}` : "선택한 곳 ZIP 받기"}
          </button>
          <button type="button" disabled={!!zip} onClick={() => setDialog("request")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 hover:bg-white/20" data-office-bulk-request>
            <MessageSquarePlus className="size-4" aria-hidden /> 자료 요청
          </button>
          <button type="button" disabled={!!zip} onClick={() => setDialog("notice")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 hover:bg-white/20" data-office-bulk-notice>
            <Megaphone className="size-4" aria-hidden /> 공지 보내기
          </button>
          <button type="button" onClick={() => setPicked(new Set())} className="ml-auto min-h-9 px-2 text-white/70 hover:text-white">
            선택 해제
          </button>
        </div>
      )}
      {note && (
        <p role={note.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${note.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {note.text}
        </p>
      )}

      {/* PC: 표 */}
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
        <table className="w-full min-w-[760px] text-sm" aria-label={`${mLabel}분 고객사 현황`}>
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={allShown} onChange={() => setPicked(allShown ? new Set() : new Set(shown.map((r) => r.company_id)))} aria-label="보이는 고객사 모두 고르기" className="size-4 accent-brand-600" />
              </th>
              <th className="px-2 py-2.5 font-semibold">고객사</th>
              <th className="px-2 py-2.5 font-semibold">{mLabel} 상태</th>
              <th className="px-2 py-2.5 font-semibold">확인할 것</th>
              <th className="px-2 py-2.5 font-semibold">마지막 올림</th>
              <th className="px-2 py-2.5 font-semibold">담당</th>
              <th className="px-2 py-2.5 font-semibold">사무소 확인</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const tone = rowTone(r.status);
              const todo = todoItems(r.status);
              return (
                <tr key={r.company_id} className="border-b border-zinc-100 align-top last:border-b-0" data-office-row={r.company_name} data-tone={tone}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={picked.has(r.company_id)} onChange={() => toggle(r.company_id)} aria-label={`${r.company_name} 고르기`} className="size-4 accent-brand-600" />
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/tax-office/${r.company_id}?month=${month}`} className="font-semibold text-zinc-900 hover:text-brand-700 hover:underline">
                      {r.company_name}
                    </Link>
                  </td>
                  <td className="px-2 py-3">
                    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_PILL[tone]}`}>
                      <i className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
                      {statusLabel(r, mLabel)}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-xs text-zinc-700">{todo.length ? todo.join(" · ") : <span className="text-zinc-400">–</span>}</td>
                  <td className="px-2 py-3 tabular-nums text-zinc-700">{md(r.status?.last_upload_at)}</td>
                  <td className="px-2 py-3">
                    {isAdmin ? (
                      <div className="flex min-w-36 flex-col gap-1">
                        <AssignSelect companyId={r.company_id} companyName={r.company_name} value={r.assigned_member_id} staff={staff} />
                        <ReleaseClientButton companyId={r.company_id} companyName={r.company_name} />
                      </div>
                    ) : (
                      <span className="text-zinc-700">{r.assigned_name ?? "–"}</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <CheckButton companyId={r.company_id} month={month} at={r.status?.office_checked_at ?? null} by={r.status?.office_checked_by ?? null} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-4 py-8 text-center text-sm text-zinc-500">이 조건에 맞는 고객사가 없어요.</p>}
      </div>

      {/* 휴대폰: 카드 */}
      <ul className="flex flex-col gap-2 md:hidden">
        {shown.map((r) => {
          const tone = rowTone(r.status);
          const todo = todoItems(r.status);
          return (
            <li key={r.company_id} className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3" data-office-card={r.company_name}>
              <input type="checkbox" checked={picked.has(r.company_id)} onChange={() => toggle(r.company_id)} aria-label={`${r.company_name} 고르기`} className="mt-1 size-5 shrink-0 accent-brand-600" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Link href={`/tax-office/${r.company_id}?month=${month}`} className="truncate font-semibold text-zinc-900">
                  {r.company_name}
                </Link>
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_PILL[tone]}`}>
                  <i className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
                  {statusLabel(r, mLabel)}
                </span>
                {todo.length > 0 && <p className="break-keep text-xs text-zinc-700">{todo.join(" · ")}</p>}
                <p className="text-xs text-zinc-500">
                  마지막 올림 {md(r.status?.last_upload_at)} · 담당 {r.assigned_name ?? "–"}
                </p>
                <CheckButton companyId={r.company_id} month={month} at={r.status?.office_checked_at ?? null} by={r.status?.office_checked_by ?? null} />
              </div>
            </li>
          );
        })}
      </ul>

      {dialog && (
        <BulkDialog
          kind={dialog}
          rows={pickedRows}
          month={month}
          busy={busy}
          onClose={() => setDialog(null)}
          onSend={(body, m) =>
            start(async () => {
              const ids = pickedRows.map((r) => r.company_id);
              const r = dialog === "request" ? await bulkTaxRequestAction(ids, m, body) : await sendOfficeNoticeAction(ids, body);
              if (!r.ok) return setNote({ ok: false, text: r.error });
              setDialog(null);
              setNote({ ok: true, text: dialog === "request" ? `${r.count}곳에 자료 요청을 보냈어요. 고객사 [세무 알림]방과 앱 알림으로 가요.` : `${r.count}곳에 공지를 보냈어요. 고객사 대표·관리자의 [세무 알림]방으로 가요.` });
            })
          }
        />
      )}
    </div>
  );
}

function CheckButton({ companyId, month, at, by }: { companyId: string; month: string; at: string | null; by: string | null }) {
  const [busy, start] = useTransition();
  const on = !!at;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => start(async () => void (await setClientCheckAction(companyId, month, !on)))}
      title={on ? `${by ?? ""} ${md(at)} 확인 — 누르면 취소` : "이 달 자료를 다 봤으면 눌러 주세요(고객사에는 안 보여요)"}
      className={`inline-flex min-h-9 w-fit items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold disabled:opacity-60 ${on ? "bg-brand-50 text-brand-700" : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
      data-office-check={on ? "on" : "off"}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
      {on ? `확인 ${md(at)}` : "확인"}
    </button>
  );
}

function BulkDialog({ kind, rows, month, busy, onClose, onSend }: { kind: "request" | "notice"; rows: ClientRow[]; month: string; busy: boolean; onClose: () => void; onSend: (body: string, month: string) => void }) {
  const [body, setBody] = useState("");
  const [m, setM] = useState(month);
  const title = kind === "request" ? "자료 요청 보내기" : "공지 보내기";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="bulk-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-lg flex-col gap-3 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl" data-office-dialog={kind}>
        <div className="flex items-center">
          <h2 id="bulk-title" className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <p className="text-sm text-zinc-600">받을 곳 {rows.length}곳</p>
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
          {rows.map((r) => (
            <span key={r.company_id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">
              {r.company_name}
            </span>
          ))}
        </div>
        {kind === "request" && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-zinc-700">어느 달 자료</span>
              <input type="month" value={m} onChange={(e) => setM(e.target.value)} className="min-h-10 rounded-lg border border-zinc-300 px-2" data-office-month />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {REQUEST_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setBody(p)} className="min-h-9 rounded-full border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50">
                  {p}
                </button>
              ))}
            </div>
          </>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={kind === "request" ? 500 : 1000}
          rows={4}
          placeholder={kind === "request" ? "예: 10월 영수증 중 증빙이 없는 지출이 있어요. 영수증 사진을 올려 주세요." : "예: 부가세 신고 자료는 1월 20일까지 올려 주세요."}
          aria-label={kind === "request" ? "요청 내용" : "공지 내용"}
          className="w-full rounded-xl border border-zinc-300 p-3 text-base md:text-sm"
          data-office-body
        />
        <p className="text-xs text-zinc-500">
          {kind === "request" ? "고객사마다 따로 요청이 하나씩 만들어지고, 답도 고객사별로 와요. 알림톡은 보내지 않아요(앱 알림 + 세무 알림방)." : "고객사 대표·관리자의 [세무 알림]방으로 가요. 답장은 받을 수 없어요."}
        </p>
        <button type="button" disabled={busy || !body.trim() || (kind === "request" && !m)} onClick={() => onSend(body.trim(), m)} className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-50" data-office-send>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {rows.length}곳에 보내기
        </button>
      </section>
    </div>
  );
}
