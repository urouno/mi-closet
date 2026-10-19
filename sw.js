/* ============================================================
   MI CLÓSET · Copia sin conexión (service worker)
   Guarda en el teléfono la página y el ícono para que la app
   abra aunque no haya señal. Tus datos ya se guardan aparte,
   en el almacenamiento de la app.

   - La página se pide primero a internet (así recibes las
     versiones nuevas que subas). Si no hay señal o tarda más
     de 4 segundos, se abre la copia guardada.
   - Las peticiones a Google (Apps Script) no pasan por aquí.

   Si algún día cambias ESTE archivo, sube el número de
   VERSION para que el teléfono descarte la copia anterior.
   ============================================================ */

const VERSION = 'v1';
const CACHE = 'mi-closet-' + VERSION;
const ARCHIVOS = ['./', './index.html', './icono.png'];
const ESPERA_RED = 4000;   // milisegundos antes de usar la copia guardada

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k.startsWith('mi-closet-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Solo archivos de este mismo sitio; Google Sheets y Apps Script van directo a internet.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') e.respondWith(pagina(req));
  else e.respondWith(archivo(req));
});

/* La página: internet primero, copia guardada si no hay señal */
async function pagina(req) {
  const cache = await caches.open(CACHE);
  try {
    const resp = await conTiempo(fetch(req, { cache: 'no-store' }), ESPERA_RED);
    if (resp.ok) { cache.put('./index.html', resp.clone()); return resp; }
    throw new Error('respuesta ' + resp.status);
  } catch (err) {
    const copia = (await cache.match('./index.html')) || (await cache.match('./'));
    if (copia) return copia;
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:40px 22px;color:#55595E">Sin conexión. Abre Mi clóset una vez con señal para que se guarde en el teléfono.</body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

/* El ícono y otros archivos: copia guardada primero, y se renueva en segundo plano */
async function archivo(req) {
  const cache = await caches.open(CACHE);
  const copia = await cache.match(req, { ignoreSearch: true });
  const red = fetch(req).then(resp => { if (resp.ok) cache.put(req, resp.clone()); return resp; }).catch(() => null);
  return copia || (await red) || new Response('', { status: 504 });
}

function conTiempo(promesa, ms) {
  return new Promise((ok, mal) => {
    const reloj = setTimeout(() => mal(new Error('tiempo')), ms);
    promesa.then(r => { clearTimeout(reloj); ok(r); }, e => { clearTimeout(reloj); mal(e); });
  });
}
