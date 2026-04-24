import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../config/firebase";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult, // <-- TAMBAHAN 1: Import ini
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
      // PANGGIL NOTIFIKASI: Simpan token device jika diizinkan
      requestAndSaveFCMToken(user.uid);
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

      // PANGGIL NOTIFIKASI: Simpan token device jika diizinkan
      requestAndSaveFCMToken(user.uid);
    }
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();

    // Agar Google selalu menanyakan/menampilkan pilihan akun email
    provider.setCustomParameters({
      prompt: "select_account",
    });

    return signInWithRedirect(auth, provider);
  }

  function logout() {
    return firebaseSignOut(auth);
  }

  useEffect(() => {
    let unsubscribe;

    const initializeAuth = async () => {
      try {
        // TAMBAHAN 2: Tahan React! Suruh tunggu Firebase selesai membaca hasil Redirect dari Google
        await getRedirectResult(auth);
      } catch (error) {
        console.error("Error saat proses redirect:", error);
      }

      // TAMBAHAN 3: Setelah hasil redirect diproses, baru jalankan pengecekan normal
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        setCurrentUser(user);
        if (user) {
          await syncUserData(user);
        } else {
          setUserData(null);
        }
        // Matikan layar loading HANYA setelah kita 100% yakin status user-nya
        setLoading(false);
      });
    };

    initializeAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
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
