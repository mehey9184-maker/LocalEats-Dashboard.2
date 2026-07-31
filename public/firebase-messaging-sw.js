// Firebase Service Worker for Background Push Notifications
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "",
  authDomain: "localeats-5e26e.firebaseapp.com",
  projectId: "localeats-5e26e",
  storageBucket: "localeats-5e26e.firebasestorage.app",
  messagingSenderId: "281496568360",
  appId: ""
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);
  const notificationTitle = payload.notification?.title || 'LocalEats Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new alert for your order.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
