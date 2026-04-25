importScripts(
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js"
);

// Ganti dengan konfigurasi firebase Anda
firebase.initializeApp({
  apiKey: "AIzaSyARecCf1UhM6FEZ4mlxYe8OYmpbk4Vbsyg",
  authDomain: "kas-maryani.firebaseapp.com",
  databaseURL:
    "https://kas-maryani-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kas-maryani",
  storageBucket: "kas-maryani.firebasestorage.app",
  messagingSenderId: "853609780731",
  appId: "1:853609780731:web:7f49b5d9a6c54dfe96e75e",
});

const messaging = firebase.messaging();

// Handling background message
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/pwa-192x192.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
