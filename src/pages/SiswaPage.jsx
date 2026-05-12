import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, UserPlus, Edit2, Trash2, Eye, EyeOff,
  RefreshCw, Users, ChevronDown, ChevronUp, Lock
} from 'lucide-react';
import Swal from 'sweetalert2';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────
const KELAS_LIST = ['4A','4B','4C','4D','5A','5B','5C','5D','6A','6B','6C','6D'];
const EMPTY_FORM = { name:'', nisn:'', class:'', username:'', password:'', password_plain:'' };

// ─────────────────────────────────────────────
// Helpers jadwal_mengajar — identik dengan AnalisisSoalSection
// ─────────────────────────────────────────────

/** Parse jadwal_mengajar – handles both string and array. */
function parseJadwalMengajar(raw) {
  if (!raw) return [];
  try { return Array.isArray(raw) ? raw : JSON.parse(raw); } catch { return []; }
}

/**
 * Kembalikan Set fullKelas dari jadwal_mengajar.
 * fullKelas = tingkat + kelas element, e.g. "5C"
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

// ─────────────────────────────────────────────
// Helper: apakah role boleh edit/hapus/tambah?
// Hanya wali_kelas yang boleh kelola data siswa.
// ─────────────────────────────────────────────
function canManage(role) {
  return role === 'wali_kelas';
}

// ─────────────────────────────────────────────
// Kartu siswa untuk tampilan mobile
// ─────────────────────────────────────────────
function SiswaCard({ s, idx, showPass, onTogglePass, onEdit, onDelete, manage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        {/* Avatar + nama */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {s.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{s.name}</p>
            <p className="text-[11px] text-gray-400 font-mono">{s.nisn}</p>
          </div>
        </div>

        {/* Status online */}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
          s.is_online
            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
          {s.is_online ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Detail row */}
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Username</p>
          <p className="text-xs text-gray-700 dark:text-gray-300 font-mono truncate">{s.username}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Password</p>
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
              {showPass[s.id] ? (s.password_plain || s.password) : '••••••••'}
            </span>
            <button onClick={() => onTogglePass(s.id)} className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors ml-0.5">
              {showPass[s.id] ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </div>
        </div>
      </div>

      {/* Aksi */}
      {manage && (
        <div className="mt-3 flex gap-2 border-t border-gray-50 dark:border-gray-800 pt-3">
          <button
            onClick={() => onEdit(s)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors"
          >
            <Edit2 size={12} /> Edit
          </button>
          <button
            onClick={() => onDelete(s)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-950 transition-colors"
          >
            <Trash2 size={12} /> Hapus
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
export default function SiswaPage({ session }) {
  const { toast } = useToast();
  const role   = session?.role || '';
  const manage = canManage(role);

  const [students, setStudents]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [filterKelas, setFilterKelas]       = useState('');
  const [showPass, setShowPass]             = useState({});
  const [modal, setModal]                   = useState({ open: false, mode: 'add', data: null });
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [saving, setSaving]                 = useState(false);
  const [collapsedKelas, setCollapsedKelas] = useState({});

  // Wali kelas: otomatis set filter ke kelas mereka
  const defaultKelas = role === 'wali_kelas' ? session?.kelas_wali || '' : '';

  useEffect(() => {
    if (defaultKelas) setFilterKelas(defaultKelas);
    loadSiswa();
    // eslint-disable-next-line
  }, []);

  // ─────────────────────────────────────────
  // Dropdown kelas tersedia sesuai role
  // — konsisten dengan AnalisisSoalSection —
  // ─────────────────────────────────────────
  const kelasList = useMemo(() => {
    if (role === 'wali_kelas') {
      return session?.kelas_wali ? [session.kelas_wali] : [];
    }
    if (role === 'guru_mapel') {
      const jadwal = parseJadwalMengajar(session?.jadwal_mengajar);
      return [...buildKelasSetGuru(jadwal)].sort((a, b) => a.localeCompare(b));
    }
    return KELAS_LIST; // admin / kepala_sekolah
  }, [role, session]);

  // ─────────────────────────────────────────
  // Load siswa dengan filter per role
  // — konsisten dengan AnalisisSoalSection —
  // ─────────────────────────────────────────
  const loadSiswa = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('students').select('*').order('class').order('name');

      if (role === 'wali_kelas' && session?.kelas_wali) {
        // Wali kelas: hanya kelasnya sendiri
        q = q.eq('class', session.kelas_wali);

      } else if (role === 'guru_mapel') {
        // Guru mapel: hanya kelas yang ada di jadwal_mengajar
        // — konsisten dengan filter di AnalisisSoalSection —
        const jadwalMengajar = parseJadwalMengajar(session?.jadwal_mengajar);

        if (!jadwalMengajar.length) {
          // Guru belum punya jadwal → tidak tampilkan siswa apapun
          setStudents([]);
          setLoading(false);
          return;
        }

        const kelasSet = buildKelasSetGuru(jadwalMengajar);
        if (!kelasSet.size) {
          setStudents([]);
          setLoading(false);
          return;
        }

        q = q.in('class', [...kelasSet]);
      }
      // admin / kepala_sekolah → tidak ada filter tambahan (lihat semua)

      const { data, error } = await q;
      if (error) throw error;
      setStudents(data || []);
    } catch {
      toast({ type: 'error', title: 'Gagal memuat', message: 'Tidak bisa memuat data siswa' });
    } finally {
      setLoading(false);
    }
  }, [session, role, toast]);

  // ── Filter lokal ──────────────────────────
  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || s.name?.toLowerCase().includes(q)
      || s.nisn?.includes(q)
      || s.username?.toLowerCase().includes(q);
    const matchKelas = !filterKelas || s.class === filterKelas;
    return matchSearch && matchKelas;
  });

  // ── Modal helpers ─────────────────────────
  const openAdd = () => {
    setForm({ ...EMPTY_FORM, class: defaultKelas });
    setModal({ open: true, mode: 'add', data: null });
  };

  const openEdit = (s) => {
    setForm({
      name: s.name, nisn: s.nisn, class: s.class,
      username: s.username, password: s.password,
      password_plain: s.password_plain || '',
    });
    setModal({ open: true, mode: 'edit', data: s });
  };

  const handleSave = async () => {
    if (!form.name || !form.nisn || !form.class || !form.username || !form.password) {
      toast({ type: 'warning', title: 'Form belum lengkap', message: 'Isi semua field yang wajib' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        nisn: form.nisn.trim(),
        class: form.class,
        username: form.username.trim().toLowerCase(),
        password: form.password,
        password_plain: form.password,
        is_online: false,
      };
      if (modal.mode === 'add') {
        const { error } = await supabase.from('students').insert(payload);
        if (error) throw error;
        toast({ type: 'success', title: 'Siswa ditambahkan', message: form.name });
      } else {
        const { error } = await supabase.from('students').update(payload).eq('id', modal.data.id);
        if (error) throw error;
        toast({ type: 'success', title: 'Data diperbarui', message: form.name });
      }
      setModal({ open: false, mode: 'add', data: null });
      loadSiswa();
    } catch (e) {
      toast({ type: 'error', title: 'Gagal menyimpan', message: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s) => {
    const result = await Swal.fire({
      title: 'Hapus Siswa?',
      html: `<b>${s.name}</b> (${s.class}) akan dihapus permanen`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
    });
    if (!result.isConfirmed) return;
    try {
      const { error } = await supabase.from('students').delete().eq('id', s.id);
      if (error) throw error;
      toast({ type: 'success', title: 'Siswa dihapus', message: s.name });
      loadSiswa();
    } catch (e) {
      toast({ type: 'error', title: 'Gagal menghapus', message: e.message });
    }
  };

  const togglePass  = (id) => setShowPass(p => ({ ...p, [id]: !p[id] }));
  const toggleKelas = (k)  => setCollapsedKelas(p => ({ ...p, [k]: !p[k] }));

  // Group by kelas
  const byKelas = filtered.reduce((acc, s) => {
    (acc[s.class] = acc[s.class] || []).push(s);
    return acc;
  }, {});

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Data Siswa</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {students.length} siswa terdaftar
            {!manage && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-500">
                <Lock size={10} /> Hanya baca
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={loadSiswa}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          {/* Hanya wali_kelas yang boleh tambah siswa */}
          {manage && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/30 transition-all"
            >
              <UserPlus size={14} /> Tambah Siswa
            </button>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama, NISN, username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
          />
        </div>

        {/* Dropdown kelas:
            - wali_kelas : hanya kelasnya (disabled, otomatis)
            - guru_mapel : hanya kelas yang diajar
            - admin/kepsek: semua kelas */}
        {role === 'wali_kelas' ? (
          <div className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center gap-2 select-none">
            <Lock size={12} className="text-gray-300" />
            Kelas {session?.kelas_wali}
          </div>
        ) : (
          <select
            value={filterKelas}
            onChange={e => setFilterKelas(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
          >
            <option value="">Semua Kelas</option>
            {kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>)}
          </select>
        )}
      </div>

      {/* ── Konten utama ── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Users size={40} className="text-gray-200 dark:text-gray-700" />
          <p className="text-sm font-semibold text-gray-400">Tidak ada siswa ditemukan</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byKelas).sort(([a], [b]) => a.localeCompare(b)).map(([kelas, list]) => {
            const collapsed = collapsedKelas[kelas];
            return (
              <motion.div
                key={kelas}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm"
              >
                {/* Group header — klik untuk collapse */}
                <button
                  onClick={() => toggleKelas(kelas)}
                  className="w-full px-5 py-3 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900 flex items-center justify-between hover:bg-indigo-100/60 dark:hover:bg-indigo-950/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Kelas {kelas}</span>
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">
                      {list.length} siswa
                    </span>
                  </div>
                  {collapsed
                    ? <ChevronDown size={14} className="text-indigo-400" />
                    : <ChevronUp size={14} className="text-indigo-400" />}
                </button>

                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* ── Desktop / Tablet: Tabel ── */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-800">
                              <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 w-8">#</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Nama</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden md:table-cell">NISN</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Username</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Password</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                              {/* Kolom aksi hanya tampil jika bisa manage */}
                              {manage && (
                                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center">Aksi</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((s, idx) => (
                              <tr
                                key={s.id}
                                className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                              >
                                <td className="px-5 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                      {s.name?.[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{s.name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-xs font-mono text-gray-500 hidden md:table-cell">{s.nisn}</td>
                                <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400">{s.username}</td>
                                <td className="px-3 py-3 hidden lg:table-cell">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                      {showPass[s.id] ? (s.password_plain || s.password) : '••••••••'}
                                    </span>
                                    <button
                                      onClick={() => togglePass(s.id)}
                                      className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                    >
                                      {showPass[s.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    s.is_online
                                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${s.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
                                    {s.is_online ? 'Online' : 'Offline'}
                                  </span>
                                </td>
                                {/* Tombol aksi — hanya wali_kelas */}
                                {manage && (
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-1 justify-center">
                                      <button
                                        onClick={() => openEdit(s)}
                                        className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 transition-colors"
                                        title="Edit"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(s)}
                                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 transition-colors"
                                        title="Hapus"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* ── Mobile: Card grid ── */}
                      <div className="sm:hidden p-3 grid grid-cols-1 gap-2">
                        {list.map((s, idx) => (
                          <SiswaCard
                            key={s.id}
                            s={s}
                            idx={idx}
                            showPass={showPass}
                            onTogglePass={togglePass}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                            manage={manage}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Modal tambah/edit — hanya muncul jika manage ── */}
      {manage && (
        <Modal
          open={modal.open}
          onClose={() => setModal(p => ({ ...p, open: false }))}
          title={modal.mode === 'add' ? 'Tambah Siswa' : 'Edit Data Siswa'}
          subtitle={modal.mode === 'edit' ? modal.data?.name : 'Isi data siswa baru'}
          footer={
            <>
              <button
                onClick={() => setModal(p => ({ ...p, open: false }))}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white shadow-md shadow-indigo-500/30 transition-all flex items-center gap-2"
              >
                {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Nama */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nama siswa"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                />
              </div>

              {/* NISN */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">NISN *</label>
                <input
                  type="text"
                  value={form.nisn}
                  onChange={e => setForm(p => ({ ...p, nisn: e.target.value }))}
                  placeholder="NISN"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                />
              </div>

              {/* Kelas:
                  wali_kelas → disabled, otomatis terisi kelasnya
                  lainnya    → dropdown (guru_mapel: kelas yg diajar; admin: semua) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Kelas *</label>
                {role === 'wali_kelas' ? (
                  <div className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center gap-2 select-none cursor-not-allowed">
                    <Lock size={12} className="text-gray-300" />
                    Kelas {form.class}
                  </div>
                ) : (
                  <select
                    value={form.class}
                    onChange={e => setForm(p => ({ ...p, class: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                  >
                    <option value="">Pilih kelas</option>
                    {/* Gunakan kelasList yang sudah disesuaikan per role */}
                    {kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>)}
                  </select>
                )}
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Username *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="username.siswa"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Password *</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value, password_plain: e.target.value }))}
                  placeholder="Password"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}