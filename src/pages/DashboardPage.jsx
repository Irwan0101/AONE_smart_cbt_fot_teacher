import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, BookOpen, CalendarDays, TrendingUp,
  Clock, CheckCircle2, AlertCircle, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const card = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.3, ease: 'easeOut' }
});

/* ── Skeleton ── */
function Skeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 sm:h-28 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        <div className="h-56 sm:h-64 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-56 sm:h-64 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers jadwal_mengajar — identik dengan SiswaPage & AnalisisSoalSection
// ─────────────────────────────────────────────

/** Parse jadwal_mengajar – handles both string and array. */
function parseJadwalMengajar(raw) {
  if (!raw) return [];
  try { return Array.isArray(raw) ? raw : JSON.parse(raw); } catch { return []; }
}

/**
 * Kembalikan Set fullKelas dari jadwal_mengajar.
 * fullKelas = tingkat + kelas element, e.g. "5C", "6A"
 */
function buildKelasSetGuru(jadwalMengajar) {
  const keys = new Set();
  jadwalMengajar.forEach((jm) => {
    const tingkat   = jm.tingkat ? String(jm.tingkat) : '';
    const kelasList = Array.isArray(jm.kelas) ? jm.kelas : jm.kelas ? [jm.kelas] : [];
    kelasList.forEach((k) => keys.add(`${tingkat}${k}`));
  });
  return keys;
}

/**
 * Kembalikan Set mapel dari jadwal_mengajar.
 */
function buildMapelSetGuru(jadwalMengajar) {
  const keys = new Set();
  jadwalMengajar.forEach((jm) => {
    if (jm.mapel) keys.add(jm.mapel);
  });
  return keys;
}

