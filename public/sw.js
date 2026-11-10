// Service worker tối thiểu để app cài được (PWA). Không cache gì: dữ liệu luôn lấy trực tiếp từ server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
