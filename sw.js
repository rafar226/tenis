const CACHE = 'neon-arcade-v9';
const ASSETS = ['./', './index.html', './arcade.css', './pong/', './pong/index.html', './pong/styles.css', './pong/game.js', './snake/', './snake/index.html', './snake/snake.css', './snake/snake.js', './bubble/', './bubble/index.html', './bubble/bubble.css', './bubble/effects.css', './bubble/bubble.js', './racer/', './racer/index.html', './racer/racer.css', './racer/racer.js', './turbo/', './turbo/index.html', './turbo/turbo.css', './turbo/turbo.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request))));
