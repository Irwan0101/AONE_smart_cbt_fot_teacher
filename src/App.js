import { useState, useEffect } from 'react';
import TeacherLogin from './pages/Login';
import DashboardPage from './pages/DashboardPage';
import Sidebar from './components/ui/Sidebar';
import { ToastProvider } from './components/ui/Toast';
import { supabase } from './lib/supabase';

import SiswaPage    from './pages/SiswaPage';
import BankSoalPage from './pages/BankSoalPage';
import JadwalPage   from './pages/JadwalPage';
import PengawasPage from './pages/PengawasPage';
import ReportPage   from './pages/ReportPage';
import FloatingChat from './components/ui/Floatingchat';

import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarDays,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';

const PAGE_META = {
  dashboard: { label: 'Dashboard',    icon: LayoutDashboard, color: '#6366f1' },
  siswa:     { label: 'Data Siswa',   icon: Users,           color: '#10b981' },
  banksoal:  { label: 'Bank Soal',    icon: BookOpen,        color: '#f59e0b' },
  jadwal:    { label: 'Jadwal Ujian', icon: CalendarDays,    color: '#3b82f6' },
  pengawas:  { label: 'Pengawas',     icon: ShieldCheck,     color: '#ef4444' },
  report:    { label: 'Report Nilai', icon: BarChart3,       color: '#8b5cf6' },
};

/* ── Page Icon Badge ── */
function PageBadge({ meta }) {
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-2.5">
      {/* icon pill */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: `${meta.color}18`,
          border: `1.5px solid ${meta.color}30`,
        }}
      >
        <Icon size={14} style={{ color: meta.color }} strokeWidth={2.2} />
      </div>
      <span
        className="text-sm font-bold tracking-tight"
        style={{ color: 'inherit' }}
      >
        {meta.label}
      </span>
    </div>
  );
}

function AppLayout({ session, onLogout }) {
  const [activePage, setActivePage]       = useState('dashboard');
  const [theme, setTheme]                 = useState(() => localStorage.getItem('theme') || 'light');
  const [hasActiveExam, setHasActiveExam] = useState(false);

  /* Cek jadwal aktif hari ini setiap 1 menit */
  useEffect(() => {
    const checkActiveExam = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('tugas_mengawas')
          .select(`id, jadwal_ujian!jadwal_id(id, tanggal, status)`)
          .eq('teacher_id', session.id)
          .eq('is_active', true)
          .eq('jadwal_ujian.tanggal', today)
          .eq('jadwal_ujian.status', 'aktif')
          .limit(1);
        setHasActiveExam((data?.length || 0) > 0);
      } catch { /* silent */ }
    };
    checkActiveExam();
    const interval = setInterval(checkActiveExam, 60_000);
    return () => clearInterval(interval);
  }, [session.id]);

  /* Sinkron dark mode ke <html> */
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage session={session} />;
      case 'siswa':     return <SiswaPage     session={session} />;
      case 'banksoal':  return <BankSoalPage  session={session} />;
      case 'jadwal':    return <JadwalPage     session={session} />;
      case 'pengawas':  return <PengawasPage  session={session} />;
      case 'report':    return <ReportPage    session={session} />;
      default:          return <DashboardPage session={session} />;
    }
  };

  const meta = PAGE_META[activePage] || PAGE_META.dashboard;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">

      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        session={session}
        hasActiveExam={hasActiveExam}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={onLogout}
      />

      <main className="lg:ml-[260px] min-h-screen pt-14 lg:pt-0">

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between text-gray-700 dark:text-gray-300">

          {/* Left: icon badge + page name */}
          <PageBadge meta={meta} />

          {/* Right: tanggal */}
          <span className="hidden sm:block text-xs font-medium text-gray-400 dark:text-gray-500">
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
          <span className="sm:hidden text-xs font-medium text-gray-400 dark:text-gray-500">
            {new Date().toLocaleDateString('id-ID', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </span>
        </header>

        {/* Page content */}
        <div className="p-4 sm:p-6">
          {renderPage()}
        </div>

        <FloatingChat session={session} />
      </main>
    </div>
  );
}

/* ── Root ── */
export default function App() {
  const [session, setSession]   = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('guru_session');
      if (saved) setSession(JSON.parse(saved));
    } catch (e) { /* silent */ }
    setChecking(false);
  }, []);

  const handleLogin  = (data) => { localStorage.setItem('guru_session', JSON.stringify(data)); setSession(data); };
  const handleLogout = ()     => { localStorage.removeItem('guru_session'); setSession(null); };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      {!session
        ? <TeacherLogin onLogin={handleLogin} />
        : <AppLayout session={session} onLogout={handleLogout} />
      }
    </ToastProvider>
  );
}