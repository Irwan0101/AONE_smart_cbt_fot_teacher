import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const notes = {
      success: [[523,0],[659,0.1],[784,0.2]],
      error:   [[400,0],[300,0.12]],
      warning: [[440,0],[440,0.13]],
      info:    [[600,0]],
    }[type] || [[600,0]];
    notes.forEach(([f,t]) => osc.frequency.setValueAtTime(f, ctx.currentTime + t));
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch { /* silent */ }
};

const CONFIG = {
  success: { icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-950', border: 'border-emerald-200 dark:border-emerald-800', iconColor: 'text-emerald-500', bar: 'bg-emerald-500' },
  error:   { icon: XCircle,     bg: 'bg-red-50 dark:bg-red-950',         border: 'border-red-200 dark:border-red-800',         iconColor: 'text-red-500',     bar: 'bg-red-500'     },
  warning: { icon: AlertTriangle,bg:'bg-amber-50 dark:bg-amber-950',     border: 'border-amber-200 dark:border-amber-800',     iconColor: 'text-amber-500',   bar: 'bg-amber-500'   },
  info:    { icon: Info,         bg: 'bg-blue-50 dark:bg-blue-950',       border: 'border-blue-200 dark:border-blue-800',       iconColor: 'text-blue-500',    bar: 'bg-blue-500'    },
};

function ToastItem({ id, type = 'info', title, message, duration = 4000, onDismiss }) {
  const c = CONFIG[type];
  const Icon = c.icon;
  return (
    <motion.div
      layout
      initial={{ x: 120, opacity: 0, scale: 0.9 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 120, opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`relative flex items-start gap-3 p-4 rounded-2xl border shadow-2xl min-w-[300px] max-w-[400px] overflow-hidden cursor-pointer select-none ${c.bg} ${c.border}`}
      onClick={() => onDismiss(id)}
    >
      <Icon className={`shrink-0 mt-0.5 ${c.iconColor}`} size={18} />
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{title}</p>}
        {message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{message}</p>}
      </div>
      <X size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 mt-0.5 transition-colors" />
      {duration > 0 && (
        <motion.div
          className={`absolute bottom-0 left-0 h-[3px] rounded-full ${c.bar}`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);

  const toast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++idRef.current;
    playSound(type);
    setToasts(p => [...p, { id, type, title, message, duration }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem {...t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);