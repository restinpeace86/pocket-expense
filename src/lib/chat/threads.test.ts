import { describe, expect, it } from "vitest";
import type { ChatThread } from "./format";
import { applyThreadMessage, canStartThread, cleanAiLine, fallbackTitle, filterThreads, threadMeta } from "./threads";

const t = (o: Partial<ChatThread> = {}): ChatThread => ({
  id: "t", room_id: "r", root_message_id: "m", title: "견적 확인", status: "open", summary: null, created_by: "a", created_by_name: "A", closed_by_name: null, closed_at: null,
  message_count: 1, last_message_at: "", created_at: "", people: [], people_count: 2, mine: false, new: 0, ...o,
});

describe("서브 대화 (D-246)", () => {
  it("만들 수 있는 방·메시지", () => {
    const m = { kind: "text" as const, deleted: false };
    expect(canStartThread(m, "group")).toBe(true);
    expect(canStartThread(m, "direct")).toBe(true);
    expect(canStartThread(m, "claim")).toBe(true);
    expect(canStartThread(m, "notice")).toBe(false);
    expect(canStartThread(m, "assistant")).toBe(false);
    expect(canStartThread({ kind: "system", deleted: false }, "group")).toBe(false);
    expect(canStartThread({ ...m, thread_id: "x" }, "group")).toBe(false);
    expect(canStartThread({ ...m, thread: t() }, "group")).toBe(false);
    expect(canStartThread({ ...m, pending: "sending" }, "group")).toBe(false);
  });

  it("AI 실패 때 제목", () => {
    expect(fallbackTitle({ kind: "text", body: "\n  예시상사 견적서  금액이 달라요\n둘째", attachment_name: null })).toBe("예시상사 견적서 금액이 달라요");
    expect(fallbackTitle({ kind: "file", body: null, attachment_name: "계약서.pdf" })).toBe("계약서.pdf");
    expect(fallbackTitle({ kind: "text", body: "가".repeat(50), attachment_name: null })).toHaveLength(40);
  });

  it("AI 답 다듬기", () => {
    expect(cleanAiLine('"예시상사 견적 단가 확인."\n설명', 40)).toBe("예시상사 견적 단가 확인");
    expect(cleanAiLine("「10월 단가 적용 요청」", 60)).toBe("10월 단가 적용 요청");
    expect(cleanAiLine(null, 10)).toBe("");
  });

  it("카드 숫자·새 글", () => {
    expect(threadMeta(t({ people_count: 3, message_count: 7 }))).toBe("3명 · 글 7개");
    const base = { me: "me", participants: ["me", "kim"], senderId: "kim", insert: true, viewing: false };
    expect(applyThreadMessage(t({ new: 1 }), t({ new: 0 }), base).new).toBe(2);
    expect(applyThreadMessage(t({ new: 1 }), t(), { ...base, viewing: true }).new).toBe(0);
    expect(applyThreadMessage(t(), t(), { ...base, participants: ["kim"] })).toMatchObject({ mine: false, new: 0 });
    expect(applyThreadMessage(t(), t(), { ...base, senderId: "me" }).new).toBe(0);
    expect(applyThreadMessage(t({ new: 2 }), t(), { ...base, insert: false }).new).toBe(2);
  });

  it("목록 거르기", () => {
    const list = [t({ id: "1", title: "견적" }), t({ id: "2", title: "워크숍", status: "closed", summary: "리조트 확정" })];
    expect(filterThreads(list, "open", "").map((x) => x.id)).toEqual(["1"]);
    expect(filterThreads(list, "closed", "리조트").map((x) => x.id)).toEqual(["2"]);
    expect(filterThreads(list, "closed", "견적")).toHaveLength(0);
  });
});
