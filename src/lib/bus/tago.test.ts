import { describe, expect, it } from "vitest";
import { alertMessage } from "./arrivals";
import { isTagoKey, parseTagoArrivals, parseTagoKey, parseTagoNearby, tagoKey } from "./tago";

// 실제 TAGO 응답 모양(판교 금토천교, 2026-11-11)
const near = {
  response: {
    header: { resultCode: "00" },
    body: {
      items: {
        item: [
          { citycode: 31020, gpslati: 37.4013, gpslong: 127.1060333, nodeid: "GGB206000539", nodenm: "금토천교", nodeno: 7495 },
          { citycode: 31020, gpslati: 37.4012, gpslong: 127.10555, nodeid: "GGB206000543", nodenm: "금토천교", nodeno: 7499 },
          { citycode: 31020, gpslati: 37.4013, gpslong: 127.1060333, nodeid: "GGB206000539", nodenm: "금토천교", nodeno: 7495 },
        ],
      },
    },
  },
};
const arrivals = {
  response: {
    header: { resultCode: "00" },
    body: {
      items: {
        item: [
          { arrprevstationcnt: 12, arrtime: 743, nodeid: "GGB206000539", nodenm: "금토천교", routeid: "GGB204000059", routeno: 9507, routetp: "직행좌석버스" },
          { arrprevstationcnt: 3, arrtime: 180, nodeid: "GGB206000539", nodenm: "금토천교", routeid: "GGB204000059", routeno: 9507, routetp: "직행좌석버스" },
          { arrprevstationcnt: 2, arrtime: 95, nodeid: "GGB206000539", nodenm: "금토천교", routeid: "GGB204000100", routeno: "마을1", routetp: "마을버스" },
        ],
      },
    },
  },
};

describe("TAGO 서울 밖 주변 버스(D-254)", () => {
  it("정류장 키", () => {
    expect(tagoKey(31020, "GGB206000539")).toBe("t31020-GGB206000539");
    expect(parseTagoKey("t31020-GGB206000539")).toEqual({ city: "31020", node: "GGB206000539" });
    expect(isTagoKey("02121")).toBe(false);
    expect(isTagoKey("t31020-../x")).toBe(false);
  });
  it("근처 정류장: 거리·번호, 같은 정류장 한 번", () => {
    const s = parseTagoNearby(near, 37.4004, 127.1068);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ key: "t31020-GGB206000539", no: "7495", name: "금토천교" });
    expect(s[0].meters).toBeGreaterThan(100);
    expect(s[0].meters).toBeLessThan(150);
  });
  it("도착: 노선마다 첫·두 번째 버스, 가까운 순, 남은 정류장", () => {
    const a = parseTagoArrivals(arrivals);
    expect(a.station_name).toBe("금토천교");
    expect(a.routes.map((r) => r.route_no)).toEqual(["마을1", "9507"]);
    const r = a.routes[1];
    expect(r).toMatchObject({ arr1_sec: 180, arr2_sec: 743, arr1_msg: "[3번째 전]", route_type: "tago:직행좌석버스", veh1: "GGB204000059" });
    expect(parseTagoArrivals({ response: { header: { resultCode: "00" }, body: { items: "" } } }).routes).toEqual([]);
  });
  it("알림 글엔 TAGO 키를 보이지 않음", () => {
    expect(alertMessage("9507", 300, "금토천교", "t31020-GGB206000539", null, "")).not.toContain("t31020");
    expect(alertMessage("402", 300, "숭례문", "02121", null, "")).toContain("(02121)");
  });
});
