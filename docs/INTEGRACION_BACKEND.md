# 🔌 BeatsCloud — Análisis del Backend de Felipe e Integración con el Frontend React

**Documento de trabajo para el equipo.** Fecha: 01-10-2026.
Backend analizado: `github.com/felipe-urtubia/BeatsCloud` (commit público, docs al 31-08-2026).

---

## 1. Qué es hoy el backend de Felipe

Es un **Django 6 monolítico con templates** (no API REST todavía):

| Componente | Detalle |
|---|---|
| Stack | Django 6.0.6 · psycopg 3 (**PostgreSQL**, BD `beatsbd`) · transbank-sdk 6.1 · mutagen · pillow · stripe (residual) |
| Auth | Django sessions + `User` + perfil `Usuario(OneToOne)` con `tipo_usu` (1=Artista, 2=Productor) |
| Vistas | ~45 vistas funcionales en `app/views.py` (1.872 líneas), plantillas Bootstrap en `app/templates/` |
| Media | `MEDIA_ROOT` local (`/media/canciones`, `/media/previews`, `/media/tracks`). **R2/S3 aún NO implementado** (objetivo 3 pendiente) |
| Pagos | Webpay Plus **real y validado en TEST**: create → retorno → commit → verificación de `response_code==0 && AUTHORIZED`, buy_order, session_id, monto y propiedad de la transacción antes de registrar compras |
| Preview | `audio_utils.generar_preview_audio()` recorta los primeros **30 s a MP3 con FFmpeg** al subir; ruta pública `/track/<id>/preview/`; el audio completo va por `/track/<id>/reproducir/` con guardas server-side |
| Seguridad | `/media/canciones/*` bloqueado por ruta 404; descarga solo post-compra (`HistorialCompra`/`HistorialVenta`); CSRF en mutaciones; subida valida extensión **+ contenido real con mutagen**; no se puede reemplazar audio de track ya vendido; "UsuarioAnónimo" conserva contenido tras eliminación de cuenta |
| Extras | Registro con **confirmación por correo** (uidb64+token), recuperación de contraseña oficial Django, suscripciones pagables vía Webpay, likes, comentarios, catálogo con búsqueda/filtros/orden/paginación (6/page) |

### Modelo de datos (tablas reales)
`Usuario` · `Track(id_track, nombre_track, precio INT CLP, track FileField, preview FileField, foto, genero FK, usuario FK, descripcion)` · `Genero_Musical` (9 choices: Pop, Rock, Hip-Hop, Electronica, Reggaeton, R&B, Jazz, Metal, Soul) · `Venta` (carrito persistente: detalle, fecha, precio, **iva**, precio_total, completada) · `HistorialCompra` · `HistorialVenta(comprador, precio, track)` · `WebpayTransaction(user, buy_order, session_id, amount, status PENDING/AUTHORIZED/CANCELLED, suscripcion FK nullable)` · `Suscripcion(detalle, precio, user FK)` · `Comentario` · `Interes` · `Carrito`/`Compra`/`Metodo_Pago` (legacy, sin uso en el flujo actual)

### Reglas de negocio confirmadas en código
1. **IVA 19%** se calcula al agregar al carrito: `iva = round(precio * 0.19)`; Webpay cobra `precio + iva`.
2. **No se puede recomprar ni duplicar en carrito** (chequea ambos historiales).
3. **Compras registradas SOLO después del commit autorizado** de Transbank (patrón `exito_carrito`).
4. **Preview abierto a anónimos; audio completo y descarga requieren ser dueño o comprador.**
5. Track gratis ($0): el modelo lo permite (`precio=0`) pero el frontend Django igual exige compra → nuestro UI puede mostrarlo como "Free" con descarga directa una vez registrado el `HistorialCompra` sin pago (decisión pendiente ⚠️).

---

## 2. Brecha con lo que pide el Capstone

El README original y los objetivos específicos #4/#5 exigen **arquitectura desacoplada: API REST (DRF) + SPA React**. El backend de Felipe tiene la lógica correcta pero servida como páginas HTML. **No hay endpoints JSON** (solo retornos POST de Transbank con `csrf_exempt`).

Por eso, la integración propuesta es: **conservar el 100% de la lógica de Felipe y exponerla como API**, sin reescribirla.

---

## 3. Plan de integración (propuesta)

### Fase A — Adaptador en el frontend (sin tocar Django) ✅ Ya iniciado
Creamos en este repo la capa `src/api/` con dos implementaciones intercambiables por `VITE_API_MODE`:

