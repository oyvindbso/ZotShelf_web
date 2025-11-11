const CACHE_NAME = 'zotshelf-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache installation failed:', error);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim any clients immediately
  return self.clients.claim();
});

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests and chrome-extension
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network first strategy for API calls
  if (event.request.url.includes('/api/') || event.request.url.includes('/.netlify/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If network fails, we don't cache API responses
          return new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  // Cache first for static assets, network fallback
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Return cached version
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the fetched response
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Return offline page or error
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
