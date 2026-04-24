import React, { useState } from "react";
import { useDatabase } from "../hooks/useDatabase";
import { useAuth } from "../contexts/AuthContext";
import { triggerAdminNotification } from "../utils/notification";
import {
  CheckCircle2,
  Search,
  ArrowRightCircle,
  Send,
  Trash2,
  Upload,
  PenTool,
  Download,
  History,
  Edit3,
  X,
  AlertTriangle,
  HandCoins,
} from "lucide-react";
// UBAH: Tambahkan fungsi 'remove' langsung dari firebase/database
import { update, ref, push, set, remove } from "firebase/database";
import { db } from "../config/firebase";
import { uploadImageToCloudinary } from "../utils/cloudinary";
import * as XLSX from "xlsx";

export default function FinanceAdminTab() {
  const { userData } = useAuth();

  if (userData?.role !== "bendahara" && userData?.role !== "superuser") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-300">
        <div className="bg-red-50 p-4 rounded-full mb-4">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
        <p className="text-gray-500 max-w-md text-sm">
          Anda tidak memiliki izin untuk mengakses halaman manajemen keuangan
          ini. Halaman ini khusus untuk Bendahara dan Superuser.
        </p>
      </div>
    );
  }

  const {
    data: transactions,
    loading: txLoading,
    updateData: updateTx,
    pushData,
    // removeData tidak kita pakai lagi untuk keamanan
  } = useDatabase("transactions");
  const { data: globalFunds, loading: fundsLoading } =
    useDatabase("global_funds");
  const { data: families } = useDatabase("families");
  const [processing, setProcessing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("setoran");
  const [exportDuration, setExportDuration] = useState("1_bulan");

  const [outForm, setOutForm] = useState({ amount: "", description: "" });

  const [manualForm, setManualForm] = useState({
    family_id: "",
    type: "pemasukan_kas",
    amount: "",
    description: "",
    file: null,
  });

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loanProofFile, setLoanProofFile] = useState(null);

  const [kategoriRiwayat, setKategoriRiwayat] = useState("semua");
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: "",
    txId: "",
    tx: null,
  });
  const [actionForm, setActionForm] = useState({
    amount: "",
    description: "",
    alasan: "",
  });

  const openImageModal = (url) => {
    setSelectedImage(url);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImage("");
  };

  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [selectedMonths, setSelectedMonths] = useState([]);

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

  const paidMonthsMapping = new Set();
  if (transactions && manualForm.family_id) {
    Object.values(transactions).forEach((tx) => {
      if (
        tx.family_id === manualForm.family_id &&
        tx.type === "pemasukan_kas" &&
        tx.status === "approved"
      ) {
        tx.months_covered?.forEach((m) => {
          paidMonthsMapping.add(m);
        });
      }
    });
  }

  const toggleMonth = (num) => {
    const val = `${num.toString().padStart(2, "0")}-${selectedYear}`;
    if (paidMonthsMapping.has(val)) return;

    let newSelected = [];
    if (selectedMonths.includes(val)) {
      newSelected = selectedMonths.filter((m) => m !== val);
    } else {
      newSelected = [...selectedMonths, val];
    }

    setSelectedMonths(newSelected);
    setManualForm({
      ...manualForm,
      amount: (newSelected.length * 10000).toString(),
    });
  };

  let activeFamilyLoan = 0;
  if (transactions && manualForm.family_id) {
    const familyTxs = Object.values(transactions).filter(
      (tx) => tx.family_id === manualForm.family_id && tx.status === "approved"
    );
    const fPinjam = familyTxs
      .filter((tx) => tx.type === "pengajuan_pinjaman")
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const fBayar = familyTxs
      .filter(
        (tx) =>
          tx.type === "bayar_pinjaman" || tx.type === "bayar_pinjaman_tabungan"
      )
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
    activeFamilyLoan = Math.max(0, fPinjam - fBayar);
  }

  const isLoanPayment =
    manualForm.type === "bayar_pinjaman" ||
    manualForm.type === "bayar_pinjaman_tabungan";
  const isLoanPaymentDisabled =
    isLoanPayment && manualForm.family_id && activeFamilyLoan <= 0;

  const formatCurrency = (n) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);

  const pendingSetoran = transactions
    ? Object.entries(transactions)
        .filter(
          ([_, tx]) =>
            (tx.type === "pemasukan_kas" ||
              tx.type === "pemasukan_tabungan" ||
              tx.type === "bayar_pinjaman" ||
              tx.type === "bayar_pinjaman_tabungan") &&
            tx.status === "pending_bendahara"
        )
        .sort((a, b) => new Date(b[1].created_at) - new Date(a[1].created_at))
    : [];

  const pendingPinjaman = transactions
    ? Object.entries(transactions)
        .filter(
          ([_, tx]) =>
            tx.type === "pengajuan_pinjaman" &&
            tx.status === "menunggu_bendahara"
        )
        .sort((a, b) => new Date(b[1].created_at) - new Date(a[1].created_at))
    : [];

  const riwayatFiltered = transactions
    ? Object.entries(transactions)
        .filter(([_, tx]) => {
          if (
            tx.status !== "approved" &&
            tx.status !== "menunggu_edit" &&
            tx.status !== "menunggu_hapus"
          )
            return false;
          if (kategoriRiwayat === "pemasukan") {
            return [
              "pemasukan_kas",
              "pemasukan_tabungan",
              "bayar_pinjaman",
              "bayar_pinjaman_tabungan",
            ].includes(tx.type);
          } else if (kategoriRiwayat === "pengeluaran") {
            return [
              "pengajuan_pengeluaran",
              "pengajuan_pinjaman",
              "pengambilan_tabungan",
            ].includes(tx.type);
          }
          return true;
        })
        .sort((a, b) => new Date(b[1].created_at) - new Date(a[1].created_at))
    : [];

  const addLog = async (action, family_id, description) => {
    await push(ref(db, "logs"), {
      action,
      family_id: family_id || "global",
      user_name: userData.name,
      description,
      created_at: new Date().toISOString(),
    });
  };

  const handleApproveSetoran = async (txId, tx) => {
    setProcessing(true);
    try {
      const updates = {};
      updates[`transactions/${txId}/status`] = "approved";

      const currentKas = globalFunds?.total_kas || 0;
      const currentTabungan = globalFunds?.total_tabungan || 0;

      if (tx.type === "pemasukan_kas") {
        updates[`global_funds/total_kas`] = currentKas + tx.amount;
        if (tx.family_id) {
          const familyCurrentKas = families?.[tx.family_id]?.total_kas || 0;
          updates[`families/${tx.family_id}/total_kas`] =
            familyCurrentKas + tx.amount;
        }
      } else if (tx.type === "pemasukan_tabungan") {
        updates[`global_funds/total_tabungan`] = currentTabungan + tx.amount;
        if (tx.family_id) {
          const familyCurrentTabungan =
            families?.[tx.family_id]?.total_tabungan || 0;
          updates[`families/${tx.family_id}/total_tabungan`] =
            familyCurrentTabungan + tx.amount;
        }
      } else if (tx.type === "bayar_pinjaman") {
        updates[`global_funds/total_kas`] = currentKas + tx.amount;
      } else if (tx.type === "bayar_pinjaman_tabungan") {
        updates[`global_funds/total_tabungan`] = currentTabungan - tx.amount;
        updates[`global_funds/total_kas`] = currentKas + tx.amount;
        if (tx.family_id) {
          const familyCurrentTabungan =
            families?.[tx.family_id]?.total_tabungan || 0;
          updates[`families/${tx.family_id}/total_tabungan`] =
            familyCurrentTabungan - tx.amount;
        }
      }

      await update(ref(db), updates);
      await addLog(
        "APPROVE",
        tx.family_id,
        `Bendahara menyetujui ${tx.type.toUpperCase()} dari ${
          tx.user_name
        } sebesar Rp${tx.amount}`
      );
    } catch (err) {
      alert("Gagal menyetujui transaksi.");
    } finally {
      setProcessing(false);
    }
  };

  const handleForwardPinjaman = async () => {
    if (!loanProofFile) return alert("Unggah bukti transfer pencairan!");
    setProcessing(true);
    try {
      const customFileName = `Pencairan_${Date.now()}_${selectedLoan.id}`;
      const proofUrl = await uploadImageToCloudinary(
        loanProofFile,
        customFileName
      );

      const updates = {};
      updates[`transactions/${selectedLoan.id}/status`] = "menunggu_ketua";
      updates[`transactions/${selectedLoan.id}/proof_pencairan`] = proofUrl;

      await update(ref(db), updates);
      await addLog(
        "FORWARD",
        selectedLoan.tx.family_id,
        `Bendahara melampirkan BUKTI PENCAIRAN PINJAMAN`
      );

      triggerAdminNotification(
        "Persetujuan Pinjaman ⏳",
        `Bendahara telah melampirkan bukti pencairan. Menunggu validasi Ketua.`,
        ["ketua", "superuser"]
      );

      setLoanModalOpen(false);
      setSelectedLoan(null);
      setLoanProofFile(null);
      alert("Bukti berhasil diunggah! Diteruskan ke Ketua.");
    } catch (err) {
      alert("Gagal memproses.");
    } finally {
      setProcessing(false);
    }
  };

  // PERBAIKAN LOGIKA: Hanya hapus spesifik ID ini saja
  const handleReject = async (txId, tx) => {
    if (!txId) return; // Mencegah ID kosong yang fatal
    if (!window.confirm("Tolak / Hapus pengajuan ini?")) return;

    setProcessing(true);
    try {
      // Menggunakan referensi langsung ke single ID Transaksi agar 100% aman
      await remove(ref(db, `transactions/${txId}`));

      await addLog(
        "DELETE",
        tx.family_id,
        `Bendahara menghapus/menolak transaksi dari ${tx.user_name}`
      );
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus transaksi.");
    } finally {
      setProcessing(false);
    }
  };

  const openActionModal = (type, txId, tx) => {
    setActionModal({ isOpen: true, type, txId, tx });
    setActionForm({
      amount: tx.amount,
      description: tx.description || "",
      alasan: "",
    });
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!actionForm.alasan) return alert("Alasan wajib diisi!");
    if (
      actionModal.type === "edit" &&
      (!actionForm.amount || parseInt(actionForm.amount) <= 0)
    )
      return alert("Nominal edit tidak valid!");

    setProcessing(true);
    try {
      const { txId, tx, type } = actionModal;
      const updates = {};

      if (type === "delete") {
        updates[`${txId}/status`] = "menunggu_hapus";
        updates[`${txId}/alasan_perubahan`] = actionForm.alasan;
        await updateTx(updates);
        await addLog(
          "FORWARD",
          tx.family_id,
          `Bendahara mengajukan PENGHAPUSAN transaksi ${tx.type} senilai Rp${tx.amount}`
        );

        triggerAdminNotification(
          "Permintaan Hapus Data ⚠️",
          `Bendahara mengajukan PENGHAPUSAN transaksi lama senilai Rp${formatCurrency(
            tx.amount
          )}.`,
          ["ketua", "superuser"]
        );
      } else if (type === "edit") {
        updates[`${txId}/status`] = "menunggu_edit";
        updates[`${txId}/alasan_perubahan`] = actionForm.alasan;
        updates[`${txId}/edit_draft`] = {
          amount: parseInt(actionForm.amount),
          description: actionForm.description,
        };
        await updateTx(updates);
        await addLog(
          "FORWARD",
          tx.family_id,
          `Bendahara mengajukan PERUBAHAN transaksi ${tx.type} dari Rp${tx.amount} menjadi Rp${actionForm.amount}`
        );

        triggerAdminNotification(
          "Permintaan Edit Data ⚠️",
          `Bendahara mengajukan PERUBAHAN nominal transaksi menjadi Rp${formatCurrency(
            actionForm.amount
          )}.`,
          ["ketua", "superuser"]
        );
      }

      alert("Pengajuan berhasil dikirim ke Ketua!");
      setActionModal({ isOpen: false, type: "", txId: "", tx: null });
      setActionForm({ amount: "", description: "", alasan: "" });
    } catch (error) {
      alert("Gagal mengirim pengajuan.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmitPengeluaran = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await pushData({
        type: "pengajuan_pengeluaran",
        user_name: userData.name,
        amount: parseInt(outForm.amount, 10),
        description: outForm.description,
        status: "menunggu_ketua",
        created_at: new Date().toISOString(),
      });
      await addLog(
        "CREATE",
        "global",
        `Bendahara mengajukan PENGELUARAN Rp${outForm.amount} ke Ketua`
      );

      triggerAdminNotification(
        "Pengajuan Pengeluaran Kas 📤",
        `Bendahara mengajukan pengeluaran kas sebesar Rp${formatCurrency(
          outForm.amount
        )}. Mohon segera disetujui.`,
        ["ketua", "superuser"]
      );

      setOutForm({ amount: "", description: "" });
      alert("Berhasil diajukan ke Ketua!");
    } catch (err) {
      alert("Request gagal");
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.family_id) return alert("Pilih keluarga!");
    if (!manualForm.amount || parseInt(manualForm.amount) <= 0)
      return alert("Masukkan nominal valid!");

    if (
      manualForm.type === "bayar_pinjaman_tabungan" ||
      manualForm.type === "pengambilan_tabungan"
    ) {
      const familyTabungan =
        families?.[manualForm.family_id]?.total_tabungan || 0;
      if (parseInt(manualForm.amount) > familyTabungan) {
        return alert(
          `Gagal: Nominal tidak boleh melebihi sisa tabungan! (Sisa: ${formatCurrency(
            familyTabungan
          )})`
        );
      }
    }

    if (manualForm.type === "pemasukan_kas" && selectedMonths.length === 0) {
      return alert("Harap centang minimal 1 bulan untuk dibayarkan!");
    }

    if (
      manualForm.type !== "bayar_pinjaman_tabungan" &&
      !manualForm.file &&
      !window.confirm(
        manualForm.type === "pengambilan_tabungan"
          ? "Tidak ada bukti transfer/penyerahan uang. Lanjutkan?"
          : "Tidak ada bukti gambar. Lanjutkan?"
      )
    )
      return;

    setProcessing(true);
    try {
      const tempTxRef = push(ref(db, "transactions"));
      const txId = tempTxRef.key;

      let proofUrl = "";
      if (manualForm.file) {
        const d = new Date();
        const timeString = `${d.getFullYear()}${(d.getMonth() + 1)
          .toString()
          .padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}_${d
          .getHours()
          .toString()
          .padStart(2, "0")}${d.getMinutes().toString().padStart(2, "0")}`;
        const safeType = manualForm.type.replace(/[^a-zA-Z]/g, "");
        const customFileName = `${timeString}_${txId}_${safeType}_${manualForm.family_id}`;
        proofUrl = await uploadImageToCloudinary(
          manualForm.file,
          customFileName
        );
      }

      const isPinjaman = manualForm.type === "pengajuan_pinjaman";
      const finalStatus = isPinjaman ? "menunggu_ketua" : "approved";
      const familyName =
        families?.[manualForm.family_id]?.nama_kepala || manualForm.family_id;

      const payload = {
        type: manualForm.type,
        family_id: manualForm.family_id,
        user_name: `[MANUAL] By Bendahara (${familyName})`,
        amount: parseInt(manualForm.amount),
        description: manualForm.description || `Input manual oleh bendahara`,
        proof_url: proofUrl,
        status: finalStatus,
        created_at: new Date().toISOString(),
        ...(manualForm.type === "pemasukan_kas"
          ? { months_covered: selectedMonths }
          : {}),
      };

      await set(tempTxRef, payload);

      if (!isPinjaman) {
        const updates = {};
        const currentKas = globalFunds?.total_kas || 0;
        const currentTabungan = globalFunds?.total_tabungan || 0;
        const fKas = families?.[manualForm.family_id]?.total_kas || 0;
        const fTab = families?.[manualForm.family_id]?.total_tabungan || 0;

        if (manualForm.type === "pemasukan_kas") {
          updates[`global_funds/total_kas`] = currentKas + payload.amount;
          if (manualForm.family_id)
            updates[`families/${manualForm.family_id}/total_kas`] =
              fKas + payload.amount;
        } else if (manualForm.type === "pemasukan_tabungan") {
          updates[`global_funds/total_tabungan`] =
            currentTabungan + payload.amount;
          if (manualForm.family_id)
            updates[`families/${manualForm.family_id}/total_tabungan`] =
              fTab + payload.amount;
        } else if (manualForm.type === "bayar_pinjaman") {
          updates[`global_funds/total_kas`] = currentKas + payload.amount;
        } else if (manualForm.type === "bayar_pinjaman_tabungan") {
          updates[`global_funds/total_tabungan`] =
            currentTabungan - payload.amount;
          updates[`global_funds/total_kas`] = currentKas + payload.amount;
          if (manualForm.family_id)
            updates[`families/${manualForm.family_id}/total_tabungan`] =
              fTab - payload.amount;
        } else if (manualForm.type === "pengambilan_tabungan") {
          updates[`global_funds/total_tabungan`] =
            currentTabungan - payload.amount;
          if (manualForm.family_id) {
            updates[`families/${manualForm.family_id}/total_tabungan`] =
              fTab - payload.amount;
          }
        }
        await update(ref(db), updates);
      }

      await addLog(
        "CREATE",
        manualForm.family_id,
        `Bendahara membuat input manual ${manualForm.type.toUpperCase()} sebesar Rp${
          payload.amount
        } untuk keluarga ${familyName}`
      );

      setManualForm({
        family_id: "",
        type: "pemasukan_kas",
        amount: "",
        description: "",
        file: null,
      });
      setSelectedMonths([]);
      alert("Input manual berhasil disimpan dan masuk ke Riwayat!");
    } catch (err) {
      console.error(err);
      alert("Gagal memproses input manual.");
    } finally {
      setProcessing(false);
    }
  };

  const handleExportExcel = () => {
    if (!transactions) return alert("Belum ada data transaksi.");

    const now = new Date();
    let validTx = Object.entries(transactions)
      .map(([id, t]) => ({ id, ...t }))
      .filter((t) => t.status === "approved");

    validTx = validTx.filter((log) => {
      const logDate = new Date(log.created_at);
      const diffTime = Math.abs(now - logDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      switch (exportDuration) {
        case "1_bulan":
          return diffDays <= 30;
        case "2_bulan":
          return diffDays <= 60;
        case "1_tahun":
          return diffDays <= 365;
        default:
          return true;
      }
    });

    if (validTx.length === 0)
      return alert("Tidak ada data di rentang waktu tersebut.");

    const excelData = validTx.map((t) => {
      const isPemasukan = [
        "pemasukan_kas",
        "pemasukan_tabungan",
        "bayar_pinjaman",
        "bayar_pinjaman_tabungan",
      ].includes(t.type);
      return {
        Tanggal: new Date(t.created_at).toLocaleString("id-ID"),
        "ID Transaksi": t.id,
        Jenis: t.type.replace(/_/g, " ").toUpperCase(),
        "Keluarga (Nama)": t.user_name || t.family_id,
        Catatan: t.description || "-",
        "Pemasukan (Rp)": isPemasukan ? t.amount : 0,
        "Pengeluaran (Rp)": !isPemasukan ? t.amount : 0,
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap_Keuangan");
    XLSX.writeFile(wb, `Laporan_Hj_Maryani_${exportDuration}.xlsx`);
  };

  if (txLoading || fundsLoading)
    return (
      <div className="animate-pulse flex gap-4 h-32 bg-white rounded-2xl p-5 w-full"></div>
    );

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex bg-brand-100 p-1 rounded-xl shadow-sm gap-1 overflow-x-auto whitespace-nowrap hide-scrollbar">
        <button
          onClick={() => setActiveSubTab("setoran")}
          className={`flex-1 min-w-[60px] py-2 px-2 text-[11px] font-semibold rounded-lg transition-colors ${
            activeSubTab === "setoran"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-brand-600 hover:text-brand-800"
          }`}
        >
          Masuk
        </button>
        <button
          onClick={() => setActiveSubTab("pinjaman")}
          className={`flex-1 min-w-[70px] py-2 px-2 text-[11px] font-semibold rounded-lg transition-colors ${
            activeSubTab === "pinjaman"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-brand-600 hover:text-brand-800"
          }`}
        >
          Pinjaman
        </button>
        <button
          onClick={() => setActiveSubTab("pengeluaran")}
          className={`flex-1 min-w-[80px] py-2 px-2 text-[11px] font-semibold rounded-lg transition-colors ${
            activeSubTab === "pengeluaran"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-brand-600 hover:text-brand-800"
          }`}
        >
          Pengeluaran
        </button>
        <button
          onClick={() => setActiveSubTab("manual")}
          className={`flex-1 min-w-[70px] py-2 px-2 text-[11px] font-bold rounded-lg transition-colors ${
            activeSubTab === "manual"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-brand-600 hover:text-brand-800"
          }`}
        >
          +Manual
        </button>
        <button
          onClick={() => setActiveSubTab("riwayat")}
          className={`flex-1 min-w-[70px] py-2 px-2 text-[11px] font-bold rounded-lg transition-colors ${
            activeSubTab === "riwayat"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-brand-600 hover:text-brand-800"
          }`}
        >
          Riwayat
        </button>
        <button
          onClick={() => setActiveSubTab("laporan")}
          className={`flex-1 min-w-[70px] py-2 px-2 text-[11px] font-bold rounded-lg transition-colors ${
            activeSubTab === "laporan"
              ? "bg-green-600 text-white shadow-sm"
              : "text-brand-600 hover:text-brand-800"
          }`}
        >
          Laporan
        </button>
      </div>

      {activeSubTab === "setoran" && (
        <section>
          {pendingSetoran.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-brand-100 text-center text-brand-400">
              <CheckCircle2 className="w-10 h-10 text-brand-200 mx-auto mb-2" />
              Tida ada setoran tertunda.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {pendingSetoran.map(([id, tx]) => (
                <div
                  key={id}
                  className="bg-white rounded-2xl overflow-hidden border border-brand-100 shadow-sm flex flex-col sm:flex-row"
                >
                  <div
                    className="bg-brand-100 w-full sm:w-40 sm:h-auto h-40 relative group cursor-pointer"
                    onClick={() => {
                      if (tx.proof_url) {
                        openImageModal(tx.proof_url);
                      }
                    }}
                  >
                    {tx.proof_url ? (
                      <img
                        src={tx.proof_url}
                        alt="Bukti Transfer"
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-400 text-xs text-center p-2">
                        {tx.type === "bayar_pinjaman_tabungan"
                          ? "Sistem: Potong Tabungan"
                          : "Tanpa Gambar"}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Search className="text-white w-6 h-6" />
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2 border-b border-brand-100 pb-2">
                      <div>
                        <p className="font-bold text-brand-900">
                          {tx.user_name}
                        </p>
                        <p className="text-[10px] text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded mt-1 inline-block uppercase tracking-wider">
                          {tx.type.replace("pemasukan_", "").replace("_", " ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-brand-700 text-lg leading-tight">
                          {formatCurrency(tx.amount || 0)}
                        </p>
                        {tx.unique_code && (
                          <p className="text-[10px] text-amber-600 font-semibold mb-[-4px]">
                            Termasuk sandi: +{tx.unique_code}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mb-4 text-xs text-brand-600">
                      {tx.type === "pemasukan_kas" && tx.months_covered && (
                        <div className="mb-1">
                          <span className="font-semibold text-brand-800">
                            Ceklisan Lunas:{" "}
                          </span>
                          <span className="bg-green-50 text-green-700 px-1 rounded inline-block">
                            {tx.months_covered.join(", ")}
                          </span>
                        </div>
                      )}
                      {tx.description && (
                        <p>
                          <span className="opacity-70">Catatan:</span>{" "}
                          {tx.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <button
                        disabled={processing}
                        onClick={() => handleApproveSetoran(id, tx)}
                        className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                      >
                        Verifikasi
                      </button>
                      <button
                        disabled={processing}
                        onClick={() => handleReject(id, tx)}
                        className="px-4 bg-red-50 text-red-600 hover:bg-red-100 py-2 rounded-xl text-sm font-medium transition-colors"
                      >
                        Tolak/Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeSubTab === "pinjaman" && (
        <section>
          <div className="mb-4 bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h4 className="text-amber-800 font-bold text-sm">
              Review Pinjaman
            </h4>
            <p className="text-xs text-amber-700">
              Tinjau kelayakan pinjaman anggota sebelum diteruskan ke Ketua.
            </p>
          </div>
          {pendingPinjaman.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-brand-100 text-center text-brand-400">
              Tidak ada pengajuan pinjaman.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {pendingPinjaman.map(([id, tx]) => (
                <div
                  key={id}
                  className="bg-white rounded-2xl p-5 border border-brand-100 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-brand-900">
                      {tx.user_name}
                    </p>
                    <p className="font-bold text-amber-600 text-lg">
                      {formatCurrency(tx.amount)}
                    </p>
                  </div>
                  <p className="text-sm text-brand-600 mb-4 bg-brand-50 p-3 rounded-lg border border-brand-100">
                    "{tx.description}"
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={processing}
                      onClick={() => {
                        setSelectedLoan({ id, tx });
                        setLoanModalOpen(true);
                      }}
                      className="flex-1 flex gap-2 items-center justify-center bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                    >
                      <ArrowRightCircle className="w-4 h-4" /> Setujui &
                      Lampirkan Struk
                    </button>
                    <button
                      disabled={processing}
                      onClick={() => handleReject(id, tx)}
                      className="px-4 bg-red-50 text-red-600 hover:bg-red-100 py-2 rounded-xl text-sm font-medium transition-colors"
                    >
                      Tolak/Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeSubTab === "pengeluaran" && (
        <section>
          <form
            onSubmit={handleSubmitPengeluaran}
            className="bg-white rounded-2xl p-6 border border-brand-100 shadow-sm flex flex-col gap-4"
          >
            <h3 className="font-bold text-brand-900 border-b border-brand-100 pb-2">
              Pengajuan Pengeluaran Kas
            </h3>
            <p className="text-xs text-brand-500">
              Buat draf pengeluaran kas (contoh: Biaya konsumsi acara, duka
              cita). Saldo otomatis terpotong saat Ketua menekan "Setuju".
            </p>
            <div>
              <label className="text-xs font-semibold text-brand-700 mb-1 block">
                Nominal (Rp)
              </label>
              <input
                required
                type="number"
                min="0"
                value={outForm.amount}
                onChange={(e) =>
                  setOutForm({ ...outForm, amount: e.target.value })
                }
                className="w-full border border-brand-200 rounded-xl px-4 py-3 bg-brand-50/50 outline-none focus:border-brand-500 text-brand-900"
                placeholder="Rp..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-700 mb-1 block">
                Keterangan / Kebutuhan
              </label>
              <textarea
                required
                value={outForm.description}
                onChange={(e) =>
                  setOutForm({ ...outForm, description: e.target.value })
                }
                className="w-full border border-brand-200 rounded-xl px-4 py-3 bg-brand-50/50 outline-none focus:border-brand-500 text-brand-900 resize-none"
                rows="3"
                placeholder="Deskripsikan untuk apa..."
              />
            </div>
            <button
              disabled={processing}
              type="submit"
              className="w-full flex gap-2 items-center justify-center bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white py-3 rounded-xl font-medium mt-2 shadow-md"
            >
              <Send className="w-4 h-4" /> Ajukan ke Ketua
            </button>
          </form>
        </section>
      )}

      {/* TAB MANUAL KHUSUS BENDAHARA */}
      {activeSubTab === "manual" && (
        <section>
          <form
            onSubmit={handleManualSubmit}
            className="bg-white rounded-2xl p-6 border border-brand-100 shadow-sm flex flex-col gap-4"
          >
            <div className="mb-2">
              <h3 className="font-bold text-brand-900 flex items-center gap-2">
                <PenTool className="w-5 h-5 text-brand-600" /> Input Manual
              </h3>
              <p className="text-[11px] text-brand-500 leading-tight block mt-1">
                Gunakan form ini khusus untuk proses data secara langsung dari
                keluarga lansia/gagap teknologi. Transaksi yg diinput kesini
                akan memotong proses checkout / transaksi tanpa perlu
                PERSETUJUAN.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-700 mb-1 block">
                1. Pilih Keluarga
              </label>
              <select
                required
                value={manualForm.family_id}
                onChange={(e) => {
                  setManualForm({
                    ...manualForm,
                    family_id: e.target.value,
                    amount: "",
                  });
                  setSelectedMonths([]);
                }}
                className="w-full border border-brand-200 rounded-xl px-4 py-3 bg-brand-50/50 outline-none focus:border-brand-500 text-sm"
              >
                <option value="">-- Pilih Keluarga --</option>
                {families &&
                  Object.entries(families).map(([fid, fam]) => (
                    <option key={fid} value={fid}>
                      {fam.nama_kepala}
                    </option>
                  ))}
              </select>
              {manualForm.family_id && (
                <div className="mt-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex justify-between items-center">
                  <span className="text-xs text-blue-700 font-semibold">
                    Saldo Tabungan Dimiliki:
                  </span>
                  <span className="text-sm font-bold text-blue-900">
                    {formatCurrency(
                      families?.[manualForm.family_id]?.total_tabungan || 0
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-brand-50 rounded-xl p-2 border border-brand-100">
              {/* URUTAN BARU BERDASARKAN PERMINTAAN */}
              <button
                type="button"
                onClick={() =>
                  setManualForm({ ...manualForm, type: "pemasukan_kas" })
                }
                className={`py-2 px-1 text-xs font-semibold rounded-lg border transition-colors ${
                  manualForm.type === "pemasukan_kas"
                    ? "bg-white text-brand-700 shadow-sm border-brand-300"
                    : "border-transparent text-brand-500"
                }`}
              >
                Kas Wajib
              </button>
              <button
                type="button"
                onClick={() =>
                  setManualForm({ ...manualForm, type: "pemasukan_tabungan" })
                }
                className={`py-2 px-1 text-xs font-semibold rounded-lg border transition-colors ${
                  manualForm.type === "pemasukan_tabungan"
                    ? "bg-white text-brand-700 shadow-sm border-brand-300"
                    : "border-transparent text-brand-500"
                }`}
              >
                Tabungan
              </button>
              <button
                type="button"
                onClick={() =>
                  setManualForm({ ...manualForm, type: "pengambilan_tabungan" })
                }
                className={`py-2 px-1 text-xs font-semibold rounded-lg border transition-colors ${
                  manualForm.type === "pengambilan_tabungan"
                    ? "bg-white text-orange-700 shadow-sm border-orange-300"
                    : "border-transparent text-brand-500"
                }`}
              >
                Ambil Tabungan
              </button>
              <button
                type="button"
                onClick={() =>
                  setManualForm({ ...manualForm, type: "pengajuan_pinjaman" })
                }
                className={`py-2 px-1 text-xs font-semibold rounded-lg border transition-colors ${
                  manualForm.type === "pengajuan_pinjaman"
                    ? "bg-white text-red-700 shadow-sm border-red-300"
                    : "border-transparent text-brand-500"
                }`}
              >
                Ajukan Pinjaman
              </button>
              <button
                type="button"
                onClick={() =>
                  setManualForm({ ...manualForm, type: "bayar_pinjaman" })
                }
                className={`py-2 px-1 text-xs font-semibold rounded-lg border transition-colors ${
                  manualForm.type === "bayar_pinjaman"
                    ? "bg-white text-brand-700 shadow-sm border-brand-300"
                    : "border-transparent text-brand-500"
                }`}
              >
                Bayar / Cicil Pinjaman
              </button>
              <button
                type="button"
                onClick={() =>
                  setManualForm({
                    ...manualForm,
                    type: "bayar_pinjaman_tabungan",
                  })
                }
                className={`py-2 px-1 text-[11px] sm:text-xs font-semibold rounded-lg border transition-colors ${
                  manualForm.type === "bayar_pinjaman_tabungan"
                    ? "bg-white text-purple-700 shadow-sm border-purple-300"
                    : "border-transparent text-brand-500"
                }`}
              >
                Bayar (Potong Tabungan)
              </button>
            </div>

            {/* UI GRID PILIHAN BULAN JIKA MEMILIH KAS MASUK DAN KELUARGA */}
            {manualForm.type === "pemasukan_kas" && manualForm.family_id && (
              <div className="bg-brand-50 p-4 rounded-xl border border-brand-200 mt-2">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-semibold text-brand-700">
                    Pilih Bulan Kas
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                      setSelectedMonths([]);
                      setManualForm({ ...manualForm, amount: "" });
                    }}
                    className="bg-white border border-brand-200 text-xs font-bold p-1 px-2 rounded-lg text-brand-700 outline-none focus:border-brand-500"
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
                <div className="text-xs text-brand-600 mt-3 font-medium bg-white p-2 rounded-lg border border-brand-100 flex justify-between items-center shadow-sm">
                  <span>{selectedMonths.length} Bulan Terpilih</span>
                  <span className="font-bold text-green-700">
                    Total: {formatCurrency(selectedMonths.length * 10000)}
                  </span>
                </div>
              </div>
            )}

            {(manualForm.type === "bayar_pinjaman" ||
              manualForm.type === "bayar_pinjaman_tabungan") &&
              manualForm.family_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex justify-between items-center text-blue-700 shadow-sm mb-3">
                  <div>
                    <p className="text-xs font-bold uppercase">
                      Sisa Pinjaman Berjalan
                    </p>
                    <h3 className="text-lg font-bold">
                      {formatCurrency(activeFamilyLoan)}
                    </h3>
                  </div>
                  <HandCoins className="w-8 h-8 opacity-40" />
                </div>
              )}

            <div>
              <label className="text-xs font-semibold text-brand-700 mb-1 block">
                Nominal Rupiah Bersih (Rp)
              </label>
              <input
                required
                type="number"
                min="0"
                disabled={isLoanPaymentDisabled}
                value={manualForm.amount}
                readOnly={manualForm.type === "pemasukan_kas"}
                onChange={(e) => {
                  let val = e.target.value;
                  if (
                    (manualForm.type === "bayar_pinjaman_tabungan" ||
                      manualForm.type === "pengambilan_tabungan") &&
                    manualForm.family_id &&
                    val !== ""
                  ) {
                    const maxTabungan =
                      families?.[manualForm.family_id]?.total_tabungan || 0;
                    if (parseInt(val) > maxTabungan) {
                      alert(
                        `Nominal tidak bisa melebihi saldo tabungan yang tersedia (${formatCurrency(
                          maxTabungan
                        )})`
                      );
                      val = maxTabungan.toString();
                    }
                  }
                  if (
                    (manualForm.type === "bayar_pinjaman" ||
                      manualForm.type === "bayar_pinjaman_tabungan") &&
                    manualForm.family_id &&
                    val !== ""
                  ) {
                    if (parseInt(val) > activeFamilyLoan) {
                      alert(
                        "Nominal cicilan tidak boleh melebihi sisa hutang berjalan!"
                      );
                      val = activeFamilyLoan.toString();
                    }
                  }
                  setManualForm({ ...manualForm, amount: val });
                }}
                className={`w-full font-bold border border-brand-200 rounded-xl px-4 py-3 outline-none focus:border-brand-500 text-brand-900 ${
                  manualForm.type === "pemasukan_kas" || isLoanPaymentDisabled
                    ? "bg-gray-100 cursor-not-allowed text-gray-400"
                    : "bg-brand-50/50"
                }`}
                placeholder="Contoh: 100000"
              />
            </div>

            {manualForm.type !== "bayar_pinjaman_tabungan" && (
              <div>
                <label className="text-xs font-semibold text-brand-700 mb-1 block">
                  {manualForm.type === "pengambilan_tabungan"
                    ? "Bukti Penyerahan / Transfer Uang Tabungan"
                    : "Bukti Penyerahan / Transfer Uang Masuk / Pinjaman"}
                </label>
                <label className="border-2 border-dashed border-brand-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-brand-50 transition-colors relative overflow-hidden group min-h-[120px]">
                  {manualForm.file ? (
                    <>
                      <img
                        src={URL.createObjectURL(manualForm.file)}
                        alt="Preview Struk"
                        className="absolute inset-0 w-full h-full object-contain p-2 opacity-50 group-hover:opacity-20 transition-opacity"
                      />
                      <span className="text-sm font-bold text-green-700 px-2 text-center relative z-10 bg-white/80 p-1 rounded">
                        {manualForm.file.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-brand-400 mb-1" />
                      <span className="text-[10px] text-brand-500 px-2 text-center">
                        Tap untuk foto{" "}
                        {manualForm.type === "pengambilan_tabungan"
                          ? "bukti penyerahan..."
                          : "struk / tangkap layar..."}
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) =>
                      e.target.files[0] &&
                      setManualForm({
                        ...manualForm,
                        file: e.target.files[0],
                      })
                    }
                  />
                </label>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-brand-700 mb-1 block">
                Keterangan Khusus
              </label>
              <textarea
                value={manualForm.description}
                disabled={isLoanPaymentDisabled}
                onChange={(e) =>
                  setManualForm({ ...manualForm, description: e.target.value })
                }
                className={`w-full border border-brand-200 rounded-xl px-4 py-3 outline-none focus:border-brand-500 text-xs resize-none ${
                  isLoanPaymentDisabled
                    ? "bg-gray-100 cursor-not-allowed text-gray-400"
                    : "bg-brand-50/50"
                }`}
                rows="2"
                placeholder="Catatan... (Opsional)"
              />
            </div>

            <button
              disabled={
                processing ||
                isLoanPaymentDisabled ||
                (!manualForm.family_id && isLoanPayment)
              }
              type="submit"
              className={`w-full flex gap-2 items-center justify-center text-white py-3 rounded-xl font-bold mt-2 shadow-md transition-colors ${
                isLoanPaymentDisabled
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gray-900 hover:bg-black"
              }`}
            >
              {processing
                ? "Proses Data..."
                : isLoanPaymentDisabled
                ? "Hutang Sudah Lunas"
                : "Proses Transaksi"}
            </button>
          </form>
        </section>
      )}

      {/* TAB RIWAYAT TRANSAKSI */}
      {activeSubTab === "riwayat" && (
        <section className="bg-white rounded-2xl p-6 border shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between mb-4 border-b pb-3 gap-3">
            <h3 className="font-bold text-brand-900 flex items-center gap-2">
              <History className="w-5 h-5" /> Manajemen Riwayat Transaksi
            </h3>
            <select
              value={kategoriRiwayat}
              onChange={(e) => setKategoriRiwayat(e.target.value)}
              className="border p-2 rounded-lg text-sm bg-gray-50 outline-none focus:border-brand-500"
            >
              <option value="semua">Semua Transaksi</option>
              <option value="pemasukan">Hanya Pemasukan</option>
              <option value="pengeluaran">Hanya Pengeluaran</option>
            </select>
          </div>

          <div className="flex flex-col gap-3">
            {riwayatFiltered.length > 0 ? (
              riwayatFiltered.map(([id, tx]) => (
                <div
                  key={id}
                  className={`flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-xl border transition-colors ${
                    tx.status.startsWith("menunggu_")
                      ? "bg-amber-50 border-amber-200"
                      : "hover:bg-gray-50 border-gray-100"
                  }`}
                >
                  <div className="mb-2 sm:mb-0">
                    <p className="font-bold text-sm text-gray-900 capitalize">
                      {tx.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString("id-ID")} •
                      Oleh: {tx.user_name}
                    </p>
                    {tx.status === "menunggu_edit" && (
                      <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                        <PenTool className="w-3 h-3" /> Pending Persetujuan Edit
                      </p>
                    )}
                    {tx.status === "menunggu_hapus" && (
                      <p className="text-[10px] font-bold text-red-600 mt-1 flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Pending Persetujuan Hapus
                      </p>
                    )}

                    {tx.proof_url && (
                      <button
                        onClick={() => openImageModal(tx.proof_url)}
                        className="text-[10px] font-bold text-brand-600 hover:underline mt-2 bg-brand-100 px-2 py-0.5 rounded flex items-center gap-1 w-max"
                      >
                        Lihat Struk
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                    <p
                      className={`font-bold text-base ${
                        [
                          "pengajuan_pinjaman",
                          "pengajuan_pengeluaran",
                          "pengambilan_tabungan",
                        ].includes(tx.type)
                          ? "text-red-500"
                          : "text-green-600"
                      }`}
                    >
                      {[
                        "pengajuan_pinjaman",
                        "pengajuan_pengeluaran",
                        "pengambilan_tabungan",
                      ].includes(tx.type)
                        ? "-"
                        : "+"}
                      {formatCurrency(tx.amount)}
                    </p>
                    {tx.status === "approved" && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => openActionModal("edit", id, tx)}
                          className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          title="Ajukan Edit ke Ketua"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openActionModal("delete", id, tx)}
                          className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          title="Ajukan Hapus ke Ketua"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 py-6 text-sm">
                Belum ada riwayat transaksi yang disetujui.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Laporan Section */}
      {activeSubTab === "laporan" && (
        <section>
          <div className="bg-white rounded-2xl p-6 border border-brand-100 shadow-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-green-700 flex items-center gap-2">
                <Download className="w-5 h-5" /> Cetak Buku Besar Keuangan
              </h3>
              <p className="text-xs text-brand-500 mt-1">
                Unduh seluruh kalkulasi rekap manual (Debit/Kredit Kas,
                Tabungan, Pinjaman, dan Acara) yang sudah sah disetujui dalam
                format Microsoft Excel.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={exportDuration}
                onChange={(e) => setExportDuration(e.target.value)}
                className="w-full flex-1 border border-brand-200 rounded-xl px-4 py-3 bg-brand-50/50 outline-none focus:border-green-500 text-sm font-semibold"
              >
                <option value="1_bulan">1 Bulan Terakhir</option>
                <option value="2_bulan">2 Bulan Terakhir</option>
                <option value="1_tahun">1 Tahun Terakhir / Tahunan</option>
                <option value="semua">Keseluruhan Semenjak Awal</option>
              </select>
              <button
                onClick={handleExportExcel}
                className="w-full sm:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition-transform active:scale-[0.98] whitespace-nowrap"
              >
                Export ke .XLSX
              </button>
            </div>
          </div>
        </section>
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

      {loanModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md animate-in zoom-in-95">
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2 text-amber-600">
              <Upload className="w-5 h-5" /> Upload Bukti Pencairan
            </h3>
            <p className="text-xs text-gray-500 mb-4 border-b pb-3">
              Silakan lampirkan bukti transfer pencairan pinjaman sebesar{" "}
              <strong className="text-amber-600 font-bold">
                {formatCurrency(selectedLoan.tx.amount)}
              </strong>{" "}
              untuk {selectedLoan.tx.user_name}.
            </p>
            <div className="mb-4">
              <label className="border-2 border-dashed border-amber-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-amber-50 transition-colors relative overflow-hidden group min-h-[120px]">
                {loanProofFile ? (
                  <>
                    <img
                      src={URL.createObjectURL(loanProofFile)}
                      alt="Preview Struk"
                      className="absolute inset-0 w-full h-full object-contain p-2 opacity-50 group-hover:opacity-20 transition-opacity"
                    />
                    <span className="text-sm font-bold text-green-700 px-2 text-center relative z-10 bg-white/80 p-1 rounded">
                      {loanProofFile.name}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-amber-400 mb-1" />
                    <span className="text-[10px] text-amber-600 px-2 text-center">
                      Tap untuk foto struk / tangkap layar...
                    </span>
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      setLoanProofFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setLoanModalOpen(false);
                  setLoanProofFile(null); // Clear form ketika batal
                }}
                className="flex-1 py-3 bg-gray-200 text-gray-800 font-bold rounded-xl text-sm hover:bg-gray-300 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleForwardPinjaman}
                disabled={processing}
                className="flex-1 flex justify-center items-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors"
              >
                {processing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Teruskan ke Ketua
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md animate-in zoom-in-95">
            <h3
              className={`font-bold text-lg mb-1 flex items-center gap-2 ${
                actionModal.type === "delete" ? "text-red-600" : "text-blue-600"
              }`}
            >
              {actionModal.type === "delete" ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <Edit3 className="w-5 h-5" />
              )}
              Pengajuan{" "}
              {actionModal.type === "delete" ? "Penghapusan" : "Perubahan"} Data
            </h3>
            <p className="text-xs text-gray-500 mb-4 border-b pb-3">
              Transaksi ini sudah direkapitulasi. Perubahan/Penghapusan
              membutuhkan izin Ketua agar tidak terjadi selisih pencatatan.
            </p>
            <form onSubmit={handleActionSubmit} className="flex flex-col gap-4">
              {actionModal.type === "edit" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Revisi Nominal Bersih (Rp)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={actionForm.amount}
                      onChange={(e) =>
                        setActionForm({ ...actionForm, amount: e.target.value })
                      }
                      className="w-full border p-3 rounded-xl bg-gray-50 outline-none focus:border-blue-500"
                      placeholder="Nominal yang benar..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Revisi Catatan/Keterangan
                    </label>
                    <textarea
                      value={actionForm.description}
                      onChange={(e) =>
                        setActionForm({
                          ...actionForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl bg-gray-50 outline-none focus:border-blue-500 resize-none"
                      rows="2"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Alasan Pengajuan (Wajib) *
                </label>
                <textarea
                  required
                  value={actionForm.alasan}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, alasan: e.target.value })
                  }
                  className="w-full border p-3 rounded-xl bg-gray-50 outline-none focus:border-red-400 resize-none"
                  placeholder="Mengapa data ini perlu diubah/dihapus?"
                  rows="3"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setActionModal({ isOpen: false })}
                  className="flex-1 py-3 bg-gray-200 text-gray-800 font-bold rounded-xl text-sm hover:bg-gray-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`flex-1 flex justify-center items-center gap-2 py-3 text-white font-bold rounded-xl text-sm transition-colors ${
                    actionModal.type === "delete"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {processing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Ajukan ke Ketua
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
