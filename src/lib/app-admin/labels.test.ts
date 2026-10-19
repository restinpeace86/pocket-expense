import { describe, expect, it } from "vitest";
import { csvCell, formatBizNo, formatKst } from "./labels";

describe("app-admin labels", () => {
  it("한국 시간으로 표시", () => {
    expect(formatKst("2026-10-19T15:30:00Z")).toBe("2026-10-20 00:30");
    expect(formatKst(null)).toBe("");
  });
  it("사업자번호 형식", () => {
    expect(formatBizNo("2208162517")).toBe("220-81-62517");
    expect(formatBizNo("12")).toBe("12");
  });
  it("CSV 칸: 쉼표·따옴표·수식 시작 문자", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(-1000)).toBe("-1000");
    expect(csvCell("-1+cmd")).toBe("'-1+cmd");
    expect(csvCell(null)).toBe("");
  });
});
