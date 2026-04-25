import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDatabase } from "../hooks/useDatabase"; // DITAMBAHKAN
import {
  LogOut,
  Home,
  Wallet,
  Users,
  Settings,
  ShieldAlert,
  CalendarClock,
  History,
} from "lucide-react";
import HomeTab from "../components/HomeTab";
import ApprovalCenterTab from "../components/ApprovalCenterTab";
import EventsManagerTab from "../components/EventsManagerTab";
import FinanceMemberTab from "../components/FinanceMemberTab";
import FinanceAdminTab from "../components/FinanceAdminTab";
import LogsTab from "../components/LogsTab";
import UserManagerTab from "../components/UserManagerTab";

export default function Dashboard() {
  const { userData, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("beranda");

  // DITAMBAHKAN: Ambil data untuk menghitung notifikasi global
  const { data: users } = useDatabase("users");
  const { data: transactions } = useDatabase("transactions");

  // Kalkulasi Notifikasi
  let totalApprovalNotif = 0;
  let totalBendaharaNotif = 0;

  if (users) {
    totalApprovalNotif += Object.values(users).filter(
      (u) => u.status === "pending"
    ).length;
  }

  if (transactions) {
    Object.values(transactions).forEach((tx) => {
      // Notifikasi untuk Ketua (Approval Center)
      if (
        ["menunggu_ketua", "menunggu_hapus", "menunggu_edit"].includes(
          tx.status
        )
      ) {
        totalApprovalNotif++;
      }

      // Notifikasi untuk Bendahara (Portal Bendahara)
      if (
        [
          "pemasukan_kas",
          "pemasukan_tabungan",
          "bayar_pinjaman",
          "bayar_pinjaman_tabungan",
        ].includes(tx.type) &&
        tx.status === "pending_bendahara"
      ) {
        totalBendaharaNotif++;
      }
      if (
        tx.type === "pengajuan_pinjaman" &&
        tx.status === "menunggu_bendahara"
      ) {
        totalBendaharaNotif++;
      }
    });
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "beranda":
        return <HomeTab />;
      case "persetujuan":
        return <ApprovalCenterTab />;
      case "acara":
        return <EventsManagerTab />;
      case "keuangan":
        return <FinanceMemberTab />;
      case "kelola_keuangan":
        if (userData?.role === "bendahara" || userData?.role === "superuser")
          return <FinanceAdminTab />;
        return <HomeTab />;
      case "log":
        return <LogsTab />;
      case "akses":
        return <UserManagerTab />;
      case "keluarga":
        return (
          <div className="p-6 text-center text-brand-400">
            Modul Keluarga (Segera hadir)
          </div>
        );
      default:
        return <HomeTab />;
    }
  };

  return (
    <div className="h-[100svh] bg-brand-50 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex justify-between items-center z-10 border-b border-brand-100 shadow-sm shrink-0">
        <div>
          <h1 className="text-xl font-bold text-brand-900">
            Kas Keluarga Almh. Hj Maryani
          </h1>
          <p className="text-xs text-brand-500 capitalize font-medium">
            {userData?.role} • {userData?.name}
          </p>
        </div>
        <button
          onClick={logout}
          className="p-2 bg-brand-50 text-brand-700 rounded-full hover:bg-brand-100 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 flex flex-col items-center overflow-y-auto">
        {renderTabContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="w-full bg-white border-t border-brand-100 px-6 pb-unsafe pt-2 flex justify-between items-center text-brand-400 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] shrink-0">
        <button
          onClick={() => setActiveTab("beranda")}
          className={`flex flex-col items-center flex-1 py-1 px-1 ${
            activeTab === "beranda"
              ? "text-brand-600"
              : "hover:text-brand-500 transition-colors"
          }`}
        >
          <div className="relative">
            <Home className="w-5 h-5 mb-1" />
          </div>
          <span className="text-[9px] font-medium">Beranda</span>
        </button>

        {(userData?.role === "ketua" || userData?.role === "superuser") && (
          <button
            onClick={() => setActiveTab("persetujuan")}
            className={`flex flex-col items-center flex-1 py-1 px-1 ${
              activeTab === "persetujuan"
                ? "text-brand-600"
                : "hover:text-brand-500 transition-colors"
            }`}
          >
            <div className="relative">
              <ShieldAlert className="w-5 h-5 mb-1" />
              {/* BADGE NOTIFIKASI APPROVAL */}
              {totalApprovalNotif > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold shadow-sm">
                  {totalApprovalNotif}
                </span>
              )}
            </div>
            <span className="text-[9px] font-medium">Approval</span>
          </button>
        )}

        {(userData?.role === "ketua" || userData?.role === "superuser") && (
          <button
            onClick={() => setActiveTab("acara")}
            className={`flex flex-col items-center flex-1 py-1 px-1 ${
              activeTab === "acara"
                ? "text-brand-600"
                : "hover:text-brand-500 transition-colors"
            }`}
          >
            <div className="relative">
              <CalendarClock className="w-5 h-5 mb-1" />
            </div>
            <span className="text-[9px] font-medium">Acara</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("keuangan")}
          className={`flex flex-col items-center flex-1 py-1 px-1 ${
            activeTab === "keuangan"
              ? "text-brand-600"
              : "hover:text-brand-500 transition-colors"
          }`}
        >
          <div className="relative">
            <Wallet className="w-5 h-5 mb-1" />
          </div>
          <span className="text-[9px] font-medium">Keuangan</span>
        </button>

        {(userData?.role === "bendahara" || userData?.role === "superuser") && (
          <button
            onClick={() => setActiveTab("kelola_keuangan")}
            className={`flex flex-col items-center flex-1 py-1 px-1 ${
              activeTab === "kelola_keuangan"
                ? "text-brand-600"
                : "hover:text-brand-500 transition-colors"
            }`}
          >
            <div className="relative">
              <Wallet className="w-5 h-5 mb-1" />
              {/* BADGE NOTIFIKASI BENDAHARA */}
              {totalBendaharaNotif > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold shadow-sm">
                  {totalBendaharaNotif}
                </span>
              )}
            </div>
            <span className="text-[9px] font-medium text-center leading-tight mt-0.5">
              Portal
              <br />
              Bendahara
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("log")}
          className={`flex flex-col items-center flex-1 py-1 px-1 ${
            activeTab === "log"
              ? "text-brand-600"
              : "hover:text-brand-500 transition-colors"
          }`}
        >
          <div className="relative">
            <History className="w-5 h-5 mb-1" />
          </div>
          <span className="text-[9px] font-medium text-center leading-tight mt-0.5">
            Log
            <br />
            Jejak
          </span>
        </button>

        {(userData?.role === "ketua" || userData?.role === "superuser") && (
          <button
            onClick={() => setActiveTab("akses")}
            className={`flex flex-col items-center flex-1 py-1 px-1 ${
              activeTab === "akses"
                ? "text-brand-600"
                : "hover:text-brand-500 transition-colors"
            }`}
          >
            <div className="relative">
              <Users className="w-5 h-5 mb-1" />
            </div>
            <span className="text-[9px] font-medium">Akses</span>
          </button>
        )}
      </nav>
    </div>
  );
}
