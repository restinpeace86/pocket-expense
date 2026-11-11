import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BusStops, type MyAlert } from "@/components/bus/bus-views";
import { getCompanyNearby } from "@/lib/bus/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "주변 버스 · Moa-on" };

// 주변 버스(D-243 → D-254 전국): 회사 200m 안 정류장(가까운 순 5곳, 없으면 500m 3곳). 주변 정류장이 없거나 회사 위치가 없으면 404
export default function BusPage({ params }: PageProps<"/workspace/[id]/employee/bus">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-80 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/workspace/[id]/employee/bus">, "params">) {
  const { id } = await params;
  await requireWorkspace(id);
  const nearby = await getCompanyNearby();
  if (!nearby?.bus) notFound();
  const supabase = await createClient();
  const { data: alert } = await supabase.from("bus_alerts").select("ars_id, station_name, route_id, route_no, expires_at").maybeSingle();
  return <BusStops base={`/workspace/${id}/employee`} address={nearby.found_address ?? nearby.address} center={typeof nearby.lat === "number" ? { lat: nearby.lat, lng: nearby.lng } : null} stops={nearby.stops} fallback={nearby.fallback} alert={(alert as MyAlert) ?? null} />;
}
