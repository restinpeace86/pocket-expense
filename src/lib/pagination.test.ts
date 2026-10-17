import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, keysetFilter, toPage } from "./pagination";

const id = "0a1b2c3d-0000-0000-0000-000000000001";

describe("cursor", () => {
  it("인코딩한 커서를 그대로 되돌린다", () => {
    const c = { v: "2026-10-17T09:30:00.000Z", id };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it("조작된 커서는 무시한다", () => {
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify(["x", "1 or 1=1"])).toString("base64url"))).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });
});

describe("keysetFilter", () => {
  it("내림차순: 값이 작거나, 같으면 id가 작은 것", () => {
    expect(keysetFilter("submitted_at", { v: "2026-10-17T09:30:00Z", id })).toBe(
      `submitted_at.lt."2026-10-17T09:30:00Z",and(submitted_at.eq."2026-10-17T09:30:00Z",id.lt.${id})`,
    );
  });
  it("오름차순은 gt", () => {
    expect(keysetFilter("approved_at", { v: "2026-10-01", id }, "asc")).toContain("approved_at.gt.");
  });
  it("값의 따옴표는 이스케이프", () => {
    expect(keysetFilter("title", { v: 'a"b', id })).toContain('title.lt."a\\"b"');
  });
});

describe("toPage", () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({ id: `0a1b2c3d-0000-0000-0000-00000000000${i}`, at: `2026-10-0${9 - i}` }));
  it("limit+1건이 오면 다음 쪽 커서를 준다", () => {
    const page = toPage(rows, 3, (r) => r.at);
    expect(page.items).toHaveLength(3);
    expect(decodeCursor(page.nextCursor)).toEqual({ v: "2026-10-07", id: rows[2].id });
  });
  it("마지막 쪽이면 커서 없음", () => {
    expect(toPage(rows.slice(0, 2), 3, (r) => r.at).nextCursor).toBeNull();
  });
});
