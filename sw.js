/* Mi clóset: copia sin conexión.
   Estrategia «primero la red»: si hay señal, siempre trae la versión más nueva
   de GitHub Pages (y la guarda); si no hay señal, abre la última copia guardada.
   Así los cambios que subes se ven al abrir la app, sin quedarse con una versión vieja.
   Los datos de Google Sheets no pasan por aquí: los guarda la propia app. */
const CACHE = 'micloset-v8';
const FUENTES = 'micloset-fuentes-v1';
const BASICOS = ['./', 'index.html', 'manifest.json', 'icono.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(BASICOS.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FUENTES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  /* Tipografías de Google: se guardan la primera vez y después se usan sin red (no cambian) */
  if (r.method === 'GET' && (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com')) {
    e.respondWith(caches.open(FUENTES).then(c => c.match(r).then(m => m || fetch(r).then(res => {
      if (res.ok || res.type === 'opaque') c.put(r, res.clone()).catch(() => {});
      return res;
    }).catch(() => Response.error()))));
    return;
  }
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  /* Si la red tarda más de 4 segundos (señal mala), se usa la copia guardada */
  const guardada = () => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : undefined));
  e.respondWith(new Promise(resolve => {
    let listo = false;
    const fin = res => { if (!listo) { listo = true; clearTimeout(reloj); resolve(res); } };
    const red = fetch(r).then(res => {
      if (res.ok && res.type === 'basic') { const copia = res.clone(); caches.open(CACHE).then(c => c.put(r, copia)).catch(() => {}); }
      fin(res);
      return res;
    }).catch(() => guardada().then(m => fin(m || Response.error())));
    const reloj = setTimeout(() => {
      guardada().then(m => { if (m) fin(m); else return red; });
    }, 4000);
  }));
});
