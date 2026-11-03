// PocketExpense 웹푸시 서비스 워커 (D-116) — 알림 보여 주기 + 누르면 그 화면 열기
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "PocketExpense", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "PocketExpense";
  event.waitUntil(
    (async () => {
      // 채팅(D-203): 그 대화방을 지금 보고 있으면 알림을 띄우지 않는다(카톡처럼)
      if (data.tag && String(data.tag).startsWith("chat-") && data.url) {
        const target = new URL(data.url, self.location.origin).pathname;
        const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        if (list.some((c) => c.visibilityState === "visible" && c.focused && new URL(c.url).pathname === target)) return;
      }
      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag || undefined,
        renotify: !!(data.tag && String(data.tag).startsWith("chat-")),
        icon: "/icons/192",
        badge: "/icons/96",
        data: { url: data.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url === url && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
