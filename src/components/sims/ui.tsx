import { Bell, Check } from "lucide-react";
import type { ReactNode } from "react";

// 시뮬레이션 장면 조각(밝은 앱 화면 모양). 나타나는 줄은 landing-row(움직임 줄이기면 바로 보임)
export function Phone({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto flex w-full max-w-[17.5rem] flex-col overflow-hidden rounded-[1.6rem] border-[5px] border-zinc-800 bg-white shadow-xl ${className}`}>
      <div className="flex items-center justify-between bg-white px-4 pb-1 pt-2 text-[10px] text-zinc-400">
        <span>9:41</span>
        <span className="h-1.5 w-10 rounded-full bg-zinc-200" />
      </div>
      <p className="border-b border-zinc-100 px-4 pb-2 text-[13px] font-bold text-zinc-900">{title}</p>
      <div className="flex flex-1 flex-col gap-2 p-3 text-[12.5px] text-zinc-800">{children}</div>
    </div>
  );
}

export function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
        <span className="size-2 rounded-full bg-red-300" />
        <span className="size-2 rounded-full bg-amber-300" />
        <span className="size-2 rounded-full bg-emerald-300" />
        <span className="ml-1.5 min-w-0 truncate text-[11px] font-semibold text-zinc-600">{title}</span>
        {sub && <span className="ml-auto shrink-0 text-[10px] text-zinc-400">{sub}</span>}
      </div>
      <div className="flex flex-col gap-2 p-3 text-[12.5px] text-zinc-800">{children}</div>
    </div>
  );
}

// 나타나는 줄(조건이 처음 참일 때 올라오며 보임)
export function Show({ when, children, className = "" }: { when: boolean; children: ReactNode; className?: string }) {
  if (!when) return null;
  return (
    <div className={`landing-row ${className}`} style={{ animationDelay: "0s" }}>
      {children}
    </div>
  );
}

// 앱 버튼 모양: idle 회색 · ready 누를 차례(테두리 강조) · done 완료
export function Btn({ state, children, done }: { state: "idle" | "ready" | "done"; children: ReactNode; done?: ReactNode }) {
  return (
    <span aria-hidden className={`inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition ${state === "done" ? "bg-emerald-500 text-white" : state === "ready" ? "bg-brand-600 text-white ring-4 ring-brand-200" : "bg-zinc-200 text-zinc-500"}`}>
      {state === "done" ? (
        <>
          <Check className="size-4" /> {done ?? children}
        </>
      ) : (
        children
      )}
    </span>
  );
}

export function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-md">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
        <Bell className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 text-[12px] leading-snug">
        <b className="block text-zinc-900">{title}</b>
        <span className="break-keep text-zinc-600">{body}</span>
      </span>
    </div>
  );
}

export function Field({ k, v, on, tag }: { k: string; v: ReactNode; on: boolean; tag?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-zinc-100 py-1.5 last:border-0">
      <span className="shrink-0 text-zinc-500">{k}</span>
      {on ? (
        <span className="landing-row inline-flex min-w-0 flex-wrap items-center justify-end gap-1 text-right font-semibold" style={{ animationDelay: "0s" }}>
          {v}
          {tag && <span className="whitespace-nowrap rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">{tag}</span>}
        </span>
      ) : (
        <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-zinc-100" />
      )}
    </div>
  );
}

// 장면 설명 한 줄(무엇이 일어났는지)
export function Say({ children }: { children: ReactNode }) {
  return <p className="break-keep text-center text-[12px] font-medium text-zinc-600">{children}</p>;
}

// 둘을 나란히(휴대폰은 위아래)
export function Duo({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center">{children}</div>;
}

// 예시 QR(모양만)
export function FakeQr({ seed = 1, className = "" }: { seed?: number; className?: string }) {
  const cells: boolean[] = [];
  let x = seed * 9301 + 49297;
  for (let i = 0; i < 121; i++) {
    x = (x * 9301 + 49297) % 233280;
    cells.push(x / 233280 > 0.5);
  }
  const finder = (r: number, c: number) => (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3);
  return (
    <svg viewBox="0 0 11 11" className={className} role="img" aria-label="예시 QR">
      <rect width="11" height="11" fill="#fff" />
      {cells.map((on, i) => {
        const r = Math.floor(i / 11);
        const c = i % 11;
        return on && !finder(r, c) ? <rect key={i} x={c} y={r} width="1.02" height="1.02" fill="#18181b" /> : null;
      })}
      {[
        [0, 0],
        [8, 0],
        [0, 8],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.3} y={y + 0.3} width="2.4" height="2.4" fill="none" stroke="#18181b" strokeWidth="0.6" />
          <rect x={x + 1} y={y + 1} width="1" height="1" fill="#18181b" />
        </g>
      ))}
    </svg>
  );
}
