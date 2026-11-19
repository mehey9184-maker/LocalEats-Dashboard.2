/* LocalEats merchant FCM worker. Separate scope from PWA offline worker.
 * These Firebase app identifiers are PUBLIC configuration, not credentials.
 */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL('/',self.location.origin).href;
  event.waitUntil((async()=>{
    const tabs=await clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=tabs.find(tab=>new URL(tab.url).origin===self.location.origin);
    if(existing){
      await existing.focus();
      if(event.notification.data?.type==='pickup_new_order') existing.postMessage({type:'merchant-pickup-order-push'});
      const type=event.notification.data?.type || event.notification.data?.FCM_MSG?.data?.type;
      if(type==='pickup_acceptance')existing.postMessage({type:'merchant-pickup-acceptance-push'});
      return;
    }
    await clients.openWindow(destination);
  })());
});

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
firebase.initializeApp({"apiKey":"AIzaSyBuX3QvWFTWSLoaEsMPE7TsQLEodAaFS1M","authDomain":"localeats-5e26e.firebaseapp.com","projectId":"localeats-5e26e","storageBucket":"localeats-5e26e.firebasestorage.app","messagingSenderId":"281496568360","appId":"1:281496568360:web:45557127bbd2a352bfeb1d"});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  // Notification-payload messages are already displayed by FCM.
  // Data-only messages: never turn a synthetic connectivity check into an order.
  if(payload.notification)return;
  if(payload.data?.type==='merchant_push_test'){
    return self.registration.showNotification('LocalEats notification test',{
      body:'This is a test alert. No customer order or payment was created.',
      icon:'/logo.png',badge:'/logo.png',
      tag:'localeats-push-test-'+String(payload.data.test_id||'test').slice(0,80),
      data:{type:'merchant_push_test'},
    });
    return;
  }
  if(payload.data?.type!=='pickup_new_order')return;
  return self.registration.showNotification('New pickup order received',{
    body:'Open your LocalEats dashboard to check and accept the order.',
    icon:'/logo.png',badge:'/logo.png',
    tag:'localeats-new-order-'+String(payload.data.event_id||payload.data.order_id||'pickup').slice(0,80),
    data:{type:'pickup_new_order'},
  });
});
