// 목록 나눠 불러오기 — 커서 방식 (performance.md §3). "마지막 항목 다음부터" 불러와 offset처럼 느려지지 않는다. 서버에서 쓴다.
export const PAGE_SIZE = 50;

export type Cursor = { v: string; id: string }; // 정렬 컬럼 값 + id(같은 값일 때 순서 고정)

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.v, c.id]), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const [v, id] = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof v !== "string" || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { v, id };
  } catch {
    return null;
  }
}

// PostgREST(supabase-js .or) 조건: 내림차순이면 (col < v) or (col = v and id < id)
export function keysetFilter(column: string, c: Cursor, direction: "desc" | "asc" = "desc"): string {
  const op = direction === "desc" ? "lt" : "gt";
  const q = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `${column}.${op}.${q(c.v)},and(${column}.eq.${q(c.v)},id.${op}.${c.id})`;
}

// limit + 1건을 불러와 다음 쪽이 있는지 판단한다
export function toPage<T extends { id: string }>(rows: T[], limit: number, sortValue: (row: T) => string) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? encodeCursor({ v: sortValue(last), id: last.id }) : null };
}
