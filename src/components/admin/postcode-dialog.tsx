"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// 다음(카카오) 우편번호 서비스(D-251, 개선사항 2): 키·비용 없음. 도로명·지번·건물명 검색.
// 새 창이 아니라 화면 가운데 창 안에 넣어(embed) 휴대폰에서도 같은 자리에서 고른다
// 2026-11-30 t1.daumcdn.net 종료 안내에 따라 t1.kakaocdn.net 주소를 쓴다
const SRC = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

export type PostcodePick = { road: string; jibun: string; zonecode: string; building: string };
type DaumData = { roadAddress: string; jibunAddress: string; autoJibunAddress: string; autoRoadAddress: string; zonecode: string; buildingName: string };
type DaumPostcode = new (o: { oncomplete: (d: DaumData) => void; width: string; height: string }) => { embed: (el: HTMLElement, o?: { autoClose?: boolean }) => void };
declare global {
  interface Window {
    daum?: { Postcode: DaumPostcode };
  }
}

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function PostcodeDialog({ onPick, onClose }: { onPick: (p: PostcodePick) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);
  useEffect(() => {
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !box.current || !window.daum) return;
        new window.daum.Postcode({
          width: "100%",
          height: "100%",
          oncomplete: (d) =>
            pick.current({
              road: d.roadAddress || d.autoRoadAddress,
              jibun: d.jibunAddress || d.autoJibunAddress,
              zonecode: d.zonecode,
              building: d.buildingName,
            }),
        }).embed(box.current, { autoClose: false });
        setReady(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" role="dialog" aria-modal aria-label="주소 검색" data-postcode-dialog>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="relative flex h-[min(560px,90dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
          <div>
            <p className="font-semibold">주소 검색</p>
            <p className="text-xs text-zinc-500">도로명·지번·건물명 모두 돼요 (예: 판교원로 3 · 삼평동 670 · 대왕빌딩)</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <div ref={box} className="relative min-h-0 flex-1">
          {!ready && !failed && (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 className="size-4 animate-spin" aria-hidden /> 주소 검색을 불러오는 중…
            </p>
          )}
          {failed && <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-700">주소 검색을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.</p>}
        </div>
      </div>
    </div>
  );
}
