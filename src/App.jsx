import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PendingApproval from "./pages/PendingApproval";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Route Login dijaga oleh GuestRoute */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />

          <Route
            path="/pending"
            element={
              <PendingApprovalRoute>
                <PendingApproval />
              </PendingApprovalRoute>
            }
          />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Default redirect map */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Komponen mini untuk menjaga route /login (Hanya boleh diakses jika BELUM login)
function GuestRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) return null; // Tunggu proses cek autentikasi selesai

  // Jika sudah login, langsung arahkan ke root/dashboard
  if (currentUser) return <Navigate to="/" replace />;

  return children;
}

// Komponen mini untuk menjaga route /pending
function PendingApprovalRoute({ children }) {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (userData?.status !== "pending") return <Navigate to="/" replace />;

  return children;
}
