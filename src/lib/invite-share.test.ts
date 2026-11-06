import { describe, expect, it } from "vitest";
import { installGuideUrl, inviteShareOptions } from "./invite-share";

describe("직원 초대 카카오톡 공유 (D-229)", () => {
  it("버튼 하나로 [웹으로 가입하기]·[앱 설치 안내] 두 길 + 휴대폰별 요약", () => {
    const install = installGuideUrl("https://w.test/", "ABCD2345");
    expect(install).toBe("https://w.test/download?join=ABCD2345");
    const o = inviteShareOptions({ companyName: "다모은랩", joinLink: "https://w.test/join/ABCD2345", installLink: install, origin: "https://w.test" });
    expect(o.content.title).toBe("다모은랩에서 WORKON에 초대했어요");
    expect(o.buttons.map((b) => b.title)).toEqual(["웹으로 가입하기", "앱 설치 안내"]);
    expect(o.buttons[0].link.mobileWebUrl).toBe("https://w.test/join/ABCD2345");
    expect(o.buttons[1].link.mobileWebUrl).toBe(install);
    expect(o.itemContent.items.map((i) => i.item)).toEqual(["안드로이드", "아이폰", "PC"]);
    expect(o.content.imageUrl).toBe("https://w.test/share/invite-image");
  });
});
