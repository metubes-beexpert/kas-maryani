import { getMessaging, getToken } from "firebase/messaging";
import { ref, update } from "firebase/database";
import { app, db } from "../config/firebase";

// Fungsi untuk meminta izin & menyimpan token ke akun user yang sedang login
export const requestAndSaveFCMToken = async (userId) => {
  try {
    const messaging = getMessaging(app);
    // Minta izin ke browser/HP
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      // Mengambil VAPID Key dengan aman dari file .env (Vite)
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });

      if (token) {
        // PERBAIKAN: Simpan token ke node 'users' agar cocok dengan Backend
        await update(ref(db, `users/${userId}`), {
          fcmToken: token,
        });
        console.log("Token FCM berhasil diamankan ke profil user!");
      }
    } else {
      console.warn("Izin notifikasi ditolak oleh pengguna.");
    }
  } catch (error) {
    console.error("Gagal mendapatkan izin notifikasi:", error);
  }
};

// Fungsi untuk memicu API Vercel
export const triggerAdminNotification = async (
  title,
  body,
  targetRoles = ["ketua", "bendahara", "superuser"]
) => {
  try {
    // Sesuaikan URL ini dengan domain Vercel Anda yang sebenarnya
    const response = await fetch(
      "https://kas-maryani.vercel.app/api/send-notif",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, targetRoles }),
      }
    );

    // PERBAIKAN: Tangkap respons dari Vercel untuk debugging
    const data = await response.json();
    console.log("Status Pengiriman Notifikasi (Vercel):", data);
  } catch (error) {
    console.error("Gagal memicu API notifikasi:", error);
  }
};
