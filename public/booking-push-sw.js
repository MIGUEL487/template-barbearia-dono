/* Push only. Deliberately no fetch listener, offline cache, or precache. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data;
    try { data = event.data.json(); } catch { return; }
    if (!data || !/^[a-f0-9]{64}$/.test(data.eventId || '') || typeof data.title !== 'string' || typeof data.body !== 'string') return;
    // Persistent event IDs survive worker termination. This is not an asset cache.
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('auto-stilo-push', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('seen');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(() => null);
    let duplicate = false;
    if (db) {
      duplicate = await new Promise((resolve, reject) => {
        const tx = db.transaction('seen', 'readwrite'), store = tx.objectStore('seen');
        const request = store.get(data.eventId);
        request.onsuccess = () => { duplicate = !!request.result; if (!duplicate) store.put(Date.now(), data.eventId); };
        // Keep IDs for 48h, longer than the push TTL, with a bounded storage lifetime.
        const cursor = store.openCursor();
        cursor.onsuccess = () => { const entry = cursor.result; if (entry) { if (entry.value < Date.now()-172800000) entry.delete(); entry.continue(); } };
        tx.oncomplete = () => resolve(duplicate); tx.onerror = () => reject(tx.error);
      }).catch(() => false);
    }
    if (duplicate) { if (db) db.close(); return; }
    const windows = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    try { await self.registration.showNotification(data.title.slice(0, 80), {
      body: data.body.slice(0, 420), icon:'/pwa/icon-192.png', badge:'/pwa/badge-96.png',
      tag:data.eventId, renotify:false, silent:windows.some(client => client.visibilityState === 'visible'),
      data:{url:'/agenda'},
    }); } catch (error) {
      // A failed OS display must remain retryable, rather than poisoning dedup.
      if (db) await new Promise(resolve => {
        const tx = db.transaction('seen', 'readwrite'); tx.objectStore('seen').delete(data.eventId);
        tx.oncomplete = tx.onerror = () => resolve();
      });
      throw error;
    } finally { if (db) db.close(); }
    windows.forEach(client => client.postMessage({type:'BOOKING_PUSH',eventId:data.eventId,title:data.title,body:data.body}));
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) { await client.navigate('/agenda'); await client.focus(); return; }
    }
    await self.clients.openWindow('/agenda');
  })());
});
