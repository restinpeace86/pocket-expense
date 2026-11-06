// WORKON 웹푸시 서비스 워커 (D-116 · D-214) — 알림 보여 주기 + 누르면 그 화면 열기
// - 브라우저 창을 닫았거나 다른 앱을 보고 있어도, 브라우저 회사 푸시 서버가 이 워커를 깨워 알림을 띄운다(상단 배너·잠금화면).
// - 진동: 기기 설정 [알림 올 때 소리·진동]이 켜져 있으면 길게 세 번(D-227) — 휴대폰이 무음이면 OS가 알아서 울리지 않는다.
//   끄면 소리·진동 없이 배너만(silent). 안드로이드 8 이상은 진동 모양을 휴대폰의 사이트 알림 설정이 정하기도 한다.
// - 같은 대화방 알림은 한 장(tag)으로 묶고 가장 최근 메시지로 바꿔 다시 울린다(renotify).
const VIBRATE = [500, 200, 500, 200, 500]; // 길게 세 번(D-227) — 안드로이드 8 이상 크롬은 이 값 대신 휴대폰 알림 설정의 진동을 쓴다

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "WORKON", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "WORKON";
  const chat = !!(data.tag && String(data.tag).startsWith("chat-"));
  const loud = data.vibrate !== false;
  event.waitUntil(
    (async () => {
      // 채팅(D-203): 그 대화방을 지금 화면에 띄워 보고 있으면 알림을 띄우지 않는다(카톡처럼)
      if (chat && data.url) {
        const target = new URL(data.url, self.location.origin).pathname;
        const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        if (list.some((c) => c.visibilityState === "visible" && c.focused && new URL(c.url).pathname === target)) return;
      }
      const options = {
        body: data.body || "",
        tag: data.tag || undefined,
        renotify: !!data.tag && loud,
        icon: "/icons/192",
        badge: "/icons/96",
        timestamp: Date.now(),
        data: { url: data.url || "/" },
      };
      if (loud) options.vibrate = VIBRATE;
      else options.silent = true;
      await self.registration.showNotification(title, options);
    })(),
  );
});

// 누르면 그 화면으로: ① 이미 그 화면이 열린 창 → 앞으로 ② 우리 사이트 창이 열려 있으면 → 그 창을 앞으로 + 그 주소로 이동
// ③ 없으면 새 창(설치한 앱이면 앱으로). 로그인이 풀렸으면 로그인 뒤 그 화면으로 돌아온다(proxy의 next)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = list.find((c) => c.url === url);
      if (same) return same.focus();
      const ours = list.filter((c) => new URL(c.url).origin === self.location.origin);
      const pick = ours.find((c) => c.focused) || ours.find((c) => c.visibilityState === "visible") || ours[0];
      if (pick && "navigate" in pick) {
        try {
          const focused = await pick.focus();
          const moved = await (focused || pick).navigate(url);
          if (moved) return moved;
        } catch {
          // 이 워커가 아직 맡지 않은 창이면 navigate가 안 된다 → 새 창
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
