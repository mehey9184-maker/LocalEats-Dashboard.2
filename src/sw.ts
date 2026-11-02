/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Precache generated assets
precacheAndRoute(self.__WB_MANIFEST || []);

self.skipWaiting();
clientsClaim();

// Handle Push Events
self.addEventListener('push', (event) => {
  let payload:unknown;
  try {payload=event.data?.json() ?? null;}catch{return;}
  if(!payload || typeof payload!=="object")return;
  const packet=payload as {data?:{type?:string;order_id?:string};title?:string;body?:string;url?:string};
  if(packet.data?.type==="merchant_new_order"){
    // This is a wake-up only: open the API-verified Orders screen to confirm
    // state and amounts. Never display customer PII from push data.
    const orderId=typeof packet.data.order_id==="string" ? packet.data.order_id : "";
    if(!/^[a-f0-9-]{36}$/i.test(orderId))return;
    event.waitUntil(self.registration.showNotification("New LocalEats order",{
      body:"A customer placed an order. Open the dashboard to confirm it.",
      icon:"/logo.png",badge:"/logo.png",tag:"merchant-order-"+orderId,
      data:{url:"/"},
    }));
    return;
  }
  // Preserve the pre-existing general notification channel (for Rider and
  // other roles), but do not show raw, unrecognized FCM data payloads.
  if(typeof packet.title!=="string" || typeof packet.body!=="string")return;
  const url=typeof packet.url==="string" && packet.url.startsWith("/") && !packet.url.startsWith("//") ? packet.url : "/";
  event.waitUntil(self.registration.showNotification(packet.title,{
    body:packet.body,icon:"/logo.png",badge:"/logo.png",
    data:{url},
  }));
});

// Handle Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle Service Worker Background Sync for Offline Mutations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-offline-updates' || event.tag === 'localeats-offline-queue') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
        });
      })
    );
  }
});