| Modo | Qué hace | Para qué |
|---|---|---|
| `mock` (default) | `localStorage` actual, tipos mapeados a las tablas Django | Demo/UI sin servidor |
| `django-html` | Llama las rutas reales del monolito (login POST form, follow redirects) | Probar contra el backend de Felipe tal cual |
| `rest` (futuro) | DRF + tokens | Cuando exista la API |

Un módulo `mappers.ts` traduce snake_case Django ↔ camelCase TypeScript:
```
Track.id_track→id · nombre_track→title · usuario.user.username→producerUsername
genero.descripcion→genre · preview.name→previewUrl('/track/{id}/preview/')
· track.name→audioUrl('/track/{id}/reproducir/') · precio→price
Usuario.tipo_usu 1/2 → 'artista'/'productor' · tracks_gustados→likedTrackIds
carrito1/Venta→cart · HistorialCompra→purchases · HistorialVenta→sales
WebpayTransaction.status→state ('AUTHORIZED (Código 0)' en receipt)
```

### Fase B — API REST sobre el backend de Felipe (PR a su repo, mínimo invasivo)
1. `pip install djangorestframework django-cors-headers` (agregar a requirements.txt).
2. Nuevas views DRF que **importan y delegan** en las funciones existentes de `app/views.py` (misma lógica, respuesta JSON). Endpoints propuestos:
   - `GET /api/catalogo/?q=&genero=&precio=&orden=&page=` → serializa el queryset ya filtrado de `catalogo()` + `tracks_comprados`
   - `GET /api/track/<id>/` · `POST /api/carrito/agregar/<id>/` · `DELETE /api/carrito/<venta_id>/` · `GET /api/carrito/`
   - `POST /api/pago/` (devuelve `{url_webpay, token_ws}`) · retornos `exito_carrito`/`cancelado` sin cambios (siguen siendo vistas HTML, Webpay redirige ahí)
   - `POST /api/upload/` (multipart, mismas validaciones mutagen/formato, genera preview FFmpeg)
   - `POST /api/auth/login|logout|registro/` (sesión cookie + CSRF token handshake)
   - `GET/POST /api/like/<id>/` · `POST /api/comentarios/<id>/` · `GET /api/perfil/<username>/`
3. CORS: `CORS_ALLOWED_ORIGINS = ['http://localhost:3000']` desde env.
4. Audio/preview siguen sirviéndose por las vistas protegidas actuales (`FileResponse`) — el `<audio>` de React apunta directo a esas URLs con `credentials: 'include'`. **La seguridad de previsualización queda exactamente donde está: server-side.**

### Fase C — Lo declarado que falta (para después, según tus prioridades)
- **Cloudflare R2** (Objetivo 3): reemplazar `FileField storage` por backend S3-compatible + presigned PUT para subida directa. La interfaz de `audio_utils` y las vistas no cambia.
- Licencias formales/verificador público (existe en nuestra UI mock; en Django sería tabla `Licencia` + hash).
- Campos que nuestra UI usa y Django no tiene aún: `resourceType` (instrumental/acapella/loop/drumkit), `bpm`, `scaleKey`, `mood`, `hasStems/Wav/Midi`, `allowFreeDownload`, `hasWatermark`. → migración `0016_track_metadata` con defaults; BPM/tono pueden extraerse en `upload_file` (mutagen da duración; bpm/key con `librosa` opcional o análisis del frontend como fallback — ya implementado en `audioAnalyzer.ts`).

---

## 4. Cómo correr ambos lado a lado (hoy)

```bash
# Terminal 1 — Backend de Felipe (Python 3.12+, PostgreSQL)
git clone https://github.com/felipe-urtubia/BeatsCloud.git BeatCloud && cd BeatCloud
python -m venv .venv && source .venv/bin/activate        # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env    # crear con DB_NAME=beatsbd, DB_USER, DB_PASSWORD, TRANSBANK_* (claves TEST públicas)
createdb beatsbd
python manage.py migrate && python manage.py createsuperuser
sudo apt install ffmpeg                                     # necesario para previews
python manage.py runserver 8000

# Terminal 2 — Frontend React (este repo)
npm install
VITE_API_MODE=mock npm run dev      # demo sin backend (default)
```

⚠️ **Sin CORS en Django**: el modo `django-html` solo funciona si serve también los templates de Felipe o si agregamos la Fase B. Por eso el adaptador hoy deja el esqueleto y el default sigue siendo `mock`.

---

## 5. Decisiones que necesita el equipo (para proponer en la reunión)

