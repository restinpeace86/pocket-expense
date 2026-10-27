import { describe, expect, it } from "vitest";
import { fitWithin, looksLikePdf, RECEIPT_ORIGINAL_MAX, RECEIPT_THUMB_MAX } from "./image";

describe("fitWithin", () => {
  it("휴대폰 사진(4032×3024)을 긴 변 2000px로 비율 유지해 줄인다", () => {
    expect(fitWithin(4032, 3024, RECEIPT_ORIGINAL_MAX)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3024, 4032, RECEIPT_ORIGINAL_MAX)).toEqual({ width: 1500, height: 2000 });
  });

  it("썸네일은 긴 변 320px", () => {
    expect(fitWithin(1500, 2000, RECEIPT_THUMB_MAX)).toEqual({ width: 240, height: 320 });
  });

  it("이미 작은 사진은 키우지 않는다", () => {
    expect(fitWithin(800, 1200, RECEIPT_ORIGINAL_MAX)).toEqual({ width: 800, height: 1200 });
  });

  it("아주 긴 영수증도 1px 밑으로 내려가지 않는다", () => {
    expect(fitWithin(10, 40000, RECEIPT_ORIGINAL_MAX)).toEqual({ width: 1, height: 2000 });
  });

  it("크기가 0이면 오류", () => {
    expect(() => fitWithin(0, 100, 2000)).toThrow();
  });
});

describe("looksLikePdf", () => {
  it("%PDF- 로 시작하는 파일은 PDF로 본다", async () => {
    expect(await looksLikePdf(new Blob(["%PDF-1.7\n..."]))).toBe(true);
  });
  it("앞에 다른 바이트가 조금 붙은 PDF도 받는다(1KB 안)", async () => {
    expect(await looksLikePdf(new Blob(["﻿\n%PDF-1.4"]))).toBe(true);
  });
  it("이름만 .pdf인 글자 파일·빈 파일은 막는다", async () => {
    expect(await looksLikePdf(new Blob(["not a pdf"]))).toBe(false);
    expect(await looksLikePdf(new Blob([]))).toBe(false);
  });
});