export default function DashboardPage({ session }) {
  const [stats, setStats]               = useState({ siswa: 0, soal: 0, jadwal: 0 });
  const [jadwalAktif, setJadwalAktif]   = useState([]);
  const [tugasHariIni, setTugasHariIni] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const today   = new Date().toISOString().split('T')[0];
      const role    = session?.role || '';
      const isMapel = role === 'guru_mapel';
      const isWali  = role === 'wali_kelas';

      // ── Parse jadwal_mengajar dengan helper yang konsisten ──
      const jadwalMengajar = parseJadwalMengajar(session?.jadwal_mengajar);
      const kelasSet       = isMapel ? buildKelasSetGuru(jadwalMengajar) : null;
      const mapelSet       = isMapel ? buildMapelSetGuru(jadwalMengajar) : null;

      // Untuk wali kelas: hanya 1 kelas
      const kelasWali = isWali ? session?.kelas_wali || null : null;

      /* 1. Hitung siswa sesuai role */
      let siswaCount = 0;
      if (isWali && kelasWali) {
        // Wali kelas: hanya kelasnya
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('class', kelasWali);
        siswaCount = count || 0;

      } else if (isMapel) {
        // Guru mapel: semua kelas yang diajar (dari jadwal_mengajar)
        if (kelasSet && kelasSet.size > 0) {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .in('class', [...kelasSet]);
          siswaCount = count || 0;
        }
        // kelasSet kosong → guru belum punya jadwal → 0 (sudah default)

      } else {
        // admin / kepala_sekolah: semua siswa
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });
        siswaCount = count || 0;
      }

      /* 2. Paket soal — guru mapel hanya lihat mapelnya */
      let soalQuery = supabase
        .from('paket_soal')
        .select('*', { count: 'exact', head: true });
      if (isMapel && mapelSet && mapelSet.size > 0) {
        soalQuery = soalQuery.in('mapel', [...mapelSet]);
      }
      const { count: soalCount } = await soalQuery;

      /* 3. Jadwal ujian & tugas mengawas (paralel) */
      const [jadwalRes, tugasRes] = await Promise.all([
        supabase
          .from('jadwal_ujian')
          .select(`id, tanggal, waktu_mulai, durasi, status, tokens, paket_soal(mapel)`)
          .eq('status', 'aktif')
          .gte('tanggal', today)
          .order('tanggal')
          .limit(20),
        supabase
          .from('tugas_mengawas')
          .select(`id, nama_ruang, token_pengawas, jadwal_ujian(id, tanggal, waktu_mulai, durasi, status, tokens, paket_soal(mapel))`)
          .eq('teacher_id', session.id)
          .eq('is_active', true),
      ]);

      /* Filter jadwal: guru mapel hanya lihat mapelnya */
      let jadwalFiltered = jadwalRes.data || [];
      if (isMapel && mapelSet && mapelSet.size > 0) {
        jadwalFiltered = jadwalFiltered.filter(j =>
          mapelSet.has(j.paket_soal?.mapel)
        );
      }

      const tugasToday = (tugasRes.data || []).filter(
        t => t.jadwal_ujian?.tanggal === today
      );

      setStats({ siswa: siswaCount, soal: soalCount || 0, jadwal: jadwalFiltered.length });
      setJadwalAktif(jadwalFiltered.slice(0, 5));
      setTugasHariIni(tugasToday);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /* ── Label ── */
  const isWali    = session?.role === 'wali_kelas';
  const roleLabel = isWali ? `Wali Kelas ${session?.kelas_wali || ''}` : 'Guru Mapel';
  const siswaLabel = isWali ? `Siswa Kelas ${session?.kelas_wali || ''}` : 'Siswa yang Diampu';

  const jadwalMengajar = parseJadwalMengajar(session?.jadwal_mengajar);
  const mapelList      = [...buildMapelSetGuru(jadwalMengajar)];

  const STAT_CARDS = [
    { label: siswaLabel,       value: stats.siswa,         icon: Users,        iconBg: 'bg-indigo-100 dark:bg-indigo-900',  textColor: 'text-indigo-600 dark:text-indigo-400'  },
    { label: 'Paket Soal',     value: stats.soal,          icon: BookOpen,     iconBg: 'bg-violet-100 dark:bg-violet-900',  textColor: 'text-violet-600 dark:text-violet-400'  },
    { label: 'Jadwal Aktif',   value: stats.jadwal,        icon: CalendarDays, iconBg: 'bg-sky-100 dark:bg-sky-900',        textColor: 'text-sky-600 dark:text-sky-400'        },
    { label: 'Tugas Hari Ini', value: tugasHariIni.length, icon: TrendingUp,   iconBg: 'bg-emerald-100 dark:bg-emerald-900',textColor: 'text-emerald-600 dark:text-emerald-400'},
  ];

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Greeting */}
      <motion.div {...card(0)}>
        <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
          Selamat datang,{' '}
          <span className="text-indigo-500">{session?.nama?.split(' ')[0]}</span> 👋
        </h2>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          {roleLabel} •{' '}
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>

        {/* Badge mapel yang diampu — khusus guru mapel */}
        {!isWali && mapelList.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {mapelList.map(m => (
              <span
                key={m}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {STAT_CARDS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              {...card(i * 0.07)}
              className="p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-2 sm:mb-3">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                  <Icon size={17} className={s.textColor} />
                </div>
              </div>
              <p className={`text-xl sm:text-2xl font-extrabold ${s.textColor}`}>{s.value}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 leading-tight">
                {s.label}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom panels */}
      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">

        {/* Tugas mengawas hari ini */}
        <motion.div
          {...card(0.28)}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-indigo-500" />
              <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                Tugas Mengawas Hari Ini
              </span>
            </div>
            {tugasHariIni.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                {tugasHariIni.length} tugas
              </span>
            )}
          </div>
          <div className="p-3 sm:p-4 space-y-2">
            {tugasHariIni.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle2 size={30} className="text-gray-200 dark:text-gray-700" />
                <p className="text-xs text-gray-400 font-medium text-center">
                  Tidak ada tugas mengawas hari ini
                </p>
              </div>
            ) : (
              tugasHariIni.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                      {t.jadwal_ujian?.paket_soal?.mapel}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      {t.nama_ruang} • {t.jadwal_ujian?.waktu_mulai?.slice(0, 5)} • {t.jadwal_ujian?.durasi} menit
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-gray-800 text-indigo-500 border border-indigo-200 dark:border-indigo-800 font-mono shrink-0">
                    {t.token_pengawas}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Jadwal ujian mendatang */}
        <motion.div
          {...card(0.35)}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <CalendarDays size={15} className="text-violet-500" />
            <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
              Jadwal Ujian Mendatang
            </span>
          </div>
          <div className="p-3 sm:p-4 space-y-2">
            {jadwalAktif.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <AlertCircle size={30} className="text-gray-200 dark:text-gray-700" />
                <p className="text-xs text-gray-400 font-medium text-center">
                  Belum ada jadwal ujian
                </p>
              </div>
            ) : (
              jadwalAktif.map(j => {
                const isToday = j.tanggal === new Date().toISOString().split('T')[0];
                return (
                  <div
                    key={j.id}
                    className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                  >
                    <div className={`w-1.5 h-10 rounded-full shrink-0 ${isToday ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                        {j.paket_soal?.mapel}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                        {new Date(j.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        {' • '}{j.waktu_mulai?.slice(0, 5)}{' • '}{j.durasi} mnt
                      </p>
                    </div>
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-500 shrink-0">
                        Hari ini
                      </span>
                    )}
                    <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}