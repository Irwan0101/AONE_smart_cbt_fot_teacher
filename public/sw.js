// ─────────────────────────────────────────────────────────────
// Service Worker – Web Push Notifications
// Letakkan file ini di: /public/sw.js
// ─────────────────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Terima push dari server ──────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { title: 'Notifikasi', body: event.data?.text() }; }

  const { title = 'Jadwal Mengawas', body = '', icon, badge, tag, data: extra } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-72.png',
      tag: tag || 'jadwal-mengawas',
      renotify: true,
      vibrate: [200, 100, 200],
      data: extra || {},
      actions: [
        { action: 'view', title: '📋 Lihat Jadwal' },
        { action: 'dismiss', title: 'Tutup' },
      ],
    })
  );
});

// ── Klik notifikasi ──────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const url = event.notification.data?.url || '/jadwal';
      const existing = clients.find(c => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});