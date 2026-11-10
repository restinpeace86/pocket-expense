import { describe, expect, it } from "vitest";
import { alertText, pushToast, shouldAlert, TOAST_MAX } from "./visual-alert";

const base = { meId: "me", ws: "/workspace/c", pathname: "/workspace/c/admin", enabled: true, wide: true, visible: true };
const msg = { room_id: "r1", sender_member_id: "kim", kind: "text", deleted: false };

describe("PC 무소음 시각 알림 (D-246)", () => {
  it("띄우는 경우·안 띄우는 경우", () => {
    expect(shouldAlert(msg, base)).toBe(true);
    expect(shouldAlert(msg, { ...base, pathname: "/workspace/c/chat" })).toBe(true); // 목록에서는 띄움
    expect(shouldAlert(msg, { ...base, pathname: "/workspace/c/chat/r1" })).toBe(false); // 그 방을 보는 중
    expect(shouldAlert({ ...msg, sender_member_id: "me" }, base)).toBe(false);
    expect(shouldAlert({ ...msg, kind: "system" }, base)).toBe(false);
    expect(shouldAlert(msg, { ...base, enabled: false })).toBe(false);
    expect(shouldAlert(msg, { ...base, wide: false })).toBe(false); // 휴대폰
    expect(shouldAlert(msg, { ...base, visible: false })).toBe(false); // 창이 가려짐 → 웹푸시
    expect(shouldAlert({ ...msg, sender_member_id: null }, base)).toBe(true); // 알림방 카드
  });

  it("내용 한 줄", () => {
    const m = { id: "1", room_id: "r", sender_member_id: "k", sender_name: "김대리", kind: "text", body: "회신  왔어요\n둘째", deleted: false };
    expect(alertText(m, "group")).toBe("회신 왔어요 둘째");
    expect(alertText({ ...m, kind: "image", body: null }, "group")).toBe("사진을 보냈어요.");
    expect(alertText({ ...m, kind: "file", body: null, attachment_name: "a.pdf" }, "direct")).toBe("파일을 보냈어요.");
    expect(alertText({ ...m, body: "결재가 완료됐어요\n금액: 1,000원" }, "notice")).toBe("결재가 완료됐어요");
    expect(alertText({ ...m, body: "가".repeat(80) }, "group").endsWith("…")).toBe(true);
  });

  it("같은 방은 합치고 최대 3장", () => {
    let l = pushToast([], { roomId: "a", sender: "김", room: "영업팀", text: "1", at: 1 });
    l = pushToast(l, { roomId: "b", sender: "박", room: "박", text: "2", at: 2 });
    l = pushToast(l, { roomId: "a", sender: "이", room: "영업팀", text: "3", at: 3 });
    expect(l.map((t) => [t.roomId, t.count, t.text])).toEqual([["b", 1, "2"], ["a", 2, "3"]]);
    for (const r of ["c", "d", "e"]) l = pushToast(l, { roomId: r, sender: null, room: r, text: r, at: 9 });
    expect(l).toHaveLength(TOAST_MAX);
    expect(l.map((t) => t.roomId)).toEqual(["c", "d", "e"]);
  });
});
