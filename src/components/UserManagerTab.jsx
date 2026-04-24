import React, { useState } from "react";
import { useDatabase } from "../hooks/useDatabase";
import { useAuth } from "../contexts/AuthContext";
import { Users, Save, XCircle, Search, ShieldCheck, Home } from "lucide-react";
import { ref, push, set } from "firebase/database";
import { db } from "../config/firebase";
import { sendApprovalEmail } from "../utils/email";

export default function UserManagerTab() {
  const { userData } = useAuth();
  const {
    data: users,
    updateData: updateUsers,
    loading: uLoading,
  } = useDatabase("users");
  const {
    data: families,
    updateData: updateFamilies,
    loading: fLoading,
  } = useDatabase("families");

  const [internalTab, setInternalTab] = useState("anggota"); // 'anggota' atau 'keluarga'
  const [searchTerm, setSearchTerm] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    role: "",
    family_id: "",
    status: "",
  });
  const [processing, setProcessing] = useState(false);

  // Form Khusus Keluarga
  const [newFamilyName, setNewFamilyName] = useState("");
  const [editFamilyTarget, setEditFamilyTarget] = useState(null);
  const [editFamilyForm, setEditFamilyForm] = useState({
    nama_kepala: "",
    jumlah_anggota: 1,
  });

  if (uLoading || fLoading)
    return (
      <div className="animate-pulse bg-white rounded-2xl h-64 border border-brand-100 p-5"></div>
    );

  // --- LOGIKA BAGIAN PENGGUNA ---
  let userList = users
    ? Object.entries(users).map(([id, val]) => ({ id, ...val }))
    : [];
  if (userData?.role === "ketua") {
    userList = userList.filter((u) => u.role !== "superuser");
  }
  if (searchTerm && internalTab === "anggota") {
    userList = userList.filter(
      (u) =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  const handleEditClick = (user) => {
    setEditTarget(user.id);
    setEditForm({
      role: user.role,
      family_id: user.family_id || "",
      status: user.status,
    });
  };

  const addLog = async (action, family_id, target_name, description) => {
    await push(ref(db, "logs"), {
      action,
      family_id: family_id || "global",
      user_name: userData.name,
      description,
      created_at: new Date().toISOString(),
    });
  };

  const handleSave = async (user) => {
    setProcessing(true);
    try {
      await updateUsers({
        [`${user.id}/role`]: editForm.role,
        [`${user.id}/family_id`]: editForm.family_id,
        [`${user.id}/status`]: editForm.status,
      });
      await addLog(
        "EDIT",
        editForm.family_id,
        user.name,
        `${userData.role} mengubah peran/status akun milik ${user.name}`
      );

      if (
        user.status === "pending" &&
        editForm.status === "active" &&
        user.email
      ) {
        await sendApprovalEmail(user.email, user.name, editForm.role);
      }
      setEditTarget(null);
    } catch (err) {
      alert("Gagal memperbarui pengguna");
    } finally {
      setProcessing(false);
    }
  };

  const handleRevoke = async (id, targetUserName) => {
    if (
      !window.confirm(
        `Yakin ingin menyabut / menolak akses untuk akun ${targetUserName}?`
      )
    )
      return;
    setProcessing(true);
    try {
      await updateUsers({ [`${id}/status`]: "rejected" });
      await addLog(
        "DELETE",
        "global",
        targetUserName,
        `${userData.role} memblokir akses akun ${targetUserName}`
      );
      if (editTarget === id) setEditTarget(null);
    } catch (err) {
      alert("Gagal membatalkan akses.");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (n) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);

  // --- LOGIKA BAGIAN KELUARGA ---
  const familyList = families
    ? Object.entries(families).map(([id, val]) => ({ id, ...val }))
    : [];

  const handleAddFamily = async () => {
    if (!newFamilyName.trim()) return alert("Nama keluarga tidak boleh kosong");
    setProcessing(true);
    try {
      // Buat ID unik berdasarkan huruf awal & timestamp
      const safeName = newFamilyName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const shortId = `fam_${safeName.substring(0, 10)}_${Math.floor(
        Math.random() * 1000
      )}`;

      await set(ref(db, `families/${shortId}`), {
        nama_kepala: newFamilyName,
        jumlah_anggota: 1,
        total_kas: 0,
        total_tabungan: 0,
        total_pinjaman_aktif: 0,
        created_at: new Date().toISOString(),
      });

      await addLog(
        "CREATE",
        shortId,
        newFamilyName,
        `${userData.role} mendaftarkan Keluarga Baru: ${newFamilyName}`
      );
      setNewFamilyName("");
    } catch (err) {
      alert("Gagal membuat data keluarga.");
    } finally {
      setProcessing(false);
    }
  };

  const handleEditFamilyClick = (fam) => {
    setEditFamilyTarget(fam.id);
    setEditFamilyForm({
      nama_kepala: fam.nama_kepala,
      jumlah_anggota: fam.jumlah_anggota || 1,
    });
  };

  const handleSaveFamily = async (famId) => {
    setProcessing(true);
    try {
      await updateFamilies({
        [`${famId}/nama_kepala`]: editFamilyForm.nama_kepala,
        [`${famId}/jumlah_anggota`]: Number(editFamilyForm.jumlah_anggota) || 1,
      });
      await addLog(
        "EDIT",
        famId,
        editFamilyForm.nama_kepala,
        `${userData.role} mengubah info keluarga ${editFamilyForm.nama_kepala}`
      );
      setEditFamilyTarget(null);
    } catch (err) {
      alert("Gagal memperbarui keluarga");
    } finally {
      setProcessing(false);
    }
  };

  const roleOptions = [
    "superuser",
    "ketua",
    "bendahara",
    "kepalakeluarga",
    "anggota",
  ];

  return (
    <div className="flex flex-col gap-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-200">
        <h3 className="font-bold text-brand-900 mb-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-600" />
          Pusat Kelola (Admin)
        </h3>

        {/* Toggle Mode */}
        <div className="flex bg-brand-50 p-1 rounded-xl">
          <button
            onClick={() => setInternalTab("anggota")}
            className={`flex-1 flex gap-2 justify-center items-center py-2 text-sm font-semibold rounded-lg transition-all ${
              internalTab === "anggota"
                ? "bg-white text-brand-800 shadow-sm border border-brand-100"
                : "text-brand-500 hover:text-brand-700"
            }`}
          >
            <Users className="w-4 h-4" /> Pengguna
          </button>
          <button
            onClick={() => setInternalTab("keluarga")}
            className={`flex-1 flex gap-2 justify-center items-center py-2 text-sm font-semibold rounded-lg transition-all ${
              internalTab === "keluarga"
                ? "bg-white text-brand-800 shadow-sm border border-brand-100"
                : "text-brand-500 hover:text-brand-700"
            }`}
          >
            <Home className="w-4 h-4" /> Keluarga Master
          </button>
        </div>
      </div>

      {internalTab === "anggota" ? (
        <>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-brand-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-brand-400" />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm text-brand-900"
            />
          </div>

          <div className="flex flex-col gap-3">
            {userList.map((user) => (
              <div
                key={user.id}
                className="p-4 rounded-xl border border-brand-100 shadow-sm bg-white"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-brand-900 leading-tight">
                      {user.name} {user.id === userData.uid && "(Anda)"}
                    </h4>
                    <p className="text-xs text-brand-500">{user.email}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm ${
                        user.status === "active"
                          ? "bg-green-100 text-green-700"
                          : user.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {user.status === "active" ? "Aktif" : user.status}
                    </span>
                    <span className="text-xs font-semibold text-brand-600 mt-1 capitalize">
                      {user.role}
                    </span>
                  </div>
                </div>

                {editTarget === user.id ? (
                  <div className="bg-brand-50 p-4 rounded-lg border border-brand-100 flex flex-col gap-3 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-brand-700 mb-1">
                          Status Lisensi
                        </label>
                        <select
                          className="w-full text-sm p-2 rounded-md border border-brand-200 outline-none"
                          value={editForm.status}
                          onChange={(e) =>
                            setEditForm({ ...editForm, status: e.target.value })
                          }
                        >
                          <option value="active">Active (Disetujui)</option>
                          <option value="pending">Pending</option>
                          <option value="rejected">
                            Rejected (Cabut Akses)
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-brand-700 mb-1">
                          Jabatan Peran
                        </label>
                        <select
                          className="w-full text-sm p-2 rounded-md border border-brand-200 outline-none"
                          value={editForm.role}
                          onChange={(e) =>
                            setEditForm({ ...editForm, role: e.target.value })
                          }
                        >
                          {roleOptions.map((r) => {
                            if (userData.role === "ketua" && r === "superuser")
                              return null;
                            return (
                              <option key={r} value={r} className="capitalize">
                                {r}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-brand-700 mb-1">
                          Keluarga Induk (Family ID)
                        </label>
                        <select
                          className="w-full text-sm p-2 rounded-md border border-brand-200 outline-none"
                          value={editForm.family_id}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              family_id: e.target.value,
                            })
                          }
                        >
                          <option value="">-- Tidak Digabungkan --</option>
                          {families &&
                            Object.entries(families).map(([fId, fVal]) => (
                              <option key={fId} value={fId}>
                                {fVal.nama_kepala}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-2">
                      <button
                        disabled={processing}
                        onClick={() => setEditTarget(null)}
                        className="px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100 rounded-md"
                      >
                        Batal
                      </button>
                      <button
                        disabled={processing}
                        onClick={() => handleSave(user)}
                        className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm"
                      >
                        <Save className="w-3 h-3" /> Simpan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleRevoke(user.id, user.name)}
                      className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1"
                    >
                      <XCircle className="w-3 h-3" /> Cabut Akses
                    </button>
                    <button
                      onClick={() => handleEditClick(user)}
                      className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 px-2 py-1"
                    >
                      <ShieldCheck className="w-3 h-3" /> Edit Akses
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* TAB MANAJEMEN KELUARGA */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-200">
            <h4 className="font-bold text-brand-900 mb-3">
              Buat Keluarga Induk Baru
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Cth: Risah & Yuyun"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                className="flex-1 bg-brand-50 border border-brand-200 p-3 rounded-xl outline-none focus:border-brand-400 text-sm"
              />
              <button
                disabled={processing || !newFamilyName}
                onClick={handleAddFamily}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 rounded-xl font-bold text-sm shadow-sm transition-colors"
              >
                Tambah
              </button>
            </div>
            <p className="text-[11px] text-brand-500 mt-2">
              Sistem otomatis menerbitkan ID Keluarga unik (contoh:{" "}
              <code>fam_rudi_405</code>).
            </p>
          </div>

          <h4 className="font-bold text-brand-900 mt-2 flex justify-between items-center px-1">
            <span>Daftar Keluarga Terdaftar</span>
            <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full text-xs">
              {familyList.length} total
            </span>
          </h4>
          <div className="flex flex-col gap-3">
            {familyList.map((fam) => (
              <div
                key={fam.id}
                className="bg-white p-4 rounded-xl border border-brand-100 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4"
              >
                {editFamilyTarget === fam.id ? (
                  <div className="flex-1 flex flex-col gap-2 w-full">
                    <label className="text-xs font-semibold text-brand-700">
                      Nama Keluarga
                    </label>
                    <input
                      type="text"
                      value={editFamilyForm.nama_kepala}
                      onChange={(e) =>
                        setEditFamilyForm({
                          ...editFamilyForm,
                          nama_kepala: e.target.value,
                        })
                      }
                      className="border border-brand-200 p-2 rounded-lg outline-none text-sm"
                    />
                    <label className="text-xs font-semibold text-brand-700">
                      Jumlah Anggota Keluarga
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editFamilyForm.jumlah_anggota}
                      onChange={(e) =>
                        setEditFamilyForm({
                          ...editFamilyForm,
                          jumlah_anggota: e.target.value,
                        })
                      }
                      className="border border-brand-200 p-2 rounded-lg outline-none text-sm"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        disabled={processing}
                        onClick={() => setEditFamilyTarget(null)}
                        className="px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100 rounded-md"
                      >
                        Batal
                      </button>
                      <button
                        disabled={processing}
                        onClick={() => handleSaveFamily(fam.id)}
                        className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm"
                      >
                        <Save className="w-3 h-3" /> Simpan
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 flex flex-col items-start">
                      <h4 className="font-bold text-brand-900">
                        {fam.nama_kepala}
                      </h4>
                      <p className="text-xs text-brand-500 font-medium mt-0.5 px-2 py-0.5 bg-brand-50 rounded-md w-fit border border-brand-100">
                        Anggota: {fam.jumlah_anggota || 1} Orang
                      </p>
                      <button
                        onClick={() => handleEditFamilyClick(fam)}
                        className="mt-2 text-[10px] uppercase font-bold px-3 py-1 bg-brand-100 text-brand-700 rounded-md hover:bg-brand-200"
                      >
                        Edit Info
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-0 w-full sm:w-auto mt-2 sm:mt-0 bg-brand-50 py-2 rounded-xl border border-brand-200 divide-x divide-brand-200">
                      <div className="text-center px-3">
                        <p className="text-[10px] text-brand-500 uppercase font-bold tracking-tight">
                          KAS
                        </p>
                        <p className="font-semibold text-brand-800 text-sm mt-0.5">
                          {formatCurrency(fam.total_kas || 0)}
                        </p>
                      </div>
                      <div className="text-center px-3">
                        <p className="text-[10px] text-brand-500 uppercase font-bold tracking-tight">
                          Tabungan
                        </p>
                        <p className="font-semibold text-brand-800 text-sm mt-0.5">
                          {formatCurrency(fam.total_tabungan || 0)}
                        </p>
                      </div>
                      <div className="text-center px-3">
                        <p className="text-[10px] text-brand-500 uppercase font-bold tracking-tight">
                          Pinjaman
                        </p>
                        <p className="font-semibold text-red-600 text-sm mt-0.5">
                          {formatCurrency(fam.total_pinjaman_aktif || 0)}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
            {familyList.length === 0 && (
              <div className="p-8 text-center text-brand-400 bg-white rounded-2xl border border-brand-100 dashed">
                Belum ada keluarga yang didaftarkan.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
