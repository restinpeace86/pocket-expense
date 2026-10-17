// 동시에 몇 건씩만 처리하고, 실패하면 정해진 횟수만큼 다시 시도한다 (performance.md §6: 업로드·AI 인식 동시 3건, 재시도 1회)
export type PoolResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

export async function runPool<I, T>(
  items: readonly I[],
  limit: number,
  worker: (item: I, index: number) => Promise<T>,
  options: { retries?: number; onSettled?: (index: number, result: PoolResult<T>) => void } = {},
): Promise<PoolResult<T>[]> {
  if (limit < 1) throw new Error("limit은 1 이상이어야 합니다");
  const retries = options.retries ?? 0;
  const results: PoolResult<T>[] = new Array(items.length);
  let next = 0;

  async function runOne(index: number): Promise<PoolResult<T>> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return { ok: true, value: await worker(items[index], index) };
      } catch (e) {
        lastError = e;
      }
    }
    return { ok: false, error: lastError };
  }

  async function lane() {
    while (next < items.length) {
      const index = next++;
      results[index] = await runOne(index);
      options.onSettled?.(index, results[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}
