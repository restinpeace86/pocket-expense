// 국세청 사업자등록 상태조회 (공공데이터포털 odcloud, D-057)
// POST https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=...  body: { b_no: ["1234567890"] }

export type BusinessStatus = "active" | "suspended" | "closed" | "not_registered" | "unverified";

export type NtsStatusItem = {
  b_no: string;
  b_stt: string; // 계속사업자 / 휴업자 / 폐업자 / ""
  b_stt_cd: string; // 01 / 02 / 03 / ""
  tax_type: string; // 미등록이면 "국세청에 등록되지 않은 사업자등록번호입니다."
};

export type BusinessCheck = { status: BusinessStatus; label: string | null; raw: unknown };

// 응답 한 건 → 내부 상태
export function mapNtsStatus(item: NtsStatusItem | undefined): Omit<BusinessCheck, "raw"> {
  if (!item) return { status: "unverified", label: null };
  switch (item.b_stt_cd) {
    case "01":
      return { status: "active", label: item.b_stt || "계속사업자" };
    case "02":
      return { status: "suspended", label: item.b_stt || "휴업자" };
    case "03":
      return { status: "closed", label: item.b_stt || "폐업자" };
    default:
      if (item.tax_type?.includes("등록되지 않은")) return { status: "not_registered", label: item.tax_type };
      return { status: "unverified", label: item.tax_type || null };
  }
}

// 조회 실패(키 없음·승인 전·장애·시간 초과)는 'unverified'로 돌려 서비스를 막지 않는다.
export async function checkBusinessNumber(bNo: string, serviceKey: string | undefined, timeoutMs = 5000): Promise<BusinessCheck> {
  if (!serviceKey) return { status: "unverified", label: "조회 키 없음", raw: null };
  try {
    const res = await fetch(
      `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${serviceKey}&returnType=JSON`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ b_no: [bNo] }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      },
    );
    const body = (await res.json().catch(() => null)) as { status_code?: string; data?: NtsStatusItem[] } | null;
    if (!res.ok || body?.status_code !== "OK") return { status: "unverified", label: `조회 실패(${res.status})`, raw: body };
    return { ...mapNtsStatus(body.data?.find((d) => d.b_no === bNo)), raw: body };
  } catch {
    return { status: "unverified", label: "조회 실패(네트워크)", raw: null };
  }
}
