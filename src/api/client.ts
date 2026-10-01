/**
 * client.ts — Capa de acceso al backend Django de Felipe.
 *
 * MODO ACTUAL: los endpoints /api/* NO existen todavía en su repo (monolito con
 * templates). Este cliente está escrito contra la Fase B propuesta en
 * docs/INTEGRACION_BACKEND.md §3-B. Mientras tanto, AppContext usa `isApiEnabled()
 * === false` y sigue con el mock de localStorage, por lo que nada de esto rompe la demo.
 *
 * Convenciones heredadas del backend real (verificadas en app/views.py):
 *  - Sesión por cookie de Django -> fetch con credentials:'include'.
 *  - Mutaciones protegidas con CSRF -> handshake desde /api/csrf/ (o cookie csrftoken).
 *  - IVA 19% se calcula server-side al agregar al carrito; NUNCA calcularlo acá.
 *  - El checkout redirige el navegador a url_webpay (no es fetch/XHR).
 */
import type {
  DCatalogoPage, DTrack, DVenta, DPagoInit, DUser,
  DHistorialCompra, DHistorialVenta, DComentario, DSuscripcion,
} from './types';

const BASE = ((import.meta as any).env?.VITE_DJANGO_URL || 'http://localhost:8000').replace(/\/$/, '');
export const API_MODE = ((import.meta as any).env?.VITE_API_MODE || 'mock') as 'mock' | 'rest';

/** La UI pregunta esto para decidir si hidrata desde red o desde localStorage. */
export const isApiEnabled = () => API_MODE === 'rest';

let csrfToken = '';

async function refreshCsrf(): Promise<void> {
  try {
    const r = await fetch(`${BASE}/api/csrf/`, { credentials: 'include' });
    if (r.ok) {
      const j = await r.json();
      csrfToken = j.detail ?? j.csrf_token ?? ''; // DRF GetCSRFToken estándar usa 'detail'
      return;
    }
  } catch { /* offline */ }
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  if (m) csrfToken = m[1];
}

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!csrfToken && init.method && init.method !== 'GET') await refreshCsrf();
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      ...init.headers,
    },
  });
  if (res.status === 403) { await refreshCsrf(); return http<T>(path, init); } // reintentar 1x con token fresco
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[${res.status}] ${path}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Catálogo & Tracks ----------
export interface CatalogoFilters {
  q?: string;              // nombre_track | productor | género (icontains, como catalogo())
  genero?: string;         // Genero_Musical.descripcion exacto
  precio?: string;         // '0-5000' | '5001-10000' | '10001-20000' | '20001-mas' (rangos reales del backend)
  orden?: 'recientes' | 'antiguos' | 'precio_menor' | 'precio_mayor' | 'nombre';
  page?: number;
}
export const getCatalogo = (f: CatalogoFilters = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
  return http<DCatalogoPage>(`/api/catalogo/?${p}`);
};
export const getTrack = (id: number) => http<DTrack>(`/api/track/${id}/`);
export const getComments = (id: number) => http<DComentario[]>(`/api/track/${id}/comentarios/`);
export const addComment = (id: number, contenido: string) =>
  http<DComentario>(`/api/track/${id}/comentarios/`, { method: 'POST', body: JSON.stringify({ contenido }) });

// ---------- Auth (sesión Django + correo de activación ya implementado por Felipe) ----------
export const getSession = () => http<DUser | null>('/api/session/');
export const login = (username: string, password: string) =>
  http<DUser>('/api/auth/login/', { method: 'POST', body: JSON.stringify({ username, password }) });
export const logout = () => http<{ ok: boolean }>('/api/auth/logout/', { method: 'POST' });
export const register = (data: FormData) => http<{ detail: string }>('/api/auth/registro/', { method: 'POST', body: data });

// ---------- Carrito (tabla Venta, completada=False) ----------
/** El shim de Django responde {items, subtotal, iva, total} — los totales los
 * calcula SIEMPRE el servidor (regla de views.py); no sumar en el SPA. */
export interface CartPayload { items: DVenta[]; subtotal: number; iva: number; total: number }
export const getCart = () => http<CartPayload>('/api/carrito/');
/** 409 esperado si ya comprado o duplicado — mensajes textuales idénticos a views.py */
export const addToCart = (idTrack: number) => http<DVenta>(`/api/carrito/agregar/${idTrack}/`, { method: 'POST' });
export const removeFromCart = (ventaId: number) => http<{ ok: boolean }>(`/api/carrito/${ventaId}/`, { method: 'DELETE' });

// ---------- Pagos Webpay Plus ----------
/** POST /api/pago/ -> tx.create(buy_order, session_id, amount, return_url). Devuelve url_webpay. */
export const startPago = () => http<DPagoInit>('/api/pago/', { method: 'POST' });
/** Redirigir el navegador: window.location.href = init.url_webpay (Webpay hace POST-back a /pago/exito-carrito/). */
export const cancelPendingPago = (transactionId: number) =>
  http<{ ok: boolean }>(`/api/pago/cancelar/${transactionId}/`, { method: 'POST' });

// ---------- Productor ----------
export const uploadTrack = (form: FormData) => http<DTrack>('/api/upload/', { method: 'POST', body: form });
export const updateTrackMeta = (id: number, data: Partial<DTrack>) =>
  http<DTrack>(`/api/track/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteTrack = (id: number) => http<{ ok: boolean }>(`/api/track/${id}/delete/`, { method: 'POST' });
export const getSales = () => http<DHistorialVenta[]>('/api/mis-ventas/');

// ---------- Artista / Usuario ----------
export const getPurchases = () => http<DHistorialCompra[]>('/api/mis-compras/');
export const toggleLike = (idTrack: number) =>
  http<{ liked: boolean }>(`/api/like/${idTrack}/`, { method: 'POST' });
export const getProfile = (username: string) => http<DUser>(`/api/perfil/${username}/`);
export const getUsersCatalog = (tipo: 'todos' | 'artistas' | 'productores', q = '') =>
  http<DUser[]>(`/api/usuarios/?tipo=${tipo}&q=${encodeURIComponent(q)}`);

// ---------- Suscripciones ----------
export const getSubscriptionsOf = (userId: number) => http<DSuscripcion[]>(`/api/suscripciones/?user=${userId}`);
export const startSuscripcionPago = (idSus: number) =>
  http<DPagoInit>(`/api/suscripcion/${idSus}/pago/`, { method: 'POST' });
