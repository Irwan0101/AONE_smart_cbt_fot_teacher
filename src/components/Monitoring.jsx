import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, Search, Users, CheckCircle2, Loader2, UserMinus,
  BarChart3, Monitor as MonitorIcon, RefreshCcw, Trophy,
  CloudOff, Cloud, FileText, Download,
  ChevronUp, ChevronDown, Eye, Clock, TrendingUp, Activity,
  Wifi, WifiOff, Bell, X, Menu, AlertTriangle
} from 'lucide-react';

// ─── KONSTANTA ────────────────────────────────────────────────────────────────
const OFFLINE_THRESHOLD_MS = 120_000; // 2 menit
const REFRESH_INTERVAL_MS  = 30_000;  // auto-refresh 30 detik

// ─── SOUND ENGINE (Web Audio API) ────────────────────────────────────────────
const AudioCtxClass = typeof window !== 'undefined'
  ? (window.AudioContext || window.webkitAudioContext)
  : null;

let _audioCtx = null;
const getAudioCtx = () => {
  if (!AudioCtxClass) return null;
  if (!_audioCtx || _audioCtx.state === 'closed') _audioCtx = new AudioCtxClass();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
};

const playTone = (freqs, type = 'sine', vol = 0.35) => {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    let t = ctx.currentTime;
    freqs.forEach(({ f, dur, startVol = vol, endVol = 0 }) => {
      if (f === 0) { t += dur; return; }
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(startVol, t);
      gain.gain.linearRampToValueAtTime(endVol, t + dur);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    });
  } catch (e) { /* silent fail */ }
};

const soundOnline      = () => playTone([{ f: 523, dur: 0.10, startVol: 0.3, endVol: 0.3 }, { f: 659, dur: 0.10, startVol: 0.3, endVol: 0.3 }, { f: 784, dur: 0.18, startVol: 0.3, endVol: 0 }], 'sine');
const soundOffline     = () => playTone([{ f: 440, dur: 0.15, startVol: 0.4, endVol: 0.4 }, { f: 330, dur: 0.22, startVol: 0.4, endVol: 0 }], 'triangle');
const soundSelesai     = () => playTone([{ f: 523, dur: 0.08, startVol: 0.35, endVol: 0.35 }, { f: 659, dur: 0.08, startVol: 0.35, endVol: 0.35 }, { f: 784, dur: 0.08, startVol: 0.35, endVol: 0.35 }, { f: 1047, dur: 0.28, startVol: 0.4, endVol: 0 }], 'sine');
const soundPelanggaran = () => playTone([{ f: 880, dur: 0.09, startVol: 0.55, endVol: 0.55 }, { f: 0, dur: 0.06 }, { f: 880, dur: 0.09, startVol: 0.55, endVol: 0.55 }, { f: 0, dur: 0.06 }, { f: 660, dur: 0.22, startVol: 0.45, endVol: 0 }], 'sawtooth');

// ─── BROWSER NOTIFICATION ─────────────────────────────────────────────────────
const requestNotifPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
};

const showBrowserNotif = (title, body, tag = 'cbt-notif') => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag, renotify: true, silent: true });
  } catch (e) { /* silent fail */ }
};

// ─── HELPER ──────────────────────────────────────────────────────────────────
const calcNilai = (skor) => (skor !== null && skor !== undefined ? Math.round(skor) : null);

const getGrade = (nilai) => {
  if (nilai === null || nilai === undefined) return null;
  if (nilai >= 90) return 'A';
  if (nilai >= 80) return 'B';
  if (nilai >= 65) return 'C';
  return 'D';
};

const isStudentOffline = (lastUpdate) => {
  if (!lastUpdate) return false;
  return (Date.now() - new Date(lastUpdate).getTime()) > OFFLINE_THRESHOLD_MS;
};

const formatTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

