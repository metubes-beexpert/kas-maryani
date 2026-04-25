import React, { useState } from "react";
import { useDatabase } from "../hooks/useDatabase";
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  MapPin,
  Clock,
  AlignLeft,
} from "lucide-react"; // DITAMBAHKAN ICON BARU

export default function EventsManagerTab() {
  const {
    data: events,
    pushData,
    updateData,
    removeData,
    loading,
  } = useDatabase("events");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    description: "",
  });

  if (loading)
    return (
      <div className="animate-pulse flex gap-4 h-32 bg-white rounded-2xl p-5"></div>
    );

  const handleOpenForm = (event = null, id = null) => {
    if (event) {
      // Parse ISO string to date and time inputs
      const d = new Date(event.date);
      // d.toISOString() format is YYYY-MM-DDTHH:mm:ss.sssZ
      // Needs local time offset hack for basic html 5 date/time inputs
      const dateStr = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
      const timeStr = d.toTimeString().slice(0, 5); // HH:mm

      setFormData({
        title: event.title,
        date: dateStr,
        time: timeStr,
        location: event.location,
        description: event.description || "", // Pastikan tidak undefined
      });
      setEditingId(id);
    } else {
      setFormData({
        title: "",
        date: "",
        time: "",
        location: "",
        description: "",
      });
      setEditingId(null);
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Komposisikan date ISO
    const isoDate = new Date(
      `${formData.date}T${formData.time}:00`
    ).toISOString();

    const payload = {
      title: formData.title,
      date: isoDate,
      location: formData.location,
      description: formData.description,
    };

    try {
      if (editingId) {
        await updateData({ [editingId]: payload });
      } else {
        await pushData(payload);
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan acara");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin hapus acara ini?")) return;
    try {
      await updateData({ [id]: null }); // Hapus key ini
    } catch (err) {
      alert("Gagal menghapus");
    }
  };

  const eventList = events
    ? Object.entries(events).sort(
        (a, b) => new Date(a[1].date) - new Date(b[1].date)
      )
    : [];

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-brand-100">
        <div className="flex items-center gap-3">
          <div className="bg-brand-100/50 p-2 rounded-xl text-brand-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-brand-900">Acara & Kumpul</h3>
            <p className="text-xs text-brand-500">
              Kelola jadwal keluarga besar
            </p>
          </div>
        </div>
        {!isFormOpen && (
          <button
            onClick={() => handleOpenForm()}
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-full w-10 h-10 flex flex-col items-center justify-center shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-5 border border-brand-200 shadow-lg flex flex-col gap-4"
        >
          <h4 className="font-bold text-brand-900 mb-2 border-b border-brand-100 pb-2">
            {editingId ? "Edit Acara" : "Buat Acara Baru"}
          </h4>

          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1 block">
              Judul Acara
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full border border-brand-200 rounded-xl px-4 py-2 bg-brand-50/50 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-brand-900"
              placeholder="Contoh: Kumpul RT / Keluarga Inti"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-brand-700 mb-1 block">
                Tanggal
              </label>
              <input
                required
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="w-full border border-brand-200 rounded-xl px-4 py-2 bg-brand-50/50 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-brand-900"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-brand-700 mb-1 block">
                Waktu
              </label>
              <input
                required
                type="time"
                value={formData.time}
                onChange={(e) =>
                  setFormData({ ...formData, time: e.target.value })
                }
                className="w-full border border-brand-200 rounded-xl px-4 py-2 bg-brand-50/50 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-brand-900"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1 block">
              Lokasi / Tempat
            </label>
            <input
              required
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="w-full border border-brand-200 rounded-xl px-4 py-2 bg-brand-50/50 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-brand-900"
              placeholder="Rumah / Gedung..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-brand-700 mb-1 block">
              Keterangan / Deskripsi
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows="3"
              className="w-full border border-brand-200 rounded-xl px-4 py-2 bg-brand-50/50 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-brand-900 resize-none"
              placeholder="Catatan tambahan (Opsional)..."
            />
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-5 py-2 rounded-xl text-brand-600 hover:bg-brand-50 font-medium transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-md transition-colors font-medium"
            >
              Simpan
            </button>
          </div>
        </form>
      )}

      {!isFormOpen && (
        <div className="flex flex-col gap-4">
          {eventList.length === 0 ? (
            <div className="text-center text-brand-400 py-8 bg-white border border-brand-100 rounded-2xl border-dashed">
              Belum ada acara. Klik + untuk membuat.
            </div>
          ) : (
            eventList.map(([id, event]) => {
              const d = new Date(event.date);
              return (
                // DITAMBAHKAN: Perbaikan UI List Acara agar lebih lengkap
                <div
                  key={id}
                  className="bg-white rounded-2xl p-5 border border-brand-100 shadow-sm flex flex-col gap-4 group"
                >
                  {/* Bagian Atas: Judul dan Tombol Aksi */}
                  <div className="flex justify-between items-start gap-2">
                    <h5 className="font-bold text-brand-900 text-lg leading-tight">
                      {event.title}
                    </h5>

                    <div className="flex items-center gap-1 opacity-100 sm:opacity-50 group-hover:opacity-100 transition-opacity shrink-0 -mt-1 -mr-1">
                      <button
                        onClick={() => handleOpenForm(event, id)}
                        className="p-2 text-brand-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Bagian Tengah: Info Tanggal, Waktu, Lokasi */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 bg-brand-50/50 p-3 rounded-xl border border-brand-50">
                    <div className="flex items-center gap-2 text-sm text-brand-700 font-medium">
                      <Calendar className="w-4 h-4 text-brand-500 shrink-0" />
                      <span>
                        {d.toLocaleDateString("id-ID", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-brand-700 font-medium">
                      <Clock className="w-4 h-4 text-brand-500 shrink-0" />
                      <span>
                        {d.toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        WIB
                      </span>
                    </div>

                    <div className="flex items-start gap-2 text-sm text-brand-700 font-medium sm:col-span-2 mt-1">
                      <MapPin className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                      <span className="leading-snug">{event.location}</span>
                    </div>
                  </div>

                  {/* Bagian Bawah: Deskripsi (Jika ada) */}
                  {event.description && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <AlignLeft className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {event.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
