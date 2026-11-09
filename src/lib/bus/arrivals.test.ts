import { describe, expect, it } from "vitest";
import { alertDecision, alertMessage, alertNeedsFetch, arrivalLabel, isStale, parseStationByUid, remainingSec, stopsAway } from "./arrivals";

// 실제 getStationByUid 응답 모양(숭례문 02121, 2026-11-09)
const sample = {
  msgHeader: { headerCd: "0", headerMsg: "정상적으로 처리되었습니다." },
  msgBody: {
    itemList: [
      { stNm: "숭례문", arsId: "02121", busRouteId: "100100389", rtNm: "9401", routeType: "6", adirection: "구미동차고지", nxtStn: "명동.롯데영플라자", traTime1: "5", arrmsg1: "곧 도착", vehId1: "107017416", traTime2: "5", arrmsg2: "곧 도착", vehId2: "107017391", isLast1: "0", congestion1: "0", term: "5" },
      { stNm: "숭례문", arsId: "02121", busRouteId: "234000016", rtNm: "5000용인", routeType: "8", adirection: "용인", nxtStn: "서울역", traTime1: "248", arrmsg1: "4분후[2번째 전]", vehId1: "v5000a", traTime2: "489", arrmsg2: "7분후[2번째 전]", vehId2: "v5000b", isLast1: "1", congestion1: "4", term: "10" },
      { stNm: "숭례문", arsId: "02121", busRouteId: "x", rtNm: "P9211(출근)용인", routeType: "8", traTime1: "0", arrmsg1: "운행종료", vehId1: "0", traTime2: "0", arrmsg2: "운행종료", vehId2: "0", isLast1: "0", congestion1: "0" },
    ],
  },
};

describe("getStationByUid 다루기(D-243)", () => {
  const { station_name, routes } = parseStationByUid(sample);
  it("정류장 이름·노선 · 남은 초 · 운행 안 함", () => {
    expect(station_name).toBe("숭례문");
    expect(routes.map((r) => r.route_no)).toEqual(["9401", "5000용인", "P9211(출근)용인"]);
    expect(routes[1]).toMatchObject({ arr1_sec: 248, veh1: "v5000a", is_last1: true, congestion: 4, direction: "용인" });
    expect(routes[2]).toMatchObject({ arr1_sec: null, veh1: null, arr1_msg: "운행종료" });
    expect(parseStationByUid({ msgBody: { itemList: null } }).routes).toEqual([]);
  });
  it("가져온 뒤 1분 지나면 1분 빼서 보여 줌", () => {
    const at = "2026-11-09T09:00:00Z";
    expect(remainingSec(248, at, new Date("2026-11-09T09:01:00Z"))).toBe(188);
    expect(arrivalLabel(188, "")).toBe("약 4분 후");
    expect(arrivalLabel(remainingSec(248, at, new Date("2026-11-09T09:03:30Z")), "")).toBe("곧 도착");
    expect(arrivalLabel(null, "운행종료")).toBe("운행종료");
    expect(stopsAway("4분후[2번째 전]")).toBe("2번째 전");
    expect(isStale(at, new Date("2026-11-09T09:02:59Z"))).toBe(false);
    expect(isStale(at, new Date("2026-11-09T09:03:00Z"))).toBe(true);
  });
  it("알림: 10분 전 → 5분 전 → 다음 차량", () => {
    const at = "2026-11-09T09:00:00Z";
    const r = (sec: number, veh = "A") => ({ ...routes[1], arr1_sec: sec, veh1: veh });
    expect(alertDecision(r(700), at, { last_veh: null, sent10: false, sent5: false }, new Date(at))).toBeNull();
    expect(alertDecision(r(580), at, { last_veh: null, sent10: false, sent5: false }, new Date(at))).toMatchObject({ kind: "10", veh: "A" });
    expect(alertDecision(r(580), at, { last_veh: "A", sent10: true, sent5: false }, new Date(at))).toBeNull();
    expect(alertDecision(r(280), at, { last_veh: "A", sent10: true, sent5: false }, new Date(at))).toMatchObject({ kind: "5" });
    expect(alertDecision(r(280), at, { last_veh: "A", sent10: true, sent5: true }, new Date(at))).toBeNull();
    // 앞 버스가 지나가 다음 차량(B)이 9분 뒤 → 다시 10분 전 알림
    expect(alertDecision(r(540, "B"), at, { last_veh: "A", sent10: true, sent5: true }, new Date(at))).toMatchObject({ kind: "10", veh: "B" });
    // 켰을 때 이미 4분 → 5분 전 알림 바로
    expect(alertDecision(r(240), at, { last_veh: null, sent10: false, sent5: false }, new Date(at))).toMatchObject({ kind: "5" });
  });
  it("알림 정류장 다시 가져오기: 12분 안이면 1분, 아니면 3분", () => {
    const at = "2026-11-09T09:00:00Z";
    expect(alertNeedsFetch({ ...routes[1], arr1_sec: 600 }, at, new Date("2026-11-09T09:01:00Z"))).toBe(true);
    expect(alertNeedsFetch({ ...routes[1], arr1_sec: 1200 }, at, new Date("2026-11-09T09:01:00Z"))).toBe(false);
    expect(alertNeedsFetch({ ...routes[1], arr1_sec: 1200 }, at, new Date("2026-11-09T09:03:00Z"))).toBe(true);
  });
  it("알림 글", () => {
    expect(alertMessage("402", 590, "숭례문", "02121", "광화문", "10분후[4번째 전]")).toBe("402번 버스 약 10분 후 도착\n정류장: 숭례문(02121) · 광화문 방면 · 4번째 전\n참고용이에요. 실제와 1~3분 차이가 날 수 있어요.");
  });
});
