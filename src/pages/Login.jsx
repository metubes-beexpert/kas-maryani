import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LogIn } from "lucide-react";

export default function Login() {
  const { loginWithGoogle, currentUser, userData } = useAuth();
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Redirect jika sudah login
  if (currentUser && userData) {
    if (userData.status === "pending") {
      navigate("/pending");
    } else {
      navigate("/");
    }
  }

  async function handleGoogleLogin() {
    try {
      setError("");
      await loginWithGoogle();
      // Navigasi akan di-handle oleh context dan conditional render di atas
    } catch (err) {
      setError("Gagal masuk. Silakan coba lagi.");
      console.error(err);
    }
  }

  return (
    <div className="min-h-[100svh] flex flex-col justify-center items-center p-6 bg-brand-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-brand-100 flex flex-col items-center text-center">
        {/* Placeholder Logo / Icon Keluarga */}
        <div className="w-20 h-20 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <LogIn className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-semibold text-brand-900 mb-2">
          Keluarga Besar Almarhumah <br />{" "}
          <span className="text-brand-600">Hj Maryani</span>
        </h1>
        <p className="text-brand-500 mb-8 text-sm">
          Sistem Informasi Manajemen Keuangan dan Acara Keluarga. Silakan masuk
          untuk melanjutkan.
        </p>

        {error && (
          <div className="mb-4 text-red-500 text-sm font-medium">{error}</div>
        )}

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-brand-600 hover:bg-brand-700 text-white py-3 px-4 rounded-xl transition-all duration-300 font-medium active:scale-[0.98] shadow-md hover:shadow-lg"
        >
          <svg
            className="w-5 h-5 bg-white rounded-full p-0.5"
            viewBox="0 0 24 24"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Lanjut dengan Google
        </button>
      </div>

      <div className="mt-8 text-brand-400 text-xs text-center">
        &copy; {new Date().getFullYear()} Keluarga Besar Almarhumah Ibu Hj
        Maryani | Bantu.in
      </div>
    </div>
  );
}
