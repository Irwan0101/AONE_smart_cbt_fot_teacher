import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, WifiOff, RefreshCw, Eye,
  Download, ChevronDown, TrendingUp, LogIn, Loader2,
  AlertTriangle, Plus, Trash2, Bell, BellOff, CheckCircle2,
  X, Activity, FileText, Clock
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';

/* ─────────────────────────────────────────
   AUDIO ENGINE
───────────────────────────────────────── */
const AudioEngine = (() => {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };
  const unlock = () => {
    try { const ac = getCtx(); if (ac.state === 'suspended') ac.resume(); } catch (_) {}
  };
  const EVENTS = ['click', 'touchstart', 'keydown', 'pointerdown'];
  const onInteraction = () => { unlock(); EVENTS.forEach(e => document.removeEventListener(e, onInteraction)); };
  EVENTS.forEach(e => document.addEventListener(e, onInteraction, { once: true, passive: true }));

  const play = (notes, delay = 0) => {
    try {
      const ac = getCtx();
      const doPlay = () => {
        let t = ac.currentTime + 0.05 + delay;
        notes.forEach(({ freq = 440, dur = 0.15, type = 'sine', vol = 0.35, gap = 0 }) => {
          const osc = ac.createOscillator(); const gain = ac.createGain();
          osc.connect(gain); gain.connect(ac.destination);
          osc.type = type;
          osc.frequency.setValueAtTime(Math.max(freq, 1), t);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(vol, t + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          osc.start(t); osc.stop(t + dur + 0.01);
          t += dur + gap;
        });
      };
      if (ac.state === 'suspended') ac.resume().then(doPlay).catch(() => {});
      else doPlay();
    } catch (err) { console.warn('[AudioEngine]', err); }
  };

  return {
    unlock,
    online:    () => play([{ freq: 880, dur: 0.08, type: 'sine', vol: 0.4 }, { freq: 1320, dur: 0.12, type: 'triangle', vol: 0.35 }]),
    offline:   () => play([{ freq: 440, dur: 0.12, type: 'sine', vol: 0.3 }, { freq: 330, dur: 0.15, type: 'sine', vol: 0.25 }]),
    submit:    () => play([{ freq: 523, dur: 0.07, vol: 0.35 }, { freq: 659, dur: 0.07, vol: 0.35 }, { freq: 784, dur: 0.1, vol: 0.35 }, { freq: 1047, dur: 0.18, type: 'triangle', vol: 0.4 }]),
    complete:  () => play([{ freq: 523, dur: 0.07, vol: 0.4, gap: 0.01 }, { freq: 659, dur: 0.07, vol: 0.4, gap: 0.01 }, { freq: 784, dur: 0.07, vol: 0.4, gap: 0.01 }, { freq: 1047, dur: 0.07, vol: 0.45, gap: 0.01 }, { freq: 1319, dur: 0.28, type: 'triangle', vol: 0.5 }]),
    violation: () => play([{ freq: 880, dur: 0.1, type: 'square', vol: 0.4, gap: 0.08 }, { freq: 880, dur: 0.1, type: 'square', vol: 0.4, gap: 0.08 }, { freq: 660, dur: 0.25, type: 'square', vol: 0.45 }]),
  };
})();

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const exportToExcel = (data, filename) => {
  const XLSX = require('xlsx');
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Peserta');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

const exportToPDF = async (data, filename, roomName, examTime) => {
  const { jsPDF } = require('jspdf');
  require('jspdf-autotable');
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(16); doc.text('LAPORAN HASIL UJIAN', pw/2, 15, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Ruang: ${roomName} | Waktu: ${examTime ?? '-'}`, pw/2, 22, { align: 'center' });
  doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, pw/2, 29, { align: 'center' });
  doc.autoTable({
    head: [['No.', 'Nama Peserta', 'NISN', 'Status', 'Nilai', 'Soal Terjawab']],
    body: data.map((item, idx) => [
      idx+1, item.name||'-', item.nisn||'-',
      item.status==='selesai'?'Selesai':item.status==='login'?'Online':'Offline',
      item.skor!=null?Number(item.skor).toFixed(0):'-',
      item.soal_terjawab!=null?`${item.soal_terjawab}/${item.total_soal??'?'}`:'-',
    ]),
    startY: 36, margin: { left: 10, right: 10 },
    headStyles: { fillColor: [79,70,229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240,240,240] },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 50 } },
  });
  doc.save(`${filename}.pdf`);
};

/* ─────────────────────────────────────────
   LIVE NOTIFICATION POPUP
───────────────────────────────────────── */
const EVENT_STYLES = {
  online:    { bg: 'bg-sky-500',     icon: LogIn,         label: 'Siswa Online'         },
  offline:   { bg: 'bg-slate-500',   icon: WifiOff,       label: 'Siswa Offline'        },
  submit:    { bg: 'bg-emerald-500', icon: CheckCircle2,  label: 'Jawaban Dikirim'      },
  complete:  { bg: 'bg-violet-500',  icon: CheckCircle2,  label: 'Semua Soal Selesai'   },
  violation: { bg: 'bg-rose-500',    icon: AlertTriangle, label: 'Pelanggaran!'         },
};

function LiveNotifPopup({ notifications, onDismiss }) {
  return (
    <div className="fixed top-3 right-3 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 290 }}>
      <AnimatePresence>
        {notifications.map(n => {
          const style = EVENT_STYLES[n.type] || EVENT_STYLES.online;
          const Icon  = style.icon;
          return (
            <motion.div key={n.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0,  scale: 1   }}
              exit={{    opacity: 0, x: 60,  scale: 0.85}}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto flex items-start gap-2.5 bg-white dark:bg-gray-900
                         rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700
                         px-3 py-2.5 overflow-hidden relative"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${style.bg}`} />
              <div className={`${style.bg} rounded-lg p-1.5 shrink-0`}>
                <Icon size={13} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{style.label}</p>
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{n.name}</p>
                {n.room && <p className="text-[10px] text-gray-400 truncate">{n.room}</p>}
                {n.note && <p className="text-[10px] text-rose-500 font-medium">{n.note}</p>}
              </div>
              <button onClick={() => onDismiss(n.id)} className="shrink-0 text-gray-300 hover:text-gray-500 mt-0.5">
                <X size={12} />
              </button>
              <motion.div className={`absolute bottom-0 left-0 h-0.5 ${style.bg} opacity-40`}
                initial={{ width: '100%' }} animate={{ width: '0%' }}
                transition={{ duration: 5, ease: 'linear' }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────
   VIOLATION TAB
───────────────────────────────────────── */
const VIOLATION_TYPES = ['Buka tab lain','Copy-paste','Screenshot','Keluar ruangan','Menggunakan HP','Berbicara','Menyontek','Lainnya'];

function ViolationTab({ roomKey, studentList, onViolationAdded, soundEnabled }) {
  const [violations, setViolations] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`violations_${roomKey}`) || '[]'); } catch { return []; }
  });
  const [form,     setForm]     = useState({ studentId: '', type: VIOLATION_TYPES[0], note: '' });
  const [showForm, setShowForm] = useState(false);

  const save = (list) => {
    setViolations(list);
    try { localStorage.setItem(`violations_${roomKey}`, JSON.stringify(list)); } catch {}
  };

  const addViolation = () => {
    if (!form.studentId) return;
    const student = studentList.find(s => s.id === form.studentId);
    const entry = {
      id: Date.now(), studentId: form.studentId,
      name: student?.name || '-', type: form.type, note: form.note,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };
    save([entry, ...violations]);
    setForm({ studentId: '', type: VIOLATION_TYPES[0], note: '' });
    setShowForm(false);
    if (soundEnabled) AudioEngine.violation();
    onViolationAdded(entry);
  };

  const remove = (id) => save(violations.filter(v => v.id !== id));

  const grouped = violations.reduce((acc, v) => {
    if (!acc[v.studentId]) acc[v.studentId] = { name: v.name, list: [] };
    acc[v.studentId].list.push(v);
    return acc;
  }, {});

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
          {violations.length} pelanggaran tercatat
        </p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                     bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400
                     border border-rose-200 dark:border-rose-900 active:scale-95 transition-all"
        >
          <Plus size={12} /> Tambah
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl p-3 space-y-2.5">
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">⚠ Catat Pelanggaran</p>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Siswa</label>
                <select value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700
                             bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-white">
                  <option value="">-- Pilih Siswa --</option>
                  {studentList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Jenis Pelanggaran</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700
                             bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-white">
                  {VIOLATION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Catatan</label>
                <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Keterangan tambahan..."
                  className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700
                             bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400" />
              </div>
              <div className="flex gap-2">
                <button onClick={addViolation} disabled={!form.studentId}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold
                             disabled:opacity-40 active:scale-95 transition-all">
                  Simpan
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                             text-xs font-bold text-gray-500 active:scale-95 transition-all">
                  Batal
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {violations.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2 text-gray-300 dark:text-gray-700">
          <ShieldCheck size={32} />
          <p className="text-xs font-bold">Tidak ada pelanggaran</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {Object.entries(grouped).map(([sid, { name, list }]) => (
            <div key={sid} className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2
                              bg-rose-50 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={11} className="text-rose-500" />
                  <span className="text-xs font-bold text-gray-800 dark:text-white">{name}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">{list.length}×</span>
              </div>
              {list.map(v => (
                <div key={v.id} className="flex items-start gap-2 px-3 py-2.5 border-b last:border-0
                           border-gray-100 dark:border-gray-800">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{v.type}</span>
                      <span className="text-[10px] text-gray-400">{v.time}</span>
                    </div>
                    {v.note && <p className="text-[10px] text-gray-500 mt-0.5">{v.note}</p>}
                  </div>
                  <button onClick={() => remove(v.id)} className="shrink-0 text-gray-300 hover:text-rose-400 p-1">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   STUDENT CARD — replaces table row
───────────────────────────────────────── */
function StudentCard({ s, idx, hasil, totalSoal, onOpenModal }) {
  const answeredCount = hasil?.soal_terjawab ?? 0;
  const total         = hasil?.total_soal ?? totalSoal ?? 0;
  const allDone       = total > 0 && answeredCount >= total;
  const pct           = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  const statusInfo = hasil
    ? { label: 'Selesai', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500',          ring: 'ring-emerald-100 dark:ring-emerald-900' }
    : s.is_online
    ? { label: 'Online',  color: 'text-sky-600 dark:text-sky-400',         dot: 'bg-sky-400 animate-pulse', ring: 'ring-sky-100 dark:ring-sky-900'         }
    : { label: 'Offline', color: 'text-gray-400',                          dot: 'bg-gray-300 dark:bg-gray-600', ring: 'ring-gray-100 dark:ring-gray-800'   };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.025 }}
      onClick={() => hasil && onOpenModal({ name: s.name, soalTerjawab: answeredCount, totalSoal: total })}
      className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden
                  ${hasil ? 'active:scale-[0.98] cursor-pointer' : 'cursor-default'} transition-transform`}
    >
      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
        {/* Avatar */}
        <div className={`relative w-10 h-10 rounded-2xl ring-2 ${statusInfo.ring} shrink-0
                         flex items-center justify-center
                         bg-gradient-to-br from-indigo-50 to-violet-100 dark:from-indigo-950 dark:to-violet-950`}>
          <span className="text-sm font-extrabold text-indigo-500 dark:text-indigo-400 select-none leading-none">
            {(s.name || '?')[0].toUpperCase()}
          </span>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full
                            border-2 border-white dark:border-gray-900 ${statusInfo.dot}`} />
        </div>

        {/* Name + NISN */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">{s.name || '-'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-400">{s.nisn || '–'}</span>
            <span className={`text-[10px] font-bold ${statusInfo.color}`}>• {statusInfo.label}</span>
          </div>
        </div>

        {/* Right: nilai / last seen */}
        <div className="shrink-0 text-right">
          {hasil && hasil.skor != null ? (
            <div>
              <p className="text-[9px] text-gray-400">Nilai</p>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 leading-tight">
                {Number(hasil.skor).toFixed(0)}
              </span>
            </div>
          ) : !hasil && s.last_seen ? (
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Clock size={9} />
              {new Date(s.last_seen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Progress bar — only when submitted */}
      {hasil && (
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-400">{answeredCount}/{total > 0 ? total : '?'} soal dijawab</span>
            <span className={`text-[10px] font-bold ${allDone ? 'text-emerald-500' : 'text-indigo-500'}`}>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              className={`h-full rounded-full ${allDone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            />
          </div>
          <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-1 text-right">Tap untuk detail soal</p>
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   SOAL DETAIL MODAL — bottom sheet on mobile
───────────────────────────────────────── */
function SoalModal({ modal, onClose }) {
  if (!modal) return null;
  const { name, soalTerjawab, totalSoal } = modal;
  const allDone = totalSoal > 0 && soalTerjawab >= totalSoal;
  const pct     = totalSoal > 0 ? Math.round((soalTerjawab / totalSoal) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{    y: 100 }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl
                   shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[88vh] overflow-hidden"
      >
        {/* Drag indicator */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <p className="text-sm font-extrabold text-gray-900 dark:text-white">{name}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Detail jawaban •{' '}
              <span className={`font-bold ${allDone ? 'text-emerald-500' : 'text-indigo-500'}`}>
                {soalTerjawab}/{totalSoal > 0 ? totalSoal : '?'} dijawab
              </span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Summary stats + circle */}
        <div className="mx-4 mb-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-3 flex items-center gap-4">
          {/* SVG circle */}
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor"
                className="text-gray-200 dark:text-gray-700" strokeWidth="6" />
              <circle cx="32" cy="32" r="26" fill="none"
                stroke={allDone ? '#10b981' : '#6366f1'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - pct / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.7s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-extrabold ${allDone ? 'text-emerald-500' : 'text-indigo-500'}`}>{pct}%</span>
            </div>
          </div>

          <div className="flex gap-4 flex-1">
            {[
              { val: soalTerjawab,              label: 'Dijawab', color: 'text-emerald-600 dark:text-emerald-400' },
              { val: totalSoal - soalTerjawab,  label: 'Belum',   color: 'text-gray-500'                         },
              { val: totalSoal,                 label: 'Total',   color: 'text-gray-900 dark:text-white'          },
            ].map(({ val, label, color }) => (
              <div key={label}>
                <p className={`text-xl font-extrabold ${color} leading-tight`}>{val}</p>
                <p className="text-[10px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-[10px] text-gray-500">Dijawab</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-700" />
            <span className="text-[10px] text-gray-500">Belum</span>
          </div>
          <span className="text-[9px] text-gray-300 dark:text-gray-600 ml-auto italic">* urutan acak</span>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto px-4 pb-4">
          {totalSoal === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Data soal belum tersedia</p>
          ) : (
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: totalSoal }, (_, i) => {
                const done = i < soalTerjawab;
                return (
                  <motion.div key={i}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1,   opacity: 1 }}
                    transition={{ delay: i * 0.005, type: 'spring', stiffness: 450, damping: 22 }}
                    className={`aspect-square flex items-center justify-center rounded-lg
                                text-[10px] font-bold border select-none
                                ${done
                                  ? 'bg-emerald-500 border-emerald-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                                }`}
                  >
                    {i + 1}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40
                        flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {totalSoal - soalTerjawab > 0
              ? `${totalSoal - soalTerjawab} soal belum dijawab`
              : '🎉 Semua soal telah dijawab'}
          </span>
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600
                       active:scale-95 text-white text-xs font-bold transition-all">
            Tutup
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function PengawasPage({ session }) {
  const { toast } = useToast();

  const [tugasList,     setTugasList]     = useState([]);
  const [pesertaMap,    setPesertaMap]    = useState({});
  const [loading,       setLoading]       = useState(true);
  const [exportingPDF,  setExportingPDF]  = useState(null);
  const [exportingXLS,  setExportingXLS]  = useState(null);
  const [now,           setNow]           = useState(new Date());
  const [expandedRoom,  setExpandedRoom]  = useState(null);
  const [activeTab,     setActiveTab]     = useState({});
  const [soalModal,     setSoalModal]     = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [soundEnabled,  setSoundEnabled]  = useState(true);

  const hasInitialized = useRef(false);
  const pollInterval   = useRef(null);
  const sessionId      = useRef(session?.id);
  const notifCounter   = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => setNotifications(prev => prev.slice(1)), 5000);
    return () => clearTimeout(timer);
  }, [notifications]);

  const pushNotif = useCallback((type, name, room, note = '') => {
    const id = ++notifCounter.current;
    setNotifications(prev => [...prev.slice(-4), { id, type, name, room, note }]);
    if (soundEnabled) AudioEngine[type]?.();
  }, [soundEnabled]);

  const dismissNotif = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const loadPeserta = useCallback(async (jadwalId, namaRuang) => {
    try {
      const { data: pesertaData, error: err1 } = await supabase
        .from('students')
        .select('id, name, nisn, class, is_online, last_seen')
        .eq('class', namaRuang)
        .order('name', { ascending: true });
      if (err1) throw err1;

      const pesertaIds = (pesertaData || []).map(p => p.id);
      let hasilMap = {};

      if (pesertaIds.length > 0) {
        const { data: hasilData, error: err2 } = await supabase
          .from('hasil_ujian')
          .select('user_id, skor, waktu_selesai, soal_terjawab, total_soal, created_at')
          .eq('jadwal_id', jadwalId)
          .in('user_id', pesertaIds);
        if (err2) throw err2;
        (hasilData || []).forEach(h => { hasilMap[h.user_id] = h; });
      }

      const key = `${jadwalId}_${namaRuang}`;

      setPesertaMap(prev => {
        const prevData   = prev[key];
        const newPeserta = pesertaData || [];

        if (prevData && hasInitialized.current) {
          const prevById  = Object.fromEntries((prevData.peserta || []).map(p => [p.id, p]));
          const prevHasil = prevData.hasil || {};
          newPeserta.forEach(s => {
            const old = prevById[s.id];
            if (!old) return;
            if (!old.is_online && s.is_online)       pushNotif('online',  s.name, namaRuang);
            else if (old.is_online && !s.is_online)  pushNotif('offline', s.name, namaRuang);
            if (!prevHasil[s.id] && hasilMap[s.id]) {
              const skor = hasilMap[s.id].skor != null ? `Nilai: ${Number(hasilMap[s.id].skor).toFixed(0)}` : '';
              pushNotif('submit', s.name, namaRuang, skor);
            }
            const prevH = prevHasil[s.id];
            const newH  = hasilMap[s.id];
            const tot   = newH?.total_soal ?? 0;
            if (tot > 0 && (prevH?.soal_terjawab ?? 0) < tot && (newH?.soal_terjawab ?? 0) >= tot) {
              pushNotif('complete', s.name, namaRuang, `${newH.soal_terjawab}/${tot} soal`);
            }
          });
        }

        const isSame =
          JSON.stringify(prevData?.peserta) === JSON.stringify(newPeserta) &&
          JSON.stringify(prevData?.hasil)   === JSON.stringify(hasilMap);
        if (isSame) return prev;
        return { ...prev, [key]: { peserta: newPeserta, hasil: hasilMap } };
      });
    } catch (e) {
      console.error('loadPeserta error:', e);
    }
  }, [pushNotif]);

  const loadTugas = useCallback(async () => {
    if (!sessionId.current) return;
    try {
      const today = getLocalToday();
      const { data, error } = await supabase
        .from('tugas_mengawas')
        .select(`
          id, nama_ruang, token_pengawas, is_active,
          jadwal_ujian:jadwal_id (
            id, tanggal, waktu_mulai, durasi, status, tokens,
            paket_soal:paket_id ( mapel, jumlah_soal )
          )
        `)
        .eq('teacher_id', sessionId.current)
        .eq('is_active', true);
      if (error) throw error;

      const todayTugas = (data || []).filter(t => t.jadwal_ujian?.tanggal === today);
      setTugasList(prev => JSON.stringify(prev) === JSON.stringify(todayTugas) ? prev : todayTugas);
      await Promise.all(todayTugas.filter(t => t.jadwal_ujian?.id).map(t => loadPeserta(t.jadwal_ujian.id, t.nama_ruang)));
      if (!hasInitialized.current) { setLoading(false); hasInitialized.current = true; }
    } catch (e) {
      if (!hasInitialized.current) { setLoading(false); hasInitialized.current = true; }
      toast({ type: 'error', title: 'Gagal memuat tugas', message: e.message });
    }
  }, [loadPeserta, toast]);

  useEffect(() => {
    sessionId.current = session?.id;
    if (!sessionId.current) { setLoading(false); return; }
    loadTugas();
    pollInterval.current = setInterval(loadTugas, 5000);
    return () => clearInterval(pollInterval.current);
  }, [session?.id, loadTugas]);

  const getExamStatus = useCallback((jadwal) => {
    if (!jadwal) return 'unknown';
    if (jadwal.tanggal !== getLocalToday()) return 'future';
    const [h, m] = jadwal.waktu_mulai.split(':').map(Number);
    const start  = new Date(); start.setHours(h, m, 0, 0);
    const end    = new Date(start.getTime() + jadwal.durasi * 60000);
    if (now < start) return 'waiting';
    if (now > end)   return 'ended';
    return 'running';
  }, [now]);

  const formatCountdown = useCallback((jadwal) => {
    if (!jadwal) return '';
    const [h, m] = jadwal.waktu_mulai.split(':').map(Number);
    const start  = new Date(); start.setHours(h, m, 0, 0);
    const end    = new Date(start.getTime() + jadwal.durasi * 60000);
    const status = getExamStatus(jadwal);
    if (status === 'waiting') {
      const diff = Math.max(0, Math.floor((start - now) / 1000));
      return `Mulai ${Math.floor(diff/60)}:${String(diff%60).padStart(2,'0')}`;
    }
    if (status === 'running') {
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      return `Sisa ${Math.floor(diff/60)}:${String(diff%60).padStart(2,'0')}`;
    }
    return 'Selesai';
  }, [getExamStatus, now]);

  const getLoginStatus = (s, hasil) => hasil ? 'selesai' : s.is_online ? 'login' : 'belum_login';

  const handleExportExcel = async (list, peserta, roomName, tugasId) => {
    setExportingXLS(tugasId);
    try {
      const data = list.map(s => {
        const st = getLoginStatus(s, peserta.hasil?.[s.id]);
        return {
          'Nama Peserta': s.name  || '-',
          'NISN':         s.nisn  || '-',
          'Status':       st === 'selesai' ? 'Selesai' : st === 'login' ? 'Online' : 'Offline',
          'Nilai':        peserta.hasil?.[s.id]?.skor != null ? Number(peserta.hasil[s.id].skor).toFixed(0) : '-',
          'Soal Terjawab':peserta.hasil?.[s.id] ? `${peserta.hasil[s.id].soal_terjawab}/${peserta.hasil[s.id].total_soal??'?'}` : '-',
          'Selesai Waktu':peserta.hasil?.[s.id]?.waktu_selesai ? new Date(peserta.hasil[s.id].waktu_selesai).toLocaleTimeString('id-ID') : '-',
        };
      });
      exportToExcel(data, `nilai_${roomName}_${Date.now()}`);
      toast({ type: 'success', title: 'Export berhasil', message: 'File Excel telah diunduh' });
    } catch (e) {
      toast({ type: 'error', title: 'Export gagal', message: e.message });
    } finally { setExportingXLS(null); }
  };

  const handleExportPDF = async (list, peserta, roomName, jadwal, tugasId) => {
    setExportingPDF(tugasId);
    try {
      const data = list.map(s => ({
        name: s.name, nisn: s.nisn,
        status: getLoginStatus(s, peserta.hasil?.[s.id]),
        skor: peserta.hasil?.[s.id]?.skor,
        soal_terjawab: peserta.hasil?.[s.id]?.soal_terjawab,
        total_soal: peserta.hasil?.[s.id]?.total_soal,
      }));
      await exportToPDF(data, `nilai_${roomName}_${Date.now()}`, roomName, jadwal?.waktu_mulai?.slice(0,5));
      toast({ type: 'success', title: 'Export berhasil', message: 'File PDF telah diunduh' });
    } catch (e) {
      toast({ type: 'error', title: 'Export gagal', message: e.message });
    } finally { setExportingPDF(null); }
  };

  const statusBadge = {
    waiting: 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
    running: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400',
    ended:   'bg-gray-100 dark:bg-gray-800 text-gray-500',
    future:  'bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400',
    unknown: 'bg-gray-100 dark:bg-gray-800 text-gray-500',
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-36 rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (tugasList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 px-4">
        <ShieldCheck size={48} className="text-gray-200 dark:text-gray-700" />
        <p className="text-sm font-bold text-gray-400 text-center">Tidak ada tugas mengawas hari ini</p>
        <p className="text-xs text-gray-300 dark:text-gray-600 text-center">Halaman ini muncul saat ada jadwal aktif</p>
      </div>
    );
  }

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <>
      <LiveNotifPopup notifications={notifications} onDismiss={dismissNotif} />

      <div className="space-y-4 pb-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white">Monitor Pengawasan</h2>
            <p className="text-[11px] text-gray-400">{tugasList.length} ruang ujian hari ini</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { AudioEngine.unlock(); setSoundEnabled(v => !v); }}
              className={`p-2.5 rounded-xl border transition-all active:scale-90
                ${soundEnabled
                  ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900'
                  : 'text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
            >
              {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            </button>
            <button
              onClick={loadTugas}
              className="p-2.5 rounded-xl border bg-white dark:bg-gray-900 text-gray-500
                         border-gray-200 dark:border-gray-700 active:scale-90 transition-all"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* ── Room Cards ── */}
        {tugasList.map((tugas, i) => {
          const jadwal  = tugas.jadwal_ujian;
          const status  = getExamStatus(jadwal);
          const key     = `${jadwal?.id}_${tugas.nama_ruang}`;
          const peserta = pesertaMap[key] || {};
          const list    = peserta.peserta || [];

          const selesaiCount     = list.filter(s => peserta.hasil?.[s.id]).length;
          const loginCount       = list.filter(s => s.is_online).length;
          const belumSelesaiList = list.filter(s => s.is_online && !peserta.hasil?.[s.id]);
          const isExpanded       = expandedRoom === tugas.id;
          const tab              = activeTab[tugas.id] || 'monitor';
          const selesaiPct       = list.length > 0 ? Math.round((selesaiCount / list.length) * 100) : 0;

          const violationCount = (() => {
            try { return JSON.parse(localStorage.getItem(`violations_${key}`) || '[]').length; }
            catch { return 0; }
          })();

          return (
            <motion.div key={tugas.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
            >
              {/* ── Tap to expand ── */}
              <button
                onClick={() => setExpandedRoom(isExpanded ? null : tugas.id)}
                className="w-full p-4 text-left active:bg-gray-50/70 dark:active:bg-gray-800/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500
                                  flex items-center justify-center text-2xl shrink-0 shadow-sm">
                    🏫
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-gray-900 dark:text-white capitalize">
                        {tugas.nama_ruang || 'Ruang Ujian'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${statusBadge[status]}`}>
                        {status === 'running' ? '● LIVE' : status === 'waiting' ? '⏳ Menunggu' : status === 'ended' ? '✓ Selesai' : 'Mendatang'}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {jadwal?.paket_soal?.mapel ?? '–'} • {jadwal?.waktu_mulai?.slice(0,5) ?? '–'} • {jadwal?.durasi ?? '–'} mnt
                    </p>

                    {/* Stat pills */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-400">
                        <Users size={10} /> {list.length} peserta
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                        <LogIn size={10} /> {loginCount} online
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={10} /> {selesaiCount} selesai
                      </span>
                      {violationCount > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          <AlertTriangle size={10} /> {violationCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5 mt-0.5">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 tabular-nums">{formatCountdown(jadwal)}</p>
                    <p className="text-[9px] text-gray-400 font-mono tracking-widest">{tugas.token_pengawas ?? '–'}</p>
                    <ChevronDown size={15} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Overall progress bar */}
                {list.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-500 transition-all duration-700"
                        style={{ width: `${selesaiPct}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-gray-400">{selesaiPct}% peserta telah selesai</p>
                  </div>
                )}
              </button>

              {/* ── Expanded content ── */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{    opacity: 0, height: 0    }}
                    transition={{ duration: 0.22 }}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    {/* Tab bar */}
                    <div className="flex bg-gray-50 dark:bg-gray-800/40">
                      {[
                        { id: 'monitor',    label: 'Monitor',     icon: FileText       },
                        { id: 'violations', label: 'Pelanggaran', icon: AlertTriangle, count: violationCount },
                      ].map(t => (
                        <button key={t.id}
                          onClick={() => setActiveTab(prev => ({ ...prev, [tugas.id]: t.id }))}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors
                            ${tab === t.id
                              ? t.id === 'violations'
                                ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-white dark:bg-gray-900'
                                : 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-900'
                              : 'border-transparent text-gray-400'}`}
                        >
                          <t.icon size={12} />
                          {t.label}
                          {t.count > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold leading-none">
                              {t.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Monitor tab */}
                    {tab === 'monitor' && (
                      <div className="p-3 space-y-3">
                        {/* Export */}
                        <div className="flex gap-2">
                          <button
                            disabled={exportingXLS === tugas.id}
                            onClick={() => handleExportExcel(list, peserta, tugas.nama_ruang, tugas.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold
                                       bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400
                                       border border-emerald-200 dark:border-emerald-900
                                       disabled:opacity-50 active:scale-95 transition-all"
                          >
                            {exportingXLS === tugas.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            Export Excel
                          </button>
                          <button
                            disabled={exportingPDF === tugas.id}
                            onClick={() => handleExportPDF(list, peserta, tugas.nama_ruang, jadwal, tugas.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold
                                       bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400
                                       border border-rose-200 dark:border-rose-900
                                       disabled:opacity-50 active:scale-95 transition-all"
                          >
                            {exportingPDF === tugas.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            Export PDF
                          </button>
                        </div>

                        {/* Student cards */}
                        {list.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-xs">
                            Belum ada peserta di ruangan ini
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {list.map((s, idx) => (
                              <StudentCard
                                key={s.id || idx}
                                s={s}
                                idx={idx}
                                hasil={peserta.hasil?.[s.id]}
                                totalSoal={jadwal?.paket_soal?.jumlah_soal ?? 0}
                                onOpenModal={setSoalModal}
                              />
                            ))}
                          </div>
                        )}

                        {/* Still working */}
                        {belumSelesaiList.length > 0 && status === 'running' && (
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2">
                              ⚠ Masih mengerjakan ({belumSelesaiList.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {belumSelesaiList.map((s, idx) => (
                                <span key={s.id || idx}
                                  className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/30
                                             border border-amber-200 dark:border-amber-900
                                             text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Violations tab */}
                    {tab === 'violations' && (
                      <ViolationTab
                        roomKey={key}
                        studentList={list}
                        soundEnabled={soundEnabled}
                        onViolationAdded={(entry) => {
                          pushNotif('violation', entry.name, tugas.nama_ruang, entry.type);
                          setActiveTab(prev => ({ ...prev }));
                        }}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Soal Modal */}
      <AnimatePresence>
        {soalModal && <SoalModal modal={soalModal} onClose={() => setSoalModal(null)} />}
      </AnimatePresence>
    </>
  );
}