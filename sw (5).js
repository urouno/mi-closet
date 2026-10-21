/* Mi clóset: copia sin conexión.
   Estrategia «primero la red»: si hay señal, siempre trae la versión más nueva
   de GitHub Pages (y la guarda); si no hay señal, abre la última copia guardada.
   Así los cambios que subes se ven al abrir la app, sin quedarse con una versión vieja.
   Los datos de Google Sheets no pasan por aquí: los guarda la propia app. */
const CACHE = 'micloset-v4';
const BASICOS = ['./', 'index.html', 'icono.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(BASICOS.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  /* Si la red tarda más de 4 segundos (señal mala), se usa la copia guardada */
  const red = fetch(r).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(r, copia)); }
    return res;
  });
  const guardada = () => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : undefined));
  const lenta = new Promise(ok => setTimeout(ok, 4000)).then(guardada).then(m => m || red);
  e.respondWith(Promise.race([red, lenta]).catch(() => guardada().then(m => m || Response.error())));
});
