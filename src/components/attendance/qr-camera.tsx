"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// 앱 안 QR 스캐너(spec/features/attendance.md §3-1): 하단 가운데 [QR 출퇴근] → 카메라 → 출근 단말 QR이면 결과 화면으로
// 브라우저 내장 BarcodeDetector가 있으면 그것, 없으면(아이폰 사파리 등) jsQR
type Detect = (v: HTMLVideoElement, c: HTMLCanvasElement) => Promise<string | null>;

async function makeDetector(): Promise<Detect> {
  const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (BD) {
    try {
      const d = new BD({ formats: ["qr_code"] });
      return async (v) => (await d.detect(v))[0]?.rawValue ?? null;
    } catch {
      // jsQR로
    }
  }
  const jsQR = (await import("jsqr")).default;
  return async (v, c) => {
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 640 / Math.max(w, h));
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

// 우리 출퇴근 QR 주소만 받는다(다른 사이트 주소로 튕기지 않게 경로·쿼리만 꺼냄)
export function scanTarget(text: string): string | null {
  try {
    const u = new URL(text, "https://x.invalid");
    if (u.pathname !== "/attend/scan") return null;
    const t = u.searchParams.get("t");
    return t ? `/attend/scan?t=${encodeURIComponent(t)}` : null;
  } catch {
    return null;
  }
}

export function QrCamera({ home }: { home: string }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setProblem("카메라를 쓸 수 없어요. 휴대폰 설정에서 카메라 권한을 허용하거나, 휴대폰 기본 카메라로 QR을 찍어 주세요.");
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      const detect = await makeDetector();
      const tick = async () => {
        if (stopped || !video.current || !canvas.current) return;
        const text = await detect(video.current, canvas.current).catch(() => null);
        if (text) {
          const to = scanTarget(text);
          if (to) {
            stopped = true;
            router.replace(to);
            return;
          }
          setWrong(true);
        }
        timer = setTimeout(tick, 250);
      };
      tick();
    })();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-900 text-white">
      <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" aria-hidden />
      <canvas ref={canvas} className="hidden" aria-hidden />
      <div aria-hidden className="absolute inset-0 bg-black/30" />
      <header className="relative flex h-14 items-center px-2 pt-[env(safe-area-inset-top)]">
        <Link href={home} aria-label="닫기" className="flex size-11 items-center justify-center">
          <X className="size-6" />
        </Link>
        <h1 className="text-[17px] font-semibold">QR 출퇴근</h1>
      </header>
      <div aria-hidden className="relative mx-auto mt-[12vh] size-64">
        <span className="absolute left-0 top-0 size-11 rounded-tl-2xl border-l-4 border-t-4 border-white" />
        <span className="absolute right-0 top-0 size-11 rounded-tr-2xl border-r-4 border-t-4 border-white" />
        <span className="absolute bottom-0 left-0 size-11 rounded-bl-2xl border-b-4 border-l-4 border-white" />
        <span className="absolute bottom-0 right-0 size-11 rounded-br-2xl border-b-4 border-r-4 border-white" />
      </div>
      <p className="relative mx-6 mt-8 text-center text-[17px] font-semibold leading-relaxed">
        회사 출근 단말 화면의 QR을
        <br />
        네모 안에 맞춰 주세요
      </p>
      <p className="relative mx-6 mt-2.5 text-center text-sm leading-relaxed text-zinc-200" role="status">
        {problem ?? (wrong ? "출근 단말 QR이 아니에요. 회사 출근 단말 화면을 찍어 주세요." : "휴대폰 기본 카메라로 찍어도 돼요. 출퇴근 가능 시간 06:00 ~ 24:00")}
      </p>
    </div>
  );
}
