import { Archive, Bus, Check, Clock, DoorOpen, FileSpreadsheet, Inbox, ReceiptText, TreePalm, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { kstTime, stayLabel } from "@/lib/attendance/rules";
import type { AttendanceToday } from "@/lib/attendance/server";
import type { RequestItem } from "@/lib/employee/requests";
import { MyRequests, type TodayRoom } from "./my-requests";
import { HelpSearchBox } from "@/components/help/help-search-box";

// 직원 홈 = 허브 (worker-dashboard.md §0, D-235)
// 메뉴 칸(맨 위 고정, 아이콘+이름, 처리할 것만 배지) → 나의 신청함(D-251, 상태는 여기 한 곳) → 공지(있을 때만)
export type HubTile = { key: string; href: string; label: string; icon: LucideIcon; badge?: number };

export function hubTiles(ws: string, o: { inbox: { waiting: number } | null; rooms: boolean; today: string; attendance?: boolean; bus?: boolean; vault?: boolean }): HubTile[] {
  return [
    { key: "claims", href: `${ws}/employee/claims`, label: "지출결의", icon: ReceiptText },
    { key: "settlements", href: `${ws}/employee/settlements`, label: "정산", icon: Wallet },
    ...(o.inbox ? [{ key: "approvals", href: `${ws}/approvals`, label: "결재함", icon: Inbox, badge: o.inbox.waiting }] : []),
    // 근태 켠 회사(D-237): [출퇴근 기록] = 월 근태 현황, [휴가 및 근태 신청] = 남은 연차·휴가 신청(D-241). 이름은 D-251 개선사항 5
    ...(o.attendance
      ? [
          { key: "attendance", href: `${ws}/employee/attendance`, label: "출퇴근 기록", icon: Clock },
          { key: "vacation", href: `${ws}/employee/vacation`, label: "휴가 및 근태 신청", icon: TreePalm },
        ]
      : []),
    ...(o.rooms ? [{ key: "rooms", href: `${ws}/calendar?rooms=${o.today}`, label: "회의실", icon: DoorOpen }] : []),
    // 서류 → 엑셀(8-104 A): 종이·PDF 서류를 표 그대로 엑셀로
    { key: "convert", href: `${ws}/employee/convert`, label: "서류 → 엑셀", icon: FileSpreadsheet },
    // 파일 보관함(D-245): 채팅을 쓰는 회사
    ...(o.vault ? [{ key: "vault", href: `${ws}/employee/vault`, label: "파일 보관함", icon: Archive }] : []),
    // 주변 버스(D-243 → D-254 전국): 회사 주변에 정류장이 있을 때 메뉴 맨 끝
    ...(o.bus ? [{ key: "bus", href: `${ws}/employee/bus`, label: "주변 버스", icon: Bus }] : []),
  ];
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export function todayTitle(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${w})`;
}

export function EmployeeHub({
  ws,
  today,
  tiles,
  rooms,
  otherEvents,
  requests,
  pendingPayout,
  notices,
  attendance = null,
}: {
  ws: string;
  today: string;
  tiles: HubTile[];
  rooms: TodayRoom[] | null; // null = 캘린더 꺼짐
  otherEvents: number;
  requests: RequestItem[];
  pendingPayout: number;
  notices: ReactNode; // 공지 없으면 null(카드 숨김)
  attendance?: AttendanceToday | null; // null = 근태 꺼짐(D-236)
}) {
  return (
    <main className="mx-auto grid w-full max-w-md gap-4 px-4 pb-10 pt-4 md:max-w-5xl md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-start md:gap-5 md:px-6 md:pt-7">
      <h1 className="sr-only">홈</h1>
        <nav aria-label="홈 메뉴" className="grid grid-cols-3 gap-2.5 md:col-start-1 md:row-start-1 md:gap-3">
          {tiles.map(({ key, href, label, icon: Icon, badge }) => (
            <Link
              key={key}
              href={href}
              data-tile={key}
              className="relative flex h-[5.25rem] flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-800 shadow-sm hover:border-brand-300 active:bg-zinc-50 md:h-26 md:text-[15px]"
            >
              <Icon className="size-7 shrink-0 text-brand-600" strokeWidth={1.8} aria-hidden />
              {/* 긴 이름(휴가 및 근태 신청)은 좁은 휴대폰에서 두 줄로(D-251) */}
              <span className="break-keep px-1.5 text-center leading-tight">{label}</span>
              {!!badge && (
                <span className="absolute right-[calc(50%-2.25rem)] top-2.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold leading-5 text-white">
                  {badge > 99 ? "99+" : badge}
                  <span className="sr-only">건 대기</span>
                </span>
              )}
            </Link>
          ))}
        </nav>

      {/* 나의 신청함(D-251 개선사항 6): "오늘 · 내 현황"을 대신함 */}
      <div className="md:col-start-2 md:row-span-2 md:row-start-1">
        <MyRequests
          ws={ws}
          title={todayTitle(today)}
          attendance={attendance ? <AttendanceLine a={attendance} /> : null}
          rooms={rooms}
          otherEvents={otherEvents}
          calendarHref={`${ws}/calendar?date=${today}`}
          requests={requests}
          pendingPayout={pendingPayout}
        />
      </div>

      {notices && <div className="md:col-start-1 md:row-start-2">{notices}</div>}
      {/* AI 도움말(D-251 개선사항 7): 홈 맨 아래 */}
      <div className="md:col-start-1">
        <HelpSearchBox action={`${ws}/employee/help`} />
      </div>
    </main>
  );
}

// 오늘 출퇴근 한 줄(attendance.md §3-3): 출근 전 / 출근 · 퇴근 전 / 출근 · 퇴근
function AttendanceLine({ a }: { a: AttendanceToday }) {
  const on = !!a.in_at;
  return (
    <p className="flex min-h-11 items-center gap-2 text-sm" data-attendance={on ? (a.out_at ? "out" : "in") : "none"}>
      <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full ${on ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>
        {on ? <Check className="size-3.5" strokeWidth={2.6} aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
      </span>
      {!on ? (
        <span>
          <b className="font-semibold">아직 출근 전</b> <span className="text-zinc-500">· 가운데 버튼으로 QR을 찍으세요</span>
        </span>
      ) : (
        <span>
          <b className="font-semibold">출근 {kstTime(a.in_at!)}</b>
          <span className="text-zinc-500">
            {a.out_at ? ` · 퇴근 ${kstTime(a.out_at)}${a.out_method === "auto" ? "(자동)" : ""} · ${stayLabel(a.in_at!, a.out_at)}` : " · 퇴근 전"}
            {a.holiday ? " · 휴일" : ""}
          </span>
        </span>
      )}
    </p>
  );
}
