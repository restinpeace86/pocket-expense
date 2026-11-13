"use client";

import { Clock, FileStack, Monitor, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteFormAction, editFormAction } from "@/app/workspace/[id]/admin/company-forms/actions";
import { inputCount, KIND_LABEL, type Field, type FormKind } from "@/lib/company-forms/model";
import { draftDaysLeft, type DocModel } from "@/lib/doc-convert/model";
import { AddFormDialog, type AddFormSource } from "./add-form-dialog";
import { SheetView } from "./sheet-view";

export type ActiveForm = { id: string; group_id: string; name: string; kind: FormKind; version: number; fields: Field[]; sheets: DocModel; published_at: string; created_by_name: string | null };
export type DraftForm = { id: string; group_id: string; name: string; kind: FormKind | null; read: boolean; source_name: string | null; updated_at: string; created_by_name: string | null; replaces: string | null };

const dateLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(iso));

function usePc() {
  const [pc, setPc] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setPc(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return pc;
}

// B④ 관리자 설정 › [회사 양식]: 칸 사용·등록된 양식·등록 대기. 등록·고치기는 PC에서만(휴대폰은 보기)
export function CompanyFormsView({
  ws,
  companyId,
  me,
  limit,
  used,
  forms,
  drafts,
}: {
  ws: string;
  companyId: string;
  me: string;
  limit: number;
  used: number;
  forms: ActiveForm[];
  drafts: DraftForm[];
}) {
  const router = useRouter();
  const pc = usePc();
  const [adding, setAdding] = useState<{ source: AddFormSource; group?: { id: string; name: string; kind: FormKind } } | null>(null);
  const [preview, setPreview] = useState<ActiveForm | null>(null);
  const [pcNotice, setPcNotice] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const needPc = (fn: () => void) => (pc ? fn() : setPcNotice(true));

  const edit = async (f: ActiveForm) => {
    setBusy(f.id);
    const r = await editFormAction(f.group_id);
    setBusy(null);
    if (r.ok) router.push(`${ws}/admin/company-forms/${r.id}`);
    else setNotice(r.error);
  };
  const remove = async (id: string, msg: string) => {
    if (!window.confirm(msg)) return;
    setBusy(id);
    const r = await deleteFormAction(id);
    setBusy(null);
    setNotice(r.ok ? "지웠어요." : r.error);
  };
  const link = "text-[13px] font-medium text-brand-700 hover:underline disabled:opacity-50";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 basis-full break-keep text-sm text-zinc-600 md:basis-auto md:flex-1">
          사진 한 장으로 등록하고, PC에서 칸마다 채울 내용을 정해요. <b className="text-zinc-800">등록은 크레딧이 들지 않아요.</b>
        </p>
        <button type="button" onClick={() => needPc(() => setAdding({ source: { type: "pick" } }))} className="flex h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700" data-add-form-open>
          <Plus className="size-4" aria-hidden /> 양식 추가
        </button>
      </div>

      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5" aria-label="양식 칸" data-slot-bar>
        <p className="text-sm">
          <b>
            양식 칸 {used} / {limit}장
          </b>{" "}
          사용 중
        </p>
        <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-zinc-200" aria-hidden>
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
        </div>
        {/* D-271: 양식 추가 1장 2만 원 폐기 — 더 필요하면 상위 플랜(비즈니스 무제한) */}
        <p className="text-[13px] text-zinc-600">{limit >= 1000 ? "AI 양식 변환 무제한 플랜이에요" : "더 필요하면 비즈니스 플랜(무제한)으로 바꿀 수 있어요"}</p>
      </section>

      {forms.length === 0 && drafts.length === 0 && (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-600" data-forms-empty>
          아직 등록한 회사 양식이 없어요. [양식 추가]로 회사에서 쓰던 서류 사진을 올려 보세요.
        </p>
      )}

      {forms.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="등록된 양식">
          {forms.map((f) => {
            const inputs = f.fields.filter((x) => x.b.k === "input");
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5" data-form-row={f.name}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500">
                  <FileStack className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">{f.name}</b>
                  <span className="block truncate text-[13px] text-zinc-600">
                    {KIND_LABEL[f.kind]} · 직원 입력 칸 {inputCount(f.fields)}개{inputs.length ? `(${inputs.map((x) => x.label).join("·")})` : ""}
                  </span>
                  <span className="block text-[12px] text-zinc-500">
                    v{f.version} · {dateLabel(f.published_at)} {f.created_by_name ?? ""}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${f.kind === "leave" ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"}`}>
                  {f.kind === "leave" ? "등록됨" : "2단계 준비 중"}
                </span>
                <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 md:w-auto">
                  <button type="button" onClick={() => setPreview(f)} className={link} data-form-preview>
                    미리보기
                  </button>
                  <span className="hidden text-zinc-300 md:inline">·</span>
                  <button type="button" onClick={() => needPc(() => void edit(f))} disabled={busy === f.id} className={link} data-form-edit>
                    고치기
                  </button>
                  <span className="hidden text-zinc-300 md:inline">·</span>
                  <button type="button" onClick={() => needPc(() => setAdding({ source: { type: "pick" }, group: { id: f.group_id, name: f.name, kind: f.kind } }))} className={link} data-form-reupload>
                    새 버전 올리기(무료)
                  </button>
                  <span className="hidden text-zinc-300 md:inline">·</span>
                  <button
                    type="button"
                    onClick={() => void remove(f.id, `'${f.name}' 양식을 지울까요? 칸이 비어 다른 양식을 등록할 수 있어요. 이미 낸 문서는 그때 모양으로 계속 볼 수 있어요.`)}
                    disabled={busy === f.id}
                    className="text-[13px] font-medium text-red-700 hover:underline disabled:opacity-50"
                    data-form-delete
                  >
                    지우기
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {forms.length < limit && (
        <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-4 text-[14px] text-zinc-600">빈 칸 {limit - forms.length}장 — [양식 추가]로 등록할 수 있어요</p>
      )}

      {drafts.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="등록 대기">
          <h2 className="flex items-center gap-1.5 text-[15px] font-bold">
            <Clock className="size-4" aria-hidden /> 등록 대기
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0" data-draft-row={d.name}>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{d.replaces ? `${d.replaces} · 새 버전` : d.name}</b>
                  <span className="block truncate text-[12.5px] text-zinc-600">
                    {d.read ? "칸 연결 중" : "휴대폰에서 담아 둔 파일"} · {d.source_name ?? ""} · {dateLabel(d.updated_at)} · {draftDaysLeft(d.updated_at)}일 뒤 삭제
                  </span>
                </span>
                {d.read ? (
                  <button type="button" onClick={() => needPc(() => router.push(`${ws}/admin/company-forms/${d.id}`))} className="h-9 rounded-lg bg-brand-600 px-3 text-[13px] font-bold text-white hover:bg-brand-700" data-draft-continue>
                    이어 하기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => needPc(() => setAdding({ source: { type: "held", id: d.id, name: d.source_name ?? d.name, group: d.replaces ? d.group_id : null } }))}
                    className="h-9 rounded-lg bg-brand-600 px-3 text-[13px] font-bold text-white hover:bg-brand-700"
                    data-draft-continue
                  >
                    이어 하기
                  </button>
                )}
                <button type="button" onClick={() => void remove(d.id, "등록 대기 중인 양식을 지울까요?")} disabled={busy === d.id} className="h-9 rounded-lg px-2 text-[13px] text-red-700 hover:bg-red-50" data-draft-delete>
                  지우기
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {adding && <AddFormDialog ws={ws} companyId={companyId} me={me} source={adding.source} group={adding.group ?? null} onClose={() => setAdding(null)} />}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={() => setPreview(null)}>
          <section role="dialog" aria-modal="true" aria-label={`${preview.name} 미리보기`} onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-3xl flex-col gap-3 rounded-t-3xl bg-white p-4 md:rounded-3xl" data-form-preview-dialog>
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 flex-1 truncate text-lg font-bold">
                {preview.name} <span className="text-sm font-normal text-zinc-500">v{preview.version}</span>
              </h2>
              <button type="button" onClick={() => setPreview(null)} aria-label="닫기" className="flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 p-2">
              {preview.sheets.sheets.map((sh, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <SheetView sheet={sh} fields={preview.fields} s={i} />
                </div>
              ))}
            </div>
            <p className="text-[12.5px] text-zinc-600">초록 칸은 신청 내용으로 채워져요. {"{ }"} = 우리 데이터, [직원 입력] = 신청할 때 직원이 적는 칸, (수기) = 출력 뒤 손으로 쓰는 칸.</p>
          </section>
        </div>
      )}

      {pcNotice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setPcNotice(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="pc-only-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5" data-pc-only>
            <Monitor className="size-8 text-brand-700" aria-hidden />
            <h2 id="pc-only-title" className="text-lg font-bold">
              양식 등록은 PC에서 해 주세요
            </h2>
            <p className="text-[14px] leading-relaxed text-zinc-700">칸을 하나하나 연결해야 해서 큰 화면이 필요해요. PC에서 [설정 › 양식·결재 › 회사 양식]을 열어 주세요. 휴대폰에서는 채팅의 사진·PDF를 길게 눌러 [회사 양식으로 등록] → 담아 둘 수 있어요.</p>
            <button type="button" onClick={() => setPcNotice(false)} className="h-12 rounded-xl bg-zinc-900 text-[15px] font-bold text-white">
              확인
            </button>
          </section>
        </div>
      )}
      {notice && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white shadow" data-notice>
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="닫기">
            <X className="size-4" />
          </button>
        </div>
      )}
      <p className="text-[12.5px] text-zinc-500">
        지출결의서 양식은 <Link href={`${ws}/admin/form-template`} className="text-brand-700 underline">설정 › 지출결의서 양식</Link>에서 따로 등록해요(칸 안 씀).
      </p>
    </div>
  );
}
