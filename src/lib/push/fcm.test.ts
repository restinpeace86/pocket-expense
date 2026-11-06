import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));

describe("안드로이드 설치 앱 알림 (D-228)", () => {
  it("채팅·회의(urgency high) = chat 채널·높은 우선순위, 나머지 = general", async () => {
    const { fcmBody, fcmChannel } = await import("./fcm");
    expect(fcmChannel({ urgency: "high" })).toBe("chat");
    expect(fcmChannel({})).toBe("general");
    const b = fcmBody("tok", { title: "김개발", body: "점심 뭐 먹어요?", url: "/workspace/c/chat/r", tag: "chat-r", urgency: "high" });
    expect(b.message.token).toBe("tok");
    expect(b.message.notification).toEqual({ title: "김개발", body: "점심 뭐 먹어요?" });
    expect(b.message.data).toEqual({ url: "/workspace/c/chat/r", tag: "chat-r" });
    expect(b.message.android.priority).toBe("HIGH");
    expect(b.message.android.notification).toMatchObject({ channel_id: "chat", tag: "chat-r", notification_priority: "PRIORITY_HIGH", icon: "ic_stat_notify" });
    const n = fcmBody("tok", { title: "결재가 완료됐어요", body: "x", url: "/w" });
    expect(n.message.android.priority).toBe("NORMAL");
    expect(n.message.android.notification.channel_id).toBe("general");
    expect(n.message.data).toEqual({ url: "/w" });
  });

  it("설치 앱이 있는 사람은 안드로이드 웹 알림만 건너뜀(같은 알림 두 번 방지), PC 웹 알림은 그대로", async () => {
    const { dropAndroidWeb } = await import("./server");
    const subs = [
      { id: "1", member_id: "a", user_agent: "Mozilla/5.0 (Linux; Android 14; SM-S921N) Chrome/130 Mobile" },
      { id: "2", member_id: "a", user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130" },
      { id: "3", member_id: "b", user_agent: "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile" },
      { id: "4", member_id: "a", user_agent: null },
    ];
    expect(dropAndroidWeb(subs, new Set(["a"])).map((s) => s.id)).toEqual(["2", "3", "4"]);
    expect(dropAndroidWeb(subs, new Set()).length).toBe(4);
  });

  it("APK 주소 = 공개 저장소 app-downloads", async () => {
    const { androidApkUrl, ANDROID_APP_VERSION, ANDROID_APK_READY } = await import("@/lib/app-download");
    const url = androidApkUrl({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co/" });
    if (ANDROID_APK_READY) expect(url).toBe(`https://x.supabase.co/storage/v1/object/public/app-downloads/android/workon.apk?v=${ANDROID_APP_VERSION}`);
    else expect(url).toBeNull(); // 올리기 전에는 받기 버튼을 숨김
    expect(androidApkUrl({})).toBeNull();
  });
});
