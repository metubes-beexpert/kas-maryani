import React from "react";
import { useDatabase } from "../hooks/useDatabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Activity,
  Clock,
  ShieldCheck,
  HelpCircle,
  Edit3,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

export default function LogsTab() {
  const { userData } = useAuth();
  const { data: logsData, loading } = useDatabase("logs");

  const [timeFilter, setTimeFilter] = React.useState("semua");

  if (loading)
    return (
      <div className="animate-pulse bg-white rounded-2xl h-64 border border-brand-100 p-5"></div>
    );

  let logs = logsData
    ? Object.entries(logsData)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    : [];

  // Filter Hak Akses
  if (
    userData?.role !== "ketua" &&
    userData?.role !== "bendahara" &&
    userData?.role !== "superuser"
  ) {
    logs = logs.filter((log) => log.family_id === userData?.family_id);
  }

  // Filter Waktu Murni
  if (timeFilter !== "semua") {
    const now = new Date();
    logs = logs.filter((log) => {
      const logDate = new Date(log.created_at);
      const diffTime = Math.abs(now - logDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      switch (timeFilter) {
        case "1_hari":
          return diffDays <= 1;
        case "1_minggu":
          return diffDays <= 7;
        case "1_bulan":
          return diffDays <= 30;
        case "1_tahun":
          return diffDays <= 365;
        default:
          return true;
      }
    });
  }

  const getActionIcon = (action) => {
    switch (action) {
      case "CREATE":
        return <Activity className="w-5 h-5 text-blue-500" />;
      case "APPROVE":
        return <ShieldCheck className="w-5 h-5 text-green-500" />;
      case "DELETE":
        return <Trash2 className="w-5 h-5 text-red-500" />;
      case "EDIT":
        return <Edit3 className="w-5 h-5 text-amber-500" />;
      case "FORWARD":
        return <ArrowUpRight className="w-5 h-5 text-purple-500" />;
      default:
        return <HelpCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getLogColor = (action) => {
    switch (action) {
      case "CREATE":
        return "bg-blue-50 border-blue-100";
      case "APPROVE":
        return "bg-green-50 border-green-100";
      case "DELETE":
        return "bg-red-50 border-red-100";
      case "EDIT":
        return "bg-amber-50 border-amber-100";
      case "FORWARD":
        return "bg-purple-50 border-purple-100";
      default:
        return "bg-gray-50 border-gray-100";
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-brand-900 mb-1 flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-600" />
            Audit Log Keuangan
          </h3>
          <p className="text-xs text-brand-500">
            Seluruh riwayat, hapus, dan modifikasi data tercatat permanen.
          </p>
        </div>
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="bg-brand-50 border border-brand-200 text-xs font-bold p-2 rounded-xl text-brand-700 outline-none w-full sm:w-auto shadow-sm"
        >
          <option value="semua">Semua Waktu</option>
          <option value="1_hari">24 Jam Terakhir</option>
          <option value="1_minggu">1 Minggu Terakhir</option>
          <option value="1_bulan">1 Bulan Terakhir</option>
          <option value="1_tahun">1 Tahun Terakhir</option>
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {logs.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-2xl border border-brand-100 text-sm text-brand-400">
            Belum ada jejak rekam sama sekali.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-4 rounded-xl border shadow-sm flex items-start gap-3 ${getLogColor(
                log.action
              )}`}
            >
              <div className="bg-white p-1.5 rounded-lg shadow-sm shrink-0">
                {getActionIcon(log.action)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  {log.description}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                  <span className="font-medium bg-white px-2 py-0.5 rounded border border-gray-200">
                    {log.user_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />{" "}
                    {new Date(log.created_at).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
