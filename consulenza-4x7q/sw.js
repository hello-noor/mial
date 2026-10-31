/* Network-first: se sei online prendi sempre l'ultima versione, offline usa la copia salvata. */
var C='massini-tracker';
self.addEventListener('install',function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(function(c){return c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'])}));
});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',function(e){
  var r=e.request;
  if(r.method!=='GET')return;
  e.respondWith(
    fetch(r).then(function(res){
      if(res&&(res.ok||res.type==='opaque')){var cp=res.clone();caches.open(C).then(function(c){c.put(r,cp)})}
      return res;
    }).catch(function(){return caches.match(r).then(function(m){return m||caches.match('./')})})
  );
});
