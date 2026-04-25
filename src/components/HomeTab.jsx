import React, { useState } from "react";
import { Wallet, Calendar, Clock, MapPin, AlignLeft, X } from "lucide-react"; // DITAMBAHKAN ICON BARU
import { useDatabase } from "../hooks/useDatabase";
import { useAuth } from "../contexts/AuthContext";

const FooterBantu = () => {
  return (
    <footer className="mt-auto py-4 px-4 bg-[#f7f1eb] rounded-2xl text-center border border-orange-100/50 w-full shrink-0">
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

  // DITAMBAHKAN: State untuk mengontrol Modal Detail Acara
  const [selectedEventModal, setSelectedEventModal] = useState(null);

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

  // DITAMBAHKAN: Format Tanggal yang lebih lengkap
  const formatFullDate = (dateString) => {
    const d = new Date(dateString);
    return {
      fullDate: d.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      time: d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      shortMonth: d.toLocaleString("id-ID", { month: "short" }),
      dateNum: d.getDate().toString().padStart(2, "0"),
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

      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden shrink-0">
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

      <div className="grid grid-cols-2 gap-4 shrink-0">
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
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm flex justify-between items-center shrink-0">
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

      <section className="shrink-0 mb-4">
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-brand-900 font-bold text-lg">
            Acara Keluarga Terdekat
          </h3>
        </div>

        {eventsLoading ? (
          <div className="bg-white rounded-2xl p-5 border border-brand-100 shadow-sm animate-pulse flex gap-4 h-28"></div>
        ) : nearestEvent ? (
          // DITAMBAHKAN: Tampilan Card Acara yang Baru & Bisa di-klik
          <div
            onClick={() => setSelectedEventModal(nearestEvent)}
            className="bg-white rounded-2xl p-5 border border-brand-200 shadow-md hover:border-brand-400 hover:shadow-lg transition-all cursor-pointer group flex gap-4 items-start relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-2 h-full bg-brand-500"></div>

            {/* Box Tanggal */}
            <div className="bg-brand-50 w-16 h-16 rounded-xl flex flex-col items-center justify-center text-brand-700 font-bold shrink-0 border border-brand-100">
              <span className="text-[10px] font-medium uppercase tracking-wider">
                {formatFullDate(nearestEvent.date).shortMonth}
              </span>
              <span className="text-2xl leading-none">
                {formatFullDate(nearestEvent.date).dateNum}
              </span>
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-1.5 pt-0.5 pr-2">
              <h4 className="font-bold text-brand-900 text-lg leading-tight line-clamp-1">
                {nearestEvent.title}
              </h4>

              <div className="flex items-center gap-1.5 text-xs text-brand-600 font-medium">
                <Clock className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span>{formatFullDate(nearestEvent.date).time} WIB</span>
              </div>

              <div className="flex items-start gap-1.5 text-xs text-brand-600 font-medium mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                <span className="line-clamp-1 leading-snug">
                  {nearestEvent.location}
                </span>
              </div>

              {nearestEvent.description && (
                <div className="flex items-start gap-1.5 text-[11px] text-gray-500 mt-1 pt-2 border-t border-brand-50">
                  <AlignLeft className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <p className="line-clamp-2 leading-snug">
                    {nearestEvent.description}
                  </p>
                </div>
              )}

              {nearestEvent.description && (
                <p className="text-[10px] text-brand-500 font-semibold mt-1 group-hover:text-brand-700 transition-colors">
                  Ketuk untuk lihat detail &rarr;
                </p>
              )}
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

      {/* DITAMBAHKAN: Modal Detail Acara */}
      {selectedEventModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-brand-600 p-4 text-white flex justify-between items-center pr-12 relative">
              <h3 className="font-bold text-lg leading-tight">Detail Acara</h3>
              <button
                onClick={() => setSelectedEventModal(null)}
                className="absolute top-3 right-3 text-white/70 hover:text-white bg-brand-700 hover:bg-brand-800 p-1.5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
              <div>
                <h2 className="text-xl font-black text-brand-900 mb-2">
                  {selectedEventModal.title}
                </h2>
                <div className="flex flex-col gap-3 bg-brand-50 p-4 rounded-xl border border-brand-100">
                  <div className="flex items-center gap-3 text-brand-700">
                    <Calendar className="w-5 h-5 text-brand-500 shrink-0" />
                    <span className="font-medium text-sm">
                      {formatFullDate(selectedEventModal.date).fullDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-brand-700">
                    <Clock className="w-5 h-5 text-brand-500 shrink-0" />
                    <span className="font-medium text-sm">
                      {formatFullDate(selectedEventModal.date).time} WIB
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-brand-700">
                    <MapPin className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                    <span className="font-medium text-sm leading-snug">
                      {selectedEventModal.location}
                    </span>
                  </div>
                </div>
              </div>

              {selectedEventModal.description && (
                <div>
                  <h4 className="font-bold text-sm text-brand-800 mb-2 flex items-center gap-2">
                    <AlignLeft className="w-4 h-4 text-brand-500" /> Keterangan
                    Tambahan
                  </h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {selectedEventModal.description}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedEventModal(null)}
                className="px-6 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-colors shadow-sm w-full"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
