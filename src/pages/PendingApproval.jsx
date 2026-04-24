import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Clock, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PendingApproval() {
  const { logout, userData } = useAuth();

  return (
    <div className="min-h-[100svh] flex flex-col justify-center items-center p-6 bg-brand-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-brand-100 flex flex-col items-center text-center">
        
        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 shadow-sm border border-amber-100">
          <Clock className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-semibold text-brand-900 mb-2">
          Menunggu Persetujuan
        </h1>
        <p className="text-brand-600 mb-6 text-sm leading-relaxed">
          Halo <span className="font-semibold">{userData?.name || 'Keluarga'}</span>,<br/>
          Akun Anda saat ini sedang menunggu persetujuan dari Ketua untuk memastikan keamanan data keluarga kita.
        </p>

        <div className="bg-brand-50 rounded-xl p-4 w-full mb-8 border border-brand-100">
          <p className="text-xs text-brand-500">
            Silakan hubungi Ketua / Admin keluarga jika proses ini memakan waktu lama.
          </p>
        </div>

        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-brand-100 hover:bg-brand-200 text-brand-700 py-3 px-4 rounded-xl transition-all duration-300 font-medium active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </div>
  );
}
