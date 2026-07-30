const CACHE_VERSION = 'rae-pwa-v10';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const APP_SHELL = [
    '/',
    '/aluno/login',
    '/aluno/dashboard',
    '/offline.html',
    '/manifest.webmanifest',
    '/rumo-ao-esporte-logo.png',
    '/pwa/icon-192.png',
    '/pwa/icon-512.png',
    '/pwa/icon-maskable-512.png',
    '/pwa/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(APP_SHELL_CACHE);

        await Promise.all(APP_SHELL.map(async (url) => {
            try {
                await cache.add(new Request(url, { cache: 'reload' }));
            } catch (error) {
                console.warn(`[PWA] Não foi possível pré-carregar ${url}.`, error);
            }
        }));

        // Não chama skipWaiting aqui: a versão nova fica aguardando até o usuário
        // aceitar no aviso "Nova versão disponível" (evita trocar o código embaixo
        // de uma tela em uso, ex: no meio de um cadastro).
    })());
});

// Enviado pelo aviso de nova versão quando o usuário clica em "Recarregar".
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();

        await Promise.all(
            cacheNames
                .filter((cacheName) => ![APP_SHELL_CACHE, STATIC_CACHE].includes(cacheName))
                .map((cacheName) => caches.delete(cacheName))
        );

        await self.clients.claim();
    })());
});

const networkFirstNavigation = async (request) => {
    const cache = await caches.open(APP_SHELL_CACHE);

    try {
        // 'reload' ignora o cache HTTP do navegador: garante que um deploy novo
        // chegue no app instalado sem esperar o Cache-Control expirar.
        const response = await fetch(request, { cache: 'reload' });

        if (response.ok) {
            await cache.put(request, response.clone());
        }

        return response;
    } catch {
        return (await cache.match(request))
            || (await cache.match('/aluno/dashboard'))
            || (await cache.match('/aluno/login'))
            || (await cache.match('/offline.html'));
    }
};

const cacheFirstStaticAsset = async (request) => {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) return cachedResponse;

    const response = await fetch(request);

    if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
    }

    return response;
};

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Dados de autenticação e pagamentos são externos e nunca entram no cache do app.
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirstNavigation(request));
        return;
    }

    if (['script', 'style', 'image', 'font'].includes(request.destination)) {
        event.respondWith(cacheFirstStaticAsset(request));
    }
});
