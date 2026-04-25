import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDatabase } from "../hooks/useDatabase"; // DITAMBAHKAN UNTUK LOGIKA BADGE
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

  // --- DITAMBAHKAN: LOGIKA UNTUK MENGHITUNG BADGE NOTIFIKASI MENU ---
  const { data: users } = useDatabase("users");
  const { data: transactions } = useDatabase("transactions");

  let badgeApproval = 0;
  let badgeKeuangan = 0;
  let badgePortalBendahara = 0;

  if (transactions || users) {
    const txList = transactions ? Object.values(transactions) : [];
    const usersList = users ? Object.values(users) : [];

    // 1. Hitung Badge Approval (Untuk Ketua/Superuser)
    if (userData?.role === "ketua" || userData?.role === "superuser") {
      const pendingUsers = usersList.filter(
        (u) => u.status === "pending"
      ).length;
      const pendingTxKetua = txList.filter((tx) =>
        ["menunggu_ketua", "menunggu_hapus", "menunggu_edit"].includes(
          tx.status
        )
      ).length;
      badgeApproval = pendingUsers + pendingTxKetua;
    }

    // 2. Hitung Badge Portal Bendahara (Untuk Bendahara/Superuser)
    if (userData?.role === "bendahara" || userData?.role === "superuser") {
      const pendingTxBendahara = txList.filter((tx) =>
        ["pending_bendahara", "menunggu_bendahara"].includes(tx.status)
      ).length;
      badgePortalBendahara = pendingTxBendahara;
    }

    // 3. Hitung Badge Keuangan (Untuk Diri Sendiri / Semua Role)
    if (userData) {
      badgeKeuangan = txList.filter((tx) => {
        if (tx.family_id !== userData.family_id) return false;

        // Tagihan butuh dibayar / sedang diproses bendahara
        if (
          tx.status === "menunggu_pembayaran" ||
          tx.status === "pending_bendahara" ||
          tx.status === "menunggu_bendahara"
        ) {
          return true;
        }

        // Transaksi baru selesai (48 jam terakhir)
        if (tx.status === "approved" || tx.status === "rejected") {
          const dateStr = tx.updated_at || tx.created_at;
          if (!dateStr) return false;
          const diffHours = Math.abs(new Date() - new Date(dateStr)) / 36e5;
          return diffHours <= 48;
        }
        return false;
      }).length;
    }
  }
  // ----------------------------------------------------------------

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
          className={`relative flex flex-col items-center flex-1 py-1 px-1 ${
            activeTab === "beranda"
              ? "text-brand-600"
              : "hover:text-brand-500 transition-colors"
          }`}
        >
          <Home className="w-5 h-5 mb-1" />
          <span className="text-[9px] font-medium">Beranda</span>
        </button>

        {(userData?.role === "ketua" || userData?.role === "superuser") && (
          <button
            onClick={() => setActiveTab("persetujuan")}
            className={`relative flex flex-col items-center flex-1 py-1 px-1 ${
              activeTab === "persetujuan"
                ? "text-brand-600"
                : "hover:text-brand-500 transition-colors"
            }`}
          >
            {/* DITAMBAHKAN: Badge Notifikasi Approval */}
            {badgeApproval > 0 && (
              <span className="absolute top-0 right-[calc(50%-18px)] bg-red-500 text-white text-[9px] font-bold px-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full border border-white z-10 animate-in zoom-in">
                {badgeApproval > 99 ? "99+" : badgeApproval}
              </span>
            )}
            <ShieldAlert className="w-5 h-5 mb-1" />
            <span className="text-[9px] font-medium">Approval</span>
          </button>
        )}

        {(userData?.role === "ketua" || userData?.role === "superuser") && (
          <button
            onClick={() => setActiveTab("acara")}
            className={`relative flex flex-col items-center flex-1 py-1 px-1 ${
              activeTab === "acara"
                ? "text-brand-600"
                : "hover:text-brand-500 transition-colors"
            }`}
          >
            <CalendarClock className="w-5 h-5 mb-1" />
            <span className="text-[9px] font-medium">Acara</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("keuangan")}
          className={`relative flex flex-col items-center flex-1 py-1 px-1 ${
            activeTab === "keuangan"
              ? "text-brand-600"
              : "hover:text-brand-500 transition-colors"
          }`}
        >
          {/* DITAMBAHKAN: Badge Notifikasi Keuangan */}
          {badgeKeuangan > 0 && (
            <span className="absolute top-0 right-[calc(50%-18px)] bg-red-500 text-white text-[9px] font-bold px-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full border border-white z-10 animate-in zoom-in">
              {badgeKeuangan > 99 ? "99+" : badgeKeuangan}
            </span>
          )}
          <Wallet className="w-5 h-5 mb-1" />
          <span className="text-[9px] font-medium">Keuangan</span>
        </button>

        {(userData?.role === "bendahara" || userData?.role === "superuser") && (
          <button
            onClick={() => setActiveTab("kelola_keuangan")}
            className={`relative flex flex-col items-center flex-1 py-1 px-1 ${
              activeTab === "kelola_keuangan"
                ? "text-brand-600"
                : "hover:text-brand-500 transition-colors"
            }`}
          >
            {/* DITAMBAHKAN: Badge Notifikasi Portal Bendahara */}
            {badgePortalBendahara > 0 && (
              <span className="absolute top-0 right-[calc(50%-18px)] bg-red-500 text-white text-[9px] font-bold px-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full border border-white z-10 animate-in zoom-in">
                {badgePortalBendahara > 99 ? "99+" : badgePortalBendahara}
              </span>
            )}
            <Wallet className="w-5 h-5 mb-1" />
            <span className="text-[9px] font-medium">Portal Bendahara</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("log")}
          className={`relative flex flex-col items-center flex-1 py-1 px-1 ${
            activeTab === "log"
              ? "text-brand-600"
              : "hover:text-brand-500 transition-colors"
          }`}
        >
          <History className="w-5 h-5 mb-1" />
          <span className="text-[9px] font-medium">Log Jejak</span>
        </button>

        {(userData?.role === "ketua" || userData?.role === "superuser") && (
          <button
            onClick={() => setActiveTab("akses")}
            className={`relative flex flex-col items-center flex-1 py-1 px-1 ${
              activeTab === "akses"
                ? "text-brand-600"
                : "hover:text-brand-500 transition-colors"
            }`}
          >
            <Users className="w-5 h-5 mb-1" />
            <span className="text-[9px] font-medium">Akses</span>
          </button>
        )}
      </nav>
    </div>
  );
}
