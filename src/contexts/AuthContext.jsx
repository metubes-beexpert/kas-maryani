import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../config/firebase";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
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
    return signInWithPopup(auth, provider);
  }

  function logout() {
    return firebaseSignOut(auth);
  }

  useEffect(() => {
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
