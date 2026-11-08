import { fitWithin, looksLikePdf } from "@/lib/receipts/image";
import { PROOF_MAX_BYTES } from "./vacation";

// 휴가 증빙 줄이기(D-241): 사진은 긴 변 2000px JPEG로 다시 그려 저장(위치정보도 지워짐), PDF는 그대로(10MB까지). 브라우저에서 실행
const MAX = 2000;
const QUALITY = 0.82;

export type ProcessedProof = { blob: Blob; mime: string; ext: string; name: string; before: number; after: number };

export async function processProof(file: File): Promise<ProcessedProof> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    if (!(await looksLikePdf(file))) throw new Error("PDF 파일을 읽을 수 없어요.");
    if (file.size > PROOF_MAX_BYTES) throw new Error("PDF가 10MB를 넘어요. 사진으로 찍어 올리거나 더 작은 PDF로 올려 주세요.");
    return { blob: file, mime: "application/pdf", ext: "pdf", name: file.name, before: file.size, after: file.size };
  }
  if (!file.type.startsWith("image/")) throw new Error("사진(JPG·PNG) 또는 PDF만 올릴 수 있어요.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("사진을 처리할 수 없어요.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) throw new Error("사진을 처리할 수 없어요.");
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { blob, mime: "image/jpeg", ext: "jpg", name, before: file.size, after: blob.size };
  } finally {
    bitmap.close();
  }
}
