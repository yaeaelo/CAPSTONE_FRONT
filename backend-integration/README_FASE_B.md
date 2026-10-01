# Fase B — API REST sobre el backend de Felipe (PR mínimo, sin tocar su lógica)

**Estado: implementado y probado.** Este paquete expone la lógica que ya existe en
`app/views.py` como API JSON para el SPA React, **sin reescribir ninguna regla**.

## Qué es `api_shim.py`

Un solo archivo (~700 líneas) que agrega endpoints `/api/*` delegando en las mismas
consultas y validaciones del monolito:

| Regla de negocio | Dónde vive HOY (Felipe) | Qué hace el shim |
|---|---|---|
| IVA 19% server-side (`round(precio*0.19)`) | `agregar_al_carrito()` l.1683 | mismo cálculo, misma tabla `Venta(completada=False)` |
| Anti-recompra / anti-duplicado (409) | `agregar_al_carrito()` | mismos `.exists()` sobre HistorialCompra ∪ HistorialVenta |
| Webpay create→commit→verificación total | `pago()` + `exito_carrito()` | `/api/pago/` SOLO inicia; el retorno sigue siendo SU vista HTML intacta |
| Preview 30s FFmpeg abierto a anónimos | `reproducir_preview_track()` + `audio_utils` | `/api/track/<id>/preview/` + preview se genera en `/api/upload/` |
| Audio completo/descarga solo post-compra | `reproducir_track()` / `descargar_track()` | misma guarda `_puede_escuchar_completo()` |
| Registro con activación por correo | `registro()` l.532 | misma `RegistroUsuarioForm`, misma transacción atómica, mismo mail |
| No borrar track vendido / no editar ajeno | `eliminar_track()` / `editar_track()` | mismas guardas (409/403) |

El frontend React (`src/api/client.ts`) ya apunta a estas rutas exactas.

## Instalación en el repo de Felipe (3 pasos, ~2 minutos)

```bash
# 1. Copiar el archivo
cp api_shim.py <repo-beatscloud>/app/api_shim.py

# 2. En app/urls.py, AGREGAR AL FINAL del urlpatterns existente (no reemplaza nada):
from . import api_shim
urlpatterns += [path('', include((api_shim.urlpatterns, 'api')))]   # o extender directamente

# ...más simple y garantizado:
from django.urls import path
from app import api_shim
urlpatterns = api_shim.urlpatterns + urlpatterns   # sus vistas siguen teniendo precedencia en sus rutas

# 3. CORS para el SPA en localhost:3000 — ELEGIR UNA OPCION:
#    a) pip install django-cors-headers  y agregar al settings:
#       INSTALLED_APPS += ['corsheaders']
#       MIDDLEWARE = ['corsheaders.middleware.CorsMiddleware'] + MIDDLEWARE
#       CORS_ALLOWED_ORIGINS = ['http://localhost:3000']
#       CSRF_TRUSTED_ORIGINS = ['http://localhost:3000']
#    b) Sin instalar nada: usar api_shim.wrap_with_api() (middleware CORS embebido,
#       documentado al final de api_shim.py). Solo para desarrollo local.
```

Nada más cambia: sus plantillas, sesiones, admin y retornos de Transbank siguen igual.
Si una regla de negocio evoluciona, se toca `views.py` y el shim (o idealmente: extraer
ambas a `app/services.py` — refactor sugerido, opcional, PR aparte).

## Endpoints expuestos (contrato verificado por smoke test)

```
GET    /api/csrf/                      -> {detail: token}          (handshake SPA)
GET    /api/session/                   -> DUser | null
POST   /api/auth/login/ {username,password}      -> DUser (403 si cuenta sin activar)
POST   /api/auth/logout/ · POST /api/auth/registro/ (multipart, igual que el form HTML)
GET    /api/catalogo/?q=&genero=&precio=&orden=&page=  -> DCatalogoPage (paginado 6/page)
GET    /api/track/<id>/                -> DTrack (+is_purchased)   PATCH: renombrar/precio/desc
GET    /api/track/<id>/preview/        -> mp3 30s (anónimo ok)
GET    /api/track/<id>/reproducir/     -> audio full (dueño/comprador, 403 resto)
GET    /api/track/<id>/descargar/      -> adjunto (dueño/comprador, 403 resto)
POST   /api/track/<id>/delete/         -> 409 si tiene ventas
GET    /api/carrito/                   -> {items, subtotal, iva, total}  (totales del servidor)
POST   /api/carrito/agregar/<id>/      -> DVenta (409 duplicado/recompra)
DELETE /api/carrito/<venta_id>/
POST   /api/pago/                      -> {url_webpay, token_ws, amount, transaction_id}
POST   /api/pago/cancelar/<tx_id>/     -> marca CANCELLED (espejo cancelar_pago_pendiente)
POST   /api/upload/                    -> multipart; valida extensión+mutagen; genera preview FFmpeg
GET    /api/mis-ventas/ · GET /api/mis-compras/
POST   /api/like/<id>/                 -> {liked: bool}
GET/POST /api/track/<id>/comentarios/
GET    /api/perfil/<username>/         -> DUser + tracks
GET    /api/suscripciones/?user=
```

## Verificación (ejecutada el 01-10-2026)

Smoke test Django (`TestCase`-less, BD en memoria, SDK Transbank stubeado) corriendo
contra los **modelos reales de Felipe** (migraciones 0001–0015): **36/36 PASS**:

- handshake CSRF, sesión anónima, login correcto/incorrecto/inactivo(403), logout
- catálogo: paginado, búsqueda `q`, filtro rango precio, orden, snake_case fields
- carrito: 201 con `iva=1900` sobre `precio=10000`; 409 duplicado; totales server-side
- pago: WebpayTransaction PENDING creada con amount=subtotal+IVA; cancelación → CANCELLED
- seguridad: reproducir/descargar sin compra = 403; preview sin archivo = 404;
  tras registrar HistorialCompra/HistorialVenta → acceso ok e `is_purchased=true`
- recompra bloqueada (409); likes toggle; comentarios GET/POST
- productor: mis-ventas; delete con ventas=409; delete propio ok; PATCH meta ok;
  delete ajeno=403; perfil público
- registro API: usuario inactivo + correo de activación en outbox

Para volver a correrlo: `backend-integration/test_smoke.py` (instrucciones dentro).

## Pendientes conocidos (decidir en reunión — ver docs/INTEGRACION_BACKEND.md §5)

1. **Checkout de retorno**: tras pagar en Webpay, el navegador aterriza en la página
   HTML `exito_carrito` de Django. Para UX SPA, Felipe podría (opción futura) recibir
   `return_url` configurable → redirigir a `http://localhost:3000/?pago=exito`. La
   VALIDACIÓN no se mueve: sigue en su vista.
2. Metadatos UI (bpm/mood/resourceType…) → migración `0016` propuesta (Fase C).
3. R2: reemplazar storage local por S3-compatible; vistas e interfaz no cambian.
