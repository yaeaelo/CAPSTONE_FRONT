import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Backend Django (BeatsCloud). Con VITE_API_MODE=rest, el navegador habla SIEMPRE con :3000 y Vite
// reenvía estas rutas a Django => mismo origen: cookies de sesión + CSRF funcionan sin CORS, y el
// retorno de Webpay (que usa el Host de la petición) vuelve a :3000 y también llega a Django.
// No cambiar el Host (sin changeOrigin): Django valida el Origin del POST contra él.
const DJANGO = 'http://127.0.0.1:8000';
const proxied = ['/api', '/media', '/static', '/track', '/pago', '/activar', '/accounts', '/recuperar', '/admin'];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: Object.fromEntries(proxied.map((p) => [p, { target: DJANGO }])),
  },
});
