import { describe, expect, it } from "vitest";
import { receiptPaths } from "./paths";

const ids = { companyId: "c1", memberId: "m1", claimId: "k1", itemId: "i1" };

describe("receiptPaths", () => {
  it("첫 폴더는 회사, 보관본 jpg + 썸네일 webp", () => {
    expect(receiptPaths(ids)).toEqual({ original: "c1/m1/k1/i1.jpg", thumb: "c1/m1/k1/i1_thumb.webp" });
  });
  it("WebP를 못 만들면 jpg 썸네일", () => {
    expect(receiptPaths({ ...ids, thumbExt: "jpg" }).thumb).toBe("c1/m1/k1/i1_thumb.jpg");
  });
    it("PDF는 원본만", () => {
    expect(receiptPaths({ ...ids, pdf: true })).toEqual({ original: "c1/m1/k1/i1.pdf", thumb: null });
  });
});
