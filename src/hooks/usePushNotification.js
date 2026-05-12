// ─────────────────────────────────────────────────────────────
// usePushNotification.js
// Letakkan di: src/hooks/usePushNotification.js
//
// Cara pakai:
//   const { subscribed, subscribe, unsubscribe, scheduleReminders } = usePushNotification(session);
//
// Requires:
//   - /public/sw.js  (service worker)
//   - Supabase tabel teachers kolom: push_subscription jsonb
//   - Jalankan: npx web-push generate-vapid-keys  → isi VITE_VAPID_PUBLIC_KEY
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function usePushNotification(session) {
  const [subscribed,    setSubscribed]    = useState(false);
  const [swReady,       setSwReady]       = useState(false);
  const [registration,  setRegistration]  = useState(null);
  const [loading,       setLoading]       = useState(false);

  // ── Register Service Worker ──────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    navigator.serviceWorker.register('/sw.js').then(reg => {
      setRegistration(reg);
      setSwReady(true);
      // Cek apakah sudah subscribed
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub));
    }).catch(err => console.warn('SW register failed:', err));
  }, []);

  // ── Subscribe ────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!swReady || !registration || !session?.id) return false;
    if (!VAPID_PUBLIC_KEY) {
      console.error('VITE_VAPID_PUBLIC_KEY belum diset di .env');
      return false;
    }
    setLoading(true);
    try {
      const existing = await registration.pushManager.getSubscription();
      if (existing) { setSubscribed(true); setLoading(false); return true; }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Simpan subscription ke Supabase
      await supabase
        .from('teachers')
        .update({ push_subscription: sub.toJSON() })
        .eq('id', session.id);

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('Subscribe error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [swReady, registration, session?.id]);

  // ── Unsubscribe ──────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!registration || !session?.id) return;
    setLoading(true);
    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await supabase
        .from('teachers')
        .update({ push_subscription: null })
        .eq('id', session.id);
      setSubscribed(false);
    } catch (err) {
      console.error('Unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, [registration, session?.id]);

  // ── Schedule Reminders (client-side via setTimeout) ──────
  // Kirim local notification H-1 hari dan H-30 menit sebelum ujian
  // Catatan: hanya berjalan selama tab terbuka.
  // Untuk server-side push, kirim dari backend/edge function ke push_subscription.
  const scheduleReminders = useCallback((jadwalList) => {
    if (!swReady || !registration) return;

    jadwalList.forEach(jadwal => {
      if (!jadwal.tanggal || !jadwal.waktu_mulai) return;

      const ujianTime = new Date(`${jadwal.tanggal}T${jadwal.waktu_mulai}`);
      const now       = new Date();

      // H-1 hari
      const minus1Day = new Date(ujianTime.getTime() - 24 * 60 * 60 * 1000);
      if (minus1Day > now) {
        const delay = minus1Day.getTime() - now.getTime();
        setTimeout(() => {
          registration.showNotification('🔔 Pengingat Mengawas Besok', {
            body: `Kamu bertugas mengawas di ${jadwal.nama_ruang} – ${jadwal.mapel}\nBesok, ${formatTime(jadwal.waktu_mulai)}`,
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            tag: `remind-1d-${jadwal.jadwal_id}`,
            vibrate: [200, 100, 200],
            data: { url: '/jadwal' },
          });
        }, delay);
      }

      // H-30 menit
      const minus30Min = new Date(ujianTime.getTime() - 30 * 60 * 1000);
      if (minus30Min > now) {
        const delay = minus30Min.getTime() - now.getTime();
        setTimeout(() => {
          registration.showNotification('⏰ 30 Menit Lagi Mengawas!', {
            body: `Segera menuju ${jadwal.nama_ruang}\n${jadwal.mapel} – ${formatTime(jadwal.waktu_mulai)}`,
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            tag: `remind-30m-${jadwal.jadwal_id}`,
            vibrate: [300, 100, 300, 100, 300],
            data: { url: '/jadwal' },
            actions: [
              { action: 'view', title: '📋 Lihat Detail' },
            ],
          });
        }, delay);
      }
    });
  }, [swReady, registration]);

  return { subscribed, swReady, loading, subscribe, unsubscribe, scheduleReminders };
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${h}:${m}`;
}