import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BusStation, type MyAlert } from "@/components/bus/bus-views";
import { getCompanyNearby, getStation } from "@/lib/bus/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "정류장 도착 정보 · Moa-on" };

// 정류장 전 노선 도착(D-243): 회사 주변 정류장만. 저장된 값이 3분 넘었으면 그때 서울시 getStationByUid로 새로
export default function BusStationPage({ params }: PageProps<"/workspace/[id]/employee/bus/[arsId]">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/workspace/[id]/employee/bus/[arsId]">, "params">) {
  const { id, arsId } = await params;
  await requireWorkspace(id);
  const nearby = await getCompanyNearby();
  const stop = nearby?.bus ? nearby.stops.find((s) => s.ars_id === decodeURIComponent(arsId)) : null;
  if (!stop) notFound();
  const admin = createAdminClient();
  if (!admin) throw new Error("service");
  const [station, { data: alert }] = await Promise.all([getStation(admin, stop.ars_id), (await createClient()).from("bus_alerts").select("ars_id, station_name, route_id, route_no, expires_at").maybeSingle()]);
  return (
    <BusStation
      base={`/workspace/${id}/employee`}
      arsId={stop.ars_id}
      stopNo={stop.no ?? (/^\d{5}$/.test(stop.ars_id) ? stop.ars_id : null)}
      stationName={station.station_name || stop.name}
      routes={station.routes}
      fetchedAt={station.fetched_at}
      error={station.error}
      alert={(alert as MyAlert) ?? null}
    />
  );
}
