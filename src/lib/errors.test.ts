import { describe, expect, it } from "vitest";
import { messageForDbError } from "./errors";

describe("messageForDbError", () => {
  it("알려진 코드는 안내 문구로 바꾼다", () => {
    expect(messageForDbError({ message: "ALREADY_MEMBER" })).toContain("이미 회사에 소속");
    expect(messageForDbError({ message: "INVALID_PHONE" })).toContain("휴대폰");
  });

  it("모르는 오류는 내부 메시지를 노출하지 않는다", () => {
    const msg = messageForDbError({ message: 'duplicate key value violates unique constraint "members_auth_user_id_key"' });
    expect(msg).not.toContain("constraint");
    expect(messageForDbError(null)).toContain("다시 시도");
  });
});
