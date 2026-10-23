import "server-only";
import { ImageResponse } from "next/og";
import { formatDateTimeKst } from "@/lib/claims/format";
import { routeCardFrom, routeFormula, type RouteCard } from "@/lib/expense/route";
import { formatWon } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

// 자차 유류비 '출장 경로 및 거리 산정 요약' 증빙 이미지 (D-088)
// 상신이 끝나면 확정된 값으로 PNG를 만들어 영수증 버킷 {company}/route-cards/{claim}/{item}.png 에 저장하고 항목에 연결한다.
// 직원은 이 폴더에 올릴 수 없다(migration 041). 실패해도 상신은 그대로이고, 화면은 저장된 값으로 같은 카드를 그린다.
export type RouteCardDoc = {
  companyName: string;
  claimTitle: string;
  memberName: string;
  department: string | null;
  vehicleNumber: string | null;
  expenseDate: string | null;
  tripPurpose: string | null;
  card: RouteCard;
  submittedAt: string | null;
  itemId: string;
};

// 서버 이미지 생성기에는 한글 글꼴이 없어 Google Fonts에서 이 그림에 쓰는 글자만 받아 온다(수 KB)
async function loadFont(text: string, weight: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(5000) })).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

const dot = (d: string | null) => (d ? d.replaceAll("-", ".") : "-");

function rows(d: RouteCardDoc): [string, string][] {
  const c = d.card;
  return [
    ["결의서", d.claimTitle || "-"],
    ["청구자", [d.memberName, d.department].filter(Boolean).join(" · ")],
    ["차량번호", d.vehicleNumber || "미등록"],
    ["사용일", dot(d.expenseDate)],
    ["출장 목적", d.tripPurpose || "-"],
    ["출발", [c.startName, c.startAddress].filter(Boolean).join(" · ")],
    ["도착", [c.endName, c.endAddress].filter(Boolean).join(" · ")],
    ["총 주행 거리", `${c.totalKm.toLocaleString("ko-KR")}km (${c.roundTrip ? "왕복" : "편도"})`],
    ["계산식", routeFormula(c)],
    ["거리 근거", c.source === "api" ? `카카오 길찾기 추천 경로 (자동 계산${c.computedAt ? ` ${formatDateTimeKst(c.computedAt)}` : ""})` : `직원이 직접 입력한 거리${c.computedAt ? ` (${formatDateTimeKst(c.computedAt)})` : ""}`],
  ];
}

export async function renderRouteCardPng(d: RouteCardDoc): Promise<ArrayBuffer | null> {
  const r = rows(d);
  const title = "출장 경로 및 거리 산정 요약";
  const footer = `${d.companyName} · 상신 ${d.submittedAt ? formatDateTimeKst(d.submittedAt) : "-"} · PocketExpense 자동 생성 · 항목 ${d.itemId.slice(0, 8)}`;
  const amount = `정산 금액 ${formatWon(d.card.amount)}`;
  const allText = [title, footer, amount, ...r.flat(), "주유 영수증 없이 경로·거리·단가로 산정한 자차 유류비 증빙입니다"].join("");
  const [regular, bold] = await Promise.all([loadFont(allText, 400), loadFont(allText, 700)]);
  if (!regular || !bold) return null;
  const img = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: "NotoSansKR", color: "#18181b", padding: 48 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #4f46e5", paddingBottom: 20 }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 22, color: d.card.source === "api" ? "#4338ca" : "#92400e", background: d.card.source === "api" ? "#eef2ff" : "#fef3c7", borderRadius: 999, padding: "6px 16px" }}>
            {d.card.source === "api" ? "길찾기 자동 계산" : "직접 입력 거리"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
          {r.map(([k, v]) => (
            <div key={k} style={{ display: "flex", borderBottom: "1px solid #e4e4e7", padding: "14px 0", fontSize: 26 }}>
              <div style={{ width: 200, color: "#71717a", flexShrink: 0 }}>{k}</div>
              <div style={{ flex: 1, fontWeight: k === "계산식" || k === "총 주행 거리" ? 700 : 400 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28, fontSize: 44, fontWeight: 700, color: "#312e81" }}>{amount}</div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 20, color: "#71717a", flexDirection: "column" }}>
          <div style={{ display: "flex" }}>주유 영수증 없이 경로·거리·단가로 산정한 자차 유류비 증빙입니다</div>
          <div style={{ display: "flex", marginTop: 6 }}>{footer}</div>
        </div>
      </div>
    ),
    {
      width: 1100,
      height: 1000,
      fonts: [
        { name: "NotoSansKR", data: regular, weight: 400, style: "normal" },
        { name: "NotoSansKR", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
  return await img.arrayBuffer();
}

// 상신된 결의서의 자차 항목마다 증빙 이미지를 만들어 연결한다(이미 연결된 항목은 건너뜀). 상신 성공 뒤 after()에서 부른다.
export async function attachRouteCards(claimId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: claim } = await admin
    .from("expense_claims")
    .select("id, company_id, member_id, title, status, trip_purpose, submitted_at")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim || claim.status === "draft" || claim.status === "rejected") return;
  const { data: items } = await admin
    .from("expense_items")
    .select("id, expense_date, start_location, end_location, is_round_trip, route_one_way_km, distance_km, distance_source, route_evidence, amount, applied_fuel_rate_per_km, applied_fuel_mode, applied_fuel_price, applied_fuel_type, route_card_path")
    .eq("claim_id", claimId)
    .eq("category", "trip")
    .eq("trip_type", "own_car")
    .is("route_card_path", null);
  if (!items?.length) return;
  const [{ data: company }, { data: member }] = await Promise.all([
    admin.from("companies").select("name").eq("id", claim.company_id).single(),
    admin.from("members").select("name, vehicle_number, department:departments(name)").eq("id", claim.member_id).single(),
  ]);
  for (const it of items) {
    const card = routeCardFrom(it, it.applied_fuel_rate_per_km ?? 0);
    if (!card) continue;
    try {
      const png = await renderRouteCardPng({
        companyName: company?.name ?? "",
        claimTitle: claim.title,
        memberName: member?.name ?? "",
        department: (member?.department as { name: string } | null)?.name ?? null,
        vehicleNumber: member?.vehicle_number ?? null,
        expenseDate: it.expense_date,
        tripPurpose: claim.trip_purpose,
        card,
        submittedAt: claim.submitted_at,
        itemId: it.id,
      });
      if (!png) {
        console.error("[route-card] font load failed", it.id);
        continue;
      }
      const path = `${claim.company_id}/route-cards/${claim.id}/${it.id}.png`;
      const up = await admin.storage.from("receipts").upload(path, png, { contentType: "image/png", upsert: true });
      if (up.error) {
        console.error("[route-card] upload failed", it.id, up.error.message);
        continue;
      }
      await admin.from("expense_items").update({ route_card_path: path }).eq("id", it.id);
    } catch (e) {
      console.error("[route-card] render failed", it.id, e instanceof Error ? e.message : e);
    }
  }
}
