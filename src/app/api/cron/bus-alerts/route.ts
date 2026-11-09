import { connection, NextResponse, type NextRequest } from "next/server";
import { alertDecision, alertMessage, alertNeedsFetch, type BusRoute } from "@/lib/bus/arrivals";
import { fetchStation } from "@/lib/bus/server";
import { sendDueNoticePushes } from "@/lib/push/notice-push";
import { createAdminClient } from "@/lib/supabase/admin";

// 버스 알림(D-243): pg_cron이 1분마다(켜진 알림이 있을 때만) 부른다. 알림 정류장을 3분마다(버스가 12분 안이면 1분마다) 다시 가져와
// 도착 10분 전·5분 전에 [알림]방 + 휴대폰. 비밀값은 휴대폰 알림과 같은 REMINDER_PUSH_SECRET
type AlertRow = { member_id: string; ars_id: string; station_name: string; route_id: string; route_no: string; last_veh: string | null; sent10: boolean; sent5: boolean };

async function handle(request: NextRequest) {
  await connection();
  const secret = process.env.REMINDER_PUSH_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Not Found", { status: 404 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  const now = new Date();
  const { data: alerts } = await admin.from("bus_alerts").select("member_id, ars_id, station_name, route_id, route_no, last_veh, sent10, sent5").gt("expires_at", now.toISOString());
  const byStop = new Map<string, AlertRow[]>();
  for (const a of (alerts ?? []) as AlertRow[]) byStop.set(a.ars_id, [...(byStop.get(a.ars_id) ?? []), a]);
  let fetched = 0;
  let notices = 0;
  for (const [ars, list] of byStop) {
    const { data: row } = await admin.from("bus_arrivals").select("routes, station_name, fetched_at").eq("ars_id", ars).maybeSingle();
    let routes = (row?.routes as unknown as BusRoute[]) ?? [];
    let fetchedAt: string | null = row?.fetched_at ?? null;
    let stationName: string | null = row?.station_name ?? null;
    if (list.some((a) => alertNeedsFetch(routes.find((r) => r.route_id === a.route_id), fetchedAt, now))) {
      const f = await fetchStation(admin, ars);
      if (f.ok) {
        routes = f.routes;
        fetchedAt = new Date().toISOString();
        stationName = f.station_name ?? stationName;
        fetched++;
      }
    }
    if (!fetchedAt) continue;
    for (const a of list) {
      const route = routes.find((r) => r.route_id === a.route_id);
      const d = alertDecision(route, fetchedAt, a, now);
      if (!d || !route) continue;
      const { data: ok } = await admin.rpc("bus_alert_notify", {
        p_member: a.member_id,
        p_kind: d.kind,
        p_veh: d.veh,
        p_body: alertMessage(a.route_no, d.sec, stationName ?? a.station_name, ars, route.direction, route.arr1_msg),
      });
      if (ok) notices++;
    }
  }
  await admin.rpc("bus_alerts_cleanup");
  const push = notices ? await sendDueNoticePushes(admin) : null;
  return NextResponse.json({ ok: true, alerts: alerts?.length ?? 0, fetched, notices, push });
}

export const POST = handle;
export const GET = handle;
