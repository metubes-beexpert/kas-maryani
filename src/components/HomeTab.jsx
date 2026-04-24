import React from "react";
import { Wallet, Calendar } from "lucide-react";
import { useDatabase } from "../hooks/useDatabase";
import { useAuth } from "../contexts/AuthContext";

const FooterBantu = () => {
  return (
    <footer className="mt-auto py-4 px-4 bg-[#f7f1eb] rounded-2xl text-center border border-orange-100/50 w-full">
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs text-gray-500 font-medium">
          Aplikasi ini dipersembahkan oleh:
        </p>
        <a
          href="https://bit.ly/cobabantuin"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center group hover:opacity-80 transition-opacity no-underline"
        >
          <img
            src="/bantuin.png"
            alt="Bantu.in Logo"
            className="h-10 mr-3 object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://via.placeholder.com/40?text=B";
            }}
          />
          <div className="flex flex-col items-start text-left">
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 via-blue-500 to-orange-400 bg-clip-text text-transparent font-sans">
              Bantu.in
            </span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider -mt-1 font-sans">
              Solusi Jasa Digital
            </span>
          </div>
        </a>
      </div>
    </footer>
  );
};

export default function HomeTab() {
  const { userData } = useAuth();
  const { data: globalFunds, loading: fundsLoading } =
    useDatabase("global_funds");
  const { data: myFamily } = useDatabase(`families/${userData?.family_id}`);
  const { data: events, loading: eventsLoading } = useDatabase("events");
  const { data: allTransactions } = useDatabase("transactions");

  const familyName = myFamily?.nama_kepala || "Keluarga Anda";

  // Ambil hanya transaksi yang sudah sah (approved)
  const myTx = allTransactions
    ? Object.entries(allTransactions).filter(
        ([_, tx]) =>
          tx.family_id === userData?.family_id && tx.status === "approved"
      )
    : [];

  // LOGIKA PINJAMAN: Total ngutang - Total Nyicil
  const dPinjam = myTx
    .filter((x) => x[1].type === "pengajuan_pinjaman")
    .reduce((acc, curr) => acc + (curr[1].amount || 0), 0);
  const dBayar = myTx
    .filter(
      (x) =>
        x[1].type === "bayar_pinjaman" ||
        x[1].type === "bayar_pinjaman_tabungan"
    )
    .reduce((acc, curr) => acc + (curr[1].amount || 0), 0);
  const totalPinjamanAktif = Math.max(0, dPinjam - dBayar);

  // LOGIKA TABUNGAN & KAS
  const dKas = myTx
    .filter((x) => x[1].type === "pemasukan_kas")
    .reduce((acc, curr) => acc + (curr[1].amount || 0), 0);

  const dTabunganMasuk = myTx
    .filter((x) => x[1].type === "pemasukan_tabungan")
    .reduce((acc, curr) => acc + (curr[1].amount || 0), 0);
  const dTabunganKeluar = myTx
    .filter(
      (x) =>
        x[1].type === "pengambilan_tabungan" ||
        x[1].type === "bayar_pinjaman_tabungan"
    )
    .reduce((acc, curr) => acc + (curr[1].amount || 0), 0);
  const dTabungan = Math.max(0, dTabunganMasuk - dTabunganKeluar);

  const getNearestEvent = () => {
    if (!events) return null;
    const now = new Date();
    const futureEvents = Object.entries(events)
      .map(([id, event]) => ({ id, ...event }))
      .filter((event) => new Date(event.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return futureEvents.length > 0 ? futureEvents[0] : null;
  };

  const nearestEvent = getNearestEvent();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDateBox = (dateString) => {
    const d = new Date(dateString);
    return {
      month: d.toLocaleString("id-ID", { month: "short" }),
      date: d.getDate().toString().padStart(2, "0"),
    };
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-brand-900">
          Keluarga {familyName}
        </h2>
        <p className="text-sm text-brand-500 mt-1">
          Ringkasan keuangan dan informasi acara.
        </p>
      </div>

      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -top-4 -right-4 p-4 opacity-10">
          <Wallet className="w-32 h-32" />
        </div>
        <p className="text-brand-100 text-sm mb-1">Total Kas Global</p>
        <h2 className="text-3xl font-bold mb-5 tracking-tight">
          {fundsLoading ? "Memuat..." : formatCurrency(globalFunds?.total_kas)}
        </h2>

        <p className="text-brand-100 text-sm mb-1 mt-2 border-t border-brand-500/50 pt-3">
          Total Tabungan Global
        </p>
        <h2 className="text-xl font-bold">
          {fundsLoading
            ? "Memuat..."
            : formatCurrency(globalFunds?.total_tabungan)}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] sm:text-xs font-bold text-brand-600 uppercase tracking-wider mb-1 line-clamp-1">
            Kas {familyName}
          </p>
          <h3 className="text-lg sm:text-xl font-black text-brand-900">
            {formatCurrency(dKas)}
          </h3>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] sm:text-xs font-bold text-green-700 uppercase tracking-wider mb-1 line-clamp-1">
            Tabungan {familyName}
          </p>
          <h3 className="text-lg sm:text-xl font-black text-green-900">
            {formatCurrency(dTabungan)}
          </h3>
        </div>
      </div>

      {totalPinjamanAktif > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm flex justify-between items-center">
          <div className="flex-1 pr-2">
            <p className="text-[10px] sm:text-xs font-bold text-red-600 uppercase tracking-wider mb-1 line-clamp-1">
              Total Pinjaman Aktif
            </p>
            <h3 className="text-xl sm:text-2xl font-black text-red-800">
              {formatCurrency(totalPinjamanAktif)}
            </h3>
          </div>
          <Wallet className="w-8 h-8 text-red-300 opacity-60 shrink-0" />
        </div>
      )}

      <section>
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-brand-900 font-bold text-lg">
            Acara Keluarga Terdekat
          </h3>
        </div>

        {eventsLoading ? (
          <div className="bg-white rounded-2xl p-5 border border-brand-100 shadow-sm animate-pulse flex gap-4 h-24"></div>
        ) : nearestEvent ? (
          <div className="bg-white rounded-2xl p-5 border border-brand-100 shadow-sm flex gap-4 items-center group hover:border-brand-300 transition-colors">
            <div className="bg-brand-50 w-16 h-16 rounded-xl flex flex-col items-center justify-center text-brand-700 font-bold shrink-0 shadow-inner">
              <span className="text-[10px] font-medium uppercase tracking-wider">
                {formatDateBox(nearestEvent.date).month}
              </span>
              <span className="text-2xl leading-none">
                {formatDateBox(nearestEvent.date).date}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-brand-900 truncate">
                {nearestEvent.title}
              </h4>
              <p className="text-sm text-brand-500 truncate flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>{" "}
                {nearestEvent.location}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-brand-50/50 rounded-2xl p-6 border border-brand-100 border-dashed text-center">
            <Calendar className="w-8 h-8 text-brand-300 mx-auto mb-2" />
            <p className="text-sm text-brand-500">Belum ada acara mendatang.</p>
          </div>
        )}
      </section>

      <FooterBantu />
    </div>
  );
}
