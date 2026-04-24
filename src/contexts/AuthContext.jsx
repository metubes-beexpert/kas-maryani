import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../config/firebase";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect, // Ditambahkan untuk fallback
  getRedirectResult, // Ditambahkan untuk menangkap hasil redirect
  signOut as firebaseSignOut,
} from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { requestAndSaveFCMToken } from "../utils/notification";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function syncUserData(user) {
    if (!user) {
      setUserData(null);
      return;
    }

    const userRef = ref(db, `users/${user.uid}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      setUserData(snapshot.val());
    } else {
      // Create new pending user
      const newUserData = {
        name: user.displayName || "Anonim",
        email: user.email,
        role: "anggota", // default role, ketuanya nanti yang menentukan
        family_id: "",
        status: "pending", // need approval
      };
      await set(userRef, newUserData);
      setUserData(newUserData);
    }

    // Panggil notifikasi tanpa memblokir proses login jika gagal (silent fail)
    try {
      requestAndSaveFCMToken(user.uid);
    } catch (error) {
      console.warn("Notifikasi tidak dapat dijalankan saat ini:", error);
    }
  }

  // --- LOGIKA LOGIN HYBRID (ANTI-BLOKIR) ---
  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      // 1. Coba gunakan Popup terlebih dahulu (Lebih cepat & tidak looping)
      return await signInWithPopup(auth, provider);
    } catch (error) {
      // 2. Jika browser memblokir popup (sering terjadi di HP/PWA)
      if (error.code === "auth/popup-blocked") {
        console.log("Popup diblokir, mengalihkan menggunakan Redirect...");
        // Gunakan metode Redirect sebagai cadangan
        return signInWithRedirect(auth, provider);
      }
      throw error;
    }
  }

  function logout() {
    return firebaseSignOut(auth);
  }

  useEffect(() => {
    // Tangkap hasil jika pengguna baru saja kembali dari Redirect Google
    getRedirectResult(auth).catch((error) => {
      console.error("Error saat kembali dari Google:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await syncUserData(user);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    loginWithGoogle,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
