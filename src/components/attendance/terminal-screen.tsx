"use client";

import { Check, Loader2, LogOut, Moon, WifiOff } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// 출근 단말 화면(spec/features/attendance.md §2-2, D-236) — 로그인 없이 이 기기에 저장된 단말 열쇠로만 동작
// 열쇠 없음 → 연결 코드 입력 / 있음 → 몇 초마다 서버에서 지금 칸 QR을 받아 그림(30초마다 바뀜)
const KEY = "workon-attend-terminal"; // 저장 키는 예전 이름 그대로(바꾸면 연결된 출근 단말이 풀림, D-251)
const POLL_MS = 3000;

type Info =
  | { status: "ok"; url: string; slotEndsAt: string; serverNow: string; name: string; companyName: string; recent: { name: string; kind: "in" | "out"; at: string }[] }
  | { status: "closed" | "disabled"; serverNow: string; name: string; companyName: string };

function readKey(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const hm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const sec = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", second: "2-digit" }).format(d).padStart(2, "0");
const dayLabel = (d: Date) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(d);

const noopSub = () => () => {};

export function TerminalScreen() {
  // 저장된 단말 키는 브라우저에서만 읽는다(서버에서 그릴 때는 undefined = 빈 화면). 연결·해제하면 그 값으로 덮어씀
  const stored = useSyncExternalStore<string | null | undefined>(noopSub, readKey, () => undefined);
  const [set, setKey] = useState<{ v: string | null } | null>(null);
  const key = set ? set.v : stored;
  if (key === undefined) return <div className="min-h-dvh bg-white" />;
  if (!key) return <PairForm onPaired={(k) => setKey({ v: k })} />;
  return (
    <Live
      terminalKey={key}
      onRevoked={() => {
        try {
          window.localStorage.removeItem(KEY);
        } catch {}
        setKey({ v: null });
      }}
    />
  );
}

function PairForm({ onPaired }: { onPaired: (key: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/attend/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = (await res.json()) as { key?: string; error?: string };
      if (!data.key) throw new Error(data.error ?? "연결하지 못했어요.");
      window.localStorage.setItem(KEY, data.key);
      onPaired(data.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "연결하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">출근 단말 연결</h1>
        <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-zinc-700">
          <li>관리자가 자기 PC나 휴대폰에서 [설정 → 근태 → 출근 단말 추가]를 눌러 6자리 코드를 받아요.</li>
          <li>이 기기(회사 입구 PC·태블릿)에서 그 코드를 아래에 입력해요.</li>
          <li>연결되면 이 화면에 30초마다 바뀌는 출퇴근 QR이 떠요. 이 기기에는 로그인하지 않아도 돼요.</li>
        </ol>
        <label htmlFor="pair-code" className="text-sm font-semibold">
          연결 코드 (6자리, 10분 동안 유효)
        </label>
        <input
          id="pair-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-14 rounded-xl border border-zinc-300 px-4 text-center text-2xl font-bold tracking-[0.5em]"
          placeholder="000000"
        />
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || code.length !== 6} className="flex h-12 items-center justify-center rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "이 기기를 출근 단말로 연결"}
        </button>
      </form>
    </main>
  );
}

function Live({ terminalKey, onRevoked }: { terminalKey: string; onRevoked: () => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [offline, setOffline] = useState(false);
  const [svg, setSvg] = useState<string>("");
  const [offset, setOffset] = useState(0); // 서버 시각 - 기기 시각
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ name: string; kind: "in" | "out"; at: string } | null>(null);
  const seen = useRef(new Set<string>());
  const lastUrl = useRef("");

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/attend/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: terminalKey }), cache: "no-store" });
      if (!res.ok) throw new Error("bad");
      const data = (await res.json()) as Info | { status: "revoked" };
      if (data.status === "revoked") return onRevoked();
      setOffline(false);
      setOffset(new Date(data.serverNow).getTime() - Date.now());
      setInfo(data);
      if (data.status === "ok") {
        if (data.url !== lastUrl.current) {
          lastUrl.current = data.url;
          setSvg(await QRCode.toString(data.url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }));
        }
        for (const r of data.recent) {
          const id = `${r.name}|${r.kind}|${r.at}`;
          if (!seen.current.has(id)) {
            seen.current.add(id);
            setToast(r);
          }
        }
      }
    } catch {
      setOffline(true); // 예전 QR은 보여 주지 않는다
    }
  }, [terminalKey, onRevoked]);

  useEffect(() => {
    void Promise.resolve().then(poll);
    const p = setInterval(poll, POLL_MS);
    const c = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(p);
      clearInterval(c);
    };
  }, [poll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // 화면 꺼짐 방지(지원하는 브라우저만). 다른 탭에 갔다 오면 다시 잡는다
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const take = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    take();
    const onVis = () => document.visibilityState === "visible" && take();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  const server = new Date(now + offset);
  const where = info ? `${info.companyName} · ${info.name}` : "";

  if (!info && !offline) return <div className="flex min-h-dvh items-center justify-center bg-white"><Loader2 className="size-10 animate-spin text-brand-600" aria-hidden /></div>;

  if (info && info.status === "closed" && !offline) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-zinc-900 px-6 text-center text-zinc-50">
        <Moon className="size-16 text-indigo-300" strokeWidth={1.6} aria-hidden />
        <p className="text-7xl font-bold tabular-nums">{hm(server)}</p>
        <h1 className="text-2xl font-bold">지금은 출퇴근을 찍을 수 없어요</h1>
        <p className="text-lg leading-relaxed text-zinc-300">출퇴근 가능 시간 06:00 ~ 24:00<br />06:00에 QR이 다시 떠요</p>
        <p className="text-zinc-400">{where}</p>
      </main>
    );
  }
  if (info && info.status === "disabled" && !offline) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <h1 className="text-2xl font-bold">회사에서 근태를 꺼 두었어요</h1>
        <p className="text-lg text-zinc-600">관리자가 근태를 켜면 QR이 다시 떠요.</p>
        <p className="text-zinc-500">{where}</p>
      </main>
    );
  }

  const ok = info?.status === "ok" ? info : null;
  const left = ok ? Math.max(0, Math.ceil((new Date(ok.slotEndsAt).getTime() - server.getTime()) / 1000)) : 0;
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-10 bg-white px-6 py-10 text-zinc-900 lg:flex-row lg:gap-16">
      {toast && (
        <div role="status" className={`absolute left-1/2 top-6 flex -translate-x-1/2 items-center gap-3 rounded-full px-6 py-3.5 text-xl font-semibold text-white shadow-xl ${toast.kind === "in" ? "bg-green-700" : "bg-brand-700"}`}>
          {toast.kind === "in" ? <Check className="size-6" strokeWidth={2.6} aria-hidden /> : <LogOut className="size-6" aria-hidden />}
          {toast.name} {toast.kind === "in" ? "출근" : "퇴근"} {hm(new Date(toast.at))}
        </div>
      )}
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-[min(80vw,440px)] items-center justify-center rounded-3xl border-2 border-zinc-200 bg-white p-5">
          {offline || !ok ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <WifiOff className="size-14 text-amber-700" aria-hidden />
              <p className="text-xl font-bold">연결 끊김 · 다시 연결 중</p>
              <p className="text-zinc-600">연결되면 바로 새 QR이 떠요.</p>
            </div>
          ) : (
            <div role="img" aria-label="출퇴근 QR 코드" data-qr-url={ok.url} className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
          )}
        </div>
        {ok && !offline && (
          <div className="w-[min(80vw,440px)]">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full bg-brand-600 transition-[width] duration-500" style={{ width: `${(left / 30) * 100}%` }} />
            </div>
            <p className="mt-2 text-center text-zinc-600">
              다음 QR까지 <b className="text-zinc-900">{left}초</b> · 30초마다 바뀌어요
            </p>
          </div>
        )}
      </div>
      <div className="flex max-w-md flex-col gap-5 text-center lg:text-left">
        <p className="text-xl text-zinc-600">{dayLabel(server)}</p>
        <p className="text-7xl font-bold tabular-nums tracking-tight lg:text-8xl">
          {hm(server)}
          <span className="text-4xl text-zinc-500 lg:text-5xl">:{sec(server)}</span>
        </p>
        <p className="text-2xl font-bold">{where}</p>
        <div className="h-px bg-zinc-200" />
        <ol className="flex flex-col gap-3 text-left text-xl leading-relaxed text-zinc-700">
          <li className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-bold text-brand-700">1</span>휴대폰 카메라나 앱 가운데 [QR 출퇴근]으로 찍으세요
          </li>
          <li className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-bold text-brand-700">2</span>처음 찍으면 출근, 퇴근할 때 한 번 더 찍으세요
          </li>
        </ol>
        <p className="text-zinc-600">출퇴근 가능 시간 06:00 ~ 24:00</p>
      </div>
    </main>
  );
}
