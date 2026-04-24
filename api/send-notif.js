import admin from "firebase-admin";

// Inisialisasi Firebase Admin (Hanya dijalankan sekali di memori Vercel)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel kadang loloskan \n sebagai string literal, kita perbaiki disini
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export default async function handler(req, res) {
  // CORS Handling jika dipanggil dari domain Firebase Hosting Anda
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  const { title, body, targetRoles } = req.body;
  const db = admin.database();

  try {
    // 1. Ambil data semua user dari Realtime Database
    const usersSnapshot = await db.ref("users").once("value");
    const users = usersSnapshot.val();

    if (!users)
      return res.status(404).json({ message: "Tidak ada user ditemukan" });

    // 2. Kumpulkan FCM Token dari user yang rolenya sesuai target
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

    // 3. Kirim Notifikasi via FCM Multicast (sekaligus ke banyak device)
    const payload = {
      notification: { title, body },
      tokens: [...new Set(tokens)], // Hindari duplikasi token
    };

    const response = await admin.messaging().sendEachForMulticast(payload);
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
