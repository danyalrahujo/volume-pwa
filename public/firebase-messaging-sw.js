importScripts(
  "https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyDyijHPMZIIGkgfxnaDydwF-CHYBYj_v94",
  authDomain: "volume-c5c8d.firebaseapp.com",
  projectId: "volume-c5c8d",
  storageBucket: "volume-c5c8d.firebasestorage.app",
  messagingSenderId: "803553631311",
  appId: "1:803553631311:web:1583254b4e9a2383059e3a",
  measurementId: "G-VKDGCDK35N"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle =
    payload.notification?.title || "VOLUME";

  const notificationOptions = {
    body:
      payload.notification?.body ||
      "You have a new VOLUME notification.",
    icon: "/volume-pwa/pwa-192x192.png",
    data: {
      url: "/volume-pwa/"
    }
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/volume-pwa/") && "focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(
          "https://danyalrahujo.github.io/volume-pwa/"
        );
      }
    })
  );
});