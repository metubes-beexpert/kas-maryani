import React, { useState } from "react";
import { useDatabase } from "../hooks/useDatabase";
import {
  Check,
  X,
  ShieldAlert,
  UserCheck,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle, // Ditambahkan icon untuk peringatan Edit/Hapus
} from "lucide-react";
import { update, ref } from "firebase/database";
import { db } from "../config/firebase";
import { sendApprovalEmail } from "../utils/email";

const PendingUserRow = ({
  id,
  user,
  families,
  processing,
  onApprove,
  onReject,
}) => {
  const [role, setRole] = useState("anggota");
  const [familyId, setFamilyId] = useState("");

  return (
    <div className="bg-white rounded-2xl p-5 border border-brand-100 shadow-sm flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-brand-900">{user.name}</p>
          <p className="text-xs text-brand-500">{user.email}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 bg-brand-50 p-3 rounded-lg border border-brand-100">
        <div>
          <label className="block text-[10px] font-bold text-brand-500 mb-1 uppercase">
            Jabatan Awal
          </label>
          <select
            className="w-full text-xs p-2 rounded-md border border-brand-200 outline-none"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="anggota">Anggota</option>
            <option value="kepalakeluarga">Kepala Keluarga</option>
            <option value="bendahara">Bendahara</option>
            <option value="ketua">Ketua</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-brand-500 mb-1 uppercase">
            Keluarga Induk
          </label>
          <select
            className="w-full text-xs p-2 rounded-md border border-brand-200 outline-none"
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
          >
            <option value="">-- Lewati Dulu --</option>
            {families &&
              Object.entries(families).map(([fId, fVal]) => (
                <option key={fId} value={fId}>
                  {fVal.nama_kepala}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 w-full justify-end">
        <button
          disabled={processing}
          onClick={() => onApprove(id, user, role, familyId)}
          className="flex items-center justify-center gap-1 bg-green-500 hover:bg-green-600 text-white py-1.5 px-4 rounded-lg text-xs font-bold transition-colors"
        >
          <Check className="w-4 h-4" /> Setuju
        </button>
        <button
          disabled={processing}
          onClick={() => onReject(id, user)}
          className="flex items-center justify-center gap-1 bg-brand-100 hover:bg-brand-200 text-brand-700 py-1.5 px-4 rounded-lg text-xs font-bold transition-colors"
        >
          <X className="w-4 h-4" /> Tolak
        </button>
      </div>
    </div>
  );
};

export default function ApprovalCenterTab() {
  const {
    data: users,
    updateData: updateUsers,
    loading: uLoading,
  } = useDatabase("users");
  const {
    data: transactions,
    updateData: updateTx,
    loading: txLoading,
  } = useDatabase("transactions");
  const { data: globalFunds, loading: fLoading } = useDatabase("global_funds");
  const { data: families } = useDatabase("families");

  const [processing, setProcessing] = useState(false);

  if (uLoading || txLoading || fLoading) {
    return (
      <div className="animate-pulse flex gap-4 h-32 bg-white rounded-2xl p-5"></div>
    );
  }

  const pendingUsers = users
    ? Object.entries(users).filter(([_, user]) => user.status === "pending")
    : [];

  // DITAMBAHKAN: Tangkap status menunggu_hapus dan menunggu_edit
  const pendingTx = transactions
    ? Object.entries(transactions).filter(([_, tx]) =>
        ["menunggu_ketua", "menunggu_hapus", "menunggu_edit"].includes(
          tx.status
        )
      )
    : [];

  const handleApproveUser = async (
    userId,
    userObj,
    role = "anggota",
    familyId = "keluarga_a"
  ) => {
    setProcessing(true);
    try {
      await updateUsers({
        [`${userId}/status`]: "active",
        [`${userId}/role`]: role,
        [`${userId}/family_id`]: familyId,
      });

      // Kirim Notifikasi Email
      if (userObj && userObj.email) {
        await sendApprovalEmail(userObj.email, userObj.name, role);
      }
    } catch (err) {
      alert("Gagal menyetujui pengguna.");
    } finally {
      setProcessing(false);
    }
  };

  const addLog = async (action, family_id, user_name, description) => {
    const { push } = await import("firebase/database");
    await push(ref(db, "logs"), {
      action,
      family_id: family_id || "global",
      user_name: user_name || "Ketua/Sistem",
      description,
      created_at: new Date().toISOString(),
    });
  };

  const handleApproveTx = async (txId, tx) => {
    setProcessing(true);
    try {
      const updates = {};
      const currentKas = globalFunds?.total_kas || 0;
      const currentTabungan = globalFunds?.total_tabungan || 0;
      const familyCurrentKas =
        tx.family_id && families?.[tx.family_id]
          ? families[tx.family_id].total_kas
          : 0;
      const familyCurrentTabungan =
        tx.family_id && families?.[tx.family_id]
          ? families[tx.family_id].total_tabungan
          : 0;

      // DITAMBAHKAN: KASUS 1 - MENYETUJUI PENGHAPUSAN TRANSAKSI
      if (tx.status === "menunggu_hapus") {
        if (
          !window.confirm(
            "YAKIN MENGHAPUS PERMANEN? Saldo kas/tabungan akan dikembalikan/dipotong secara otomatis sesuai jenis transaksi ini."
          )
        ) {
          setProcessing(false);
          return;
        }

        // Logika Reverse (Pengembalian Saldo)
        if (tx.type === "pemasukan_kas") {
          updates[`global_funds/total_kas`] = currentKas - tx.amount;
          if (tx.family_id)
            updates[`families/${tx.family_id}/total_kas`] =
              familyCurrentKas - tx.amount;
        } else if (tx.type === "pemasukan_tabungan") {
          updates[`global_funds/total_tabungan`] = currentTabungan - tx.amount;
          if (tx.family_id)
            updates[`families/${tx.family_id}/total_tabungan`] =
              familyCurrentTabungan - tx.amount;
        } else if (tx.type === "bayar_pinjaman") {
          updates[`global_funds/total_kas`] = currentKas - tx.amount;
        } else if (tx.type === "bayar_pinjaman_tabungan") {
          updates[`global_funds/total_tabungan`] = currentTabungan + tx.amount;
          updates[`global_funds/total_kas`] = currentKas - tx.amount;
          if (tx.family_id)
            updates[`families/${tx.family_id}/total_tabungan`] =
              familyCurrentTabungan + tx.amount;
        } else if (
          tx.type === "pengajuan_pengeluaran" ||
          tx.type === "pengajuan_pinjaman"
        ) {
          updates[`global_funds/total_kas`] = currentKas + tx.amount; // Uang kembali ke kas
        }

        updates[`transactions/${txId}`] = null; // Hapus node database
        await update(ref(db), updates);
        await addLog(
          "DELETE",
          tx.family_id,
          "Ketua",
          `Ketua menyetujui Penghapusan transaksi ${tx.type} senilai Rp${tx.amount}. Alasan: ${tx.alasan_perubahan}`
        );
      }

      // DITAMBAHKAN: KASUS 2 - MENYETUJUI PENGEDITAN TRANSAKSI
      else if (tx.status === "menunggu_edit") {
        if (
          !window.confirm(
            "YAKIN MENYETUJUI REVISI? Saldo akan disesuaikan otomatis dengan nominal yang baru."
          )
        ) {
          setProcessing(false);
          return;
        }

        const oldAmount = tx.amount;
        const newAmount = parseInt(tx.edit_draft.amount);
        const selisih = newAmount - oldAmount; // Jika nominal baru lebih besar, selisih positif (+).

        if (tx.type === "pemasukan_kas") {
          updates[`global_funds/total_kas`] = currentKas + selisih;
          if (tx.family_id)
            updates[`families/${tx.family_id}/total_kas`] =
              familyCurrentKas + selisih;
        } else if (tx.type === "pemasukan_tabungan") {
          updates[`global_funds/total_tabungan`] = currentTabungan + selisih;
          if (tx.family_id)
            updates[`families/${tx.family_id}/total_tabungan`] =
              familyCurrentTabungan + selisih;
        } else if (tx.type === "bayar_pinjaman") {
          updates[`global_funds/total_kas`] = currentKas + selisih;
        } else if (tx.type === "bayar_pinjaman_tabungan") {
          updates[`global_funds/total_tabungan`] = currentTabungan - selisih;
          updates[`global_funds/total_kas`] = currentKas + selisih;
          if (tx.family_id)
            updates[`families/${tx.family_id}/total_tabungan`] =
              familyCurrentTabungan - selisih;
        } else if (
          tx.type === "pengajuan_pengeluaran" ||
          tx.type === "pengajuan_pinjaman"
        ) {
          updates[`global_funds/total_kas`] = currentKas - selisih; // Pengeluaran bertambah = Kas berkurang
        }

        updates[`transactions/${txId}/amount`] = newAmount;
        updates[`transactions/${txId}/description`] = tx.edit_draft.description;
        updates[`transactions/${txId}/status`] = "approved";
        updates[`transactions/${txId}/edit_draft`] = null;
        updates[`transactions/${txId}/alasan_perubahan`] = null;

        await update(ref(db), updates);
        await addLog(
          "EDIT",
          tx.family_id,
          "Ketua",
          `Ketua menyetujui Revisi transaksi ${tx.type}. Nominal berubah: Rp${oldAmount} -> Rp${newAmount}`
        );
      }

      // KASUS 3: PENGAJUAN PENGELUARAN & PINJAMAN NORMAL (KODE LAMA)
      else {
        updates[`transactions/${txId}/status`] = "approved";
        if (tx.type === "pengajuan_pengeluaran") {
          updates[`global_funds/total_kas`] = currentKas - tx.amount;
          await update(ref(db), updates);
          await addLog(
            "APPROVE",
            "global",
            "Ketua",
            `Ketua menyetujui PENGELUARAN sebesar Rp${tx.amount} (${tx.description})`
          );
        } else if (tx.type === "pengajuan_pinjaman") {
          updates[`global_funds/total_kas`] = currentKas - tx.amount;
          await update(ref(db), updates);
          await addLog(
            "APPROVE",
            tx.family_id,
            "Ketua",
            `Ketua menyetujui PINJAMAN sebesar Rp${tx.amount} untuk ${tx.user_name}`
          );
        } else {
          await update(ref(db), updates); // Untuk safety jika ada transaksi lain yg menyasar kesini
        }
      }
    } catch (err) {
      alert("Gagal mengeksekusi konfirmasi.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectUser = async (userId, user) => {
    if (!window.confirm("Batal setujui pengguna ini?")) return;
    try {
      await updateUsers({ [`${userId}/status`]: "rejected" });
      await addLog(
        "DELETE",
        "global",
        "Ketua",
        `Ketua menolak registrasi pengguna ${user?.name}`
      );
    } catch (e) {}
  };

  const handleRejectTx = async (txId, tx) => {
    if (!window.confirm("Tolak pengajuan ini?")) return;
    try {
      // DITAMBAHKAN: Jika itu pengajuan EDIT/HAPUS, kembalikan saja statusnya ke 'approved'
      if (tx.status === "menunggu_hapus" || tx.status === "menunggu_edit") {
        await updateTx({
          [`${txId}/status`]: "approved",
          [`${txId}/edit_draft`]: null,
          [`${txId}/alasan_perubahan`]: null,
        });
        await addLog(
          "EDIT",
          tx.family_id,
          "Ketua",
          `Ketua MENOLAK pengajuan Revisi/Hapus transaksi ${tx.type}`
        );
      } else {
        // Kode Lama: Tolak pengeluaran / pinjaman baru
        await updateTx({ [`${txId}/status`]: "rejected" });
        await addLog(
          "DELETE",
          tx.family_id,
          "Ketua",
          `Ketua menolak pengajuan ${tx.type} senilai Rp${tx.amount} dari ${tx.user_name}`
        );
      }
    } catch (e) {}
  };

  const formatCurrency = (n) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-brand-50 rounded-2xl p-4 border border-brand-200 shadow-sm flex gap-4 items-start">
        <ShieldAlert className="w-6 h-6 text-brand-600 shrink-0 mt-1" />
        <div>
          <h3 className="font-bold text-brand-900 mb-1">Pusat Persetujuan</h3>
          <p className="text-sm text-brand-600">
            Sebagai ketua, Anda harus memverifikasi setiap anggota yang masuk
            dan transaksi krusial (kas keluar/pinjaman serta pengajuan
            Edit/Hapus).
          </p>
        </div>
      </div>

      <section>
        <h4 className="font-bold text-brand-900 mb-3 flex items-center gap-2">
          <UserCheck className="w-5 h-5" />
          Pendaftaran Baru
          {/* BADGE NOTIFIKASI USER BARU */}
          {pendingUsers.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-pulse ml-1">
              {pendingUsers.length}
            </span>
          )}
        </h4>
        {pendingUsers.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-brand-100 text-center text-brand-400 text-sm">
            Tidak ada pendaftaran baru.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pendingUsers.map(([id, user]) => {
              return (
                <PendingUserRow
                  key={id}
                  id={id}
                  user={user}
                  families={families}
                  processing={processing}
                  onApprove={handleApproveUser}
                  onReject={handleRejectUser}
                />
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h4 className="font-bold text-brand-900 mb-3 mt-4 flex items-center gap-2">
          Persetujuan Transaksi
          {/* BADGE NOTIFIKASI TRANSAKSI BARU */}
          {pendingTx.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-pulse ml-1">
              {pendingTx.length}
            </span>
          )}
        </h4>
        <p className="text-xs text-brand-500 mb-3 -mt-2">
          Kas Keluar & Perubahan Data
        </p>

        {pendingTx.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-brand-100 text-center text-brand-400 text-sm">
            Tidak ada pengajuan pengeluaran, pinjaman, maupun edit/hapus.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pendingTx.map(([id, tx]) => {
              const isDelete = tx.status === "menunggu_hapus";
              const isEdit = tx.status === "menunggu_edit";

              return (
                <div
                  key={id}
                  className={`rounded-2xl p-5 border shadow-sm ${
                    isDelete
                      ? "bg-red-50 border-red-200"
                      : isEdit
                      ? "bg-amber-50 border-amber-200"
                      : "bg-white border-brand-100"
                  }`}
                >
                  {/* DITAMBAHKAN: Header Peringatan Jika Edit/Hapus */}
                  {(isDelete || isEdit) && (
                    <div className="flex items-center gap-2 mb-3 border-b pb-2 border-opacity-30">
                      <AlertTriangle
                        className={`w-5 h-5 ${
                          isDelete ? "text-red-600" : "text-amber-600"
                        }`}
                      />
                      <span
                        className={`text-sm font-bold uppercase tracking-wider ${
                          isDelete ? "text-red-700" : "text-amber-700"
                        }`}
                      >
                        Pengajuan {isDelete ? "Penghapusan" : "Revisi"}{" "}
                        Transaksi
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-brand-900 capitalize">
                        {tx.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-brand-500">{tx.user_name}</p>
                    </div>
                    <div className="text-right">
                      {isEdit ? (
                        <>
                          <p className="text-sm text-gray-500 line-through">
                            {formatCurrency(tx.amount)}
                          </p>
                          <p className="font-bold text-amber-600 text-lg">
                            {formatCurrency(tx.edit_draft.amount)}
                          </p>
                        </>
                      ) : (
                        <p
                          className={`font-bold text-lg ${
                            tx.type.includes("pengeluaran") ||
                            tx.type.includes("pinjaman") ||
                            isDelete
                              ? "text-red-500"
                              : "text-green-600"
                          }`}
                        >
                          {[
                            "pengajuan_pengeluaran",
                            "pengajuan_pinjaman",
                          ].includes(tx.type) || isDelete
                            ? "-"
                            : "+"}
                          {formatCurrency(tx.amount)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* DITAMBAHKAN: Menampilkan alasan edit/hapus */}
                  <div
                    className={`text-sm text-brand-600 mb-4 p-3 rounded-lg border italic ${
                      isDelete
                        ? "bg-red-100/50 border-red-200"
                        : isEdit
                        ? "bg-amber-100/50 border-amber-200"
                        : "bg-brand-50 border-brand-100"
                    }`}
                  >
                    {isEdit || isDelete ? (
                      <div className="flex flex-col gap-1">
                        <p>
                          <span className="font-bold not-italic">
                            Catatan Awal:
                          </span>{" "}
                          {tx.description}
                        </p>
                        {isEdit && (
                          <p>
                            <span className="font-bold not-italic text-amber-700">
                              Revisi Catatan:
                            </span>{" "}
                            {tx.edit_draft.description}
                          </p>
                        )}
                        <p className="mt-2 text-red-700">
                          <span className="font-bold not-italic">
                            Alasan Pengajuan Bendahara:
                          </span>{" "}
                          "{tx.alasan_perubahan}"
                        </p>
                      </div>
                    ) : (
                      <p>"{tx.description}"</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={processing}
                      onClick={() => handleApproveTx(id, tx)}
                      className={`flex-1 flex gap-2 items-center justify-center text-white py-2 rounded-xl text-sm font-medium transition-colors ${
                        isDelete
                          ? "bg-red-600 hover:bg-red-700"
                          : isEdit
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "bg-brand-600 hover:bg-brand-700"
                      }`}
                    >
                      <Check className="w-4 h-4" />{" "}
                      {isDelete
                        ? "Izinkan Hapus Data"
                        : isEdit
                        ? "Izinkan Revisi"
                        : "Setujui & Potong Kas"}
                    </button>
                    <button
                      disabled={processing}
                      onClick={() => handleRejectTx(id, tx)}
                      className="px-4 bg-red-50 text-red-600 hover:bg-red-100 py-2 rounded-xl text-sm font-medium transition-colors"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
