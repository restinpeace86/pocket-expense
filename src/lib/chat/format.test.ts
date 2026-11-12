import { describe, expect, it } from "vitest";
import { assistantLinkLabel, buildRows, noticeCard, bytesLabel, meetingNoticeCard, oneLine, dateLabel, listTimeLabel, mergeMessages, previewText, roomTitle, timeLabel, unreadCountFor, readersFor, type ChatMessage } from "./format";
import { BRAND } from "@/lib/brand";

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
    expect(bytesLabel(15_000)).toBe("1MB 미만");
    expect(bytesLabel(320 * 1024 * 1024)).toBe("320MB");
    expect(bytesLabel(1024 ** 3)).toBe("1GB");
    expect(bytesLabel(1.25 * 1024 ** 3)).toBe("1.3GB");
  });
});

describe("oneLine (D-214 알림 한 줄)", () => {
  it("줄바꿈을 한 칸으로, 길면 …", () => {
    expect(oneLine("김대표: 안녕\n하세요")).toBe("김대표: 안녕 하세요");
    const long = oneLine("가".repeat(100));
    expect(long.length).toBe(60);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("meetingNoticeCard (D-217 10분 전 카드)", () => {
  it("시간·제목·장소·안건·자료 수", () => {
    expect(meetingNoticeCard("회의 시작 10분 전입니다.\n14:00~15:00 분기 점검\n장소: 3층 회의실\n안건: 1. 실적\n자료: 2개")).toEqual({ time: "14:00~15:00", title: "분기 점검", place: "3층 회의실", agenda: "1. 실적", files: 2 });
    expect(meetingNoticeCard("회의 시작 10분 전입니다.\n09:00~09:30 스탠드업")).toEqual({ time: "09:00~09:30", title: "스탠드업", place: null, agenda: null, files: 0 });
  });
  it("다른 알림 글은 카드가 아님", () => {
    expect(meetingNoticeCard("공지입니다")).toBeNull();
    expect(meetingNoticeCard(null)).toBeNull();
  });
});

describe("도우미 방 (D-222)", () => {
  it("방 이름·bot 글은 안 읽음 수 없음·[열기] 글자", () => {
    expect(roomTitle({ kind: "assistant", title: null, members: [] }, "me")).toBe(`${BRAND.name} 도우미`);
    expect(unreadCountFor({ sender_member_id: null, created_at: "2026-11-05T00:00:00Z", kind: "bot" }, [{ member_id: "me", last_read_at: "2026-11-04T00:00:00Z" }])).toBe(0);
    expect(assistantLinkLabel("/workspace/c1/calendar/rooms?date=2026-11-06")).toBe("회의실 예약 열기");
    expect(assistantLinkLabel("/workspace/c1/calendar?date=2026-11-06")).toBe("캘린더에서 보기");
    expect(assistantLinkLabel("/workspace/c1/employee/claims/x/edit")).toBe("결의서 열기");
    expect(assistantLinkLabel("/workspace/c1/admin/claims")).toBe("결재하러 가기");
  });
});

describe("noticeCard (D-224 앱 알림 카드)", () => {
  it("제목 + 이름: 값 줄 + 글 줄", () => {
    expect(noticeCard("결재가 완료됐어요\n제목: 택시비\n금액: 10,000 원\n지급까지 기다려 주세요.")).toEqual({
      title: "결재가 완료됐어요",
      rows: [
        { label: "제목", value: "택시비" },
        { label: "금액", value: "10,000 원" },
        { label: null, value: "지급까지 기다려 주세요." },
      ],
    });
    // 퇴근 누락 알림(D-238): 시각 속 ":"를 이름으로 잘못 나누지 않음
    expect(noticeCard("퇴근을 아직 안 찍었어요\n자정까지 안 찍으면 정규 퇴근 시각(18:00)으로 자동 기록돼요.\n더 일하고 있다면 자정 전에 회사 QR로 퇴근을 찍어 주세요.\n출근: 08:57")).toEqual({
      title: "퇴근을 아직 안 찍었어요",
      rows: [
        { label: null, value: "자정까지 안 찍으면 정규 퇴근 시각(18:00)으로 자동 기록돼요." },
        { label: null, value: "더 일하고 있다면 자정 전에 회사 QR로 퇴근을 찍어 주세요." },
        { label: "출근", value: "08:57" },
      ],
    });
    expect(assistantLinkLabel("/workspace/c/employee#notices")).toBe("공지 보기");
    expect(assistantLinkLabel("/workspace/c/employee/attendance")).toBe("내 근태 보기");
    expect(assistantLinkLabel("/workspace/c/employee/attendance?month=2026-11")).toBe("내 근태 보기");
    expect(assistantLinkLabel("/workspace/c/admin/attendance")).toBe("근태 승인 열기");
    expect(assistantLinkLabel("/workspace/c/employee/bus/02503")).toBe("도착 정보 보기");
    expect(assistantLinkLabel("/workspace/c/admin/export?month=2026-10")).toBe("세무 마감 열기");
    expect(assistantLinkLabel("/workspace/c/employee/claims/x")).toBe("결의서 열기");
  });
});


describe("readersFor (D-244 읽음 확인)", () => {
  const msg = { sender_member_id: "a", created_at: "2026-11-10T03:00:00Z" };
  const mem = (member_id: string, name: string, last_read_at: string, joined_at = "2026-11-01T00:00:00Z") => ({ member_id, name, status: "active", last_read_at, joined_at });
  const members = [
    mem("a", "가보냄", "2026-11-10T03:00:00Z"),
    mem("b", "하읽음", "2026-11-10T03:05:00Z"),
    mem("c", "나안읽", "2026-11-10T02:00:00Z"),
    mem("d", "다읽음", "2026-11-10T03:00:00Z"),
    mem("e", "라늦게", "2026-11-10T04:00:00Z", "2026-11-10T04:00:00Z"),
  ];
  it("보낸 사람·글 뒤에 들어온 사람은 빼고 이름 순으로 나눔", () => {
    const r = readersFor(msg, members);
    expect(r.read.map((m) => m.name)).toEqual(["다읽음", "하읽음"]);
    expect(r.unread.map((m) => m.name)).toEqual(["나안읽"]);
  });
  it("안 읽은 사람 수는 말풍선 숫자와 같음", () => {
    expect(readersFor(msg, members).unread.length).toBe(unreadCountFor({ ...msg, kind: "text" }, members));
  });
});
