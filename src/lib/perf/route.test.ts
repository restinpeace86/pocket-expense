import { describe, expect, it } from "vitest";
import { normalizeRoute, shouldRecordRoute } from "./route";

describe("normalizeRoute", () => {
  it("회사·멤버 id를 [id]로", () => {
    expect(normalizeRoute("/workspace/1a2b3c4d-0000-0000-0000-000000000000/admin/members/9f8e7d6c-1111-2222-3333-444455556666")).toBe(
      "/workspace/[id]/admin/members/[id]",
    );
  });
  it("초대 코드·토큰과 쿼리는 지운다", () => {
    expect(normalizeRoute("/join/ABCD2345?x=1")).toBe("/join/[code]");
    expect(normalizeRoute("/join/i/abcdef0123")).toBe("/join/i/[token]");
  });
  it("기록 대상은 로그인 후 화면", () => {
    expect(shouldRecordRoute("/workspace/x/admin")).toBe(true);
    expect(shouldRecordRoute("/onboarding/pending")).toBe(true);
    expect(shouldRecordRoute("/login")).toBe(false);
  });
});
