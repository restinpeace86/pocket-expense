import { describe, expect, it } from "vitest";
import { frequentRoutes, matchRecent, recentMerchants, recentPlaces, recentValues } from "./recent";

const row = (s: string, e: string, round = false) => ({
  start_location: s,
  start_lat: 37,
  start_lng: 127,
  end_location: e,
  end_lat: 35,
  end_lng: 129,
  is_round_trip: round,
});

describe("recentValues", () => {
  it("빈 값은 빼고, 같은 값은 한 번, 최근 순으로 limit개", () => {
    expect(recentValues(["(주)한빛건설", null, " ", "대성전기", "(주)한빛건설", "가", "나", "다"], 4)).toEqual(["(주)한빛건설", "대성전기", "가", "나"]);
  });
  it("앞뒤·겹친 공백은 정리", () => {
    expect(recentValues(["  한빛  건설 ", "한빛 건설"])).toEqual(["한빛 건설"]);
  });
});

describe("matchRecent", () => {
  it("글자가 들어 있는 값만, 똑같은 값은 빼고", () => {
    expect(matchRecent(["(주)한빛건설", "한빛철물건재", "대성전기"], "한빛")).toEqual(["(주)한빛건설", "한빛철물건재"]);
    expect(matchRecent(["대성전기"], "대성전기")).toEqual([]);
    expect(matchRecent(["ABC상사"], "abc")).toEqual(["ABC상사"]);
    expect(matchRecent(["대성전기"], " ")).toEqual([]);
  });
});

describe("recentMerchants", () => {
  it("가맹점마다 가장 최근 사업자번호, 최근 것에 없으면 그 전 것", () => {
    const r = recentMerchants([
      { merchant_name: "스타벅스 강남점", merchant_business_number: null },
      { merchant_name: "스타벅스 강남점", merchant_business_number: "1234567890" },
      { merchant_name: "김밥천국", merchant_business_number: "2223334444" },
      { merchant_name: null, merchant_business_number: "9" },
    ]);
    expect(r).toEqual([
      { name: "스타벅스 강남점", businessNumber: "1234567890" },
      { name: "김밥천국", businessNumber: "2223334444" },
    ]);
  });
});

describe("recentPlaces / frequentRoutes", () => {
  const company = { name: "회사", address: "서울 중구", lat: 37, lng: 127 };
  it("장소는 이름으로 한 번, 회사 이름은 빼고, 좌표 없는 것은 빼고", () => {
    const rows = [row("회사", "판교 현장"), row("판교 현장", "부산 지사"), { ...row("x", "y"), start_lat: null, end_lat: null }];
    expect(recentPlaces(rows, company).map((p) => p.name)).toEqual(["판교 현장", "부산 지사"]);
  });
  it("자주 다닌 길은 횟수 많은 순, 같으면 최근 순, 왕복은 가장 최근 값", () => {
    const rows = [row("회사", "부산 지사", false), row("회사", "판교 현장", true), row("회사", "판교 현장", false), row("회사", "부산 지사")];
    const r = frequentRoutes(rows);
    expect(r.map((x) => `${x.start.name}→${x.end.name}:${x.count}:${x.roundTrip}`)).toEqual(["회사→부산 지사:2:false", "회사→판교 현장:2:true"]);
  });
});