| # | Decisión | Opciones | Mi recomendación |
|---|---|---|---|
| D1 | ¿API nueva encima del código de Felipe (Fase B) o reescribir a DRF? | Delegar vs reescribir | **Delegar** — respeta "mantener su lógica", menos riesgo |
| D2 | Auth SPA: cookies de sesión Django vs JWT | Cookies+CSRF / SimpleJWT | Cookies primero (cero cambios), JWT cuando haya mobile |
| D3 | Tracks gratis: ¿descarga sin paso por Webpay? | Sí (crear HistorialCompra directo) / No | Sí, con botón "Obtener Gratis" que registra compra $0 server-side |
| D4 | ¿Quién paga el IVA al productor? | Precio neto + IVA al comprador (como hoy) / Precio incluye IVA | Dejar como está (IVA sumado al checkout) — coincide con `Venta.iva` |
| D5 | Metadatos (bpm/mood/resourceType) | Migración Django + formulario / Solo frontend mock hasta Fase B | Migración ahora, son columnas simples |
| D6 | Stripe aparece en settings/requirements | Eliminar / Documentar | Eliminar de deps (Transbank es lo declarado) |

---

## 6. Estado de implementación en este repo

- [x] `src/api/types.ts` — DTOs espejo de las tablas Django
- [x] `src/api/mappers.ts` — conversión snake_case↔camelCase
- [x] `src/api/client.ts` — handshake CSRF, fetch con credenciales, modo mock/rest configurable
- [ ] Reescritura interna de `AppContext` para consumir `client.ts` (interfaz `useApp()` **no cambia** → cero impacto en componentes UI)
- [ ] PR Fase B al repo de Felipe (carpeta `api/` nueva, no toca vistas existentes)

---

## 6. Registro de decisiones (para reunión de equipo)

| # | Decisión | Estado | Fundamento |
|---|---|---|---|
| D1 | Frontend en modo `mock` por defecto; API real se activa con `VITE_API_MODE=rest` | ✅ Aceptada implícitamente | Demo sin servidor; cero riesgo a la UI del grupo |
| D2 | No tocar lógica de Felipe: integración como PR mínimo (`api_shim.py`, 1 archivo + 1 línea en urls.py) | ✅ Implementado, probado 36/36 | Reglas de negocio viven 100% server-side (views.py intacto) |
| D3 | Autenticación = sesión cookie Django + CSRF handshake (NO JWT) | ⚠️ PENDIENTE aprobación | Es lo que Felipe ya tiene; JWT sería reescribir su auth |
| D4 | Un único modelo `Usuario` con rol `tipo_usu` (artista/productor conmutables) | ⚠️ PENDIENTE confirmación | Nuestra UI asume perfiles separados; mappers.ts lo resuelve vía rol |
| D5 | Precios netos server-side: IVA 19% solo en carrito/pago (tabla `Venta`); HistorialCompra/Venta guardan precio neto | ✅ Verificado en views.py y espejado en mock | Recibo muestra total Webpay (`webpayAmount`) separado del neto |
| D6 | Track gratis ($0): ¿descarga directa o `HistorialCompra` sin pago? | ⚠️ PENDIENTE decisión equipo | Backend actual exige compra incluso en $0; UI ofrece "Gratis" |
| D7 | Retorno post-Webpay aterriza en página HTML de Django; opción futura `return_url` → SPA | ⚠️ PENDIENTE conversación con Felipe | La validación NO se mueve del servidor |
| D8 | R2 presigned PUT vs subir multipart a Django | ⚠️ PENDIENTE (Objetivo 3) | Con WAV/Stems grandes, directo a R2 es lo declarado en el proyecto |
| D9 | Metadatos UI (bpm/mood/resourceType/stems/watermark) → migración 0016 propuesta | ⚠️ PENDIENTE aprobación (Fase C) | Sin esto, filtros finos solo viven en el mock |
| D10 | Licencias: tabla `Licencia` + hash verificable server-side vs certificado generado en cliente | ⚠️ PENDIENTE decisión | El verificador público necesita fuente confiable post-backend |
| D11 | buy_order idéntico en pasarela→recibo→compra→venta (create→commit) | ✅ Implementado hoy | Espejo exacto de WebpayTransaction; evita inconsistencia en demos |
| D12 | Legal/licencias textuales y colores "app-oriented" → Fase posterior | ✅ Postergado por pedido explícito | — |

**Regla de oro acordada:** ningún componente React llama `fetch` directamente; todo pasa por `useApp()` → `src/api/client.ts`. Cambiar de carril (mock↔REST) no toca la UI.
