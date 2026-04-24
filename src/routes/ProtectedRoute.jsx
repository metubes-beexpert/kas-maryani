import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-brand-700">Loading...</div>;

  if (!currentUser) return <Navigate to="/login" replace />;

  if (userData?.status === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  // Jika allowedRoles diisi, berarti rute ini spesifik untuk peran tertentu
  if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
    return <Navigate to="/" replace />; // Lempar ke dashboard utama
  }

  return children;
}
