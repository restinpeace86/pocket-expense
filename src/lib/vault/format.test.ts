import { describe, expect, it } from "vitest";
import { fileBadge, filterVault, trashDaysLeft, usagePct, usageTone, vaultErrorMessage, vaultPaths } from "./format";

describe("파일 영구 보관 (D-245)", () => {
  it("사용률·색 단계", () => {
    expect(usagePct(320 * 1024 * 1024, 1024 * 1024 * 1024)).toBe(31);
    expect(usagePct(5, 0)).toBe(100);
    expect(usagePct(2000, 1000)).toBe(100);
    expect([usageTone(69), usageTone(70), usageTone(89), usageTone(90)]).toEqual(["ok", "warn", "warn", "full"]);
  });
  it("아이콘 글자", () => {
    expect(fileBadge("계약서.pdf", "file")).toBe("PDF");
    expect(fileBadge("견적.xlsx", "file")).toBe("XLSX");
    expect(fileBadge("메모", "file")).toBe("파일");
    expect(fileBadge("현장.jpg", "image")).toBe("사진");
  });
  it("보관 경로: 회사 폴더 + 새 id + 원본 확장자", () => {
    expect(vaultPaths("c1", "n1", "c1/r1/m1.PDF", false)).toEqual({ path: "c1/n1.pdf", thumb: null });
    expect(vaultPaths("c1", "n1", "c1/r1/m1.jpg", true)).toEqual({ path: "c1/n1.jpg", thumb: "c1/n1_thumb.jpg" });
    expect(vaultPaths("c1", "n1", "c1/r1/noext", false).path).toBe("c1/n1.bin");
  });
  it("탭·검색(이름·보관한 사람)", () => {
    const files = [
      { scope: "company" as const, name: "납품계약서.pdf", owner_member_id: "a" },
      { scope: "company" as const, name: "현장.jpg", owner_member_id: "b" },
      { scope: "private" as const, name: "내 메모.pdf", owner_member_id: "a" },
    ];
    const who = (id: string) => (id === "a" ? "박팀장" : "최직원");
    expect(filterVault(files, "company", "", who)).toHaveLength(2);
    expect(filterVault(files, "company", "계약", who).map((f) => f.name)).toEqual(["납품계약서.pdf"]);
    expect(filterVault(files, "company", "최직원", who).map((f) => f.name)).toEqual(["현장.jpg"]);
    expect(filterVault(files, "private", "", who)).toHaveLength(1);
  });
  it("오류 문구", () => {
    expect(vaultErrorMessage("VAULT_FULL")).toContain("다 찼어요");
    expect(vaultErrorMessage("something")).toContain("처리하지 못했어요");
  });
});

describe("휴지통 남은 날 (D-266)", () => {
  it("지운 날 = 기간 그대로, KST 날짜가 바뀌면 하루씩 줄고 0 아래로 안 내려감", () => {
    const del = "2026-11-13T01:00:00Z"; // KST 10:00
    expect(trashDaysLeft(del, 90, Date.parse("2026-11-13T14:00:00Z"))).toBe(90); // KST 23:00 같은 날
    expect(trashDaysLeft(del, 90, Date.parse("2026-11-13T15:30:00Z"))).toBe(89); // KST 다음 날 00:30
    expect(trashDaysLeft(del, 30, Date.parse("2027-01-01T00:00:00Z"))).toBe(0);
  });
});

