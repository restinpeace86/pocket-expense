"use client";

import { Clock, Loader2, MonitorSmartphone } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  createPairCodeAction,
  refreshAttendanceAction,
  renameTerminalAction,
  revokeTerminalAction,
  saveAttendanceSettingsAction,
  setAttendanceEnabledAction,
} from "@/app/workspace/[id]/admin/attendance-settings/actions";
import { FormError } from "@/components/onboarding/field";
import { ALERT_OPTIONS, alertLabel, TIME_OPTIONS, WEEKDAYS, type AttendanceSettings } from "@/lib/attendance/rules";
import type { AttendanceAdminView } from "@/lib/attendance/server";

// 근태 설정 화면 본문(D-236, attendance.md §1·§2-1): 켜기 · 설정 · 출근 단말 · 변경 이력
const fmt = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const card = "rounded-2xl border border-zinc-200 bg-white p-4 md:p-5";
const select = "h-11 rounded-xl border border-zinc-300 bg-white px-3 text-[15px]";

export function AttendanceAdmin({ view }: { view: AttendanceAdminView }) {
  return (
    <div className="flex flex-col gap-6">
      <EnabledSwitch enabled={view.enabled} />
      {view.enabled ? (
        <>
          <SettingsForm initial={view.settings} />
          <Terminals terminals={view.terminals} />
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">근태를 켜면 근무 시각과 출근 단말을 정할 수 있어요.</p>
      )}
      <History rows={view.history} />
    </div>
  );
}

function EnabledSwitch({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toggle = () => {
    if (enabled && !confirm("근태를 끌까요?\n\n직원 화면의 [QR 출퇴근]과 출근 단말 QR이 멈춰요. 지금까지의 기록은 지워지지 않아요.")) return;
    setError(null);
    start(async () => {
      const r = await setAttendanceEnabledAction(!enabled);
      if (r.error) setError(r.error);
    });
  };
  return (
    <section className={card} aria-label="근태 사용">
      <div className="flex items-start gap-3">
        <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${enabled ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-500"}`}>
          <Clock className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">근태 사용</p>
          <p className="text-sm text-zinc-600">
            {enabled ? "켜져 있어요. 직원 하단 가운데 버튼이 [QR 출퇴근]으로 바뀌었어요." : "꺼져 있어요. 켜면 직원 하단 가운데 버튼이 [QR 출퇴근]으로 바뀌고 홈에 오늘 출근 현황이 보여요."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="근태 사용"
          disabled={pending}
          onClick={toggle}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-brand-600" : "bg-zinc-300"}`}
        >
          <span className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-7" : "translate-x-1"}`} />
          {pending && <Loader2 className="absolute -left-6 size-4 animate-spin text-zinc-400" />}
        </button>
      </div>
      <FormError message={error} />
    </section>
  );
}

function Row({ title, help, children, htmlFor }: { title: string; help: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-100 py-4 last:border-b-0">
      <div className="min-w-[13rem] flex-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="font-semibold">
            {title}
          </label>
        ) : (
          <p className="font-semibold">{title}</p>
        )}
        <p className="text-[13px] text-zinc-600">{help}</p>
      </div>
      {children}
    </div>
  );
}

function SettingsForm({ initial }: { initial: AttendanceSettings }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => setS(initial), [initial]);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const set = <K extends keyof AttendanceSettings>(k: K, v: AttendanceSettings[K]) => {
    setSaved(false);
    setS((p) => ({ ...p, [k]: v }));
  };
  const toggleDay = (d: number) => set("work_days", s.work_days.includes(d) ? s.work_days.filter((x) => x !== d) : [...s.work_days, d].sort());
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveAttendanceSettingsAction(s);
      if (r.error) setError(r.error);
      else setSaved(true);
    });
  };
  return (
    <form onSubmit={save} className={card} aria-label="근태 설정">
      <h2 className="text-lg font-bold">근무 기준</h2>
      <Row title="정규 출근 · 퇴근 시각" help="자정까지 퇴근을 안 찍으면 이 퇴근 시각으로 기록돼요. 누락 알림 기준이기도 해요. 지각 판단에는 쓰지 않아요.">
        <div className="flex items-center gap-2">
          <select aria-label="정규 출근" className={select} value={s.work_start} onChange={(e) => set("work_start", e.target.value)}>
            {TIME_OPTIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <span aria-hidden>~</span>
          <select aria-label="정규 퇴근" className={select} value={s.work_end} onChange={(e) => set("work_end", e.target.value)}>
            {TIME_OPTIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </Row>
      <Row title="1일 소정근로시간" help="시간차(1시간 단위 휴가) 차감 기준이에요. 1일 = 이 시간." htmlFor="att-hours">
        <select id="att-hours" className={select} value={s.daily_hours} onChange={(e) => set("daily_hours", Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>
              {h}시간
            </option>
          ))}
        </select>
      </Row>
      <Row title="근무 요일" help="이 요일이 아닌 날과 공휴일에 찍으면 '휴일'로 남아요.">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="근무 요일">
          {WEEKDAYS.map((w, i) => {
            const d = i + 1;
            const on = s.work_days.includes(d);
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(d)}
                className={`size-11 rounded-full text-[15px] font-semibold ${on ? "bg-brand-600 text-white" : `border border-zinc-300 bg-white ${d === 6 ? "text-blue-700" : d === 7 ? "text-red-700" : "text-zinc-700"}`}`}
              >
                {w}
              </button>
            );
          })}
        </div>
      </Row>
      <Row title="퇴근 누락 알림" help="퇴근을 안 찍은 직원 본인에게 채팅 [알림]방과 휴대폰 알림으로 하루 한 번 알려요(휴일 제외)." htmlFor="att-alert">
        <select id="att-alert" className={select} value={s.missing_alert_minutes} onChange={(e) => set("missing_alert_minutes", Number(e.target.value))}>
          {ALERT_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {alertLabel(s.work_end, m)}
            </option>
          ))}
        </select>
      </Row>
      <Row title="연차 연도 기준" help="직원별 연차 일수를 정할 때 써요(연차 화면은 곧 열려요).">
        <div className="flex flex-col text-[15px]">
          <label className="flex min-h-10 items-center gap-2">
            <input type="radio" name="att-year" checked={s.leave_year_basis === "calendar"} onChange={() => set("leave_year_basis", "calendar")} className="size-4" /> 1월 1일 ~ 12월 31일
          </label>
          <label className="flex min-h-10 items-center gap-2">
            <input type="radio" name="att-year" checked={s.leave_year_basis === "hire"} onChange={() => set("leave_year_basis", "hire")} className="size-4" /> 직원별 입사일 기준
          </label>
        </div>
      </Row>
      <Row title="상시 근로자 5인 미만 회사" help="'예'면 연차 법 기준 추천값 없이 직접 입력해요.">
        <div className="flex gap-4 text-[15px]">
          <label className="flex min-h-10 items-center gap-2">
            <input type="radio" name="att-u5" checked={s.under_five} onChange={() => set("under_five", true)} className="size-4" /> 예
          </label>
          <label className="flex min-h-10 items-center gap-2">
            <input type="radio" name="att-u5" checked={!s.under_five} onChange={() => set("under_five", false)} className="size-4" /> 아니요
          </label>
        </div>
      </Row>
      <div className="flex flex-wrap items-center gap-3 pt-3">
        <p className="min-w-0 flex-1 text-[13px] text-zinc-600">저장하면 바꾼 사람·시각·이전 값이 변경 이력에 남아요. 이미 남은 출퇴근 기록은 바뀌지 않아요.</p>
        {saved && !dirty && (
          <span role="status" className="text-sm font-semibold text-green-700">
            저장했어요
          </span>
        )}
        <button type="submit" disabled={pending || !dirty} className="inline-flex h-11 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "저장"}
        </button>
      </div>
      <FormError message={error} />
    </form>
  );
}

