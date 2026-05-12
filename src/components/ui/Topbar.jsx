import { useState, useEffect } from 'react';

export default function Topbar({ title, subtitle, actions }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const DAYS  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const MONTHS= ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  return (
    <header className="fixed top-0 left-[260px] right-0 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center px-6 gap-4 z-40 transition-colors duration-300">
      <div className="flex-1">
        <h1 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-[11px] text-gray-400 font-medium mt-0.5">{subtitle}</p>}
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}

      <div className="text-right px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0">
        <p className="text-sm font-extrabold text-gray-900 dark:text-white tabular-nums tracking-tight">
          {time.toLocaleTimeString('id-ID')}
        </p>
        <p className="text-[10px] text-gray-400 font-medium">
          {DAYS[time.getDay()]}, {time.getDate()} {MONTHS[time.getMonth()]} {time.getFullYear()}
        </p>
      </div>
    </header>
  );
}