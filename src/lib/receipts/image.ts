// 영수증 이미지 줄이기 (spec/common/performance.md §1, D-073) — 업로드 전에 브라우저에서 실행한다.
// 보관본: 긴 변 2000px JPEG / 썸네일: 긴 변 320px WebP. 다시 그리면서 사진 속 위치정보(EXIF)도 함께 지워진다.
export const RECEIPT_ORIGINAL_MAX = 2000;
export const RECEIPT_THUMB_MAX = 320;
// 저장소 한도(receipts 버킷 10MB, migration 003). 사진은 줄이면 1~2MB라 넘지 않고, 줄이지 않는 PDF만 걸린다 — 올리기 전에 막아 크레딧·빈 항목이 생기지 않게
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const TOO_LARGE_MESSAGE = "파일이 10MB를 넘어요. 사진으로 찍어 올리거나 더 작은 PDF로 올려 주세요.";
const ORIGINAL_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

// 긴 변이 max를 넘으면 비율을 지켜 줄인다(키우지는 않는다)
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new Error("이미지 크기가 올바르지 않습니다");
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const scale = max / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export const isPdf = (file: Blob) => file.type === "application/pdf";

export type ProcessedReceipt =
  | { kind: "image"; original: Blob; thumb: Blob; thumbExt: "webp" | "jpg"; width: number; height: number }
  | { kind: "pdf"; original: Blob; thumb: null };

async function render(bitmap: ImageBitmap, max: number, type: string, quality: number): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리할 수 없습니다");
  ctx.fillStyle = "#ffffff"; // 투명 PNG 배경을 흰색으로
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error("이미지를 처리할 수 없습니다");
  return blob;
}

// PDF는 줄이지 않고 원본 그대로(썸네일 없음 — 화면에서 PDF 아이콘으로 대신)
export async function processReceiptFile(file: File): Promise<ProcessedReceipt> {
  if (isPdf(file)) return { kind: "pdf", original: file, thumb: null };
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); // 휴대폰 사진 회전 반영
  try {
    const original = await render(bitmap, RECEIPT_ORIGINAL_MAX, "image/jpeg", ORIGINAL_QUALITY);
    // WebP로 저장하지 못하는 오래된 브라우저(구형 iOS 등)는 다른 형식을 돌려주므로 그때는 JPEG 썸네일로 대신한다
    let thumb = await render(bitmap, RECEIPT_THUMB_MAX, "image/webp", THUMB_QUALITY);
    let thumbExt: "webp" | "jpg" = "webp";
    if (thumb.type !== "image/webp") {
      thumb = await render(bitmap, RECEIPT_THUMB_MAX, "image/jpeg", THUMB_QUALITY);
      thumbExt = "jpg";
    }
    const size = fitWithin(bitmap.width, bitmap.height, RECEIPT_ORIGINAL_MAX);
    return { kind: "image", original, thumb, thumbExt, ...size };
  } finally {
    bitmap.close();
  }
}
