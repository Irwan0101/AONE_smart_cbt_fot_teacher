import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  TrendingUp, Users, BookOpen, Award,
  Download, RefreshCw, Search, X,
  FileSpreadsheet, FileText, CheckCircle2,
  BarChart2, ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import AnalisisSoalSection from '../components/ui/AnalisisSoalSection';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];

const SCORE_RANGES = [
  { label: '80–100', min: 80, max: 100 },
  { label: '70–79', min: 70, max: 79 },
  { label: '60–69', min: 60, max: 69 },
  { label: '0–59', min: 0, max: 59 },
];

function getScoreStyle(skor) {
  if (skor >= 80) return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400';
  if (skor >= 70) return 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400';
  if (skor >= 60) return 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400';
  return 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400';
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─────────────────────────────────────────────
// Export Modal
// ─────────────────────────────────────────────
function ExportModal({ open, onClose, rows, title, role }) {
  const [done, setDone] = useState('');
  useEffect(() => { if (open) setDone(''); }, [open]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const scores = rows.map(r => r.skor).filter(s => s > 0);
    const avg = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
    const passCount = rows.filter(r => r.skor >= 70).length;
    const passRate = rows.length ? +((passCount / rows.length) * 100).toFixed(1) : 0;

    const wsSummary = XLSX.utils.aoa_to_sheet([
      ['LAPORAN NILAI SISWA'],
      [title],
      ['Tanggal Cetak', new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })],
      [],
      ['Total Siswa', rows.length],
      ['Rata-rata Nilai', avg],
      ['Jumlah Lulus', passCount],
      ['Tingkat Kelulusan', `${passRate}%`],
    ]);
    wsSummary['!cols'] = [{ wch: 22 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

    const headers = ['No', 'Nama Siswa', 'NISN', 'Kelas', 'Mata Pelajaran', 'Nilai', 'Status', 'Waktu Ujian'];
    const detail = rows.map((r, i) => [
      i + 1, r.name, r.nisn || '-', r.class, r.mapel,
      r.skor, r.skor >= 70 ? 'Lulus' : 'Tidak Lulus',
      r.waktu ? new Date(r.waktu).toLocaleString('id-ID') : '-',
    ]);
    const wsDetail = XLSX.utils.aoa_to_sheet([headers, ...detail]);
    wsDetail['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 14 }, { wch: 8 }, { wch: 22 }, { wch: 8 }, { wch: 14 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Nilai');

    if (role === 'wali_kelas') {
      const mapelMap = {};
      rows.forEach(r => {
        if (!mapelMap[r.mapel]) mapelMap[r.mapel] = [];
        mapelMap[r.mapel].push(r);
      });
      Object.entries(mapelMap).forEach(([mapel, list]) => {
        const ws = XLSX.utils.aoa_to_sheet([
          [mapel],
          ['No', 'Nama Siswa', 'Kelas', 'Nilai', 'Status'],
          ...list.map((r, i) => [i + 1, r.name, r.class, r.skor, r.skor >= 70 ? 'Lulus' : 'Tidak Lulus']),
        ]);
        ws['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 8 }, { wch: 8 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, mapel.replace(/[\\/:*?[\]]/g, '').slice(0, 31));
      });
    }

    XLSX.writeFile(wb, `Laporan_Nilai_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setDone('excel');
  };

  const exportPdf = () => {
    const scores = rows.map(r => r.skor).filter(s => s > 0);
    const avg = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
    const passCount = rows.filter(r => r.skor >= 70).length;
    const passRate = rows.length ? +((passCount / rows.length) * 100).toFixed(1) : 0;

    const getBg = s => s >= 80 ? '#d1fae5' : s >= 70 ? '#dbeafe' : s >= 60 ? '#fef3c7' : '#fee2e2';
    const getFg = s => s >= 80 ? '#065f46' : s >= 70 ? '#1e40af' : s >= 60 ? '#92400e' : '#991b1b';

    const tableRows = rows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:8px 10px;text-align:center;color:#6b7280;font-size:12px">${i + 1}</td>
        <td style="padding:8px 10px">
          <div style="font-weight:600;font-size:13px;color:#111827">${r.name}</div>
          <div style="font-size:11px;color:#9ca3af">${r.nisn || '-'}</div>
        </td>
        <td style="padding:8px 10px;font-size:12px;color:#374151;text-align:center">${r.class}</td>
        <td style="padding:8px 10px;font-size:12px;color:#374151">${r.mapel}</td>
        <td style="padding:8px 10px;text-align:center">
          <span style="background:${getBg(r.skor)};color:${getFg(r.skor)};padding:3px 10px;border-radius:6px;font-weight:700;font-size:13px">${r.skor || '-'}</span>
        </td>
        <td style="padding:8px 10px;text-align:center">
          <span style="background:${r.skor >= 70 ? '#d1fae5' : r.skor === 0 ? '#f3f4f6' : '#fee2e2'};color:${r.skor >= 70 ? '#065f46' : r.skor === 0 ? '#6b7280' : '#991b1b'};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">${r.status}</span>
        </td>
        <td style="padding:8px 10px;font-size:11px;color:#6b7280">${fmtDate(r.waktu)}</td>
      </tr>`).join('');

    const statCards = [
      ['Total Siswa', rows.length, '#6366f1'],
      ['Rata-rata Nilai', avg, '#8b5cf6'],
      ['Siswa Lulus', passCount, '#10b981'],
      ['Tingkat Kelulusan', `${passRate}%`, '#f59e0b'],
    ].map(([label, val, color]) => `
      <div style="border:1.5px solid #e5e7eb;border-radius:12px;padding:14px 16px;border-top:3px solid ${color};flex:1;min-width:120px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:6px">${label}</div>
        <div style="font-size:24px;font-weight:800;color:#111827">${val}</div>
      </div>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#111827;padding:32px 40px}@media print{body{padding:16px 24px}@page{margin:1.5cm}}</style>
</head><body>
<div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:20px;border-bottom:2.5px solid #6366f1;margin-bottom:24px">
  <div>
    <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#6366f1;margin-bottom:4px">Laporan Nilai Siswa</div>
    <h1 style="font-size:22px;font-weight:800;color:#111827">${title}</h1>
    <div style="font-size:12px;color:#9ca3af;margin-top:4px">Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</div>
  </div>
</div>
<div style="display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap">${statCards}</div>
<div style="border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:12px 16px">
    <span style="font-size:13px;font-weight:700;color:#fff">Daftar Nilai Siswa</span>
  </div>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#f8fafc;border-bottom:1.5px solid #e5e7eb">
      ${['#', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Nilai', 'Status', 'Waktu Ujian'].map(h =>
      `<th style="padding:10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280">${h}</th>`
    ).join('')}
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>
<div style="margin-top:24px;text-align:center;font-size:11px;color:#d1d5db">Dokumen digenerate otomatis • ${new Date().toLocaleString('id-ID')}</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setDone('pdf');
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 16 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40">
            <div>
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base">Export Laporan</h3>
              <p className="text-xs text-gray-400 mt-0.5">{rows.length} siswa · {title}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors">
              <X size={16} className="text-gray-400" />
            </button>
          </div>
          <div className="p-6 space-y-3">
            <button onClick={exportExcel}
              className={`w-full group flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${done === 'excel' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${done === 'excel' ? 'bg-emerald-500' : 'bg-emerald-100 dark:bg-emerald-950 group-hover:bg-emerald-500'}`}>
                <FileSpreadsheet size={22} className={done === 'excel' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400 group-hover:text-white'} />
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-sm text-gray-900 dark:text-white">Export ke Excel</div>
                <div className="text-xs text-gray-400 mt-0.5">.xlsx · Ringkasan + detail{role === 'wali_kelas' ? ' + sheet per mapel' : ''}</div>
              </div>
              {done === 'excel' && <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />}
            </button>
            <button onClick={exportPdf}
              className={`w-full group flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${done === 'pdf' ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${done === 'pdf' ? 'bg-indigo-500' : 'bg-indigo-100 dark:bg-indigo-950 group-hover:bg-indigo-500'}`}>
                <FileText size={22} className={done === 'pdf' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400 group-hover:text-white'} />
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-sm text-gray-900 dark:text-white">Export ke PDF</div>
                <div className="text-xs text-gray-400 mt-0.5">Preview cetak · Simpan sebagai PDF via browser</div>
              </div>
              {done === 'pdf' && <CheckCircle2 size={18} className="text-indigo-500 shrink-0" />}
            </button>
          </div>
          <div className="px-6 pb-5">
            <button onClick={onClose} className="w-full py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              Tutup
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function ReportPage({ session }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, avg: 0, passCount: 0, passRate: 0 });
  const [scoreData, setScoreData] = useState([]);
  const [search, setSearch] = useState('');
  const [showExport, setShowExport] = useState(false);

  // ── State baru: jadwal untuk analisis soal ──
  const [jadwalList, setJadwalList] = useState([]);   // { id, mapel, paket_id, tanggal, label }
  const [selectedJadwal, setSelectedJadwal] = useState(null);
  const [loadingJadwal, setLoadingJadwal] = useState(false);
  const [showAnalisis, setShowAnalisis] = useState(false);

  const buildStats = (list) => {
    const scores = list.map(r => r.skor).filter(s => s > 0);
    const avg = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
    const passCount = scores.filter(s => s >= 70).length;
    const passRate = scores.length ? +((passCount / scores.length) * 100).toFixed(1) : 0;
    return { total: list.length, avg, passCount, passRate };
  };

  const buildScoreData = (list) => {
    const scores = list.map(r => r.skor).filter(s => s > 0);
    return SCORE_RANGES.map(r => ({
      name: r.label,
      value: scores.filter(s => s >= r.min && s <= r.max).length,
    }));
  };

  // ── Load daftar jadwal untuk dropdown analisis ──
  // ── Load daftar jadwal untuk dropdown analisis ──
  // FIXED: jadwal_ujian tidak punya kolom mapel, join ke paket_soal
  const loadJadwalList = useCallback(async () => {
    setLoadingJadwal(true);
    try {
      const { data, error } = await supabase
        .from('jadwal_ujian')
        .select(`
          id,
          paket_id,
          tanggal,
          waktu_mulai,
          status,
          paket_soal (
            id,
            mapel
          )
        `)
        .order('tanggal', { ascending: false });

      if (error) throw error;

      const list = (data || [])
        .filter(j => j.paket_id && j.paket_soal)
        .map(j => {
          const mapel = j.paket_soal?.mapel || `Paket #${j.paket_id}`;
          const tgl = j.tanggal
            ? new Date(j.tanggal).toLocaleDateString('id-ID', {
              day: 'numeric', month: 'short', year: 'numeric',
            })
            : 'Tanpa tanggal';
          return {
            id: j.id,
            mapel,
            paket_id: j.paket_id,
            tanggal: j.tanggal,
            label: `${mapel} — ${tgl}`,
          };
        });

      setJadwalList(list);
    } catch (err) {
      console.error('loadJadwalList error:', err);
    } finally {
      setLoadingJadwal(false);
    }
  }, []);  // tidak butuh session karena semua jadwal ditampilkan

  // ── WALI KELAS ───────────────────────────────
  const loadWaliKelas = useCallback(async () => {
    const kelas = session?.kelas_wali;
    if (!kelas) return [];

    const { data: siswa, error: e1 } = await supabase
      .from('students')
      .select('id, name, nisn, class, username')
      .eq('class', kelas)
      .order('name');
    if (e1) throw e1;
    if (!siswa?.length) return [];

    const { data: hasil, error: e2 } = await supabase
      .from('hasil_ujian')
      .select('id, user_id, mapel, skor, waktu_selesai, created_at')
      .in('user_id', siswa.map(s => s.id))
      .order('created_at', { ascending: false });
    if (e2) throw e2;

    const siswaMap = Object.fromEntries(siswa.map(s => [s.id, s]));
    const seen = new Set();
    const result = [];
    (hasil || []).forEach(h => {
      const key = `${h.user_id}_${h.mapel}`;
      if (seen.has(key)) return;
      seen.add(key);
      const s = siswaMap[h.user_id];
      if (!s) return;
      result.push({
        id: s.id, hasilId: h.id,
        name: s.name, nisn: s.nisn, class: s.class, username: s.username,
        mapel: h.mapel, skor: h.skor ?? 0,
        waktu: h.waktu_selesai ?? h.created_at,
        status: (h.skor ?? 0) >= 70 ? 'Lulus' : 'Tidak Lulus',
      });
    });

    const usedIds = new Set(result.map(r => r.id));
    siswa.forEach(s => {
      if (!usedIds.has(s.id)) {
        result.push({
          id: s.id, hasilId: null,
          name: s.name, nisn: s.nisn, class: s.class, username: s.username,
          mapel: '-', skor: 0, waktu: null, status: 'Belum Ujian',
        });
      }
    });

    return result;
  }, [session?.kelas_wali]);

  // ── GURU MAPEL ───────────────────────────────
// ──────────────────────────────────────────────────
// PERBAIKAN: loadGuruMapel untuk jadwal_mengajar
// Struktur jadwal_mengajar:
// [
//   {
//     "kelas": ["C", "D"],      ← ARRAY!
//     "mapel": "Bahasa Arab",
//     "tingkat": 5
//   }
// ]
// ──────────────────────────────────────────────────

// ── GURU MAPEL ───────────────────────────────
 // ── GURU MAPEL ───────────────────────────────
  const loadGuruMapel = useCallback(async () => {
    const jadwal = session?.jadwal_mengajar || [];
    if (!jadwal.length) return [];

    // ✅ FIX: Gabung tingkat + kelas karena student class = "5C", "5D", dll
    const mapelSet = [...new Set(jadwal.map(j => j.mapel).filter(Boolean))];
    const kelasSet = [...new Set(
      jadwal.flatMap(j => 
        (j.kelas || []).map(k => `${j.tingkat}${k}`)  // ← tingkat + kelas
      ).filter(Boolean)
    )];
    
    // console.log('📚 mapelSet:', mapelSet);
    // console.log('🏫 kelasSet:', kelasSet);
    
    // Buat key dari kombinasi kelas + mapel
    const jadwalKey = new Set();
    jadwal.forEach(j => {
      (j.kelas || []).forEach(k => {
        const fullClass = `${j.tingkat}${k}`;
        jadwalKey.add(`${fullClass}_${j.mapel}`);
      });
    });
    
    if (!mapelSet.length || !kelasSet.length) return [];

    const { data: siswa, error: e1 } = await supabase
      .from('students')
      .select('id, name, nisn, class, username')
      .in('class', kelasSet);
    if (e1) throw e1;
    if (!siswa?.length) return [];

    const siswaMap = Object.fromEntries(siswa.map(s => [s.id, s]));

    const { data: hasil, error: e2 } = await supabase
      .from('hasil_ujian')
      .select('id, user_id, mapel, skor, waktu_selesai, created_at')
      .in('user_id', siswa.map(s => s.id))
      .in('mapel', mapelSet)
      .order('created_at', { ascending: false });
    if (e2) throw e2;

    const seen = new Set();
    const result = [];
    (hasil || []).forEach(h => {
      const s = siswaMap[h.user_id];
      if (!s) return;
      if (!jadwalKey.has(`${s.class}_${h.mapel}`)) return;
      
      const key = `${h.user_id}_${h.mapel}`;
      if (seen.has(key)) return;
      seen.add(key);
      
      result.push({
        id: s.id, hasilId: h.id,
        name: s.name, nisn: s.nisn, class: s.class, username: s.username,
        mapel: h.mapel, skor: h.skor ?? 0,
        waktu: h.waktu_selesai ?? h.created_at,
        status: (h.skor ?? 0) >= 70 ? 'Lulus' : 'Tidak Lulus',
      });
    });

    return result;
  }, [session?.jadwal_mengajar]);
  // ── Loader utama ─────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data =
        session?.role === 'wali_kelas' ? await loadWaliKelas() :
          session?.role === 'guru_mapel' ? await loadGuruMapel() : [];
      setRows(data);
      setStats(buildStats(data));
      setScoreData(buildScoreData(data));
    } catch (err) {
      console.error(err);
      toast({ type: 'error', title: 'Gagal memuat data', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [loadWaliKelas, loadGuruMapel, session?.role, toast]);

  useEffect(() => {
    loadData();
    loadJadwalList();
  }, [loadData, loadJadwalList]);

  // ── Derived ──────────────────────────────────
  const mapelLabel = session?.role === 'guru_mapel'
    ? [...new Set((session?.jadwal_mengajar || []).map(j => j.mapel).filter(Boolean))].join(', ')
    : '';

  const pageTitle =
    session?.role === 'wali_kelas' ? `Nilai Siswa – Kelas ${session?.kelas_wali}` :
      `Nilai Ujian – ${mapelLabel || 'Mapel Saya'}`;

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.nisn?.toLowerCase().includes(q) ||
      r.username?.toLowerCase().includes(q) ||
      r.mapel?.toLowerCase().includes(q) ||
      r.class?.toLowerCase().includes(q)
    );
  });

  // ── StatCard ─────────────────────────────────
  const StatCard = ({ icon: Icon, label, value, color }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
          <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{value}</span>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </motion.div>
  );

  // ── Render ───────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">{pageTitle}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {stats.total} siswa
            {stats.passCount > 0 && ` · ${stats.passCount} lulus`}
            {stats.avg > 0 && ` · rata-rata ${stats.avg}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={() => !loading && rows.length > 0 && setShowExport(true)}
            disabled={loading || rows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md shadow-indigo-500/30 transition-all"
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Cari nama, NISN, kelas, mapel…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
        />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)
        ) : (
          <>
            <StatCard icon={Users} label="Total Siswa" value={stats.total} color="bg-gradient-to-br from-indigo-400 to-indigo-600" />
            <StatCard icon={Award} label="Rata-rata Nilai" value={stats.avg} color="bg-gradient-to-br from-violet-400 to-violet-600" />
            <StatCard icon={TrendingUp} label="Siswa Lulus" value={stats.passCount} color="bg-gradient-to-br from-emerald-400 to-emerald-600" />
            <StatCard icon={BookOpen} label="Tingkat Kelulusan" value={`${stats.passRate}%`} color="bg-gradient-to-br from-orange-400 to-orange-600" />
          </>
        )}
      </div>

      {/* Distribusi */}
      {!loading && scoreData.some(d => d.value > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm"
        >
          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1">Distribusi Nilai</h3>
          <p className="text-xs text-gray-400 mb-5">Sebaran siswa berdasarkan range nilai</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={scoreData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                  label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={false}
                >
                  {scoreData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Siswa" radius={[6, 6, 0, 0]}>
                  {scoreData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Tabel nilai */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm"
      >
        <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
          <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Daftar Nilai Siswa</h3>
          {filtered.length > 0 && <span className="text-xs text-gray-400">{filtered.length} data</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['#', 'Nama Siswa', 'NISN', 'Kelas', 'Mata Pelajaran', 'Nilai', 'Status', 'Waktu Ujian'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((__, j) => (
                      <td key={j} className="px-5 py-3"><div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <Users size={36} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
                    <p className="text-sm text-gray-400 font-semibold">Tidak ada data</p>
                  </td>
                </tr>
              ) : filtered.map((r, idx) => (
                <tr key={`${r.id}_${r.mapel}`}
                  className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-5 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {r.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">{r.name}</div>
                        <div className="text-[10px] text-gray-400">{r.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-gray-500">{r.nisn || '-'}</td>
                  <td className="px-5 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400">{r.class}</td>
                  <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-400">{r.mapel}</td>
                  <td className="px-5 py-3">
                    {r.skor > 0 ? (
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg font-bold text-xs ${getScoreStyle(r.skor)}`}>{r.skor}</span>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Lulus' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' :
                        r.status === 'Belum Ujian' ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500' :
                          'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'Lulus' ? 'bg-emerald-400' : r.status === 'Belum Ujian' ? 'bg-gray-300' : 'bg-red-400'}`} />
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{fmtDate(r.waktu)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── ANALISIS SOAL SECTION ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm"
      >
        {/* Header section analisis */}
        <button
          onClick={() => setShowAnalisis(v => !v)}
          className="w-full px-6 py-4 flex items-center justify-between bg-violet-50 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-violet-500" />
            <h3 className="text-sm font-bold text-violet-600 dark:text-violet-400">Analisis Jawaban per Soal</h3>
          </div>
          <ChevronDown
            size={16}
            className={`text-violet-400 transition-transform duration-200 ${showAnalisis ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {showAnalisis && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="p-6 space-y-4">

                {/* Dropdown pilih jadwal */}
                <AnalisisSoalSection session={session} />

                {/* Komponen analisis soal */}
                {selectedJadwal ? (
                  <AnalisisSoalSection
                    jadwalId={selectedJadwal.id}
                    paketId={selectedJadwal.paket_id}
                    mapel={selectedJadwal.mapel}
                    session={session}
                  />
                ) : (
                  <div className="text-center py-12">
                    <BarChart2 size={36} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
                    <p className="text-sm text-gray-400 font-semibold">Pilih jadwal ujian untuk melihat analisis jawaban</p>
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Distribusi jawaban A/B/C/D per soal + daftar nama siswa</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Export Modal */}
      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        rows={filtered.length > 0 && search ? filtered : rows}
        title={pageTitle}
        role={session?.role}
      />
    </div>
  );
}