// ─── EXPORT CSV ──────────────────────────────────────────────────────────────
const exportToCSV = (students, session, totalSoal) => {
  const rows = [
    ['No','Nama','Username','NISN','Kelas','Status','Soal Terjawab','Total Soal','Progres(%)','Skor','Nilai','Grade','Selesai Pukul'],
  ];
  const selesai = students.filter(s => s.waktu_selesai).sort((a,b) => calcNilai(b.skor) - calcNilai(a.skor));
  const rest    = students.filter(s => !s.waktu_selesai);
  [...selesai, ...rest].forEach((s, i) => {
    const isDone = !!s.waktu_selesai;
    const nilai  = calcNilai(s.skor);
    const pct    = totalSoal > 0 ? Math.round((s.soal_terjawab / totalSoal) * 100) : 0;
    rows.push([
      i + 1, s.name, s.username, s.nisn, s.class,
      isDone ? 'Selesai' : s.is_login ? 'Ujian' : 'Offline',
      s.soal_terjawab, totalSoal, pct,
      s.skor ?? '', nilai ?? '', getGrade(nilai) ?? '',
      isDone ? formatTime(s.waktu_selesai) : '',
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `hasil_${session.mapel}_kelas${session.kelas}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── GRADE CHIP ──────────────────────────────────────────────────────────────
const gradeChip = (g) => ({
  A: 'bg-emerald-100 text-emerald-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-rose-100 text-rose-800'
}[g] ?? 'bg-slate-100 text-slate-500');

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const StatusBadge = ({ is_login, isDone, isLag }) => {
  if (!is_login) return <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full"><CloudOff size={9}/>Offline</span>;
  if (isDone)    return <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 size={9}/>Selesai</span>;
  if (isLag)     return <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><CloudOff size={9}/>Delay</span>;
  return              <span className="flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full"><Cloud size={9} className="animate-pulse"/>Live</span>;
};

// ─── COUNTDOWN TIMER ─────────────────────────────────────────────────────────
const CountdownTimer = ({ session }) => {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!session.waktuMulai || !session.durasi) return;
    const tick = () => {
      const start = new Date(session.waktuMulai).getTime();
      const end   = start + session.durasi * 60000;
      setRemaining(end - Date.now());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  if (!session.waktuMulai || !session.durasi) return null;

  const isExpired = remaining !== null && remaining <= 0;
  const m   = remaining ? Math.max(0, Math.floor(remaining / 60000)) : 0;
  const s   = remaining ? Math.max(0, Math.floor((remaining % 60000) / 1000)) : 0;
  const pct = session.durasi ? Math.max(0, Math.min(100, (remaining / (session.durasi * 60000)) * 100)) : 0;

  return (
    <div className={`mx-3 sm:mx-4 mt-3 rounded-2xl p-3 flex items-center gap-3 border ${
      isExpired ? 'bg-rose-50 border-rose-200' : pct < 20 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
    }`}>
      <Clock size={16} className={isExpired ? 'text-rose-500' : pct < 20 ? 'text-amber-500' : 'text-slate-400'} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-400 font-semibold">Sisa Waktu</span>
          <span className={`font-mono font-black ${isExpired ? 'text-rose-600' : pct < 20 ? 'text-amber-600' : 'text-slate-700'}`}>
            {isExpired ? 'HABIS' : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8 }}
            className={`h-full rounded-full ${isExpired ? 'bg-rose-500' : pct < 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          />
        </div>
      </div>
      <span className="text-[9px] text-slate-400 font-mono shrink-0">{session.durasi}m</span>
    </div>
  );
};

// ─── STATS GRID ───────────────────────────────────────────────────────────────
const StatsGrid = ({ students, totalSoal }) => {
  const total   = students.length;
  const selesai = students.filter(s => s.waktu_selesai).length;
  const proses  = students.filter(s => s.is_login && !s.waktu_selesai).length;
  const belum   = total - selesai - proses;
  const lag     = students.filter(s => s.is_login && !s.waktu_selesai && isStudentOffline(s.last_update)).length;
  const nilaiArr= students.filter(s => s.waktu_selesai).map(s => calcNilai(s.skor)).filter(n => n !== null);
  const avgNilai= nilaiArr.length ? Math.round(nilaiArr.reduce((a,b) => a+b, 0) / nilaiArr.length) : null;
  const pctDone = total > 0 ? Math.round((selesai / total) * 100) : 0;

  const items = [
    { label: 'Mengerjakan', value: proses,         sub: lag > 0 ? `${lag} delay` : 'aktif',   color: 'text-blue-600',    bg: 'bg-blue-50',    accent: 'border-b-blue-500',    Icon: Loader2 },
    { label: 'Selesai',     value: selesai,        sub: `${pctDone}% tuntas`,                  color: 'text-emerald-600', bg: 'bg-emerald-50', accent: 'border-b-emerald-500', Icon: CheckCircle2 },
    { label: 'Belum Login', value: belum,          sub: `dari ${total} siswa`,                 color: 'text-amber-600',   bg: 'bg-amber-50',   accent: 'border-b-amber-500',   Icon: UserMinus },
    { label: 'Rata-Rata',   value: avgNilai ?? '—',sub: 'nilai ujian',                         color: 'text-purple-600',  bg: 'bg-purple-50',  accent: 'border-b-purple-500',  Icon: TrendingUp },
    { label: 'Total Siswa', value: total,          sub: `kelas ${students[0]?.class ?? '?'}`,  color: 'text-slate-700',   bg: 'bg-slate-50',   accent: 'border-b-slate-400',   Icon: Users },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 px-3 sm:px-4 pt-3 sm:pt-4">
      {items.map(({ label, value, sub, color, bg, accent, Icon }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className={`${bg} ${accent} border border-black/5 border-b-2 rounded-2xl p-3 sm:p-4 flex justify-between items-center`}
        >
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{label}</p>
            <p className={`text-2xl sm:text-3xl font-black leading-none ${color}`}>{value}</p>
            <p className="text-[9px] text-slate-400 mt-1 truncate">{sub}</p>
          </div>
          <Icon size={22} className={`${color} opacity-15 shrink-0`} />
        </motion.div>
      ))}
    </div>
  );
};

// ─── STUDENT CARD ─────────────────────────────────────────────────────────────
const StudentCard = ({ s, totalSoal, onReset, onViewDetail }) => {
  const isDone   = !!s.waktu_selesai;
  const isLag    = s.is_login && !isDone && isStudentOffline(s.last_update);
  const progress = totalSoal > 0 ? Math.round((s.soal_terjawab / totalSoal) * 100) : 0;
  const nilai    = calcNilai(s.skor);
  const grade    = getGrade(nilai);
  const hasPelanggaran = s._hasPelanggaran ?? false;

  const cardStyle = !s.is_login
    ? 'border-dashed border-slate-200 bg-slate-50/50 opacity-60'
    : hasPelanggaran
      ? 'border-rose-400 bg-rose-50/60 shadow-sm shadow-rose-200'
      : isDone
        ? 'border-emerald-200 bg-emerald-50/60'
        : isLag
          ? 'border-amber-300 bg-amber-50/60'
          : 'border-blue-100 bg-white shadow-sm shadow-blue-900/5';

  const barColor = isDone ? 'bg-emerald-500' : isLag ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <motion.div layout className={`relative rounded-2xl p-3 sm:p-4 border-2 transition-colors ${cardStyle}`}>
      <div className={`absolute top-0 left-3 right-3 h-0.5 rounded-full ${hasPelanggaran ? 'bg-rose-500' : isDone ? 'bg-emerald-400' : isLag ? 'bg-amber-400' : s.is_login ? 'bg-blue-400' : 'bg-slate-300'}`} />

      <div className="flex justify-between items-start mb-2 mt-1">
        <StatusBadge is_login={s.is_login} isDone={isDone} isLag={isLag} />
        <div className="flex items-center gap-1.5">
          {s.is_login && (
            <button onClick={() => onViewDetail(s)} className="text-slate-300 hover:text-emerald-500 transition-colors" title="Detail">
              <Eye size={12} />
            </button>
          )}
          <span className="text-[9px] font-mono text-slate-300">{s.nisn?.slice(-5)}</span>
        </div>
      </div>

      <h3 className="font-black text-[12px] sm:text-[13px] text-slate-800 leading-tight mb-2 sm:mb-3 line-clamp-2 uppercase min-h-[2rem]">{s.name}</h3>

      <div className="mb-2 sm:mb-3">
        <div className="flex justify-between text-[9px] sm:text-[10px] mb-1">
          <span className="text-slate-400 font-semibold flex items-center gap-1"><Trophy size={8}/>Progres</span>
          <span className={`font-bold ${isDone ? 'text-emerald-600' : 'text-blue-600'}`}>{progress}%</span>
        </div>
        <div className="h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }}
            className={`h-full rounded-full ${barColor}`}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-400">{s.soal_terjawab}/{totalSoal}</span>
          {s.last_update && <span className="text-[9px] text-slate-400 font-mono">{formatTime(s.last_update)}</span>}
        </div>
      </div>

      {isDone && nilai !== null && (
        <div className="flex items-center justify-between mb-2 bg-emerald-100/60 rounded-xl px-2.5 py-1.5">
          <span className="text-[10px] text-emerald-700 font-bold">Nilai</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm sm:text-base font-black text-emerald-700">{nilai}</span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${gradeChip(grade)}`}>{grade}</span>
          </div>
        </div>
      )}

      <button
        disabled={!s.is_login}
        onClick={() => onReset(s.id_hasil, s.name)}
        className={`w-full py-1.5 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase flex items-center justify-center gap-1 border transition-all ${
          s.is_login
            ? 'border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300'
            : 'border-transparent text-slate-200 cursor-not-allowed'
        }`}
      >
        <RefreshCcw size={10}/> Reset Login
      </button>
    </motion.div>
  );
};

// ─── MODAL DETAIL SISWA ───────────────────────────────────────────────────────
const StudentDetailModal = ({ student, totalSoal, onClose }) => {
  if (!student) return null;
  const isDone   = !!student.waktu_selesai;
  const nilai    = calcNilai(student.skor);
  const grade    = getGrade(nilai);
  const progress = totalSoal > 0 ? Math.round((student.soal_terjawab / totalSoal) * 100) : 0;
  const benar    = isDone && nilai !== null ? Math.round((student.skor / 100) * totalSoal) : null;
  const salah    = isDone && benar !== null ? totalSoal - benar : null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-3xl border border-black/8 shadow-2xl w-full sm:max-w-md overflow-hidden"
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className={`p-4 sm:p-5 ${isDone ? 'bg-emerald-950' : 'bg-blue-950'}`}>
          <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${isDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'}`}>
              {isDone ? '✓ Selesai' : '⟳ Sedang Ujian'}
            </span>
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors p-1"><X size={16}/></button>
          </div>
          <h2 className="font-black text-white text-base sm:text-lg uppercase leading-tight">{student.name}</h2>
          <p className="text-[10px] text-white/40 mt-1 font-mono">{student.username} · NISN {student.nisn}</p>
          {isDone && nilai !== null && (
            <div className="flex items-end gap-3 mt-3">
              <div>
                <p className="text-[10px] text-white/40 uppercase">Nilai</p>
                <p className="text-4xl sm:text-5xl font-black text-white leading-none">{nilai}</p>
              </div>
              <span className={`text-lg sm:text-xl font-black px-3 py-1 rounded-xl mb-1 ${
                grade === 'A' ? 'bg-emerald-500 text-white' : grade === 'B' ? 'bg-blue-500 text-white' :
                grade === 'C' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
              }`}>{grade}</span>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[50vh] sm:max-h-none overflow-y-auto">
          <div>
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-slate-500 font-semibold">Progres</span>
              <span className="font-bold text-slate-700">{progress}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }}
                className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-blue-500'}`}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{student.soal_terjawab} dari {totalSoal} soal</p>
          </div>

          {isDone && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Benar', value: benar ?? '—', cls: 'text-emerald-600 bg-emerald-50' },
                { label: 'Salah', value: salah ?? '—', cls: 'text-rose-600 bg-rose-50' },
                { label: 'Skor',  value: student.skor ? Math.round(student.skor) : '—', cls: 'text-blue-600 bg-blue-50' },
              ].map(({ label, value, cls }) => (
                <div key={label} className={`${cls} rounded-xl p-2.5 sm:p-3 text-center`}>
                  <p className="text-[10px] text-slate-400 font-semibold">{label}</p>
                  <p className={`text-xl sm:text-2xl font-black leading-none mt-0.5 ${cls.split(' ')[0]}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t border-black/5 pt-3">
            {[
              { label: 'Status Login',    value: student.is_login ? 'Online' : 'Offline' },
              { label: 'Selesai Pukul',   value: formatTime(student.waktu_selesai) },
              { label: 'Update Terakhir', value: formatTime(student.last_update) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-[11px] sm:text-[12px]">
                <span className="text-slate-400">{label}</span>
                <span className="font-semibold text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── NOTIF PANEL ─────────────────────────────────────────────────────────────
const NotifPanel = ({ notifications, onClear, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: -8, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -8, scale: 0.96 }}
    className="absolute top-full right-2 sm:right-4 mt-2 w-[90vw] sm:w-80 bg-white rounded-2xl border border-black/8 shadow-xl z-50 overflow-hidden"
  >
    <div className="flex items-center justify-between px-4 py-3 border-b border-black/6">
      <p className="text-[11px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-2"><Bell size={12}/> Notifikasi</p>
      <div className="flex gap-2">
        {notifications.length > 0 && <button onClick={onClear} className="text-[10px] text-slate-400 hover:text-rose-500 font-bold transition-colors">Hapus</button>}
        <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors"><X size={12}/></button>
      </div>
    </div>
    <div className="max-h-64 overflow-y-auto">
      {notifications.length === 0
        ? <p className="text-center text-[12px] text-slate-400 py-6">Tidak ada notifikasi</p>
        : notifications.map((n, i) => (
          <div key={i} className={`px-4 py-2.5 border-b border-black/4 last:border-0 ${
            n.type === 'pelanggaran' ? 'bg-rose-50 border-l-2 border-rose-400' : n.type === 'done' ? 'bg-emerald-50/60' : n.type === 'lag' ? 'bg-amber-50/60' : 'bg-blue-50/60'
          }`}>
            <p className="text-[11px] font-bold text-slate-700">{n.title}</p>
            <p className="text-[10px] text-slate-400">{n.msg}</p>
            <p className="text-[9px] text-slate-300 mt-0.5 font-mono">{formatTime(n.at)}</p>
          </div>
        ))
      }
    </div>
  </motion.div>
);

// ─── TAB NILAI ────────────────────────────────────────────────────────────────
const TabNilai = ({ students, session, totalSoal }) => {
  const [sortBy,  setSortBy]  = useState('nilai');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => sortBy !== col
    ? <ChevronUp size={10} className="text-slate-300"/>
    : sortDir === 'asc' ? <ChevronUp size={10} className="text-emerald-500"/> : <ChevronDown size={10} className="text-emerald-500"/>;

  const selesai = students.filter(s => s.waktu_selesai).map(s => ({ ...s, nilai: calcNilai(s.skor) }));
  const rest    = students.filter(s => !s.waktu_selesai);

  const sortedSelesai = [...selesai].sort((a, b) => {
    let va = a[sortBy === 'nilai' ? 'nilai' : sortBy] ?? -1;
    let vb = b[sortBy === 'nilai' ? 'nilai' : sortBy] ?? -1;
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    return sortDir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
  });

  const all  = [...sortedSelesai, ...rest];
  let rank   = 0;

  return (
    <div className="px-3 sm:px-4 pb-8">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <p className="text-sm font-black text-slate-700 uppercase tracking-tight">
          Rekap — <span className="text-emerald-600">{session.mapel} Kelas {session.kelas}</span>
        </p>
        <p className="text-[11px] text-slate-400">{selesai.length}/{students.length} selesai</p>
      </div>
      <div className="bg-white rounded-2xl border border-black/5 overflow-auto shadow-sm">
        <table className="w-full text-[11px] sm:text-[12px] min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-black/5">
              {[
                { key: '#',       label: '#',        sortable: false },
                { key: 'name',    label: 'Nama',     sortable: true },
                { key: 'username',label: 'Username', sortable: true },
                { key: 'benar',   label: 'Benar',    sortable: false },
                { key: 'salah',   label: 'Salah',    sortable: false },
                { key: 'nilai',   label: 'Nilai',    sortable: true },
                { key: 'grade',   label: 'Grade',    sortable: false },
                { key: 'selesai', label: 'Selesai',  sortable: false },
                { key: 'status',  label: 'Status',   sortable: false },
              ].map(col => (
                <th key={col.key} onClick={() => col.sortable && handleSort(col.key)}
                  className={`px-2 sm:px-3 py-2.5 text-left text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-slate-600 select-none' : ''}`}>
                  <span className="flex items-center gap-1">{col.label}{col.sortable && <SortIcon col={col.key}/>}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {all.map((s) => {
              const isDone = !!s.waktu_selesai;
              const n    = isDone ? calcNilai(s.skor) : null;
              const g    = getGrade(n);
              const benar = isDone && n !== null ? Math.round((s.skor / 100) * totalSoal) : null;
              const salah = isDone && benar !== null ? totalSoal - benar : null;
              if (isDone) rank++;
              return (
                <tr key={s.id} className="border-b border-black/4 hover:bg-slate-50/80 transition-colors">
                  <td className="px-2 sm:px-3 py-2">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black ${
                      !isDone ? 'bg-slate-100 text-slate-400' :
                      rank === 1 ? 'bg-amber-100 text-amber-700' :
                      rank === 2 ? 'bg-slate-200 text-slate-600' :
                      rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                    }`}>{isDone ? rank : '—'}</span>
                  </td>
                  <td className="px-2 sm:px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{s.name}</td>
                  <td className="px-2 sm:px-3 py-2 font-mono text-slate-500">{s.username}</td>
                  <td className="px-2 sm:px-3 py-2 text-center font-bold text-emerald-600">{benar ?? '—'}</td>
                  <td className="px-2 sm:px-3 py-2 text-center font-bold text-rose-500">{salah ?? '—'}</td>
                  <td className="px-2 sm:px-3 py-2 text-center">
                    {n !== null ? <span className="font-black text-slate-800">{n}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2 sm:px-3 py-2 text-center">
                    {g ? <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${gradeChip(g)}`}>{g}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2 sm:px-3 py-2 font-mono text-slate-500 whitespace-nowrap">{formatTime(s.waktu_selesai)}</td>
                  <td className="px-2 sm:px-3 py-2">
                    {isDone
                      ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ Selesai</span>
                      : s.is_login
                        ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">⟳ Ujian</span>
                        : <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">● Offline</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {all.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">Belum ada data siswa</div>}
      </div>
    </div>
  );
};

// ─── TAB STATISTIK ────────────────────────────────────────────────────────────
const TabStats = ({ students, totalSoal }) => {
  const selesai    = students.filter(s => s.waktu_selesai);
  const aktif      = students.filter(s => s.is_login);
  const inProgress = students.filter(s => s.is_login && !s.waktu_selesai);
  const kehadiran  = students.length > 0 ? Math.round((aktif.length / students.length) * 100) : 0;
  const nilaiArr   = selesai.map(s => calcNilai(s.skor)).filter(n => n !== null);
  const avgNilai   = nilaiArr.length ? Math.round(nilaiArr.reduce((a,b) => a+b, 0) / nilaiArr.length) : 0;
  const maxNilai   = nilaiArr.length ? Math.max(...nilaiArr) : 0;
  const minNilai   = nilaiArr.length ? Math.min(...nilaiArr) : 0;
  const lulus      = nilaiArr.filter(n => n >= 65).length;
  const pctLulus   = nilaiArr.length ? Math.round((lulus / nilaiArr.length) * 100) : 0;
  const dist       = { A: 0, B: 0, C: 0, D: 0 };
  nilaiArr.forEach(n => { dist[getGrade(n)]++; });

  return (
    <div className="px-3 sm:px-4 pb-8 space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Kehadiran',     value: `${kehadiran}%`,  color: 'text-emerald-600' },
          { label: 'Rata-Rata',     value: avgNilai || '—',  color: 'text-blue-600' },
          { label: 'Tertinggi',     value: maxNilai || '—',  color: 'text-purple-600' },
          { label: 'Tingkat Lulus', value: `${pctLulus}%`,   color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-black/5 p-3 sm:p-4 shadow-sm">
            <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">{label}</p>
            <p className={`text-2xl sm:text-3xl font-black leading-none ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-4">Distribusi Grade</p>
          <div className="flex gap-3">
            {[
              { g:'A', count: dist.A, color:'bg-emerald-500', text:'text-emerald-600', range:'90-100' },
              { g:'B', count: dist.B, color:'bg-blue-500',    text:'text-blue-600',    range:'80-89' },
              { g:'C', count: dist.C, color:'bg-amber-500',   text:'text-amber-600',   range:'65-79' },
              { g:'D', count: dist.D, color:'bg-rose-500',    text:'text-rose-600',    range:'<65' },
            ].map(({ g, count, color, text, range }) => (
              <div key={g} className="flex-1 text-center">
                <div className="bg-slate-100 rounded-xl h-20 sm:h-24 flex items-end overflow-hidden mb-2">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: selesai.length > 0 ? `${Math.round((count / selesai.length) * 100)}%` : '0%' }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className={`w-full ${color} rounded-t-lg`}
                  />
                </div>
                <p className={`text-base sm:text-lg font-black ${text}`}>{g}</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400">{count} siswa</p>
                <p className="text-[9px] text-slate-300">{range}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-4">Rentang Nilai</p>
          {nilaiArr.length === 0
            ? <p className="text-sm text-slate-400 text-center py-6">Belum ada nilai</p>
            : (
              <div className="space-y-3">
                {[
                  { label:'Tertinggi', value: maxNilai, color:'bg-emerald-500', pct: 100 },
                  { label:'Rata-rata', value: avgNilai, color:'bg-blue-500',    pct: Math.round((avgNilai/100)*100) },
                  { label:'Terendah',  value: minNilai, color:'bg-rose-500',    pct: Math.round((minNilai/100)*100) },
                ].map(({ label, value, color, pct }) => (
                  <div key={label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-black text-slate-700">{value}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                        className={`h-full rounded-full ${color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-4">
          Progres Real-Time ({inProgress.length} aktif)
        </p>
        {inProgress.length === 0
          ? <p className="text-sm text-slate-400 text-center py-4">Tidak ada siswa yang sedang ujian</p>
          : (
            <div className="space-y-2.5">
              {[...inProgress].sort((a,b) => b.soal_terjawab - a.soal_terjawab).map(s => {
                const pct = totalSoal > 0 ? Math.round((s.soal_terjawab / totalSoal) * 100) : 0;
                const lag = isStudentOffline(s.last_update);
                return (
                  <div key={s.id} className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${lag ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                    <p className="text-[10px] sm:text-[11px] text-slate-600 w-24 sm:w-28 truncate shrink-0">{s.name}</p>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        animate={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${lag ? 'bg-amber-500' : 'bg-blue-500'}`}
                      />
                    </div>
                    <p className="text-[10px] sm:text-[11px] font-mono text-slate-500 w-8 text-right shrink-0">{pct}%</p>
                    <p className="text-[9px] sm:text-[10px] text-slate-300 w-12 text-right shrink-0 font-mono">{s.soal_terjawab}/{totalSoal}</p>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
};

// ─── KOMPONEN UTAMA ───────────────────────────────────────────────────────────
const Monitoring = ({ session, onLogout }) => {
  const [students,        setStudents]        = useState([]);
  const [search,          setSearch]          = useState('');
  const [filter,          setFilter]          = useState('all');
  const [activeTab,       setActiveTab]       = useState('monitor');
  const [dbStatus,        setDbStatus]        = useState('connecting');
  const [lastSync,        setLastSync]        = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [notifications,   setNotifications]  = useState([]);
  const [showNotif,       setShowNotif]       = useState(false);
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [soundEnabled,    setSoundEnabled]    = useState(true);
  const [notifGranted,    setNotifGranted]    = useState(
    typeof window !== 'undefined' && window.Notification?.permission === 'granted'
  );
  const prevStudentsRef  = useRef({});
  const notifRef         = useRef(null);
  const soundEnabledRef  = useRef(true);

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    requestNotifPermission().then(granted => setNotifGranted(granted));
    const unlock = () => { getAudioCtx(); document.removeEventListener('click', unlock); };
    document.addEventListener('click', unlock);
    return () => document.removeEventListener('click', unlock);
  }, []);

  const totalSoal = useMemo(() => {
    const fromData = students.find(s => s.total_soal > 0);
    return fromData?.total_soal ?? session.totalSoal ?? 40;
  }, [students, session.totalSoal]);

  // ── NOTIFIKASI ──────────────────────────────────────────────────────────────
  const addNotif = useCallback((notif) => {
    setNotifications(prev => [{ ...notif, at: new Date() }, ...prev].slice(0, 50));
  }, []);

  const checkChanges = useCallback((newStudents) => {
    const prev = prevStudentsRef.current;
    const isInitial = Object.keys(prev).length === 0;

    newStudents.forEach(s => {
      const p = prev[s.id];

      // ── Siswa baru login / online ──────────────────────────────────────────
      if (p && !p.is_login && s.is_login) {
        addNotif({ type: 'login', title: `✅ ${s.name} Online`, msg: 'Siswa mulai mengerjakan ujian' });
        if (!isInitial) {
          if (soundEnabledRef.current) soundOnline();
          showBrowserNotif('Siswa Online 🟢', `${s.name} mulai mengerjakan ujian`, `online-${s.id}`);
        }
      }

      // ── Siswa logout / offline ─────────────────────────────────────────────
      if (p && p.is_login && !s.is_login && !s.waktu_selesai) {
        addNotif({ type: 'lag', title: `🔴 ${s.name} Offline`, msg: 'Siswa keluar / koneksi terputus' });
        if (!isInitial) {
          if (soundEnabledRef.current) soundOffline();
          showBrowserNotif('Siswa Offline 🔴', `${s.name} keluar atau koneksi terputus`, `offline-${s.id}`);
        }
      }

      // ── Siswa selesai ujian ────────────────────────────────────────────────
      if (p && !p.waktu_selesai && s.waktu_selesai) {
        const nilai = calcNilai(s.skor);
        addNotif({ type: 'done', title: `🏆 ${s.name} Selesai`, msg: `Nilai: ${nilai ?? '—'}` });
        if (!isInitial) {
          if (soundEnabledRef.current) soundSelesai();
          showBrowserNotif('Ujian Selesai 🏆', `${s.name} — Nilai: ${nilai ?? '—'}`, `done-${s.id}`);
        }
      }

      // ── Siswa delay / offline (last_update > 2 menit) ─────────────────────
      if (p && p.is_login && !p.waktu_selesai && !isStudentOffline(p.last_update) && isStudentOffline(s.last_update)) {
        addNotif({ type: 'lag', title: `⚠️ ${s.name} Tidak Responsif`, msg: 'Tidak ada respons lebih dari 2 menit' });
        if (!isInitial) {
          if (soundEnabledRef.current) soundOffline();
          showBrowserNotif('Siswa Delay ⚠️', `${s.name} tidak responsif 2 menit`, `lag-${s.id}`);
        }
      }

      // ── Deteksi pelanggaran: jawaban_user berkurang ────────────────────────
      if (p && s.is_login && !s.waktu_selesai) {
        const prevJawab = Object.keys(p.jawaban_user ?? {}).length;
        const currJawab = Object.keys(s.jawaban_user ?? {}).length;
        if (!isInitial && currJawab < prevJawab && prevJawab > 0) {
          addNotif({
            type: 'pelanggaran',
            title: `🚨 ${s.name} — PELANGGARAN!`,
            msg: `Jawaban berkurang ${prevJawab} → ${currJawab} (kemungkinan manipulasi)`
          });
          if (soundEnabledRef.current) soundPelanggaran();
          showBrowserNotif('⛔ PELANGGARAN', `${s.name}: jawaban berkurang ${prevJawab}→${currJawab}`, `plg-${s.id}`);
        }
      }
    });

    const map = {};
    newStudents.forEach(s => { map[s.id] = s; });
    prevStudentsRef.current = map;
  }, [addNotif]);

  // ── FORCE LOGOUT ────────────────────────────────────────────────────────────
  const forceLogout = useCallback((msg) => {
    localStorage.removeItem('min2_session');
    Swal.fire({
      title: 'Akses Dicabut',
      text: msg,
      icon: 'warning',
      confirmButtonText: 'Kembali ke Login',
      allowOutsideClick: false,
      confirmButtonColor: '#15803d',
    }).then(() => onLogout());
  }, [onLogout]);

  // ── FETCH SISWA ─────────────────────────────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    try {
      // ✅ FIX: Ambil is_online & last_seen dari tabel students
      const { data: daftarSiswa, error: errSiswa } = await supabase
        .from('students')
        .select('id, name, nisn, username, class, is_online, last_seen')
        .eq('class', session.kelas)
        .order('name', { ascending: true });
      if (errSiswa) throw errSiswa;

      const { data: hasilUjian, error: errHasil } = await supabase
        .from('hasil_ujian')
        .select('id, jadwal_id, mapel, soal_terjawab, total_soal, jawaban_user, skor, waktu_selesai, user_id, updated_at')
        .eq('jadwal_id', session.jadwalId);
      if (errHasil) throw errHasil;

      const combined = (daftarSiswa || []).map(siswa => {
        const hasil = (hasilUjian || []).find(h => String(h.user_id) === String(siswa.id));
        return {
          ...siswa,
          id_hasil:      hasil?.id             ?? null,
          soal_terjawab: hasil?.soal_terjawab  ?? 0,
          total_soal:    hasil?.total_soal     ?? session.totalSoal ?? 40,
          skor:          hasil?.skor           ?? null,
          waktu_selesai: hasil?.waktu_selesai  ?? null,
          // ✅ FIX: Gunakan last_seen dari students sebagai last_update
          last_update:   siswa.last_seen       ?? hasil?.updated_at ?? null,
          jawaban_user:  hasil?.jawaban_user   ?? {},
          // ✅ FIX: is_login dari is_online di tabel students
          is_login:      siswa.is_online === true,
        };
      });

      checkChanges(combined);
      setStudents(combined);
      setDbStatus('ok');
      setLastSync(new Date());
    } catch (err) {
      console.error('fetchStudents error:', err);
      setDbStatus('error');
    }
  }, [session, checkChanges]);

  // ── REALTIME SUPABASE ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchStudents();

    // 1. ✅ FIX: Realtime students — deteksi is_online & last_seen berubah
    const studentsSub = supabase
      .channel('monitor_students')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'students',
        filter: `class=eq.${session.kelas}`
      }, fetchStudents)
      .subscribe();

    // 2. Realtime hasil_ujian — deteksi progres & selesai
    const realtimeSub = supabase
      .channel('monitor_hasil_ujian')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hasil_ujian'
      }, fetchStudents)
      .subscribe();

    // 3. Realtime app_config — jika proctor_access jadi FALSE → force logout
    const configSub = supabase
      .channel('monitor_app_config')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'app_config',
        filter: 'setting_key=eq.proctor_access'
      }, (payload) => {
        if (payload.new?.status === false) {
          forceLogout('Akses monitoring telah ditutup oleh Admin Pusat.');
        }
      })
      .subscribe();

    // 4. Realtime jadwal_ujian — jika status bukan aktif → force logout
    const jadwalSub = supabase
      .channel('monitor_jadwal_ujian')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'jadwal_ujian',
        filter: `id=eq.${session.jadwalId}`
      }, (payload) => {
        if (payload.new?.status !== 'aktif') {
          forceLogout('Sesi ujian ini telah dinonaktifkan oleh Admin.');
        }
      })
      .subscribe();

    // 5. Realtime tabel pengawas — jika is_active jadi FALSE → force logout
    const pengawasSub = supabase
      .channel('monitor_pengawas')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'pengawas',
        filter: `token=eq.${session.token}`
      }, (payload) => {
        if (payload.new?.is_active === false) {
          forceLogout('Akun pengawas Anda telah dinonaktifkan oleh Admin.');
        }
      })
      .subscribe();

    // 6. Auto-refresh fallback 30 detik
    const autoRefresh = setInterval(fetchStudents, REFRESH_INTERVAL_MS);

    return () => {
      supabase.removeChannel(studentsSub);   // ✅ FIX: cleanup students subscription
      supabase.removeChannel(realtimeSub);
      supabase.removeChannel(configSub);
      supabase.removeChannel(jadwalSub);
      supabase.removeChannel(pengawasSub);
      clearInterval(autoRefresh);
    };
  }, [fetchStudents, session.jadwalId, session.token, session.kelas, forceLogout]);

  // ── Tutup notif & sidebar saat klik luar ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── RESET SESI SISWA ────────────────────────────────────────────────────────
  const handleReset = async (idHasil, name) => {
    const res = await Swal.fire({
      title: 'Reset Sesi?',
      text: `Siswa ${name} akan bisa login kembali. Jawaban tidak hilang.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Reset',
      cancelButtonText: 'Batal',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'bg-emerald-600 text-white font-bold uppercase px-5 py-2.5 rounded-xl mx-1.5 text-sm',
        cancelButton:  'bg-slate-500 text-white font-bold uppercase px-5 py-2.5 rounded-xl mx-1.5 text-sm',
      },
    });
    if (res.isConfirmed && idHasil) {
      const { error } = await supabase.from('hasil_ujian').update({ waktu_selesai: null }).eq('id', idHasil);
      if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
      } else {
        fetchStudents();
        addNotif({ type: 'login', title: `${name} Direset`, msg: 'Sesi ujian berhasil direset oleh pengawas' });
        Swal.fire({ icon: 'success', title: 'Berhasil direset', timer: 1200, showConfirmButton: false });
      }
    }
  };

  // ── LOGOUT MANUAL ───────────────────────────────────────────────────────────
  const handleLogout = async () => {
    const res = await Swal.fire({
      title: 'Keluar?', text: 'Sesi monitoring Anda akan diakhiri.', icon: 'question',
      showCancelButton: true, confirmButtonText: 'Ya, Keluar', cancelButtonText: 'Batal',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'bg-rose-600 text-white font-bold uppercase px-5 py-2.5 rounded-xl mx-1.5 text-sm',
        cancelButton:  'bg-slate-500 text-white font-bold uppercase px-5 py-2.5 rounded-xl mx-1.5 text-sm',
      },
    });
    if (res.isConfirmed) {
      localStorage.removeItem('min2_session');
      onLogout();
    }
  };

  // ── FILTER SISWA ────────────────────────────────────────────────────────────
  const pelanggaranNames = useMemo(() =>
    new Set(notifications.filter(n => n.type === 'pelanggaran').map(n => n.title.split(' — ')[0].replace('🚨 ', ''))),
    [notifications]
  );

  const filtered = useMemo(() => {
    return students.map(s => ({ ...s, _hasPelanggaran: pelanggaranNames.has(s.name) })).filter(s => {
      const q = search.toLowerCase();
      const matchSearch = s.name?.toLowerCase().includes(q) || s.username?.toLowerCase().includes(q) || s.nisn?.includes(q);
      if (filter === 'done')    return matchSearch && !!s.waktu_selesai;
      if (filter === 'process') return matchSearch && s.is_login && !s.waktu_selesai;
      if (filter === 'offline') return matchSearch && !s.is_login;
      if (filter === 'lag')     return matchSearch && s.is_login && !s.waktu_selesai && isStudentOffline(s.last_update);
      if (filter === 'plg')     return matchSearch && notifications.some(n => n.type === 'pelanggaran' && n.title.includes(s.name));
      return matchSearch;
    });
  }, [students, search, filter, pelanggaranNames, notifications]);

  const FILTERS = [
    { key: 'all',     label: 'Semua',   count: students.length },
    { key: 'process', label: 'Ujian',   count: students.filter(s => s.is_login && !s.waktu_selesai).length },
    { key: 'done',    label: 'Selesai', count: students.filter(s => s.waktu_selesai).length },
    { key: 'offline', label: 'Offline', count: students.filter(s => !s.is_login).length },
    { key: 'lag',     label: 'Delay',   count: students.filter(s => s.is_login && !s.waktu_selesai && isStudentOffline(s.last_update)).length },
    { key: 'plg',     label: '🚨 Pelanggaran', count: notifications.filter(n => n.type === 'pelanggaran').length },
  ];

  const TABS = [
    { key: 'monitor', label: 'Monitor',   Icon: MonitorIcon },
    { key: 'nilai',   label: 'Nilai',     Icon: FileText },
    { key: 'stats',   label: 'Statistik', Icon: BarChart3 },
  ];

  const unreadNotif = notifications.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">

      {/* ── HEADER ── */}
      <header className="bg-emerald-950 text-emerald-50 px-3 sm:px-5 py-2.5 sm:py-3 flex justify-between items-center border-b border-emerald-800/60 sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            className="sm:hidden w-8 h-8 flex items-center justify-center rounded-xl text-emerald-400 hover:bg-emerald-800 transition-colors"
            onClick={() => setSidebarOpen(v => !v)}
          >
            {sidebarOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>

          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center font-black text-emerald-400 text-base sm:text-lg select-none shrink-0">A</div>
          <div className="min-w-0">
            <p className="font-black text-sm sm:text-base leading-none tracking-tight truncate">
              AONE <span className="text-emerald-400">Smart</span> CBT
            </p>
            <p className="text-[9px] sm:text-[10px] text-emerald-500 mt-0.5 truncate">MIN 2 Sarolangun · Pengawas</p>
            <div className="hidden sm:flex gap-1.5 mt-1">
              <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-md font-bold text-emerald-300 uppercase">{session.mapel}</span>
              <span className="text-[9px] bg-white/8 border border-white/15 px-2 py-0.5 rounded-md font-bold text-emerald-200 uppercase">Kelas {session.kelas}</span>
              <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase flex items-center gap-1 ${dbStatus === 'ok' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${dbStatus === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}/>
                {dbStatus === 'ok' ? `Sync ${lastSync ? formatTime(lastSync) : ''}` : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden md:block text-right pr-3 border-r border-emerald-800">
            <p className="text-[9px] text-emerald-500 uppercase tracking-widest">Token</p>
            <p className="text-base sm:text-xl font-mono font-bold tracking-widest text-white">{session.token}</p>
          </div>

          {/* Toggle Suara */}
          <button
            onClick={() => setSoundEnabled(v => !v)}
            title={soundEnabled ? 'Matikan Suara' : 'Nyalakan Suara'}
            className={`relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition-all ${soundEnabled ? 'border-emerald-700 text-emerald-400 bg-emerald-800/50' : 'border-emerald-900 text-emerald-700 hover:bg-emerald-900'}`}
          >
            {soundEnabled
              ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            }
          </button>

          {/* Toggle Notifikasi Browser */}
          <button
            onClick={() => requestNotifPermission().then(g => { setNotifGranted(g); })}
            title={notifGranted ? 'Notifikasi browser aktif' : 'Klik untuk izinkan notifikasi browser'}
            className={`relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition-all ${notifGranted ? 'border-blue-700 text-blue-400 bg-blue-900/30' : 'border-emerald-900 text-emerald-700 hover:bg-emerald-900'}`}
          >
            <Bell size={13}/>
            {!notifGranted && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full"/>}
          </button>

          {/* Notifikasi Panel */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotif(v => !v)}
              className={`relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition-all ${showNotif ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'border-emerald-800 text-emerald-400 hover:bg-emerald-800'}`}
            >
              {notifications.some(n => n.type === 'pelanggaran')
                ? <AlertTriangle size={14} className="text-rose-400"/>
                : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              }
              {unreadNotif > 0 && (
                <span className={`absolute -top-1 -right-1 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ${notifications.some(n => n.type === 'pelanggaran') ? 'bg-rose-500 animate-pulse' : 'bg-emerald-600'}`}>
                  {unreadNotif > 9 ? '9+' : unreadNotif}
                </span>
              )}
            </button>
            <AnimatePresence>
              {showNotif && (
                <NotifPanel
                  notifications={notifications}
                  onClear={() => setNotifications([])}
                  onClose={() => setShowNotif(false)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Export */}
          <button
            onClick={() => exportToCSV(students, session, totalSoal)}
            className="flex items-center gap-1 sm:gap-1.5 bg-emerald-800 hover:bg-emerald-700 active:scale-95 transition-all text-emerald-200 text-[9px] sm:text-[10px] font-bold px-2 sm:px-3 py-2 rounded-xl border border-emerald-700"
          >
            <Download size={12}/>
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 sm:gap-2 bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all text-white text-[9px] sm:text-[11px] font-bold px-2 sm:px-4 py-2 rounded-xl border border-rose-500/50"
          >
            <span className="hidden sm:inline">Keluar</span>
            <LogOut size={13}/>
          </button>
        </div>
      </header>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 sm:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.nav
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-56 bg-emerald-950 z-50 sm:hidden flex flex-col pt-4 pb-6 border-r border-emerald-900/60"
            >
              <div className="px-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center font-black text-emerald-400">A</div>
                  <div>
                    <p className="font-black text-white text-sm">AONE Smart CBT</p>
                    <p className="text-[9px] text-emerald-500">Kelas {session.kelas} · {session.mapel}</p>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-emerald-900/50 rounded-xl">
                  <p className="text-[9px] text-emerald-500 uppercase">Token Aktif</p>
                  <p className="font-mono font-black text-white tracking-widest">{session.token}</p>
                </div>
              </div>

              <div className="flex-1 px-2 space-y-1">
                {TABS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => { setActiveTab(key); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm font-bold ${
                      activeTab === key ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={18}/> {label}
                  </button>
                ))}
              </div>

              <div className="px-4 mt-4">
                <div className={`flex items-center gap-2 text-[10px] font-bold ${dbStatus === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${dbStatus === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}/>
                  {dbStatus === 'ok' ? 'Realtime Aktif' : 'Koneksi Bermasalah'}
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* ── STATUS BAR ── */}
      <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 text-[10px] sm:text-[11px] border-b ${
        dbStatus === 'ok'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : dbStatus === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
      }`}>
        {dbStatus === 'ok' ? <Wifi size={10}/> : <WifiOff size={10}/>}
        <span className="truncate">
          {dbStatus === 'ok'
            ? `Terhubung · ${students.length} siswa · Realtime aktif · Auto-refresh 30s`
            : dbStatus === 'error' ? 'Gagal terhubung ke database.' : 'Menghubungkan...'}
        </span>
        <Activity size={10} className={`shrink-0 ${dbStatus === 'ok' ? 'text-emerald-500 animate-pulse' : ''}`}/>
        <button onClick={fetchStudents} className="ml-auto flex items-center gap-1 font-bold hover:opacity-70 transition-opacity shrink-0">
          <RefreshCcw size={10}/> <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ── TAB BAR (desktop) ── */}
      <div className="hidden sm:flex border-b border-slate-200 bg-white px-4">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wide border-b-2 transition-all ${
              activeTab === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      {/* ── KONTEN UTAMA ── */}
      <div className="flex-1">
        <StatsGrid students={students} totalSoal={totalSoal}/>
        <CountdownTimer session={session}/>

        {/* TAB MONITOR */}
        {activeTab === 'monitor' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 px-3 sm:px-4 py-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                <input
                  type="text"
                  placeholder="Cari nama, username, NISN..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-white border border-black/8 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-slate-700"
                />
              </div>
              <div className="flex bg-white border border-black/8 rounded-xl p-1 gap-1 overflow-x-auto">
                {FILTERS.map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase transition-all flex items-center gap-1 whitespace-nowrap ${
                      filter === key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {label}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${filter === key ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* PELANGGARAN ALERT STRIP */}
            <AnimatePresence>
              {notifications.filter(n => n.type === 'pelanggaran').length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="mx-3 sm:mx-4 mb-2 bg-rose-50 border border-rose-200 rounded-2xl overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-3 py-2 bg-rose-100 border-b border-rose-200">
                    <AlertTriangle size={14} className="text-rose-600 shrink-0"/>
                    <p className="text-[11px] font-black text-rose-700 uppercase tracking-wide">Peringatan Pelanggaran</p>
                    <span className="ml-auto text-[9px] bg-rose-500 text-white font-black px-2 py-0.5 rounded-full">
                      {notifications.filter(n => n.type === 'pelanggaran').length} Kasus
                    </span>
                  </div>
                  <div className="divide-y divide-rose-100 max-h-36 overflow-y-auto">
                    {notifications.filter(n => n.type === 'pelanggaran').map((n, i) => (
                      <div key={i} className="px-3 py-2 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0 animate-pulse"/>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-rose-700">{n.title}</p>
                          <p className="text-[10px] text-rose-500">{n.msg}</p>
                          <p className="text-[9px] text-rose-300 font-mono">{formatTime(n.at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Legend */}
            <div className="flex gap-3 sm:gap-4 px-3 sm:px-4 mb-3 flex-wrap">
              {[
                { dot: 'bg-blue-500 animate-pulse', label: 'Live' },
                { dot: 'bg-emerald-500', label: 'Selesai' },
                { dot: 'bg-amber-500', label: 'Delay' },
                { dot: 'bg-slate-400', label: 'Offline' },
              ].map(({ dot, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-slate-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`}/>
                  {label}
                </div>
              ))}
              <span className="text-[9px] text-slate-300 ml-1">{filtered.length}/{students.length} ditampilkan</span>
            </div>

            {/* Grid kartu */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 px-3 sm:px-4 pb-8">
              <AnimatePresence mode="popLayout">
                {filtered.length === 0
                  ? <div className="col-span-full text-center py-16 text-slate-400 text-sm">Tidak ada siswa ditemukan</div>
                  : filtered.map(s => (
                    <StudentCard
                      key={s.id}
                      s={s}
                      totalSoal={totalSoal}
                      onReset={handleReset}
                      onViewDetail={setSelectedStudent}
                    />
                  ))
                }
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* TAB NILAI */}
        {activeTab === 'nilai' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-4">
            <TabNilai students={students} session={session} totalSoal={totalSoal}/>
          </motion.div>
        )}

        {/* TAB STATISTIK */}
        {activeTab === 'stats' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-4">
            <TabStats students={students} totalSoal={totalSoal}/>
          </motion.div>
        )}
      </div>

      {/* ── BOTTOM NAV (mobile) ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-30 safe-area-inset-bottom">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[9px] font-bold uppercase transition-all ${
              activeTab === key ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            <Icon size={18} className={activeTab === key ? 'text-emerald-600' : 'text-slate-300'}/>
            {label}
          </button>
        ))}
      </div>

      {/* ── MODAL DETAIL ── */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentDetailModal
            student={selectedStudent}
            totalSoal={totalSoal}
            onClose={() => setSelectedStudent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Monitoring;