import React, { useState } from "react";
import { uploadImageToCloudinary } from "../utils/cloudinary";
import { useDatabase } from "../hooks/useDatabase";
import { useAuth } from "../contexts/AuthContext";
import { triggerAdminNotification } from "../utils/notification"; // <-- IMPORT NOTIFIKASI
import {
  Upload,
  Landmark,
  History,
  CreditCard,
  HandCoins,
  ArrowLeft,
  Receipt,
  CheckCircle2,
  Copy,
  Check,
  X,
  Wallet,
  Clock,
} from "lucide-react";
import { ref, push, set, update, remove } from "firebase/database";
import { db } from "../config/firebase";

export default function FinanceMemberTab() {
  const { userData } = useAuth();
  const { data: transactions, pushData } = useDatabase("transactions");
  const { data: myFamily } = useDatabase(`families/${userData?.family_id}`);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("setor");

  const [formData, setFormData] = useState({
    type: "pemasukan_kas",
    amount: "",
    description: "",
    file: null,
  });

  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [selectedMonths, setSelectedMonths] = useState([]);

  // State untuk melacak ID Transaksi yang sedang di-checkout (Belum lunas)
  const [selectedPendingTxId, setSelectedPendingTxId] = useState(null);

  const [copiedStates, setCopiedStates] = useState({
    ref: false,
    total: false,
  });

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");
  const [kategoriRiwayat, setKategoriRiwayat] = useState("semua");

  // Tabungan murni dari Database Realtime
  const totalTabunganKu = myFamily?.total_tabungan || 0;

  const openImageModal = (url) => {
    setSelectedImage(url);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImage("");
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedStates({ ...copiedStates, [type]: true });
    setTimeout(() => setCopiedStates({ ...copiedStates, [type]: false }), 2000);
  };

  const monthsGrid = [
    { num: 1, name: "Jan" },
    { num: 2, name: "Feb" },
    { num: 3, name: "Mar" },
    { num: 4, name: "Apr" },
    { num: 5, name: "Mei" },
    { num: 6, name: "Jun" },
    { num: 7, name: "Jul" },
    { num: 8, name: "Agt" },
    { num: 9, name: "Sep" },
    { num: 10, name: "Okt" },
    { num: 11, name: "Nov" },
    { num: 12, name: "Des" },
  ];

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

  // PEMISAHAN LOGIKA TRANSAKSI
  const myTxAll = transactions
    ? Object.entries(transactions)
        .filter(([_, tx]) => tx.family_id === userData.family_id)
        .sort((a, b) => new Date(b[1].created_at) - new Date(a[1].created_at))
    : [];

  const myTxApproved = myTxAll.filter(([_, tx]) => tx.status === "approved");

  const dPinjam = myTxApproved
    .filter((x) => x[1].type === "pengajuan_pinjaman")
    .reduce((acc, curr) => acc + (curr[1].amount || 0), 0);

  const dBayar = myTxApproved
    .filter(
      (x) =>
        x[1].type === "bayar_pinjaman" ||
        x[1].type === "bayar_pinjaman_tabungan"
    )
    .reduce((acc, curr) => acc + (curr[1].amount || 0), 0);

  const totalPinjamanAktif = Math.max(0, dPinjam - dBayar);

  const paidMonthsMapping = new Set();
  myTxAll
    .filter(
      ([_, tx]) => tx.type === "pemasukan_kas" && tx.status !== "rejected"
    )
    .forEach(([_, tx]) => {
      tx.months_covered?.forEach((m) => {
        paidMonthsMapping.add(m);
      });
    });

  const riwayatDifilter = myTxAll.filter(([_, tx]) => {
    if (kategoriRiwayat === "semua") return true;
    if (kategoriRiwayat === "kas") return tx.type === "pemasukan_kas";
    if (kategoriRiwayat === "tabungan")
      return (
        tx.type === "pemasukan_tabungan" || tx.type === "pengambilan_tabungan"
      );
    if (kategoriRiwayat === "peminjaman")
      return (
        tx.type === "pengajuan_pinjaman" ||
        tx.type === "bayar_pinjaman" ||
        tx.type === "bayar_pinjaman_tabungan"
      );
    return true;
  });

  // --- LOGIKA BARU: HITUNG BADGE NOTIFIKASI RIWAYAT ---
  const badgeRiwayatCount = myTxAll.filter(([_, tx]) => {
    // 1. Tagihan yang butuh dibayar member
    if (tx.status === "menunggu_pembayaran") return true;

    // 2. Transaksi yang sedang direview/diproses bendahara
    if (tx.status === "pending_bendahara" || tx.status === "menunggu_bendahara")
      return true;

    // 3. Transaksi yang BARU SAJA di verifikasi (Approved) dalam 48 jam terakhir
    if (tx.status === "approved" || tx.status === "rejected") {
      const dateStr = tx.updated_at || tx.created_at;
      if (!dateStr) return false;
      const txDate = new Date(dateStr);
      const now = new Date();
      const diffHours = Math.abs(now - txDate) / 36e5; // Konversi ke jam
      return diffHours <= 48; // Muncul badge selama 2 hari setelah diverifikasi
    }

    return false;
  }).length;
  // ----------------------------------------------------

  const toggleMonth = (num) => {
    const val = `${num.toString().padStart(2, "0")}-${selectedYear}`;
    if (paidMonthsMapping.has(val)) return;
    if (selectedMonths.includes(val)) {
      setSelectedMonths(selectedMonths.filter((m) => m !== val));
    } else {
      setSelectedMonths([...selectedMonths, val]);
    }
  };

  const proceedToCheckout = async (e) => {
    e.preventDefault();
    let base = 0;
    if (formData.type === "pemasukan_kas") {
      if (selectedMonths.length === 0)
        return alert("Pilih minimal 1 bulan kas untuk didanai!");
      base = selectedMonths.length * 10000;
    } else {
      if (!formData.amount || parseInt(formData.amount) <= 0)
        return alert("Masukkan nominal wajib disetor!");
      base = parseInt(formData.amount);
    }

    setLoading(true);
    try {
      const uCode = Math.floor(Math.random() * 89) + 10;
      const payload = {
        type: formData.type,
        family_id: userData.family_id,
        user_name: userData.name,
        amount: base,
        unique_code: uCode,
        months_covered: formData.type === "pemasukan_kas" ? selectedMonths : [],
        description:
          formData.description ||
          `Pembayaran ${formData.type.replace(/_/g, " ")}`,
        status: "menunggu_pembayaran",
        created_at: new Date().toISOString(),
      };

      const tempTxRef = push(ref(db, "transactions"));
      await set(tempTxRef, payload);

      setSelectedPendingTxId(tempTxRef.key);
      setActiveSubTab("setor");

      setFormData({
        type: "pemasukan_kas",
        amount: "",
        description: "",
        file: null,
      });
      setSelectedMonths([]);
    } catch (err) {
      console.error(err);
      alert("Gagal membuat tagihan pembayaran.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCheckout = async () => {
    if (!selectedPendingTxId) return;
    if (
      window.confirm(
        "Yakin ingin membatalkan transaksi ini? Transaksi akan dihapus dari riwayat."
      )
    ) {
      setLoading(true);
      try {
        await remove(ref(db, `transactions/${selectedPendingTxId}`));
        setSelectedPendingTxId(null);
        setFormData({ ...formData, file: null });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFinalSubmit = async () => {
    if (!formData.file) {
      alert("Harap unggah bukti transfer gambar struk terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const activeTx = transactions?.[selectedPendingTxId];
      if (!activeTx) throw new Error("Transaksi tidak ditemukan.");

      const d = new Date();
      const timeString = `${d.getFullYear()}${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}_${d
        .getHours()
        .toString()
        .padStart(2, "0")}${d.getMinutes().toString().padStart(2, "0")}`;
      const safeType = activeTx.type.replace(/[^a-zA-Z]/g, "");
      const customFileName = `${timeString}_${selectedPendingTxId}_${safeType}_${userData.family_id}`;

      const proofUrl = await uploadImageToCloudinary(
        formData.file,
        customFileName
      );

      const totalFinal = (activeTx.amount || 0) + (activeTx.unique_code || 0);
      await update(ref(db, `transactions/${selectedPendingTxId}`), {
        proof_url: proofUrl,
        status: "pending_bendahara",
        updated_at: new Date().toISOString(),
      });

      await push(ref(db, "logs"), {
        action: "CREATE",
        family_id: userData.family_id,
        user_name: userData.name,
        description: `${userData.name} menyerahkan bukti tf Rp${totalFinal} untuk kewajiban murni Rp${activeTx.amount}`,
        created_at: new Date().toISOString(),
      });

      // TRIGGER PUSH NOTIFICATION
      triggerAdminNotification(
        "Verifikasi Pembayaran Baru 💰",
        `${
          userData.name
        } telah mengirimkan bukti transfer sebesar Rp${formatCurrency(
          totalFinal
        )}. Mohon segera diverifikasi.`,
        ["bendahara", "superuser"]
      );

      setSelectedPendingTxId(null);
      setFormData({ ...formData, file: null });
      alert("Transaksi Berhasil diajukan! Menunggu konfirmasi dari Bendahara.");
    } catch (err) {
      console.error(err);
      alert("Gagal mengontak server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handlePotongTabunganSubmit = async (e) => {
    e.preventDefault();
    const potongAmount = parseInt(formData.amount, 10);
    if (!potongAmount || potongAmount <= 0)
      return alert("Nominal pemotongan tidak valid!");
    if (potongAmount > totalTabunganKu)
      return alert("Saldo tabungan Anda tidak mencukupi!");
    if (potongAmount > totalPinjamanAktif)
      return alert(
        "Nominal pemotongan tidak boleh melebihi total pinjaman berjalan Anda!"
      );

    if (
      !window.confirm(
        `Yakin memotong Saldo Tabungan Rp${potongAmount} untuk pelunasan?`
      )
    )
      return;

    setLoading(true);
    try {
      const payload = {
        type: "bayar_pinjaman_tabungan",
        family_id: userData.family_id,
        user_name: userData.name,
        amount: potongAmount,
        description:
          formData.description || "Melunasi pinjaman potong saldo tabungan.",
        proof_url: "",
        status: "pending_bendahara",
        created_at: new Date().toISOString(),
      };
      const tempTxRef = push(ref(db, "transactions"));
      await set(tempTxRef, payload);
      await push(ref(db, "logs"), {
        action: "CREATE",
        family_id: userData.family_id,
        user_name: userData.name,
        description: `${userData.name} pengajuan pelunasan via potong tabungan Rp${potongAmount}`,
        created_at: new Date().toISOString(),
      });

      // TRIGGER PUSH NOTIFICATION
      triggerAdminNotification(
        "Potong Saldo Tabungan 💳",
        `${
          userData.name
        } mengajukan pelunasan pinjaman dengan memotong tabungannya sebesar Rp${formatCurrency(
          potongAmount
        )}.`,
        ["bendahara", "superuser"]
      );

      setFormData({
        type: "pemasukan_kas",
        amount: "",
        description: "",
        file: null,
      });
      setActiveSubTab("setor");
      alert("Berhasil diajukan! Menunggu konfirmasi dari Bendahara");
    } catch (err) {
      alert("Gagal memproses pengajuan.");
    } finally {
      setLoading(false);
    }
  };

  const handlePengambilanTabunganSubmit = async (e) => {
    e.preventDefault();
    const tarikAmount = parseInt(formData.amount, 10);
    if (!tarikAmount || tarikAmount <= 0)
      return alert("Nominal pengambilan tidak valid!");
    if (tarikAmount > totalTabunganKu)
      return alert("Saldo tabungan Anda tidak mencukupi!");

    if (
      !window.confirm(`Yakin mengajukan pencairan tabungan Rp${tarikAmount}?`)
    )
      return;

    setLoading(true);
    try {
      const payload = {
        type: "pengambilan_tabungan",
        family_id: userData.family_id,
        user_name: userData.name,
        amount: tarikAmount,
        description: formData.description || "Pengambilan saldo tabungan.",
        proof_url: "",
        status: "menunggu_bendahara",
        created_at: new Date().toISOString(),
      };
      const tempTxRef = push(ref(db, "transactions"));
      await set(tempTxRef, payload);
      await push(ref(db, "logs"), {
        action: "CREATE",
        family_id: userData.family_id,
        user_name: userData.name,
        description: `${userData.name} pengajuan AMBIL TABUNGAN Rp${tarikAmount}`,
        created_at: new Date().toISOString(),
      });

      // TRIGGER PUSH NOTIFICATION
      triggerAdminNotification(
        "Pengambilan Tabungan 💸",
        `${
          userData.name
        } mengajukan pencairan tabungan sebesar Rp${formatCurrency(
          tarikAmount
        )}.`,
        ["bendahara", "superuser"]
      );

      setFormData({
        type: "pemasukan_kas",
        amount: "",
        description: "",
        file: null,
      });
      alert("Pengajuan berhasil dikirim!");
    } catch (err) {
      alert("Gagal memproses.");
    } finally {
      setLoading(false);
    }
  };

  const handlePinjamanSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        type: "pengajuan_pinjaman",
        family_id: userData.family_id,
        user_name: userData.name,
        amount: parseInt(formData.amount, 10),
        description: formData.description,
        status: "menunggu_bendahara",
        created_at: new Date().toISOString(),
      };
      await pushData(payload);
      await push(ref(db, "logs"), {
        action: "CREATE",
        family_id: userData.family_id,
        user_name: userData.name,
        description: `${userData.name} mendaftarkan Peminjaman Saldo Rp${formData.amount}`,
        created_at: new Date().toISOString(),
      });

      // TRIGGER PUSH NOTIFICATION
      triggerAdminNotification(
        "Pengajuan Pinjaman Baru 📝",
        `${userData.name} mengajukan pinjaman sebesar Rp${formatCurrency(
          formData.amount
        )}. Mohon direview.`,
        ["bendahara", "ketua", "superuser"]
      );

      setFormData({ ...formData, amount: "", description: "" });
      alert("Pengajuan Peminjaman Dana sudah diajukan ke Bendahara.");
    } catch (err) {
      alert("Gagal");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (n) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);

  const activeTx = selectedPendingTxId
    ? transactions?.[selectedPendingTxId]
    : null;

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* MAIN NAVIGATION TABS */}
      <div className="flex bg-brand-100 p-1 rounded-xl shadow-sm gap-1">
        <button
          onClick={() => {
            setActiveSubTab("setor");
            setFormData({ ...formData, type: "pemasukan_kas" });
          }}
          className={`flex-1 flex gap-2 justify-center items-center py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeSubTab === "setor"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-brand-600 hover:text-brand-800"
          }`}
        >
          <CreditCard className="w-4 h-4" /> Transaksi
        </button>
        <button
          onClick={() => {
            setActiveSubTab("pinjam");
            setFormData({ ...formData, type: "pengajuan_pinjaman" });
          }}
          className={`flex-1 flex gap-2 justify-center items-center py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeSubTab === "pinjam"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-brand-600 hover:text-brand-800"
          }`}
        >
          <HandCoins className="w-4 h-4" /> Pinjaman
        </button>

        {/* --- TOMBOL RIWAYAT DENGAN BADGE NOTIFIKASI --- */}
        <button
          onClick={() => setActiveSubTab("riwayat")}
          className={`relative flex-1 flex gap-2 justify-center items-center py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeSubTab === "riwayat"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-brand-600 hover:text-brand-800"
          }`}
        >
          <History className="w-4 h-4" /> Riwayat
          {badgeRiwayatCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full shadow-sm border border-white">
              {badgeRiwayatCount > 99 ? "99+" : badgeRiwayatCount}
            </span>
          )}
        </button>
        {/* ----------------------------------------------- */}
      </div>

      {activeSubTab === "setor" && (
        <>
          {activeTx && activeTx.status === "menunggu_pembayaran" ? (
            /* --- LAYAR: RINCIAN KONFIRMASI CHECKOUT --- */
            <div className="flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center w-full">
                <button
                  onClick={() => setSelectedPendingTxId(null)}
                  className="flex items-center gap-2 text-brand-600 font-bold hover:bg-brand-50 px-3 py-1.5 rounded-lg transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Tutup Sementara
                </button>
                <button
                  disabled={loading}
                  onClick={handleCancelCheckout}
                  className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> Batalkan Transaksi
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-xl border border-brand-200 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-amber-500"></div>
                <Receipt className="w-10 h-10 text-brand-500 mx-auto mb-2" />
                <h3 className="font-bold text-brand-900 text-lg uppercase">
                  Tiket {activeTx.type.replace(/_/g, " ")}
                </h3>
                <p className="text-xs text-brand-500 mb-5">
                  Rincian kewajiban transfer Anda
                </p>

                <div className="bg-brand-50 rounded-xl p-4 flex flex-col gap-2 relative border border-brand-100">
                  <div className="flex justify-between items-center text-sm font-medium text-brand-700">
                    <span>Tagihan Pokok</span>
                    <span>{formatCurrency(activeTx.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium text-amber-600">
                    <span>Kode Unik</span>
                    <span>+{activeTx.unique_code}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg pt-2 border-t border-brand-200 mt-1 pb-1">
                    <span className="font-bold text-green-700">
                      Total Bayar
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-700">
                        {formatCurrency(activeTx.amount + activeTx.unique_code)}
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            (activeTx.amount + activeTx.unique_code).toString(),
                            "total"
                          )
                        }
                        className="text-brand-500 hover:text-brand-700 bg-white p-1.5 rounded-md shadow-sm border border-brand-100 transition-colors"
                      >
                        {copiedStates.total ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-red-600 font-bold mt-4 animate-pulse">
                  PENTING: JANGAN DIBULATKAN!
                </p>
                <p className="text-xs text-brand-600 leading-tight mt-1">
                  Kehadiran kode 2 digit ini berfungsi agar rekening BCA
                  Bendahara langsung mengenali nama Anda secara presisi.
                </p>
              </div>

              {/* Target Transfer */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-200 flex flex-col sm:flex-row items-center gap-4 relative">
                <div className="w-14 h-14 bg-brand-50 rounded-full flex items-center justify-center shrink-0">
                  <Landmark className="w-6 h-6 text-brand-600" />
                </div>
                <div className="flex-1 text-center sm:text-left flex flex-col gap-1 w-full flex-wrap sm:flex-nowrap">
                  <p className="text-xs text-brand-500 font-medium">
                    Rekening Bendahara Utama (BCA)
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 max-w-full">
                    <h3 className="font-mono text-xl sm:text-2xl font-bold text-brand-900 tracking-wider">
                      1234 5678 90
                    </h3>
                    <button
                      onClick={() => copyToClipboard("1234567890", "ref")}
                      className="text-brand-500 hover:text-brand-700 bg-brand-50 p-1.5 rounded-md border border-brand-200 transition-colors shrink-0"
                    >
                      {copiedStates.ref ? (
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-brand-600 font-semibold mt-1">
                    a.n Yuna Melinda
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-200">
                <label className="block text-sm font-semibold text-brand-900 mb-3">
                  1. Upload Bukti Transfer Bank (Struk)
                </label>
                <label className="border-2 border-dashed border-brand-300 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:bg-brand-50 transition-colors relative overflow-hidden group min-h-[140px]">
                  {formData.file ? (
                    <>
                      <img
                        src={URL.createObjectURL(formData.file)}
                        alt="Preview Struk"
                        className="absolute inset-0 w-full h-full object-contain p-2 opacity-50 group-hover:opacity-20 transition-opacity"
                      />
                      <CheckCircle2 className="w-8 h-8 text-green-500 mb-2 relative z-10" />
                      <span className="text-sm font-bold text-green-700 px-2 text-center relative z-10 line-clamp-1">
                        {formData.file.name}
                      </span>
                      <span className="text-[10px] text-green-600 font-medium mt-1 relative z-10 bg-green-50 px-2 py-0.5 rounded-md">
                        Klik untuk mengganti gambar
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-brand-400 mb-2" />
                      <span className="text-sm font-medium text-brand-600 px-2 text-center">
                        Pilih Folder Kamera / Screenshot...
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>

                <button
                  disabled={loading}
                  onClick={handleFinalSubmit}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-sm py-4 rounded-xl shadow-md transition-transform active:scale-[0.98] mt-6 flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> Kirim bukti Transaksi
                      ke Bendahara
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* --- LAYAR AWAL TRANSAKSI --- */
            <form
              onSubmit={
                formData.type === "pengambilan_tabungan"
                  ? handlePengambilanTabunganSubmit
                  : proceedToCheckout
              }
              className="bg-white rounded-2xl p-6 border border-brand-100 shadow-md flex flex-col gap-5"
            >
              <h3 className="font-bold text-brand-900 border-b border-brand-100 pb-2">
                Form Pembayaran Kas / Tabungan
              </h3>

              <div className="flex bg-brand-50 rounded-xl p-1 gap-1 border border-brand-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, type: "pemasukan_kas" });
                    setSelectedMonths([]);
                  }}
                  className={`flex-1 min-w-[80px] py-2 px-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors ${
                    formData.type === "pemasukan_kas"
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-brand-500 hover:text-brand-700"
                  }`}
                >
                  Kas Wajib
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, type: "pemasukan_tabungan" })
                  }
                  className={`flex-1 min-w-[80px] py-2 px-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors ${
                    formData.type === "pemasukan_tabungan"
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-brand-500 hover:text-brand-700"
                  }`}
                >
                  Tabungan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      type: "pengambilan_tabungan",
                    });
                    setSelectedMonths([]);
                  }}
                  className={`flex-1 min-w-[90px] py-2 px-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors ${
                    formData.type === "pengambilan_tabungan"
                      ? "bg-white text-orange-700 shadow-sm border border-orange-200"
                      : "text-brand-500 hover:text-orange-700"
                  }`}
                >
                  Ambil Tabungan
                </button>
              </div>

              {formData.type === "pemasukan_kas" ? (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-brand-700">
                      Pilih Beban Bulan Lunas
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        setSelectedYear(e.target.value);
                        setSelectedMonths([]);
                      }}
                      className="bg-brand-50 border border-brand-200 text-xs font-bold p-1 px-2 rounded-lg text-brand-700 outline-none"
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {monthsGrid.map((m) => {
                      const val = `${m.num
                        .toString()
                        .padStart(2, "0")}-${selectedYear}`;
                      const isPaid = paidMonthsMapping.has(val);
                      const isSelected = selectedMonths.includes(val);

                      let stateClass =
                        "border-brand-200 bg-white text-brand-500 hover:border-brand-400";
                      if (isSelected)
                        stateClass =
                          "border-brand-600 bg-brand-50 text-brand-800 shadow-sm border-[2px]";
                      if (isPaid)
                        stateClass =
                          "border-gray-100 bg-gray-100 text-gray-400 opacity-50 cursor-not-allowed line-through relative overflow-hidden";

                      return (
                        <button
                          type="button"
                          key={val}
                          disabled={isPaid}
                          onClick={() => toggleMonth(m.num)}
                          className={`py-3 rounded-xl border text-[11px] font-bold transition-all ${stateClass}`}
                        >
                          {m.name}
                          {isPaid && (
                            <div className="absolute inset-0 bg-gray-100/40"></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between items-center bg-green-50 px-3 py-2 mt-2 rounded-xl text-green-800 border border-green-200">
                    <span className="text-xs font-bold">
                      {selectedMonths.length} Bulan x Rp10.000
                    </span>
                    <span className="font-bold">
                      Total: {formatCurrency(selectedMonths.length * 10000)}
                    </span>
                  </div>
                </div>
              ) : formData.type === "pengambilan_tabungan" ? (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                  <div className="flex items-center gap-2 mb-3 text-orange-900">
                    <Wallet className="w-5 h-5" />
                    <h4 className="font-bold text-sm">
                      Informasi Saldo Tabungan
                    </h4>
                  </div>
                  <p className="text-xs text-orange-700">
                    Tabungan Anda:{" "}
                    <strong className="text-lg ml-2">
                      {formatCurrency(totalTabunganKu)}
                    </strong>
                  </p>

                  <label className="text-xs font-bold text-orange-800 mt-4 mb-1 block">
                    Nominal yang akan dipotong (Rp)
                  </label>
                  <input
                    required
                    type="number"
                    max={totalTabunganKu}
                    min="0"
                    value={formData.amount}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val !== "" && parseInt(val) > totalTabunganKu) {
                        alert(
                          "Nominal tidak boleh melebihi jumlah tabungan yang Anda miliki!"
                        );
                        val = totalTabunganKu.toString();
                      }
                      setFormData({ ...formData, amount: val });
                    }}
                    className="w-full border border-orange-300 rounded-xl px-4 py-3 bg-white outline-none focus:border-orange-500 text-brand-900 font-bold"
                    placeholder="Maksimal: Saldo tabungan Anda"
                  />

                  <label className="text-xs font-bold text-orange-800 mt-4 mb-1 block">
                    Catatan Tambahan
                  </label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full border border-orange-300 rounded-xl px-4 py-3 outline-none focus:border-orange-500 min-h-[80px] bg-white text-sm resize-none"
                    placeholder="Keperluan pengambilan tabungan..."
                  ></textarea>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-brand-700 mb-1 block">
                    Nominal (Rp)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-full border border-brand-200 rounded-xl px-4 py-3 bg-brand-50/50 outline-none focus:border-brand-500 text-brand-900"
                    placeholder="Contoh: 150000"
                  />
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full border border-brand-200 rounded-xl px-4 py-3 mt-3 outline-none focus:border-brand-500 min-h-[80px] bg-brand-50/50 text-sm resize-none"
                    placeholder="Catatan transfer (Opsional)..."
                  ></textarea>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full text-white font-bold text-sm py-4 rounded-xl shadow-md transition-transform active:scale-[0.98] mt-2 flex justify-center items-center gap-2 ${
                  formData.type === "pengambilan_tabungan"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-brand-600 hover:bg-brand-700"
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : formData.type === "pengambilan_tabungan" ? (
                  "Ajukan Pengambilan Tabungan"
                ) : (
                  "Simulasikan Total Checkout"
                )}
              </button>
            </form>
          )}
        </>
      )}

      {activeSubTab === "pinjam" && (
        <div className="flex flex-col gap-5">
          <div className="flex bg-brand-50 rounded-xl p-1 gap-1 border border-brand-100 flex-wrap">
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, type: "pengajuan_pinjaman" })
              }
              className={`flex-1 min-w-[90px] py-2 px-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors ${
                formData.type === "pengajuan_pinjaman"
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-brand-500 hover:text-brand-700"
              }`}
            >
              Ajukan Pinjaman
            </button>
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, type: "bayar_pinjaman" })
              }
              className={`flex-1 min-w-[90px] py-2 px-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors ${
                formData.type === "bayar_pinjaman"
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-brand-500 hover:text-brand-700"
              }`}
            >
              Bayar / Cicil Pinjaman
            </button>
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, type: "bayar_pinjaman_tabungan" })
              }
              className={`flex-1 min-w-[90px] py-2 px-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors ${
                formData.type === "bayar_pinjaman_tabungan"
                  ? "bg-white text-purple-700 shadow-sm border border-purple-200"
                  : "text-brand-500 hover:text-purple-700"
              }`}
            >
              Bayar / Cicil (Dari Tabungan)
            </button>
          </div>

          {/* RENDER FORM PINJAMAN */}
          {formData.type === "pengajuan_pinjaman" ? (
            <form
              onSubmit={handlePinjamanSubmit}
              className="bg-white rounded-2xl p-6 border border-brand-100 shadow-md flex flex-col gap-4"
            >
              {totalPinjamanAktif > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex justify-between items-center text-red-700 shadow-sm mb-2">
                  <div>
                    <p className="text-xs font-bold uppercase">
                      Total Pinjaman Berjalan
                    </p>
                    <h3 className="text-lg font-bold">
                      {formatCurrency(totalPinjamanAktif)}
                    </h3>
                  </div>
                  <HandCoins className="w-8 h-8 opacity-40" />
                </div>
              )}

              <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 text-sm italic">
                Pinjaman dana tak otomatis cair. Ketua & Bendahara akan mereview
                permohonan Anda. Dana akan dikirim ke rekening Anda setelah
                disetujui (konfirmasi).
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-700 mb-1 block">
                  Nominal Meminjam (Rp)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="w-full border border-brand-200 rounded-xl px-4 py-3 bg-brand-50/50 outline-none focus:border-brand-500"
                  placeholder="Rp..."
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-700 mb-1 block">
                  Alasan / Kepentingan
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full border border-brand-200 rounded-xl px-4 py-3 outline-none focus:border-brand-500 min-h-[100px] bg-brand-50/50 text-sm"
                  placeholder="Tujuan pengajuan peminjaman.."
                ></textarea>
              </div>
              <button
                disabled={loading}
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm py-4 rounded-xl shadow-sm transition-colors flex justify-center items-center"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Ajukan Pinjaman"
                )}
              </button>
            </form>
          ) : formData.type === "bayar_pinjaman_tabungan" ? (
            <form
              onSubmit={handlePotongTabunganSubmit}
              className="bg-white rounded-2xl p-6 border border-brand-100 shadow-md flex flex-col gap-4"
            >
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                <div className="flex items-center gap-2 mb-3 text-purple-900">
                  <Wallet className="w-5 h-5" />{" "}
                  <h4 className="font-bold text-sm">
                    Informasi Saldo Tabungan
                  </h4>
                </div>
                <p className="text-xs text-purple-700">
                  Tabungan Anda:{" "}
                  <strong className="text-lg ml-2">
                    {formatCurrency(totalTabunganKu)}
                  </strong>
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Total Pinjaman Berjalan:{" "}
                  <strong>{formatCurrency(totalPinjamanAktif)}</strong>
                </p>

                <label className="text-xs font-bold text-purple-800 mt-4 mb-1 block">
                  Nominal yang dipotong (Rp)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  // Atur max limit atribut bawaan HTML agar lebih aman
                  max={Math.min(totalTabunganKu, totalPinjamanAktif)}
                  disabled={totalPinjamanAktif <= 0}
                  value={formData.amount}
                  onChange={(e) => {
                    let val = e.target.value;
                    const numVal = parseInt(val);

                    // Cari batas maksimal yang paling logis
                    const maxAllowed = Math.min(
                      totalTabunganKu,
                      totalPinjamanAktif
                    );

                    if (val !== "" && numVal > maxAllowed) {
                      // Jika tabungan lebih kecil dari hutang (Kasus: Tabungan 300rb, Hutang 400rb)
                      if (totalTabunganKu < totalPinjamanAktif) {
                        alert(
                          "Nominal tidak boleh melebihi jumlah tabungan yang Anda miliki!"
                        );
                      }
                      // Jika hutang lebih kecil dari tabungan (Kasus: Tabungan 500rb, Hutang 300rb)
                      else {
                        alert(
                          "Nominal cicilan tidak boleh melebihi total pinjaman berjalan!"
                        );
                      }

                      // Kembalikan angka otomatis ke batas maksimal yang diizinkan
                      val = maxAllowed.toString();
                    }

                    setFormData({ ...formData, amount: val });
                  }}
                  className="w-full border border-purple-300 rounded-xl px-4 py-3 bg-white outline-none focus:border-purple-500 text-brand-900 font-bold disabled:bg-gray-100 disabled:text-gray-400"
                  placeholder={`Maksimal: ${formatCurrency(
                    Math.min(totalTabunganKu, totalPinjamanAktif)
                  )}`}
                />

                {/* Estimasi Sisa Pinjaman */}
                {formData.amount &&
                  parseInt(formData.amount) > 0 &&
                  totalPinjamanAktif > 0 && (
                    <div className="mt-2 text-xs font-medium text-purple-700 bg-purple-50 p-2 rounded-lg border border-purple-200 flex justify-between items-center shadow-sm">
                      <span>Estimasi Sisa Pinjaman:</span>
                      <span className="font-bold text-sm">
                        {formatCurrency(
                          Math.max(
                            0,
                            totalPinjamanAktif - parseInt(formData.amount)
                          )
                        )}
                      </span>
                    </div>
                  )}
                <textarea
                  value={formData.description}
                  disabled={totalPinjamanAktif <= 0}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full border border-purple-300 rounded-xl px-4 py-3 mt-3 outline-none focus:border-purple-500 min-h-[80px] bg-white text-sm resize-none disabled:bg-gray-100 disabled:text-gray-400"
                  placeholder="Catatan tambahan (opsional)..."
                ></textarea>
              </div>
              <button
                type="submit"
                disabled={loading || totalPinjamanAktif <= 0}
                className={`w-full text-white bg-purple-600 hover:bg-purple-700 font-bold text-sm py-4 rounded-xl shadow-md mt-2 flex justify-center items-center ${
                  totalPinjamanAktif <= 0 ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : totalPinjamanAktif <= 0 ? (
                  "Pinjaman Sudah Lunas"
                ) : (
                  "Ajukan Potong Saldo Tabungan"
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={proceedToCheckout}
              className="bg-white rounded-2xl p-6 border border-brand-100 shadow-md flex flex-col gap-4"
            >
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex justify-between items-center text-blue-700 shadow-sm mb-2">
                <div>
                  <p className="text-xs font-bold uppercase">
                    Total Pinjaman Berjalan
                  </p>
                  <h3 className="text-lg font-bold">
                    {formatCurrency(totalPinjamanAktif)}
                  </h3>
                </div>
                <HandCoins className="w-8 h-8 opacity-40" />
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-700 mb-1 block">
                  Nominal Cicilan / Transfer (Rp)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  max={totalPinjamanAktif}
                  disabled={totalPinjamanAktif <= 0}
                  value={formData.amount}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val !== "" && parseInt(val) > totalPinjamanAktif) {
                      alert(
                        "Nominal cicilan tidak boleh melebihi total pinjaman berjalan!"
                      );
                      val = totalPinjamanAktif.toString();
                    }
                    setFormData({ ...formData, amount: val });
                  }}
                  className="w-full border border-brand-200 rounded-xl px-4 py-3 bg-brand-50/50 outline-none focus:border-brand-500 text-brand-900 disabled:bg-gray-100 disabled:text-gray-400"
                  placeholder="Contoh: 150000"
                />
                {formData.amount &&
                  parseInt(formData.amount) > 0 &&
                  totalPinjamanAktif > 0 && (
                    <div className="mt-2 text-xs font-medium text-brand-600 bg-brand-50 p-2 rounded-lg border border-brand-100 flex justify-between items-center shadow-sm">
                      <span>Estimasi Sisa Pinjaman:</span>
                      <span className="font-bold text-sm">
                        {formatCurrency(
                          Math.max(
                            0,
                            totalPinjamanAktif - parseInt(formData.amount)
                          )
                        )}
                      </span>
                    </div>
                  )}
                <textarea
                  value={formData.description}
                  disabled={totalPinjamanAktif <= 0}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full border border-brand-200 rounded-xl px-4 py-3 mt-3 outline-none focus:border-brand-500 min-h-[80px] bg-brand-50/50 text-sm resize-none disabled:bg-gray-100 disabled:text-gray-400"
                  placeholder="Catatan transfer (Opsional)..."
                ></textarea>
              </div>
              <button
                type="submit"
                disabled={loading || totalPinjamanAktif <= 0}
                className={`w-full text-white bg-blue-600 hover:bg-blue-700 font-bold text-sm py-4 rounded-xl shadow-md mt-2 flex justify-center items-center ${
                  totalPinjamanAktif <= 0 ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : totalPinjamanAktif <= 0 ? (
                  "Pinjaman Sudah Lunas"
                ) : (
                  "Proses Bayar Pinjaman"
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {activeSubTab === "riwayat" && (
        <div className="bg-white rounded-2xl p-6 border border-brand-100 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-brand-100 pb-3">
            <h3 className="font-bold text-brand-900 mb-2 sm:mb-0">
              Track Record Transaksi Saya
            </h3>
            <select
              value={kategoriRiwayat}
              onChange={(e) => setKategoriRiwayat(e.target.value)}
              className="border p-2 rounded-lg text-sm bg-gray-50 outline-none focus:border-brand-500"
            >
              <option value="semua">Semua Kategori</option>
              <option value="kas">Uang Kas</option>
              <option value="tabungan">Tabungan</option>
              <option value="peminjaman">Peminjaman</option>
            </select>
          </div>

          <div className="flex flex-col gap-4">
            {riwayatDifilter.length > 0 ? (
              riwayatDifilter.map(([id, tx]) => (
                <div
                  key={id}
                  className="flex flex-col p-3 hover:bg-brand-50 rounded-xl transition-colors border border-transparent hover:border-brand-100 gap-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-brand-900 capitalize">
                        {tx.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-brand-500 mt-1">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>

                      <div className="mt-2">
                        {tx.status === "menunggu_pembayaran" && (
                          <span className="text-[10px] bg-yellow-100 text-yellow-800 font-bold px-2 py-1 rounded-md border border-yellow-200 flex items-center gap-1 w-max">
                            <Clock className="w-3 h-3" /> Menunggu Pembayaran
                          </span>
                        )}
                        {tx.status === "pending_bendahara" && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded-md border border-blue-200 flex items-center gap-1 w-max">
                            <Clock className="w-3 h-3" /> Verifikasi Bendahara
                          </span>
                        )}
                        {tx.status === "approved" && (
                          <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-1 rounded-md border border-green-200 flex items-center gap-1 w-max">
                            <CheckCircle2 className="w-3 h-3" /> Berhasil/Lunas
                          </span>
                        )}
                      </div>

                      {tx.proof_url && (
                        <button
                          onClick={() => openImageModal(tx.proof_url)}
                          className="text-[10px] font-bold text-brand-600 hover:underline mt-2 bg-brand-100 px-2 py-0.5 rounded flex items-center gap-1 w-max"
                        >
                          Lihat Struk
                        </button>
                      )}
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p
                        className={`font-bold text-sm ${
                          [
                            "pengajuan_pinjaman",
                            "pengambilan_tabungan",
                          ].includes(tx.type)
                            ? "text-red-500"
                            : "text-green-600"
                        }`}
                      >
                        {[
                          "pengajuan_pinjaman",
                          "pengambilan_tabungan",
                        ].includes(tx.type)
                          ? "-"
                          : "+"}
                        {formatCurrency(tx.amount + (tx.unique_code || 0))}
                      </p>
                      {tx.months_covered?.length > 0 && (
                        <span className="text-[9px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-sm mt-1">
                          {tx.months_covered.length} bln
                        </span>
                      )}
                    </div>
                  </div>

                  {tx.status === "menunggu_pembayaran" && (
                    <div className="border-t border-brand-100 pt-2 mt-1">
                      <button
                        onClick={() => {
                          setSelectedPendingTxId(id);
                          setActiveSubTab("setor");
                        }}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2 rounded-lg shadow-sm"
                      >
                        Lanjutkan Pembayaran
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-brand-400 text-sm py-4">
                Tidak ada riwayat untuk kategori ini.
              </p>
            )}
          </div>
        </div>
      )}

      {isImageModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-3 border-b bg-gray-50 rounded-t-lg">
              <h3 className="text-base font-semibold text-gray-800">
                Bukti Transaksi
              </h3>
              <button
                onClick={closeImageModal}
                className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-2 flex-1 overflow-auto flex justify-center items-center bg-gray-100 min-h-[300px]">
              <img
                src={selectedImage}
                alt="Bukti Transaksi"
                className="max-w-full max-h-[70vh] object-contain rounded drop-shadow-md"
              />
            </div>
            <div className="p-3 border-t flex justify-end bg-gray-50 rounded-b-lg">
              <button
                onClick={closeImageModal}
                className="px-6 py-2 bg-gray-800 text-white text-sm font-bold rounded-lg hover:bg-gray-900 transition-colors shadow-sm"
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
