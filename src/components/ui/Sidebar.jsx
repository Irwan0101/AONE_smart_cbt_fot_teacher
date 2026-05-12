import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, BookOpen, CalendarDays,
  ShieldCheck, BarChart3, Sun, Moon, LogOut, GraduationCap,
  Menu, X, AlertTriangle
} from 'lucide-react';

const ALL_NAV = [
  { key: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard, desc: 'Ringkasan data'        },
  { key: 'siswa',     label: 'Data Siswa',   icon: Users,           desc: 'Kelola data siswa'     },
  { key: 'banksoal',  label: 'Bank Soal',    icon: BookOpen,        desc: 'Kelola soal ujian'     },
  { key: 'jadwal',    label: 'Jadwal Ujian', icon: CalendarDays,    desc: 'Atur jadwal'           },
  { key: 'pengawas',  label: 'Pengawas',     icon: ShieldCheck,     desc: 'Monitor ruang ujian', activeExamOnly: true },
  { key: 'report',    label: 'Report Nilai', icon: BarChart3,       desc: 'Laporan nilai siswa'   },
];

/* ─── Logout Modal ─── */
function LogoutModal({ onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          onClick={e => e.stopPropagation()}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-sm overflow-hidden"
        >
          <div className="h-1.5 bg-gradient-to-r from-red-400 via-rose-500 to-red-600" />
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                <AlertTriangle size={26} className="text-red-500" />
              </div>
            </div>
            <h3 className="text-center text-base font-extrabold text-gray-900 dark:text-white mb-1">
              Konfirmasi Keluar
            </h3>
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
              Apakah kamu yakin ingin keluar dari<br />
              <span className="font-semibold text-indigo-500">AONE Smart CBT</span>?
            </p>
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Batal
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-sm font-bold text-white shadow-lg shadow-red-500/30 hover:from-red-600 hover:to-rose-700 transition-all"
              >
                Ya, Keluar
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Nav Item ─── */
function NavItem({ item, isActive, onClick }) {
  const Icon = item.icon;
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
        isActive
          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
      }`}
    >
      <Icon size={17} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-tight">{item.label}</p>
        {!isActive && (
          <p className="text-[10px] opacity-60 leading-tight mt-0.5 truncate">{item.desc}</p>
        )}
      </div>
      {item.activeExamOnly && (
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      )}
    </motion.button>
  );
}

/* ─── Sidebar Content ─── */
function SidebarContent({ activePage, onNavigate, session, hasActiveExam, theme, onToggleTheme, onLogoutRequest, onClose }) {
  const navItems = ALL_NAV.filter(i => !i.activeExamOnly || hasActiveExam);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg shadow-lg shadow-indigo-500/30 shrink-0">
            📋
          </div>
          <div>
            <div className="font-extrabold text-sm text-gray-900 dark:text-white leading-tight tracking-tight">
              Portal Guru
            </div>
            <div className="text-[10px] font-bold text-indigo-500 tracking-widest uppercase mt-0.5">
              AONE Smart CBT
            </div>
          </div>
        </div>
        {onClose && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors lg:hidden"
          >
            <X size={18} />
          </motion.button>
        )}
      </div>

      {/* Teacher profile */}
      <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {session?.nama?.[0]?.toUpperCase() || <GraduationCap size={14} />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{session?.nama || 'Guru'}</p>
            <p className="text-[10px] font-semibold text-indigo-500 capitalize">
              {session?.role === 'wali_kelas'
                ? `Wali Kelas ${session?.kelas_wali || ''}`
                : 'Guru Mapel'}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto flex flex-col gap-0.5">
        {navItems.map(item => (
          <NavItem
            key={item.key}
            item={item}
            isActive={activePage === item.key}
            onClick={() => { onNavigate(item.key); onClose?.(); }}
          />
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800 flex gap-2">
        {/* Theme toggle */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onToggleTheme}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold
            text-gray-500 dark:text-gray-400
            hover:bg-gray-100 dark:hover:bg-gray-800
            hover:text-gray-800 dark:hover:text-gray-200
            transition-all"
        >
          {theme === 'dark'
            ? <><Sun size={15}/> Terang</>
            : <><Moon size={15}/> Gelap</>
          }
        </motion.button>

        {/* Logout */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onLogoutRequest}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-500 transition-all"
          title="Keluar"
        >
          <LogOut size={15} />
        </motion.button>
      </div>

      {/* Footer */}
      <p className="text-center text-[9px] text-gray-400 dark:text-gray-600 pb-3 font-medium">
        © 2026 AONE Smart CBT • MIN 2 Sarolangun
      </p>
    </div>
  );
}

/* ─── Main Sidebar ─── */
export default function Sidebar(props) {
  const { theme, onLogout, onToggleTheme } = props;
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileOpen,      setMobileOpen]      = useState(false);

  // Tutup drawer saat resize ke desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleLogoutRequest = () => setShowLogoutModal(true);
  const handleLogoutCancel  = () => setShowLogoutModal(false);
  const handleLogoutConfirm = () => { setShowLogoutModal(false); onLogout?.(); };

  const sharedProps = { ...props, onLogoutRequest: handleLogoutRequest };

  return (
    <>
      {/* ── Desktop Sidebar (lg+) ── */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-[260px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col z-50 transition-colors duration-300">
        <SidebarContent {...sharedProps} onClose={null} />
      </aside>

      {/* ── Mobile/Tablet Topbar ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3 px-4 h-14 transition-colors duration-300">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Menu size={20} />
        </motion.button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm shrink-0">
            📋
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-sm text-gray-900 dark:text-white leading-none">Portal Guru</span>
            <span className="hidden sm:inline text-[10px] font-bold text-indigo-500 tracking-widest uppercase ml-2">AONE Smart CBT</span>
          </div>
        </div>

        {/* Theme toggle di topbar mobile */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </motion.button>
      </header>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 35 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 w-[280px] sm:w-[300px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-[100] flex flex-col transition-colors duration-300"
            >
              <SidebarContent {...sharedProps} onClose={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Logout Modal ── */}
      <AnimatePresence>
        {showLogoutModal && (
          <LogoutModal onConfirm={handleLogoutConfirm} onCancel={handleLogoutCancel} />
        )}
      </AnimatePresence>
    </>
  );
}