function Terminals({ terminals }: { terminals: AttendanceAdminView["terminals"] }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pair, setPair] = useState<{ code: string; expiresAt: string; terminalUrl: string; name: string } | null>(null);
  const [left, setLeft] = useState(0);

  // 코드를 보여 주는 동안 남은 시간 표시 + 5초마다 목록 새로 고침(기기가 연결되면 목록에 생김)
  useEffect(() => {
    if (!pair) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(pair.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    const r = setInterval(() => refreshAttendanceAction(), 5000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [pair]);
  useEffect(() => {
    if (pair && terminals.some((t) => t.name === pair.name && new Date(t.created_at).getTime() > new Date(pair.expiresAt).getTime() - 11 * 60_000)) setPair(null);
  }, [terminals, pair]);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createPairCodeAction(name);
      if (r.error || !r.code) return setError(r.error ?? "코드를 만들지 못했어요.");
      setPair({ code: r.code, expiresAt: r.expiresAt!, terminalUrl: r.terminalUrl!, name: name.trim() });
      setName("");
    });
  };

  return (
    <section className={card} aria-labelledby="att-terminals">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <MonitorSmartphone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="att-terminals" className="text-lg font-bold">
            출근 단말
          </h2>
          <p className="text-sm text-zinc-600">QR을 띄워 둘 회사 기기예요(입구 PC·태블릿·안 쓰는 휴대폰). 최대 20대, 지점마다 둘 수 있어요.</p>
        </div>
      </div>

      {pair ? (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4" role="status">
          <p className="text-sm font-semibold text-brand-900">&quot;{pair.name}&quot; 기기에서 아래 순서대로 해 주세요</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-zinc-800">
            <li>
              그 기기의 인터넷 브라우저에서 <b className="break-all">{pair.terminalUrl}</b> 를 열어요.
            </li>
            <li>아래 6자리 코드를 입력해요. 그 기기에는 로그인하지 않아도 돼요.</li>
            <li>QR이 뜨면 전체 화면(F11)으로 켜 두세요. 브라우저 시작 페이지로 지정해 두면 재부팅해도 바로 떠요.</li>
          </ol>
          <p className="mt-3 text-center font-mono text-4xl font-bold tracking-[0.3em] text-zinc-900" aria-label={`연결 코드 ${pair.code.split("").join(" ")}`}>
            {pair.code}
          </p>
          <p className="mt-1 text-center text-sm text-zinc-600">{left > 0 ? `${Math.floor(left / 60)}분 ${left % 60}초 안에 입력 · 한 번만 쓸 수 있어요` : "시간이 지났어요. 새 코드를 받아 주세요."}</p>
          <button type="button" onClick={() => setPair(null)} className="mt-3 inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-brand-800 hover:bg-brand-100">
            닫기
          </button>
        </div>
      ) : (
        <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm font-semibold">
            새 출근 단말 이름
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="예: 1층 입구" className="h-11 rounded-xl border border-zinc-300 px-3 text-[15px] font-normal" />
          </label>
          <button type="submit" disabled={pending || !name.trim()} className="inline-flex h-11 items-center rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "출근 단말 추가 (연결 코드 받기)"}
          </button>
        </form>
      )}
      <FormError message={error} />

      {terminals.length > 0 ? (
        <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
          {terminals.map((t) => (
            <TerminalRow key={t.id} t={t} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">아직 연결된 출근 단말이 없어요.</p>
      )}
      <p className="mt-3 text-[13px] leading-relaxed text-zinc-600">해제하면 그 기기의 QR은 바로 쓸 수 없어요. 기기의 브라우저 데이터를 지우면 다시 연결해야 해요.</p>
    </section>
  );
}

function TerminalRow({ t }: { t: AttendanceAdminView["terminals"][number] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rename = () => {
    const next = prompt("출근 단말 이름", t.name);
    if (!next || next.trim() === t.name) return;
    start(async () => {
      const r = await renameTerminalAction(t.id, next.trim());
      setError(r.error);
    });
  };
  const revoke = () => {
    if (!confirm(`"${t.name}" 출근 단말을 해제할까요?\n\n그 기기의 QR이 바로 멈춰요. 다시 쓰려면 새로 연결해야 해요.`)) return;
    start(async () => {
      const r = await revokeTerminalAction(t.id);
      setError(r.error);
    });
  };
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t.name}</p>
        <p className="text-[13px] text-zinc-600">
          {t.created_by ?? "-"} · {fmt(t.created_at)} 연결 · 마지막 사용 {t.last_used_at ? fmt(t.last_used_at) : "-"}
        </p>
        <FormError message={error} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={rename} disabled={pending} className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-50">
          이름 바꾸기
        </button>
        <button type="button" onClick={revoke} disabled={pending} className="inline-flex min-h-10 items-center rounded-lg border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50">
          해제
        </button>
      </div>
    </li>
  );
}

const ACTION_LABEL: Record<string, string> = { enabled: "근태 켜기·끄기", settings: "근무 기준", terminal_add: "출근 단말", terminal_rename: "출근 단말", terminal_revoke: "출근 단말" };

function History({ rows }: { rows: AttendanceAdminView["history"] }) {
  return (
    <section id="history" className={card} aria-labelledby="att-history">
      <h2 id="att-history" className="text-lg font-bold">
        변경 이력
      </h2>
      <p className="text-sm text-zinc-600">근태 설정과 출근 단말의 모든 변경이 남아요. 지우거나 고칠 수 없어요(최근 100건).</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">아직 변경 이력이 없어요.</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100">
          {rows.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-4 gap-y-1 py-3">
              <span className="w-32 shrink-0 text-[13px] text-zinc-600">{fmt(h.at)}</span>
              <div className="min-w-0 flex-1 text-sm leading-relaxed">
                <span className="mr-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[12px] text-zinc-600">{ACTION_LABEL[h.action] ?? h.action}</span>
                <b className="font-semibold">{h.member_name ?? "시스템"}</b>
                {h.changes.map((c, i) => (
                  <span key={i} className="block">
                    {c.label}
                    {c.from !== null && (
                      <>
                        {" "}
                        <span className="text-zinc-500">{c.from}</span> →
                      </>
                    )}{" "}
                    {c.to !== null ? <b className="font-semibold">{c.to}</b> : <span className="text-zinc-500">(해제)</span>}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
