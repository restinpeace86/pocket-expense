import { describe, expect, it } from "vitest";
import { checkBusinessNumber, mapNtsStatus } from "./nts";

describe("mapNtsStatus", () => {
  it("상태 코드를 내부 상태로 바꾼다", () => {
    expect(mapNtsStatus({ b_no: "1", b_stt: "계속사업자", b_stt_cd: "01", tax_type: "" }).status).toBe("active");
    expect(mapNtsStatus({ b_no: "1", b_stt: "휴업자", b_stt_cd: "02", tax_type: "" }).status).toBe("suspended");
    expect(mapNtsStatus({ b_no: "1", b_stt: "폐업자", b_stt_cd: "03", tax_type: "" }).status).toBe("closed");
  });

  it("국세청 미등록 번호를 구분한다 (실제 응답 문구)", () => {
    const r = mapNtsStatus({ b_no: "1234567890", b_stt: "", b_stt_cd: "", tax_type: "국세청에 등록되지 않은 사업자등록번호입니다." });
    expect(r.status).toBe("not_registered");
  });

  it("응답이 없으면 확인 대기", () => {
    expect(mapNtsStatus(undefined).status).toBe("unverified");
  });
});

describe("checkBusinessNumber", () => {
  it("키가 없으면 조회하지 않고 확인 대기로 둔다 (서비스를 막지 않음)", async () => {
    const r = await checkBusinessNumber("1248100998", undefined);
    expect(r.status).toBe("unverified");
  });
});
