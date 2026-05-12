import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, MapPin, BookOpen, Bell, BellOff,
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle2,
  Users, Shield, RefreshCw, Info, Lock, Unlock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { usePushNotification } from '../hooks/usePushNotification';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni',
               'Juli','Agustus','September','Oktober','November','Desember'];

function fmtTanggal(d) {
  if (!d) return '-';
  const date = new Date(d);
  return `${HARI[date.getDay()]}, ${date.getDate()} ${BULAN[date.getMonth()]} ${date.getFullYear()}`;
}
function fmtWaktu(t) {
  if (!t) return '-';
  if (typeof t === 'string' && t.includes('T')) {
    // Date object converted to string via toTimeString()
    return t.slice(0, 5);
  }
  return t.slice(0, 5);
}
function fmtWaktuFromDate(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
function fmtDurasi(menit) {
  if (!menit) return '-';
  const h = Math.floor(menit / 60);
  const m = menit % 60;
  if (h > 0 && m > 0) return `${h}j ${m}m`;
  if (h > 0) return `${h} jam`;
  return `${m} menit`;
}
function isToday(d) {
  const today = new Date().toISOString().slice(0, 10);
  return d === today;
}
function isPast(tanggal, waktu_mulai, durasi = 0) {
  const now   = new Date();
  const mulai = new Date(`${tanggal}T${waktu_mulai}`);
  const akhir = new Date(mulai.getTime() + durasi * 60 * 1000);
  return now > akhir;
}
function isBerlangsung(tanggal, waktu_mulai, durasi = 0) {
  const now   = new Date();
  const mulai = new Date(`${tanggal}T${waktu_mulai}`);
  const akhir = new Date(mulai.getTime() + durasi * 60 * 1000);
  return now >= mulai && now <= akhir;
}
function isUpcoming(d, t) {
  const now   = new Date();
  const ujian = new Date(`${d}T${t}`);
  const diff  = ujian - now;
  return diff > 0 && diff <= 24 * 60 * 60 * 1000;
}
/** Token boleh ditampilkan jika hari ini dan ≤ 30 menit sebelum mulai, atau sedang berlangsung */
function isTokenVisible(tanggal, waktu_mulai, durasi) {
  if (!isToday(tanggal)) return false;
  const now      = new Date();
  const mulai    = new Date(`${tanggal}T${waktu_mulai}`);
  // Jika durasi null/0/undefined, anggap ujian tidak pernah selesai (pakai 999 menit)
  const dur      = durasi && durasi > 0 ? durasi : 999;
  const akhir    = new Date(mulai.getTime() + dur * 60 * 1000);
  const msBefore = mulai - now; // positif = belum mulai, negatif = sudah mulai

  // Tampilkan token jika:
  // 1. Sudah mulai DAN belum selesai (berlangsung), ATAU
  // 2. Belum mulai tapi ≤ 30 menit lagi
  const berlangsung = now >= mulai && now <= akhir;
  const segera      = msBefore > 0 && msBefore <= 30 * 60 * 1000;

  return berlangsung || segera;
}

function statusBadge(tanggal, waktu_mulai, durasi = 0) {
  if (isPast(tanggal, waktu_mulai, durasi))
    return { label: 'Selesai',      cls: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',                             dot: 'bg-gray-300 dark:bg-gray-600' };
  if (isBerlangsung(tanggal, waktu_mulai, durasi))
    return { label: 'Berlangsung',  cls: 'bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400',                         dot: 'bg-green-400 animate-pulse' };
  if (isToday(tanggal))
    return { label: 'Hari Ini',     cls: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400',                     dot: 'bg-indigo-400 animate-pulse' };
  if (isUpcoming(tanggal, waktu_mulai))
    return { label: 'Besok',        cls: 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400',                         dot: 'bg-amber-400' };
  return   { label: 'Mendatang',   cls: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400',                  dot: 'bg-emerald-400' };
}

// ─────────────────────────────────────────────
// Notification Toggle Button
// ─────────────────────────────────────────────
function NotifToggle({ subscribed, loading, swReady, onSubscribe, onUnsubscribe }) {
  const supported = 'Notification' in window && 'serviceWorker' in navigator;
  if (!supported) return null;
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={subscribed ? onUnsubscribe : onSubscribe}
      disabled={loading || !swReady}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
        subscribed
          ? 'bg-indigo-500 border-indigo-500 text-white shadow-md shadow-indigo-500/30 hover:bg-indigo-600'
          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {subscribed ? <Bell size={13}/> : <BellOff size={13}/>}
      {loading ? 'Memproses…' : subscribed ? 'Notif Aktif' : 'Aktifkan Notif'}
    </motion.button>
  );
}

// ─────────────────────────────────────────────
// Semua Jadwal Card
// ─────────────────────────────────────────────
function UjianCard({ item, idx }) {
  const badge   = statusBadge(item.tanggal, item.waktu_mulai, item.durasi);
  const selesai = new Date(`${item.tanggal}T${item.waktu_mulai}`);
  selesai.setMinutes(selesai.getMinutes() + (item.durasi || 0));

  const done        = isPast(item.tanggal, item.waktu_mulai, item.durasi);
  const berlangsung = isBerlangsung(item.tanggal, item.waktu_mulai, item.durasi);
  const today       = isToday(item.tanggal);

  const accentColor = done        ? 'bg-gray-200 dark:bg-gray-700'
                    : berlangsung ? 'bg-green-400'
                    : today       ? 'bg-indigo-500'
                    :               'bg-emerald-400';

  const dateBg = done        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
               : berlangsung ? 'bg-green-500 text-white'
               : today       ? 'bg-indigo-500 text-white'
               :               'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className={`relative bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden transition-all hover:shadow-md ${
        done
          ? 'border-gray-200 dark:border-gray-800 opacity-70'
          : today
          ? 'border-indigo-300 dark:border-indigo-700 shadow-sm shadow-indigo-100 dark:shadow-indigo-900/30'
          : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`}/>

      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Mapel + badge */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className={`font-bold text-sm truncate ${done ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'}`}>
                {item.mapel}
              </h4>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}/>
                {badge.label}
              </span>
              {done && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-600">
                  <CheckCircle2 size={10}/> Ujian selesai
                </span>
              )}
            </div>

            {/* Info baris */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Calendar size={11} className="text-gray-400 dark:text-gray-500"/>
                {fmtTanggal(item.tanggal)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Clock size={11} className="text-gray-400 dark:text-gray-500"/>
                {fmtWaktu(item.waktu_mulai)} – {fmtWaktuFromDate(selesai)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <BookOpen size={11} className="text-gray-400 dark:text-gray-500"/>
                {item.jumlah_soal} soal · {fmtDurasi(item.durasi)}
              </span>
            </div>
          </div>

          {/* Tanggal box */}
          <div className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center ${dateBg}`}>
            <span className="text-xs font-semibold leading-none">
              {BULAN[new Date(item.tanggal).getMonth()].slice(0,3)}
            </span>
            <span className="text-lg font-extrabold leading-tight">
              {new Date(item.tanggal).getDate()}
            </span>
          </div>
        </div>

        {/* Tokens (hanya label ruang, bukan token rahasia) */}
        {item.tokens?.length > 0 && !done && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tokens.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                <MapPin size={9}/> {t.nama}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Tugas Mengawas Card
// ─────────────────────────────────────────────
function MengawasCard({ item, idx }) {
  const badge      = statusBadge(item.tanggal, item.waktu_mulai, item.durasi);
  const selesai    = new Date(`${item.tanggal}T${item.waktu_mulai}`);
  selesai.setMinutes(selesai.getMinutes() + (item.durasi || 0));

  const done        = isPast(item.tanggal, item.waktu_mulai, item.durasi);
  const berlangsung = isBerlangsung(item.tanggal, item.waktu_mulai, item.durasi);
  const today       = isToday(item.tanggal);
  const showToken   = isTokenVisible(item.tanggal, item.waktu_mulai, item.durasi);

  // Berapa menit lagi token akan muncul
  const mulai       = new Date(`${item.tanggal}T${item.waktu_mulai}`);
  const diffMen     = Math.ceil((mulai - new Date()) / 60000);
  const tokenHint   = !showToken && today && !done && diffMen > 0
    ? `Token tampil ${diffMen > 30 ? 'H-1 (30 menit sebelum ujian)' : `dalam ${diffMen} menit`}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all ${
        done
          ? 'border-gray-200 dark:border-gray-800 opacity-70'
          : berlangsung
          ? 'border-green-300 dark:border-green-700 ring-1 ring-green-200 dark:ring-green-900'
          : today
          ? 'border-amber-300 dark:border-amber-700 ring-1 ring-amber-200 dark:ring-amber-900'
          : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      {/* Header */}
      <div className={`px-5 py-3 flex items-center justify-between ${
        done        ? 'bg-gray-50 dark:bg-gray-800/40'
        : berlangsung ? 'bg-green-50 dark:bg-green-950/40'
        : today     ? 'bg-amber-50 dark:bg-amber-950/40'
        :              'bg-gray-50 dark:bg-gray-800/40'
      }`}>
        <div className="flex items-center gap-2">
          {done
            ? <CheckCircle2 size={14} className="text-gray-400"/>
            : <Shield size={14} className={berlangsung ? 'text-green-500' : today ? 'text-amber-500' : 'text-gray-400'}/>
          }
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
            {done ? 'Selesai Mengawas' : 'Tugas Mengawas'}
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}/>
          {badge.label}
        </span>
      </div>

      <div className="px-5 py-4">
        {/* Mapel */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h4 className={`font-extrabold text-base ${done ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'}`}>
              {item.mapel}
            </h4>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.kategori || 'Ujian Sekolah'}</p>
          </div>
          <div className={`shrink-0 px-3 py-1.5 rounded-xl text-center ${
            done        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
            : berlangsung ? 'bg-green-500 text-white'
            : today     ? 'bg-amber-500 text-white'
            :              'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
          }`}>
            <div className="text-xs font-semibold leading-none">{BULAN[new Date(item.tanggal).getMonth()].slice(0,3)}</div>
            <div className="text-xl font-extrabold leading-tight">{new Date(item.tanggal).getDate()}</div>
          </div>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar size={11} className="text-indigo-400"/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Tanggal</span>
            </div>
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{fmtTanggal(item.tanggal)}</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={11} className="text-indigo-400"/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Waktu</span>
            </div>
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              {fmtWaktu(item.waktu_mulai)} – {fmtWaktuFromDate(selesai)}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{fmtDurasi(item.durasi)}</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin size={11} className="text-indigo-400"/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Ruang</span>
            </div>
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{item.nama_ruang || '-'}</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BookOpen size={11} className="text-indigo-400"/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Soal</span>
            </div>
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{item.jumlah_soal} soal</p>
          </div>
        </div>

        {/* ── Token Pengawas ── */}
        <AnimatePresence mode="wait">
          {done ? (
            /* Selesai: tampilkan ringkasan tanpa token */
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex items-center gap-2"
            >
              <CheckCircle2 size={14} className="text-gray-400 shrink-0"/>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold">Sesi pengawasan telah selesai</p>
            </motion.div>

          ) : showToken ? (
            /* Token terungkap */
            <motion.div
              key="token-visible"
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="mt-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Unlock size={11} className="text-indigo-500"/>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Token Pengawas</span>
                {berlangsung && (
                  <span className="ml-auto text-[9px] font-bold text-green-500 bg-green-100 dark:bg-green-950 px-1.5 py-0.5 rounded-full">
                    Sedang Berlangsung
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <code className="text-lg font-black tracking-[0.25em] text-indigo-600 dark:text-indigo-400">
                  {item.token_pengawas}
                </code>
                <button
                  onClick={() => navigator.clipboard?.writeText(item.token_pengawas)}
                  className="ml-auto text-[10px] font-semibold text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900"
                >
                  Salin
                </button>
              </div>
            </motion.div>

          ) : (
            /* Token terkunci */
            <motion.div
              key="token-locked"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2">
                <Lock size={13} className="text-gray-300 dark:text-gray-600 shrink-0"/>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
                    Token Pengawas
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {tokenHint ?? (
                      isToday(item.tanggal)
                        ? 'Token akan muncul 30 menit sebelum ujian'
                        : 'Token hanya tersedia di hari ujian (30 menit sebelum mulai)'
                    )}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  {['•','•','•','•','•','•'].map((d, i) => (
                    <span key={i} className="text-gray-200 dark:text-gray-700 text-base font-black">•</span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function JadwalPage({ session }) {
  const { toast } = useToast();
  const [loading,     setLoading]     = useState(true);
  const [allJadwal,   setAllJadwal]   = useState([]);
  const [myMengawas,  setMyMengawas]  = useState([]);
  const [tab,         setTab]         = useState('semua');
  const [filterBulan, setFilterBulan] = useState('');

  const { subscribed, swReady, loading: notifLoading, subscribe, unsubscribe, scheduleReminders } =
    usePushNotification(session);

  // ── Auto-refresh setiap menit supaya token visibility update ──
  useEffect(() => {
    const timer = setInterval(() => {
      setAllJadwal(prev => [...prev]);  // trigger re-render
      setMyMengawas(prev => [...prev]);
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Load Data ────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: jadwal, error: e1 } = await supabase
        .from('jadwal_ujian')
        .select(`
          id, tanggal, waktu_mulai, durasi, tokens, status,
          paket_soal:paket_id ( id, mapel, jumlah_soal, kategori )
        `)
        .eq('status', 'aktif')
        .order('tanggal', { ascending: true })
        .order('waktu_mulai', { ascending: true });

      if (e1) throw e1;

      const mapped = (jadwal || []).map(j => ({
        id:          j.id,
        tanggal:     j.tanggal,
        waktu_mulai: j.waktu_mulai,
        durasi:      j.durasi,
        status:      j.status,
        tokens:      j.tokens || [],
        mapel:       j.paket_soal?.mapel       || '-',
        jumlah_soal: j.paket_soal?.jumlah_soal || 0,
        kategori:    j.paket_soal?.kategori    || '',
      }));
      setAllJadwal(mapped);

      if (session?.id) {
        const { data: tugas, error: e2 } = await supabase
          .from('tugas_mengawas')
          .select(`
            id, token_pengawas, nama_ruang, is_active,
            jadwal:jadwal_id (
              id, tanggal, waktu_mulai, durasi,
              paket_soal:paket_id ( mapel, jumlah_soal, kategori )
            )
          `)
          .eq('teacher_id', session.id)
          .eq('is_active', true);

        if (e2) throw e2;

        const tugasMapped = (tugas || [])
          .filter(t => t.jadwal)
          .map(t => ({
            id:             t.id,
            jadwal_id:      t.jadwal.id,
            token_pengawas: t.token_pengawas,
            nama_ruang:     t.nama_ruang,
            tanggal:        t.jadwal.tanggal,
            waktu_mulai:    t.jadwal.waktu_mulai,
            durasi:         t.jadwal.durasi,
            mapel:          t.jadwal.paket_soal?.mapel       || '-',
            jumlah_soal:    t.jadwal.paket_soal?.jumlah_soal || 0,
            kategori:       t.jadwal.paket_soal?.kategori    || '',
          }))
          .sort((a, b) => new Date(`${a.tanggal}T${a.waktu_mulai}`) - new Date(`${b.tanggal}T${b.waktu_mulai}`));

        setMyMengawas(tugasMapped);
        if (subscribed) scheduleReminders(tugasMapped);
      }
    } catch (err) {
      console.error(err);
      toast({ type: 'error', title: 'Gagal memuat jadwal', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [session?.id, subscribed, scheduleReminders, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (subscribed && myMengawas.length > 0) scheduleReminders(myMengawas);
  }, [subscribed]);

  // ── Handlers ─────────────────────────────────
  const handleSubscribe = async () => {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      toast({ type: 'error', title: 'Izin Ditolak', message: 'Aktifkan notifikasi di pengaturan browser.' });
      return;
    }
    const ok = await subscribe();
    if (ok) {
      toast({ type: 'success', title: 'Notifikasi Aktif', message: 'Kamu akan diingatkan sebelum jadwal mengawas.' });
      if (myMengawas.length > 0) scheduleReminders(myMengawas);
    }
  };

  const handleUnsubscribe = async () => {
    await unsubscribe();
    toast({ type: 'info', title: 'Notifikasi Dimatikan', message: 'Kamu tidak akan menerima pengingat.' });
  };

  // ── Filters ──────────────────────────────────
  const activeList = tab === 'semua' ? allJadwal : myMengawas;
  const bulanOptions = [...new Set(
    activeList.map(j => j.tanggal?.slice(0, 7)).filter(Boolean)
  )].sort();
  const filtered = filterBulan
    ? activeList.filter(j => j.tanggal?.startsWith(filterBulan))
    : activeList;

  const today       = new Date().toISOString().slice(0, 10);
  const todayCount  = allJadwal.filter(j => j.tanggal === today).length;
  const myUpcoming  = myMengawas.filter(j => !isPast(j.tanggal, j.waktu_mulai, j.durasi)).length;

  // ─────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Jadwal Ujian</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {allJadwal.length} total jadwal
            {myMengawas.length > 0 && ` · ${myUpcoming} tugas mengawas`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <NotifToggle
            subscribed={subscribed}
            loading={notifLoading}
            swReady={swReady}
            onSubscribe={handleSubscribe}
            onUnsubscribe={handleUnsubscribe}
          />
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all"
          >
            <RefreshCw size={13}/> Refresh
          </button>
        </div>
      </div>

      {/* ── Notif banner ── */}
      {!subscribed && myMengawas.some(j => !isPast(j.tanggal, j.waktu_mulai, j.durasi)) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800"
        >
          <Bell size={16} className="text-amber-500 shrink-0 mt-0.5"/>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Aktifkan Notifikasi</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">
              Aktifkan notifikasi agar kamu diingatkan H-1 dan 30 menit sebelum jadwal mengawas.
            </p>
          </div>
          <button onClick={handleSubscribe}
            className="shrink-0 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
          >
            Aktifkan
          </button>
        </motion.div>
      )}

      {/* ── Stats ── */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Calendar, label: 'Total Jadwal', value: allJadwal.length, color: 'from-indigo-400 to-indigo-600' },
            { icon: Clock,    label: 'Hari Ini',     value: todayCount,        color: 'from-violet-400 to-violet-600' },
            { icon: Shield,   label: 'Tugas Saya',   value: myUpcoming,        color: 'from-amber-400 to-amber-600'  },
          ].map(({ icon: Icon, label, value, color }) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">{label}</p>
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</span>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${color}`}>
                  <Icon size={18} className="text-white"/>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Tab + Filter ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {[
            { key: 'semua',    label: 'Semua Jadwal',   count: allJadwal.length  },
            { key: 'mengawas', label: 'Tugas Mengawas', count: myMengawas.length },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setFilterBulan(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === t.key
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                tab === t.key
                  ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>

        {bulanOptions.length > 1 && (
          <select
            value={filterBulan}
            onChange={e => setFilterBulan(e.target.value)}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-indigo-400 transition-all"
          >
            <option value="">Semua Bulan</option>
            {bulanOptions.map(b => {
              const [y, m] = b.split('-');
              return <option key={b} value={b}>{BULAN[parseInt(m)-1]} {y}</option>;
            })}
          </select>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_,i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Calendar size={40} className="text-gray-200 dark:text-gray-700"/>
          <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">
            {tab === 'mengawas' ? 'Tidak ada tugas mengawas' : 'Tidak ada jadwal ujian'}
          </p>
        </div>
      ) : tab === 'semua' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((item, idx) => <UjianCard key={item.id} item={item} idx={idx}/>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((item, idx) => <MengawasCard key={item.id} item={item} idx={idx}/>)}
        </div>
      )}

    </div>
  );
}