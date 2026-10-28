// 세무 마감 ZIP을 관리자 브라우저에서 묶는다 (performance.md §5, D-073)
// 서버 함수는 응답 크기 제한(약 4.5MB)이 있어 ZIP을 서버에서 만들지 않는다. 엑셀은 서버가 만들고, 영수증은 10분짜리 링크로 직접 받는다.
// 동시에 4장씩 받고, 실패한 장은 새 링크로 한 번 더. 한 파일이 약 500MB를 넘으면 _1.zip, _2.zip …으로 나눈다.
import { Zip, ZipPassThrough } from "fflate";

export type ZipFile = { name: string; url: string | null };
export type ZipProgress = { done: number; total: number; failed: number };

class Part {
  chunks: Uint8Array<ArrayBuffer>[] = [];
  size = 0;
  private zip: Zip;
  private finished: Promise<void>;
  constructor() {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    this.finished = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.zip = new Zip((err, chunk, final) => {
      if (err) return reject(err);
      this.chunks.push(chunk as Uint8Array<ArrayBuffer>);
      this.size += chunk.length;
      if (final) resolve();
    });
  }
  add(name: string, data: Uint8Array) {
    // 사진·PDF는 이미 압축돼 있어 다시 압축하지 않는다(빠르고 크기 차이 없음)
    const f = new ZipPassThrough(name);
    this.zip.add(f);
    f.push(data, true);
  }
  async end(): Promise<Blob> {
    this.zip.end();
    await this.finished;
    return new Blob(this.chunks, { type: "application/zip" });
  }
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function buildTaxZip(opts: {
  workbook: { name: string; data: Uint8Array };
  files: ZipFile[];
  refreshUrls: (names: string[]) => Promise<ZipFile[]>; // 실패분 새 링크
  onProgress: (p: ZipProgress) => void;
  // 영수증을 다 받은 뒤 같은 바이트로 만들 추가 파일(지출결의서 PDF). 실패하면 null — ZIP은 그대로 만든다
  extra?: (got: Map<string, Uint8Array>) => Promise<{ name: string; data: Uint8Array } | null>;
  // 영수증 외에 함께 넣을 파일(홈택스자료/ 폴더, D-158). 못 받은 파일은 attachmentsFailed로
  attachments?: { folder: string; files: ZipFile[] };
  maxPartBytes?: number;
  concurrency?: number;
}): Promise<{ parts: Blob[]; failed: string[]; extraAdded: boolean; attachmentsFailed: string[] }> {
  const max = opts.maxPartBytes ?? 500 * 1024 * 1024;
  const parts: Blob[] = [];
  let part = new Part();
  part.add(opts.workbook.name, opts.workbook.data);
  const total = opts.files.length;
  let done = 0;
  let failed: ZipFile[] = [];
  const got = new Map<string, Uint8Array>();
  // 받은 순서대로 넣되, 넣는 동안 다른 다운로드와 섞이지 않게 한 줄로 넣는다
  let chain = Promise.resolve();
  const put = (name: string, data: Uint8Array) => {
    chain = chain.then(async () => {
      if (part.size > 0 && part.size + data.length > max) {
        parts.push(await part.end());
        part = new Part();
      }
      part.add(`영수증/${name}`, data);
    });
    got.set(name, data);
    return chain;
  };

  async function run(list: ZipFile[], countFailed: boolean) {
    const queue = [...list];
    const miss: ZipFile[] = [];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const data = f.url ? await fetchBytes(f.url) : null;
        if (data) {
          await put(f.name, data);
          done++;
        } else miss.push(f);
        opts.onProgress({ done, total, failed: countFailed ? miss.length : 0 });
      }
    };
    await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 4, Math.max(list.length, 1)) }, worker));
    return miss;
  }

  failed = await run(opts.files, false);
  if (failed.length) {
    const again = await opts.refreshUrls(failed.map((f) => f.name)).catch(() => failed);
    failed = await run(again, true);
  }
  await chain;
  const attachmentsFailed: string[] = [];
  for (const f of opts.attachments?.files ?? []) {
    const data = f.url ? await fetchBytes(f.url) : null;
    if (data) part.add(`${opts.attachments!.folder}/${f.name}`, data);
    else attachmentsFailed.push(f.name);
  }
  const more = opts.extra ? await opts.extra(got).catch(() => null) : null;
  if (more) part.add(more.name, more.data);
  parts.push(await part.end());
  return { parts, failed: failed.map((f) => f.name), extraAdded: !!more, attachmentsFailed };
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
