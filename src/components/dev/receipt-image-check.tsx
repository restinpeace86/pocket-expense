"use client";

import { useState } from "react";
import { processReceiptFile } from "@/lib/receipts/image";

// 개발용 점검 화면(/dev/preview/receipt-image): 휴대폰 사진 크기(4032×3024) 가짜 영수증을 만들어 줄이기 결과를 보여 준다
export function ReceiptImageCheck() {
  const [result, setResult] = useState<string>("");

  async function run() {
    const canvas = document.createElement("canvas");
    canvas.width = 3024;
    canvas.height = 4032;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f5f5f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111";
    ctx.font = "120px sans-serif";
    for (let i = 0; i < 25; i++) ctx.fillText(`부산국밥 ${i + 1}  17,000원  사업자 124-81-00998`, 120, 240 + i * 150);
    const big = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.95));
    const file = new File([big], "receipt.jpg", { type: "image/jpeg" });
    const t0 = performance.now();
    const out = await processReceiptFile(file);
    const ms = Math.round(performance.now() - t0);
    if (out.kind !== "image") return setResult("unexpected pdf");
    const thumbBitmap = await createImageBitmap(out.thumb);
    setResult(
      JSON.stringify({
        inputBytes: file.size,
        originalBytes: out.original.size,
        originalType: out.original.type,
        originalSize: `${out.width}x${out.height}`,
        thumbBytes: out.thumb.size,
        thumbType: out.thumb.type,
        thumbSize: `${thumbBitmap.width}x${thumbBitmap.height}`,
        ms,
      }),
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <button type="button" onClick={run} className="rounded-xl bg-brand-600 px-4 py-2 text-white">
        이미지 줄이기 점검
      </button>
      <pre id="result" className="mt-4 whitespace-pre-wrap text-xs">
        {result}
      </pre>
    </main>
  );
}
