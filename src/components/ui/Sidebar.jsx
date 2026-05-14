import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, Users, BookOpen, CalendarDays,
  ShieldCheck, BarChart3, Sun, Moon, LogOut, GraduationCap,
  Menu, X, AlertTriangle, GripVertical, ChevronLeft
} from 'lucide-react';
import logo from '../../assets/icon2.jpg';

const ALL_NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Ringkasan data' },
  { key: 'siswa', label: 'Data Siswa', icon: Users, desc: 'Kelola data siswa' },
  { key: 'banksoal', label: 'Bank Soal', icon: BookOpen, desc: 'Kelola soal ujian' },
  { key: 'jadwal', label: 'Jadwal Ujian', icon: CalendarDays, desc: 'Atur jadwal' },
  { key: 'pengawas', label: 'Pengawas', icon: ShieldCheck, desc: 'Monitor ruang ujian', activeExamOnly: true },
  { key: 'report', label: 'Report Nilai', icon: BarChart3, desc: 'Laporan nilai siswa' },
];

const MIN_WIDTH = 220;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 280;

/* ─── Logout Modal ─── */
function LogoutModal({ onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.88, opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8f7ff 100%)',
            boxShadow: '0 32px 64px -12px rgba(99,102,241,0.25), 0 0 0 1px rgba(99,102,241,0.08)',
          }}
          className="rounded-3xl w-full max-w-sm overflow-hidden"
        >
          <div className="h-1.5 bg-gradient-to-r from-red-400 via-rose-500 to-red-600" />
          <div className="p-8">
            <div className="flex justify-center mb-5">
              <motion.div
                animate={{ rotate: [0, -8, 8, -4, 0] }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center shadow-inner"
              >
                <AlertTriangle size={28} className="text-red-500" />
              </motion.div>
            </div>
            <h3 className="text-center text-lg font-black text-gray-900 mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
              Konfirmasi Keluar
            </h3>
            <p className="text-center text-sm text-gray-500 leading-relaxed mb-7">
              Apakah kamu yakin ingin keluar dari<br />
              <span className="font-bold text-indigo-500">AONE Smart CBT</span>?
            </p>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onCancel}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                className="flex-1 py-3 rounded-2xl text-sm font-black text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #f87171 0%, #e11d48 100%)',
                  boxShadow: '0 8px 24px -4px rgba(225,29,72,0.4)',
                }}
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
function NavItem({ item, isActive, onClick, sidebarWidth }) {
  const Icon = item.icon;
  const compact = sidebarWidth < 240;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: isActive ? 0 : 3 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all duration-150 group relative overflow-hidden ${isActive
          ? 'text-white shadow-lg'
          : 'text-gray-500 dark:text-gray-400 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/30 hover:text-indigo-700 dark:hover:text-indigo-300'
        }`}
      style={isActive ? {
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        boxShadow: '0 8px 20px -4px rgba(99,102,241,0.45)',
      } : {}}
    >
      {isActive && (
        <motion.div
          layoutId="active-pill"
          className="absolute inset-0 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      <span className="relative z-10 shrink-0">
        <Icon size={20} />
      </span>
      {!compact && (
        <div className="flex-1 min-w-0 relative z-10">
          <p className="text-sm font-bold leading-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
            {item.label}
          </p>
          {!isActive && (
            <p className="text-[11px] opacity-60 leading-tight mt-0.5 truncate">{item.desc}</p>
          )}
        </div>
      )}
      {item.activeExamOnly && (
        <span className="relative z-10 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      )}
    </motion.button>
  );
}

/* ─── Resize Handle ─── */
function ResizeHandle({ sidebarWidth, setSidebarWidth, isDragging, setIsDragging }) {
  const handleRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = startWidth + delta;
      setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth, setSidebarWidth, setIsDragging]);

  return (
    <div
      ref={handleRef}
      onMouseDown={handleMouseDown}
      className="absolute top-0 right-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize z-10 group"
      style={{ right: '-6px' }}
    >
      <motion.div
        animate={{
          opacity: isDragging ? 1 : 0,
          scaleY: isDragging ? 1 : 0.3,
        }}
        whileHover={{ opacity: 1, scaleY: 1 }}
        className="w-1 h-16 rounded-full transition-colors"
        style={{
          background: isDragging
            ? 'linear-gradient(180deg, #6366f1, #8b5cf6)'
            : 'rgba(99,102,241,0.4)',
          boxShadow: isDragging ? '0 0 12px rgba(99,102,241,0.6)' : 'none',
        }}
      />
      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical size={14} className="text-indigo-400" />
      </div>
    </div>
  );
}

/* ─── Sidebar Content ─── */
function SidebarContent({ activePage, onNavigate, session, hasActiveExam, theme, onToggleTheme, onLogoutRequest, onClose, sidebarWidth }) {
  const navItems = ALL_NAV.filter(i => !i.activeExamOnly || hasActiveExam);
  const compact = sidebarWidth < 240;

  return (
    <div className="flex flex-col h-full transition-colors duration-300 relative"
      style={{
        background: theme === 'dark'
          ? 'linear-gradient(180deg, #0f0e17 0%, #111827 100%)'
          : 'linear-gradient(180deg, #fafafe 0%, #f4f3ff 100%)',
      }}
    >
      {/* Logo */}
      <div className="px-4 py-5 flex items-center justify-between"
        style={{ borderBottom: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.1)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.1 }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              boxShadow: '0 8px 20px -4px rgba(99,102,241,0.5)',
            }}
          >
            <img
              src={logo}
              alt="AONE Smart CBT"
              className="w-full h-full object-contain"
            />
          </motion.div>
          {!compact && (
            <div className="min-w-0">
              <div className="font-black text-base leading-tight tracking-tight truncate"
                style={{
                  fontFamily: "'Sora', sans-serif",
                  color: theme === 'dark' ? '#f9fafb' : '#111827',
                }}
              >
                Portal Guru
              </div>
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase mt-0.5"
                style={{ color: '#6366f1' }}
              >
                AONE Smart CBT
              </div>
            </div>
          )}
        </div>
        {onClose && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1.5 rounded-xl transition-colors lg:hidden ml-2 shrink-0"
            style={{
              color: theme === 'dark' ? '#9ca3af' : '#6b7280',
              background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            }}
          >
            <X size={18} />
          </motion.button>
        )}
      </div>

      {/* Teacher Profile */}
      <div className="px-3 py-3"
        style={{ borderBottom: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.1)' }}
      >
        <div className="flex items-center gap-3 px-3 py-3 rounded-2xl"
          style={{
            background: theme === 'dark' ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.15)',
          }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {session?.nama?.[0]?.toUpperCase() || <GraduationCap size={15} />}
          </div>
          {!compact && (
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{
                fontFamily: "'Sora', sans-serif",
                color: theme === 'dark' ? '#f9fafb' : '#111827',
              }}>
                {session?.nama || 'Nama Guru'}
              </p>
              <p className="text-[11px] font-semibold" style={{ color: '#6366f1' }}>
                {session?.role === 'wali_kelas'
                  ? `Wali Kelas ${session?.kelas_wali || ''}`
                  : 'Guru Mapel'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto flex flex-col gap-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {navItems.map((item, i) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 30 }}
          >
            <NavItem
              item={item}
              isActive={activePage === item.key}
              onClick={() => { onNavigate(item.key); onClose?.(); }}
              sidebarWidth={sidebarWidth}
            />
          </motion.div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="px-3 pb-4 pt-2 flex gap-2"
        style={{ borderTop: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.1)' }}
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleTheme}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold transition-all"
          style={{
            background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            color: theme === 'dark' ? '#d1d5db' : '#6b7280',
            fontFamily: "'Sora', sans-serif",
          }}
        >
          {theme === 'dark'
            ? <><Sun size={16} />{!compact && ' Terang'}</>
            : <><Moon size={16} />{!compact && ' Gelap'}</>
          }
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onLogoutRequest}
          className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition-all"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color: '#ef4444',
          }}
          title="Keluar"
        >
          <LogOut size={16} />
          {!compact && <span style={{ fontFamily: "'Sora', sans-serif" }}>Keluar</span>}
        </motion.button>
      </div>

      {/* Footer */}
      {!compact && (
        <p className="text-center text-[10px] pb-3 font-medium" style={{ color: theme === 'dark' ? '#374151' : '#d1d5db' }}>
          © 2026 AONE Smart CBT • MIN 2 Sarolangun
        </p>
      )}
    </div>
  );
}

/* ─── Main Sidebar ─── */
export default function Sidebar({
  activePage,
  onNavigate,
  session,
  hasActiveExam,
  theme,
  onToggleTheme,
  onLogout,
  sidebarWidth = DEFAULT_WIDTH,  // ← Accept as prop
  setSidebarWidth = () => {}      // ← Accept setter as prop
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleLogoutRequest = () => setShowLogoutModal(true);
  const handleLogoutCancel = () => setShowLogoutModal(false);
  const handleLogoutConfirm = () => { setShowLogoutModal(false); onLogout?.(); };

  const sharedProps = {
    activePage,
    onNavigate,
    session,
    hasActiveExam,
    theme,
    onToggleTheme,
    onLogoutRequest: handleLogoutRequest,
    sidebarWidth,
  };

  return (
    <>
      {/* Google Font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap');`}</style>

      {/* ── Desktop Sidebar ── */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="hidden lg:flex fixed top-0 left-0 bottom-0 flex-col z-50 transition-colors duration-300"
        style={{
          borderRight: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.12)',
          userSelect: isResizing ? 'none' : 'auto',
          cursor: isResizing ? 'col-resize' : 'auto',
        }}
      >
        <SidebarContent {...sharedProps} onClose={null} />
        <ResizeHandle
          sidebarWidth={sidebarWidth}
          setSidebarWidth={setSidebarWidth}
          isDragging={isResizing}
          setIsDragging={setIsResizing}
        />
      </motion.aside>

      {/* ── Mobile Topbar ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 h-14 transition-colors duration-300"
        style={{
          background: theme === 'dark' ? '#0f0e17' : '#fafafe',
          borderBottom: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.12)',
        }}
      >
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl transition-colors"
          style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
        >
          <Menu size={22} />
        </motion.button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img
            src={logo}
            alt="AONE Smart CBT"
            className="w-8 h-8 rounded-xl object-contain shrink-0"
          />
          <span className="font-black text-base leading-none" style={{
            fontFamily: "'Sora', sans-serif",
            color: theme === 'dark' ? '#f9fafb' : '#111827',
          }}>
            Portal Guru
          </span>
          <span className="hidden sm:inline text-[10px] font-bold tracking-[0.2em] uppercase ml-1" style={{ color: '#6366f1' }}>
            AONE Smart CBT
          </span>
        </div>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onToggleTheme}
          className="p-2 rounded-xl transition-colors"
          style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
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
              className="lg:hidden fixed inset-0 z-[90]"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 35 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-[100] flex flex-col"
              style={{ width: 300 }}
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