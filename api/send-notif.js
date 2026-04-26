import admin from "firebase-admin";

// Pisahkan inisialisasi ke dalam fungsi agar bisa ditangkap oleh try-catch
function initFirebase() {
  if (!admin.apps.length) {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error("FIREBASE_PRIVATE_KEY belum di-setting di Vercel");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
}

export default async function handler(req, res) {
  // CORS Setup
  res.setHeader("Access-Control-Allow-Origin", "https://kas-maryani.web.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    initFirebase();

    const { title, body, targetRoles } = req.body;
    const db = admin.database();

    // Ambil semua user
    const usersSnapshot = await db.ref("users").once("value");
    const users = usersSnapshot.val();

    if (!users)
      return res.status(404).json({ message: "Tidak ada user ditemukan" });

    // Filter token berdasarkan Role & ketersediaan fcmToken
    const tokens = [];
    Object.values(users).forEach((user) => {
      if (targetRoles.includes(user.role) && user.fcmToken) {
        tokens.push(user.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return res
        .status(200)
        .json({ message: "Tidak ada target dengan device token aktif" });
    }

    // Eksekusi pengiriman via FCM
    const payload = {
      notification: { title, body },
      tokens: [...new Set(tokens)], // Hindari duplikasi
    };

    const response = await admin.messaging().sendEachForMulticast(payload);
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error("Gagal menjalankan fungsi:", error);
    res.status(500).json({ error: error.message });
  }
}
