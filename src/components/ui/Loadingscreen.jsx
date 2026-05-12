import { motion } from 'framer-motion';

export default function LoadingScreen({ message = 'Memuat data...' }) {
  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-950 z-[9999] flex flex-col items-center justify-center gap-6">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-3xl shadow-2xl shadow-indigo-500/40">
          📋
        </div>
        <motion.div
          className="absolute -inset-2 rounded-3xl border-2 border-indigo-400/30"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      <div className="flex flex-col items-center gap-3">
        {/* Spinner */}
        <div className="flex gap-1.5">
          {[0,1,2,3].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-indigo-500"
              animate={{ y: [0, -10, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}