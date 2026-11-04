import { describe, expect, it } from "vitest";
import { buildRows, bytesLabel, dateLabel, listTimeLabel, mergeMessages, previewText, roomTitle, timeLabel, unreadCountFor, type ChatMessage } from "./format";

const msg = (id: string, sender: string | null, at: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  room_id: "r",
  sender_member_id: sender,
  sender_name: sender,
  kind: "text",
  body: id,
  attachment_path: null,
  attachment_name: null,
  attachment_size: null,
  attachment_mime: null,
  width: null,
  height: null,
  created_at: at,
  deleted: false,
  ...extra,
});
const mem = (id: string, name: string, read = "2026-11-03T00:00:00Z", status = "approved") => ({ member_id: id, name, status, last_read_at: read, joined_at: "2026-11-01T00:00:00Z" });

describe("메신저 방 이름 (D-203)", () => {
  it("1:1은 상대 이름, 퇴사자는 (퇴사)", () => {
    expect(roomTitle({ kind: "direct", title: null, members: [mem("me", "나"), mem("a", "김대표")] }, "me")).toBe("김대표");
    expect(roomTitle({ kind: "direct", title: null, members: [mem("me", "나"), mem("a", "최직원", undefined, "inactive")] }, "me")).toBe("최직원(퇴사)");
  });
  it("그룹은 정한 이름, 없으면 참여자 3명 + 외 N명", () => {
    expect(roomTitle({ kind: "group", title: "영업팀", members: [] }, "me")).toBe("영업팀");
    const ms = [mem("me", "나"), mem("a", "가"), mem("b", "나나"), mem("c", "다"), mem("d", "라")];
    expect(roomTitle({ kind: "group", title: null, members: ms }, "me")).toBe("가, 나나, 다 외 1명");
  });
  it("소명서 방은 소명서 제목", () => {
    expect(roomTitle({ kind: "claim", title: null, claim_title: "10월 출장비", members: [] }, "me")).toBe("📄 10월 출장비");
  });
});

describe("말풍선 옆 안 읽은 수", () => {
  it("보낸 사람 빼고, 그 메시지보다 앞까지 읽은 사람만 센다", () => {
    const members = [mem("me", "나", "2026-11-03T05:00:00Z"), mem("a", "가", "2026-11-03T04:00:00Z"), mem("b", "나나", "2026-11-03T06:00:00Z")];
    expect(unreadCountFor(msg("1", "me", "2026-11-03T05:00:00Z"), members)).toBe(1);
    expect(unreadCountFor(msg("2", "me", "2026-11-03T03:00:00Z"), members)).toBe(0);
    expect(unreadCountFor(msg("3", null, "2026-11-03T07:00:00Z", { kind: "system" }), members)).toBe(0);
  });
});

describe("시각 표시(한국 시간)", () => {
  it("오전·오후", () => {
    expect(timeLabel("2026-11-03T06:05:00Z")).toBe("오후 3:05");
    expect(timeLabel("2026-11-02T15:00:00Z")).toBe("오전 12:00");
  });
  it("날짜 구분선", () => expect(dateLabel("2026-11-03T01:00:00Z")).toBe("2026년 11월 3일 화요일"));
  it("목록: 오늘·어제·올해·작년", () => {
    const now = "2026-11-03T03:00:00Z";
    expect(listTimeLabel("2026-11-03T01:00:00Z", now)).toBe("오전 10:00");
    expect(listTimeLabel("2026-11-02T01:00:00Z", now)).toBe("어제");
    expect(listTimeLabel("2026-10-02T01:00:00Z", now)).toBe("10월 2일");
    expect(listTimeLabel("2025-10-02T01:00:00Z", now)).toBe("2025. 10. 2.");
  });
});

describe("미리보기", () => {
  it("삭제·사진·파일·글", () => {
    expect(previewText(msg("x", "a", "2026-11-03T00:00:00Z", { deleted: true }))).toBe("삭제된 메시지입니다.");
    expect(previewText(msg("x", "a", "2026-11-03T00:00:00Z", { kind: "image" }))).toBe("사진");
    expect(previewText(msg("x", "a", "2026-11-03T00:00:00Z", { kind: "file", attachment_name: "견적.pdf" }))).toBe("파일: 견적.pdf");
    expect(previewText(msg("x", "a", "2026-11-03T00:00:00Z", { body: "안녕\n하세요" }))).toBe("안녕 하세요");
  });
});

describe("카톡처럼 묶기", () => {
  it("날짜 구분선 + 같은 사람·같은 분이면 이름은 첫 줄, 시각은 마지막 줄", () => {
    const rows = buildRows(
      [msg("1", "a", "2026-11-02T01:00:10Z"), msg("2", "a", "2026-11-03T01:00:10Z"), msg("3", "a", "2026-11-03T01:00:40Z"), msg("4", "me", "2026-11-03T01:00:50Z"), msg("5", null, "2026-11-03T01:01:00Z", { kind: "system" })],
      "me",
    );
    expect(rows.map((r) => r.type)).toEqual(["date", "msg", "date", "msg", "msg", "msg", "system"]);
    const m = rows.filter((r) => r.type === "msg");
    expect(m.map((r) => [r.showName, r.showTime, r.mine])).toEqual([
      [true, true, false],
      [true, false, false],
      [false, true, false],
      [true, true, true],
    ]);
  });
  it("합치기: 같은 id는 새 것으로, 시간순", () => {
    const merged = mergeMessages([msg("b", "a", "2026-11-03T02:00:00Z", { pending: "sending", localUrl: "blob:x" })], [msg("a", "a", "2026-11-03T01:00:00Z"), msg("b", "a", "2026-11-03T02:00:00Z")]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
    expect(merged[1].pending).toBeUndefined();
    expect(merged[1].localUrl).toBe("blob:x");
  });
});

describe("bytesLabel (D-212 저장 공간)", () => {
  it("1GB 미만은 MB, 이상은 GB", () => {
    expect(bytesLabel(0)).toBe("0MB");
    expect(bytesLabel(320 * 1024 * 1024)).toBe("320MB");
    expect(bytesLabel(1024 ** 3)).toBe("1GB");
    expect(bytesLabel(1.25 * 1024 ** 3)).toBe("1.3GB");
  });
});
