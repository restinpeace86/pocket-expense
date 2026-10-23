import { Megaphone } from "lucide-react";
import type { Notice } from "@/lib/push/notices";

// 홈 화면 공지 (D-116): 최근 30일, 최대 3건. 누르면 내용이 펼쳐진다
const date = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
export function NoticeStrip({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null;
  return (
    <section id="notices" className="rounded-2xl border border-zinc-200 bg-white px-4 py-2" aria-label="공지">
      {notices.map((n) => (
        <details key={n.id} className="group border-b border-zinc-100 last:border-b-0">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-sm [&::-webkit-details-marker]:hidden">
            <Megaphone className="size-4 shrink-0 text-brand-600" />
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${n.scope === "platform" ? "bg-zinc-100 text-zinc-700" : "bg-brand-50 text-brand-800"}`}>{n.scope === "platform" ? "서비스 공지" : "사내 공지"}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{n.title}</span>
            <span className="shrink-0 text-xs text-zinc-500">{date(n.created_at)}</span>
          </summary>
          <p className="whitespace-pre-wrap break-words pb-3 pl-6 text-sm text-zinc-700">{n.body}</p>
        </details>
      ))}
    </section>
  );
}
