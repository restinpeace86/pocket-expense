import { describe, expect, it } from "vitest";
import { capabilitiesFor } from "./capabilities";

const sup = { member_id: "s", role: "super_admin" as const };
const adm = { member_id: "a", role: "admin" as const };
const emp = (id = "e", status: "approved" | "pending" | "inactive" = "approved") => ({ id, role: "employee" as const, status });

describe("capabilitiesFor", () => {
  it("관리자는 일반 멤버만 편집·비활성화하고 역할·넘기기는 못 한다", () => {
    expect(capabilitiesFor(adm, emp())).toEqual({ canEdit: true, canChangeRole: false, canTransfer: false, canDeactivate: true });
    expect(capabilitiesFor(adm, { id: "a2", role: "admin", status: "approved" })).toEqual({
      canEdit: false,
      canChangeRole: false,
      canTransfer: false,
      canDeactivate: false,
    });
    expect(capabilitiesFor(adm, { id: "s", role: "super_admin", status: "approved" }).canEdit).toBe(false);
  });

  it("관리자 본인 정보는 편집할 수 있지만 스스로 비활성화할 수 없다", () => {
    const c = capabilitiesFor(adm, { id: "a", role: "admin", status: "approved" });
    expect(c.canEdit).toBe(true);
    expect(c.canDeactivate).toBe(false);
  });

  it("최고 관리자는 관리자까지 역할 변경·비활성화, 본인은 강등·비활성화·넘기기 대상이 아니다", () => {
    expect(capabilitiesFor(sup, { id: "a", role: "admin", status: "approved" })).toEqual({
      canEdit: true,
      canChangeRole: true,
      canTransfer: true,
      canDeactivate: true,
    });
    expect(capabilitiesFor(sup, { id: "s", role: "super_admin", status: "approved" })).toEqual({
      canEdit: true,
      canChangeRole: false,
      canTransfer: false,
      canDeactivate: false,
    });
  });

  it("활성 상태가 아니면 역할·넘기기·비활성화 버튼을 숨긴다", () => {
    for (const status of ["pending", "inactive"] as const) {
      const c = capabilitiesFor(sup, emp("e", status));
      expect([c.canChangeRole, c.canTransfer, c.canDeactivate]).toEqual([false, false, false]);
      expect(c.canEdit).toBe(true);
    }
  });
});
