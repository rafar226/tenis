const CACHE = 'neon-arcade-v7';
const ASSETS = ['./', './index.html', './arcade.css', './pong/', './pong/index.html', './pong/styles.css', './pong/game.js', './snake/', './snake/index.html', './snake/snake.css', './snake/snake.js', './bubble/', './bubble/index.html', './bubble/bubble.css', './bubble/effects.css', './bubble/bubble.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request))));
