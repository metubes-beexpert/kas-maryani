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
      // Ganti dengan VAPID Key Anda (Bisa didapat di Console Firebase -> Project Settings -> Cloud Messaging -> Web configuration)
      const token = await getToken(messaging, {
        vapidKey: "VAPID_KEY_ANDA_DARI_FIREBASE_CONSOLE",
      });

      if (token) {
        // Simpan ke Realtime Database di bawah profil user
        await update(ref(db, `users/${userId}`), {
          fcmToken: token,
        });
        console.log("Token FCM berhasil disimpan!");
      }
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
    // Ganti URL ini dengan domain vercel Anda nantinya
    await fetch("https://kas-maryani.vercel.app/api/send-notif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, targetRoles }),
    });
  } catch (error) {
    console.error("Gagal mengirim notifikasi:", error);
  }
};
