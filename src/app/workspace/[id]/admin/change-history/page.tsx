import Link from "next/link";
import { Suspense } from "react";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { attendanceEnabled } from "@/lib/attendance/server";
import { createClient } from "@/lib/supabase/server";
import { ACTION_WORD, HISTORY_AREAS, HISTORY_LIMIT, areaLabel, mergeHistory, parseArea, type AttendanceHistoryRaw, type HistoryArea, type SettingsHistoryRow } from "@/lib/admin/change-history";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `변경 이력 · ${BRAND.name}` };

// 설정 › 변경 이력(D-303, 벤치마킹 B-2): 모든 설정의 누가·언제·이전→이후. 근태 이력(attendance_history)도 합쳐 보임
export default function Page({ params, searchParams }: PageProps<"/workspace/[id]/admin/change-history">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="변경 이력"
        summary="설정을 누가 언제 무엇을 바꿨는지 남아요. 지우거나 고칠 수 없어요."
        help={
          <>
            <p>회사정보·부서·법인카드·차량·회의실·기능 사용·경비 정책(식대·유류비·출장 일비·예산·정기 결제)·양식·결재라인·파일 보관·근태 정책을 바꾸면 자동으로 남아요.</p>
            <p>세무사에게 &quot;식대 한도가 언제부터 바뀌었나요?&quot; 같은 질문을 받으면 여기서 확인해 보세요. 화면 순서 바꾸기처럼 설정 값이 아닌 것은 남지 않아요.</p>
          </>
        }
      />
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

async function Content({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  const area = parseArea((await searchParams).area);
  const supabase = await createClient();
  const wantSettings = area !== "attendance";
  const wantAttendance = area === null || area === "attendance";
  let sq = supabase.from("settings_history").select("id, at, member_name, area, menu, action, target, changes").order("at", { ascending: false }).order("id", { ascending: false }).limit(HISTORY_LIMIT);
  if (area) sq = sq.eq("area", area);
  const [s, a, attOn] = await Promise.all([
    wantSettings ? sq : Promise.resolve({ data: [], error: null }),
    wantAttendance ? supabase.from("attendance_history").select("id, at, member_name, action, changes").order("at", { ascending: false }).order("id", { ascending: false }).limit(HISTORY_LIMIT) : Promise.resolve({ data: [], error: null }),
    attendanceEnabled(),
  ]);
  if (s.error || a.error) throw new Error("변경 이력을 불러오지 못했어요.");
  const items = mergeHistory((s.data ?? []) as SettingsHistoryRow[], (a.data ?? []) as AttendanceHistoryRaw[]);
  const base = `/workspace/${id}/admin/change-history`;
  const areas: (HistoryArea | null)[] = [null, ...HISTORY_AREAS.filter((x) => x !== "attendance" || attOn || area === "attendance")];

  return (
    <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 md:p-5" data-change-history>
      <nav aria-label="메뉴별로 보기" className="-mx-1 flex flex-wrap gap-1.5">
        {areas.map((x) => {
          const on = x === area;
          return (
            <Link
              key={x ?? "all"}
              href={x ? `${base}?area=${x}` : base}
              aria-current={on ? "page" : undefined}
              data-history-filter={x ?? "all"}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] ${on ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
            >
              {x ? areaLabel(x) : "전체"}
            </Link>
          );
        })}
      </nav>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500" data-history-empty>
          아직 변경 이력이 없어요. 설정을 바꾸면 여기에 남아요.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {items.map((h) => (
            <li key={h.key} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4" data-history-item={h.area}>
              <span className="shrink-0 text-[13px] tabular-nums text-zinc-600 sm:w-40">{fmt(h.at)}</span>
              <div className="min-w-0 flex-1 text-sm leading-relaxed">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[12px] text-zinc-600">
                    {areaLabel(h.area)}
                    {h.menu !== areaLabel(h.area) && ` › ${h.menu}`}
                  </span>
                  <b className="font-semibold">{h.who}</b>
                  <span className="text-zinc-600">
                    {h.target ? `${h.target} ` : ""}
                    {ACTION_WORD[h.action]}
                  </span>
                </div>
                {h.changes.map((c, i) => (
                  <span key={i} className="mt-0.5 block break-words">
                    {c.label}
                    {c.from !== null && (
                      <>
                        {" "}
                        <span className="text-zinc-500">{c.from}</span> →
                      </>
                    )}{" "}
                    {c.to !== null ? <b className="font-semibold">{c.to}</b> : <span className="text-zinc-500">(없음)</span>}
                    {c.reason && <span className="block text-[13px] text-zinc-600">사유: {c.reason}</span>}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[13px] text-zinc-500">최근 {HISTORY_LIMIT}건까지 보여요. 회사 관리자가 바꾼 것만 남고, 다른 회사는 볼 수 없어요.</p>
    </section>
  );
}
