"use client";

import { useEffect, useRef, useState } from "react";

// 회사 주변 정류장 지도(D-251 개선사항 4): 카카오 지도 JavaScript SDK
// 회사 = 큰 핀, 정류장 = 버스 표시(누르면 onSelect). 고른 정류장은 초록으로 하이라이트 + 이름·거리 말풍선
// 지도를 못 불러오면(키·도메인 미등록·네트워크) 안내만 — 아래 목록은 그대로 쓴다
const KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";

export type MapStop = { ars_id: string; name: string; meters: number; lat: number; lng: number };
type LatLng = unknown;
type Kakao = {
  maps: {
    load: (cb: () => void) => void;
    LatLng: new (lat: number, lng: number) => LatLng;
    LatLngBounds: new () => { extend: (p: LatLng) => void };
    Map: new (el: HTMLElement, o: { center: LatLng; level: number }) => { setBounds: (b: unknown, ...pad: number[]) => void; relayout: () => void; setCenter: (p: LatLng) => void };
    CustomOverlay: new (o: { position: LatLng; content: HTMLElement; yAnchor?: number; xAnchor?: number; zIndex?: number; clickable?: boolean }) => { setMap: (m: unknown) => void; setZIndex: (z: number) => void };
  };
};
declare global {
  interface Window {
    kakao?: Kakao;
  }
}

let loading: Promise<Kakao> | null = null;
function loadKakao(): Promise<Kakao> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  loading ??= new Promise<Kakao>((resolve, reject) => {
    if (!KEY) return reject(new Error("NO_KEY"));
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false`;
    s.async = true;
    s.onload = () => (window.kakao?.maps ? window.kakao.maps.load(() => resolve(window.kakao!)) : reject(new Error("LOAD")));
    s.onerror = () => reject(new Error("LOAD"));
    document.head.appendChild(s);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

function pinEl(label: string): HTMLElement {
  const d = document.createElement("div");
  d.style.cssText = "display:flex;flex-direction:column;align-items:center;pointer-events:none";
  d.innerHTML = `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#4f46e5;box-shadow:0 2px 6px rgba(0,0,0,.3);display:grid;place-items:center"><span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:13px">회</span></div>`;
  const t = document.createElement("div");
  t.textContent = label;
  t.style.cssText = "margin-top:4px;background:#fff;border:1px solid #d4d4d8;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700;color:#1e1b4b;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis";
  d.appendChild(t);
  return d;
}

function busEl(s: MapStop, selected: boolean, onClick: () => void): HTMLElement {
  const d = document.createElement("button");
  d.type = "button";
  d.setAttribute("aria-label", `${s.name} ${s.meters}m`);
  d.dataset.mapStop = s.ars_id;
  d.style.cssText = "display:flex;flex-direction:column;align-items:center;background:none;border:0;padding:0;cursor:pointer";
  const box = document.createElement("span");
  box.style.cssText = `width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:15px;border:2px solid #047857;${selected ? "background:#047857;box-shadow:0 0 0 5px rgba(4,120,87,.28)" : "background:#fff"}`;
  box.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${selected ? "#fff" : "#047857"}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>`;
  d.appendChild(box);
  if (selected) {
    const t = document.createElement("span");
    t.textContent = `${s.name} · ${s.meters}m`;
    t.style.cssText = "margin-top:4px;background:#047857;color:#fff;border-radius:6px;padding:1px 7px;font-size:11.5px;font-weight:700;white-space:nowrap";
    d.appendChild(t);
  }
  d.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return d;
}

export function StopsMap({ center, label, stops, selected, onSelect, className = "h-56 md:h-72" }: { center: { lat: number; lng: number }; label: string; stops: MapStop[]; selected?: string | null; onSelect?: (ars: string) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<InstanceType<Kakao["maps"]["Map"]> | null>(null);
  const overlays = useRef<{ setMap: (m: unknown) => void }[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const pick = useRef(onSelect);
  useEffect(() => {
    pick.current = onSelect;
  }, [onSelect]);

  // 지도 만들기(한 번) + 회사·정류장이 모두 보이게
  useEffect(() => {
    let alive = true;
    loadKakao()
      .then((k) => {
        if (!alive || !box.current) return;
        const c = new k.maps.LatLng(center.lat, center.lng);
        const m = new k.maps.Map(box.current, { center: c, level: 3 });
        if (stops.length) {
          const b = new k.maps.LatLngBounds();
          b.extend(c);
          stops.forEach((s) => b.extend(new k.maps.LatLng(s.lat, s.lng)));
          m.setBounds(b, 60, 40, 40, 40);
        }
        map.current = m;
        setState("ready");
      })
      .catch(() => alive && setState("failed"));
    return () => {
      alive = false;
    };
    // 회사 위치·정류장 목록이 바뀌면 다시 그린다
  }, [center.lat, center.lng, stops]);

  // 표시(고른 정류장이 바뀌면 다시)
  useEffect(() => {
    const k = window.kakao;
    const m = map.current;
    if (state !== "ready" || !k || !m) return;
    overlays.current.forEach((o) => o.setMap(null));
    const list: { setMap: (m: unknown) => void }[] = [];
    const home = new k.maps.CustomOverlay({ position: new k.maps.LatLng(center.lat, center.lng), content: pinEl(label), yAnchor: 1, zIndex: 1 });
    home.setMap(m);
    list.push(home);
    for (const s of stops) {
      const on = s.ars_id === selected;
      const o = new k.maps.CustomOverlay({ position: new k.maps.LatLng(s.lat, s.lng), content: busEl(s, on, () => pick.current?.(s.ars_id)), yAnchor: on ? 0.3 : 0.5, zIndex: on ? 3 : 2, clickable: true });
      o.setMap(m);
      list.push(o);
    }
    overlays.current = list;
  }, [state, stops, selected, center.lat, center.lng, label]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 ${className}`} data-stops-map={state}>
      <div ref={box} className="absolute inset-0" />
      {state === "loading" && <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">지도를 불러오는 중…</p>}
      {state === "failed" && <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-zinc-600">지도를 불러오지 못했어요. 아래 목록에서 정류장을 골라 주세요.</p>}
    </div>
  );
}
