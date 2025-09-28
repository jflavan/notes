// Service Worker for Notes PWA
const CACHE_NAME = 'notes-app-v1.0.0';
const STATIC_CACHE_NAME = 'notes-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'notes-dynamic-v1.0.0';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/manifest.json',
  // Add other static assets as needed
];

// Resources that can be cached on demand
const CACHE_PATTERNS = [
  /\/src\/.+\.tsx?$/,
  /\/src\/.+\.css$/,
  /\/assets\/.+\.(png|jpg|jpeg|svg|gif|webp)$/,
  /\/fonts\/.+\.(woff2?|ttf|eot)$/
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName !== STATIC_CACHE_NAME && 
                     cacheName !== DYNAMIC_CACHE_NAME &&
                     (cacheName.startsWith('notes-static-') || 
                      cacheName.startsWith('notes-dynamic-'));
            })
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', request.url);
          return cachedResponse;
        }

        // Clone request for caching
        const fetchRequest = request.clone();
        
        return fetch(fetchRequest)
          .then(response => {
            // Check if response is valid
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Check if we should cache this resource
            const shouldCache = CACHE_PATTERNS.some(pattern => 
              pattern.test(url.pathname) || 
              STATIC_ASSETS.includes(url.pathname)
            );

            if (shouldCache) {
              // Clone response for caching
              const responseToCache = response.clone();
              
              caches.open(DYNAMIC_CACHE_NAME)
                .then(cache => {
                  console.log('[SW] Caching new resource:', request.url);
                  cache.put(request, responseToCache);
                });
            }

            return response;
          })
          .catch(error => {
            console.error('[SW] Network request failed:', error);
            
            // Return offline fallback for HTML requests
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            // Return empty response for other failed requests
            return new Response('', { 
              status: 408, 
              statusText: 'Request timeout' 
            });
          });
      })
  );
});

// Background sync for data persistence
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'notes-backup') {
    event.waitUntil(performBackgroundSync());
  }
});

async function performBackgroundSync() {
  try {
    // Perform any background sync operations
    console.log('[SW] Performing background sync');
    
    // You could implement data sync logic here
    // For example, sync with a remote server when online
    
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Push notification handling (for future features)
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'You have new updates in your notes',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open Notes',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192x192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Notes App', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling from main thread
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('[SW] Service worker script loaded');
