"use client";

import { AlertTriangle, Loader2, Plus, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { saveLeaveShortageAction as saveLeaveShortageActionRaw, saveLeaveTypeAction as saveLeaveTypeActionRaw, type LeaveTypeInput } from "@/app/workspace/[id]/admin/attendance-settings/vacation-types/actions";
import type { LeaveTypeRow, LeaveTypesAdmin } from "@/lib/attendance/server";
import { PAID_LABEL } from "@/lib/attendance/vacation";
import { guarded } from "@/lib/action-guard";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const saveLeaveShortageAction = guarded(saveLeaveShortageActionRaw);
const saveLeaveTypeAction = guarded(saveLeaveTypeActionRaw);

// 휴가 종류(D-241, spec/features/attendance.md §8-1·§8-6): 연차는 항상 켜짐, 나머지는 회사가 켜고 끈다.
// 앱은 막지 않는다 — 법정 휴가를 끌 때 "앱에서 신청만 못 할 뿐, 법상 의무는 그대로"를 확인 창으로 분명히 알린다
const card = "rounded-2xl border border-zinc-200 bg-white";
const PROOF_LABEL = { none: "받지 않음", optional: "선택", required: "필수" } as const;
const isLegal = (t: LeaveTypeRow) => !!t.builtin_key && t.builtin_key !== "family_event" && t.builtin_key !== "sick";

// 법정 휴가를 끌 때 알릴 말(조항 + 규모 안내)
function offNotice(t: LeaveTypeRow, underFive: boolean): string {
  const base = `${t.name}는(은) ${t.law_ref}로 정해진 휴가예요. 끄면 직원이 앱에서 신청할 수 없을 뿐, 법이 적용되는 회사라면 직원이 청구할 때 회사는 줘야 해요. 이미 승인된 기록은 그대로 남아요.`;
  if (t.builtin_key === "menstrual") return `${base}\n\n참고: 상시 5명 미만 회사는 생리휴가(근로기준법 제73조)가 적용되지 않는다고 안내되고 있어요${underFive ? " — 근무 기준에서 '5인 미만 회사'로 되어 있어요" : ""}.`;
  if (t.builtin_key === "public") return `${base}\n\n예비군·민방위 훈련 기간은 휴무로 처리하고 불리하게 대하면 안 돼요(예비군법 제10조·민방위기본법 제27조).`;
  return `${base}\n\n참고: 출산전후휴가와 남녀고용평등법 휴가(배우자 출산·난임치료·가족돌봄)는 회사 규모와 상관없이 적용된다고 안내되고 있어요. 정확한 적용은 고용노동부 1350에서 확인해 주세요.`;
}

export function VacationTypesAdmin({ data }: { data: LeaveTypesAdmin }) {
  const [editing, setEditing] = useState<LeaveTypeRow | "new" | null>(null);
  const [confirmOff, setConfirmOff] = useState<LeaveTypeRow | null>(null);
  const [busy, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = (t: LeaveTypeRow, patch: Partial<LeaveTypeInput>) =>
    start(async () => {
      setBusyId(t.id);
      setError(null);
      const r = await saveLeaveTypeAction({ id: t.id, name: t.name, deducts: t.deducts, paid: t.paid, allow_hours: t.allow_hours, proof: t.proof, enabled: t.enabled, ...patch });
      setBusyId(null);
      if (!r.ok) setError(r.error ?? null);
    });
  const toggle = (t: LeaveTypeRow) => {
    if (t.enabled && isLegal(t)) return setConfirmOff(t);
    save(t, { enabled: !t.enabled });
  };

  return (
    <div className="flex flex-col gap-4">
      <ShortageCard mode={data.shortage} />

      <section className={`${card} overflow-hidden`} aria-label="휴가 종류 목록">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3.5 md:px-5">
          <b className="text-[15px]">휴가 종류 {data.types.length}개</b>
          <span className="text-[13px] text-zinc-600">켜진 {data.types.filter((t) => t.enabled).length}개만 직원 앱에 보여요</span>
          <button type="button" onClick={() => setEditing("new")} className="ml-auto flex h-10 items-center gap-1 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700" data-add-type>
            <Plus className="size-4" aria-hidden /> 휴가 종류 추가
          </button>
        </div>
        {error && (
          <p role="alert" className="px-4 pb-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <ul className="border-t border-zinc-100">
          {data.types.map((t) => {
            const annual = t.builtin_key === "annual";
            return (
              <li key={t.id} data-type={t.builtin_key ?? t.name} data-enabled={t.enabled} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-zinc-100 px-4 py-3 last:border-b-0 md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_5.5rem_5rem_5rem_7.5rem_auto] md:gap-4 md:px-5 ${t.enabled ? "" : "bg-zinc-50"}`}>
                <span className="min-w-0">
                  <b className="text-[15px]">{t.name}</b>{" "}
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${isLegal(t) ? "bg-indigo-100 text-indigo-800" : t.builtin_key ? "bg-zinc-100 text-zinc-700" : "bg-teal-100 text-teal-800"}`}>{isLegal(t) ? "법정" : t.builtin_key ? "기본" : "회사 추가"}</span>
                </span>
                <span className="w-full text-xs text-brand-700 md:w-auto">{t.law_ref}</span>
                <span className="text-[13px]">{t.deducts ? <b>연차 차감</b> : "차감 없음"}</span>
                <span className="text-[13px]">{PAID_LABEL[t.paid]}</span>
                <span className="text-[13px]">증빙 {PROOF_LABEL[t.proof]}</span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={t.enabled}
                    aria-label={`${t.name} 사용`}
                    disabled={annual || (busy && busyId === t.id)}
                    onClick={() => toggle(t)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${annual ? "bg-brand-300" : t.enabled ? "bg-brand-600" : "bg-zinc-300"}`}
                  >
                    <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${t.enabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <span className="text-xs text-zinc-500">{annual ? "항상 켜짐" : t.enabled ? "켜짐" : "꺼짐"}</span>
                </span>
                {!annual ? (
                  <button type="button" onClick={() => setEditing(t)} className="ml-auto h-9 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 md:ml-0" data-edit-type>
                    수정
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="text-xs leading-relaxed text-zinc-600">반차는 따로 두지 않아요 — 시간차를 켜면 연차를 4시간(반차)·2시간(반반차)처럼 써요. 육아휴직처럼 몇 달씩 쉬는 휴직은 이번에는 다루지 않아요. 바꾼 내용은 근태 정책의 [변경 이력]에 남아요.</p>

      {confirmOff && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setConfirmOff(null)}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="off-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl" data-off-confirm>
            <h2 id="off-title" className="flex items-center gap-2 text-lg font-bold">
              <AlertTriangle className="size-5 text-amber-600" aria-hidden />
              {confirmOff.name}를(을) 끌까요?
            </h2>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-zinc-800">{offNotice(confirmOff, data.under_five)}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOff(null)} className="h-11 rounded-xl border border-zinc-300 px-4 text-sm">
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = confirmOff;
                  setConfirmOff(null);
                  save(t, { enabled: false });
                }}
                className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
                data-off-ok
              >
                알고 끄기
              </button>
            </div>
          </section>
        </div>
      )}
      {editing && <TypeSheet type={editing === "new" ? null : editing} hourly={data.hourly_leave} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ShortageCard({ mode }: { mode: "block" | "borrow" }) {
  const [m, setM] = useState(mode);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setM(mode);
  }
  const save = (next: "block" | "borrow") => {
    setM(next);
    start(async () => {
      const r = await saveLeaveShortageAction(next);
      setMsg(r.ok ? { ok: true, text: "저장했어요. 변경 이력에 남았어요." } : { ok: false, text: r.error ?? "저장하지 못했어요." });
    });
  };
  const opt = (k: "block" | "borrow", title: string, body: string) => (
    <button type="button" role="radio" aria-checked={m === k} disabled={busy} onClick={() => save(k)} className={`flex min-h-11 flex-1 flex-col items-start rounded-xl border px-3.5 py-2.5 text-left text-sm ${m === k ? "border-brand-600 bg-brand-50 font-semibold text-brand-900" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`}>
      {title}
      <span className="text-xs font-normal leading-relaxed text-zinc-600">{body}</span>
    </button>
  );
  return (
    <section className={`${card} flex flex-col gap-2.5 px-4 py-4 md:px-5`} aria-label="연차가 모자랄 때">
      <b className="text-[15px]">연차가 모자랄 때</b>
      <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="연차가 모자랄 때">
        {opt("block", "막기 (기본)", "남은 연차보다 많이 신청할 수 없어요.")}
        {opt("borrow", "당겨쓰기 허용", "남은 연차가 마이너스로 보이고, 다음 연차에서 빠지는 것으로 회사가 관리해요.")}
      </div>
      {m === "borrow" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-amber-950">당겨쓴 직원이 퇴사할 때 그만큼 급여에서 빼려면 직원 동의가 필요해요. 정산 방법은 노무사와 확인해 주세요.</p>}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-green-800" : "font-semibold text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}

function TypeSheet({ type, hourly, onClose }: { type: LeaveTypeRow | null; hourly: boolean; onClose: () => void }) {
  const [name, setName] = useState(type?.name ?? "");
  const [deducts, setDeducts] = useState(type?.deducts ?? false);
  const [paid, setPaid] = useState<LeaveTypeRow["paid"]>(type?.paid ?? "paid");
  const [hours, setHours] = useState(type?.allow_hours ?? false);
  const [proof, setProof] = useState<LeaveTypeRow["proof"]>(type?.proof ?? "none");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const save = () =>
    start(async () => {
      setError(null);
      if (!name.trim()) return setError("이름을 적어 주세요.");
      const r = await saveLeaveTypeAction({ id: type?.id, name: name.trim(), deducts, paid, allow_hours: hours, proof, enabled: type?.enabled ?? true });
      if (!r.ok) return setError(r.error ?? null);
      onClose();
    });
  const seg = <T extends string>(value: T, set: (v: T) => void, opts: [T, string][], disabled = false) => (
    <div className="flex flex-wrap gap-1.5">
      {opts.map(([k, label]) => (
        <button key={k} type="button" disabled={disabled} aria-pressed={value === k} onClick={() => set(k)} className={`h-10 rounded-full border px-3.5 text-[13px] disabled:opacity-50 ${value === k ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 bg-white text-zinc-700"}`}>
          {label}
        </button>
      ))}
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="type-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3.5 overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl">
        <div className="flex items-center">
          <h2 id="type-title" className="text-lg font-bold">
            {type ? `${type.name} 수정` : "휴가 종류 추가"}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        {type?.law_ref && <p className="text-[13px] text-brand-700">근거: {type.law_ref}</p>}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">이름</span>
          <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="예: 포상휴가" className="h-12 rounded-xl border border-zinc-300 px-3.5 text-[15px] outline-none focus:border-brand-600" aria-label="휴가 이름" />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">연차에서 빼기</span>
          {seg<"y" | "n">(deducts ? "y" : "n", (v) => setDeducts(v === "y"), [["n", "빼지 않음"], ["y", "연차에서 뺌"]])}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">급여(기록용)</span>
          {seg(paid, setPaid, [["paid", "유급"], ["unpaid", "무급"], ["partial", "일부 유급"]])}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">시간 단위로 쓰기</span>
          {seg<"y" | "n">(hours ? "y" : "n", (v) => setHours(v === "y"), [["n", "하루 단위만"], ["y", "시간 단위도 허용"]])}
          {deducts && hours && !hourly && <span className="text-xs text-zinc-600">연차에서 빼는 휴가를 시간으로 쓰려면 직원별 연차 화면에서 시간차를 켜 주세요.</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">증빙</span>
          {type?.proof_locked ? (
            <span className="text-[13px] text-zinc-700">
              {PROOF_LABEL[type.proof]} (고정){type.builtin_key === "menstrual" && " — 생리휴가 증빙 요구는 사생활 침해로 보는 판결이 있어요(대법원 2021도1500)"}
            </span>
          ) : (
            seg(proof, setProof, [["none", "받지 않음"], ["optional", "선택"], ["required", "필수"]])
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <button type="button" onClick={save} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-70" data-save-type>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          저장
        </button>
      </section>
    </div>
  );
}

// [휴가 종류는 이렇게 써요] — 처음 한 번 펼침, 법 안내 + 예시 그림(로고·서비스 이름 없음)
export function VacationTypesGuide() {
  return (
    <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-zinc-800">
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <b>사용</b>: 우리 회사에서 쓰는 휴가만 켜 두세요. 꺼진 휴가는 직원 앱에서 안 보여요. <b>연차는 항상 켜져 있어요.</b>
        </li>
        <li>
          <b>법정 휴가를 끄면</b>: 앱으로 신청만 못 할 뿐이에요. <b>법이 적용되는 회사라면 직원이 청구할 때 회사는 줘야 해요.</b> 5인 미만 회사는 생리휴가(근로기준법 제73조)·연차(제60조)가 적용되지 않는다고 안내되지만, 출산전후휴가와 남녀고용평등법 휴가(배우자 출산·난임치료·가족돌봄)는 규모와 상관없이 적용된다고 안내되고 있어요 — 고용노동부 <b>1350</b>에서 확인해 주세요.
        </li>
        <li>
          <b>연차 차감</b>: 켜면 남은 연차에서 빠져요. <b>유급/무급</b>은 기록용이에요(급여 계산은 하지 않아요).
        </li>
        <li>
          <b>증빙</b>: 연차·생리휴가는 받지 않아요(생리휴가 증빙 요구는 사생활 침해로 본 판결 — 대법원 2021도1500). 나머지 기본 휴가는 필수예요. 진단서처럼 나중에 나오는 서류는 신청 뒤에 올려도 되고, 올리기 전에는 승인할 수 없어요. 증빙은 <b>휴가가 끝난 날로부터 3년</b> 보관한 뒤 자동으로 지워져요(근로기준법 제42조).
        </li>
        <li>법정 휴가의 일수·유급 범위는 최근 법 개정이 잦아 앱에 고정하지 않았어요.</li>
      </ul>
      <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { img: "vacation-form.png", title: "직원이 휴가 신청", body: "근무일만 세고(주말·공휴일 제외) 남은 연차를 미리 보여 줘요." },
          { img: "vacation-proof.png", title: "증빙은 민감정보 동의 후", body: "사진은 자동으로 줄여 저장하고, 본인·관리자만 볼 수 있어요." },
        ].map((s) => (
          <li key={s.img} className="flex flex-col gap-2">
            <a href={`/guide/attendance/${s.img}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <Image src={`/guide/attendance/${s.img}`} width={390} height={900} alt={`예시 화면: ${s.title}`} className="aspect-[390/600] w-full object-cover object-top" sizes="(min-width: 768px) 25vw, 50vw" />
            </a>
            <b className="text-sm text-zinc-900">{s.title}</b>
            <span className="text-[13px] leading-relaxed text-zinc-600">{s.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
