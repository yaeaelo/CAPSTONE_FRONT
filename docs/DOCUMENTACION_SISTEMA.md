# 📖 BeatsCloud — Documentación del Sistema (Estado Actual)

**Proyecto Capstone:** 2026_2_MA_CAPSTONE_005D · GRUPO_4 · DUOC UC (Sede Maipú)
**Equipo:** Ismael Araya (Líder / Full Stack) · Felipe Urtubia (Full Stack) · Vicente Monroy (Full Stack)
**Versión documentada:** Frontend SPA Alpha funcional, lista para propuesta e integración con backend Django.

---

## 1. Visión General

BeatsCloud es una plataforma web para la **publicación, búsqueda, compra y venta de instrumentales, loops, acapellas y drum kits**, orientada al mercado chileno/latinoamericano: precios en **CLP**, IVA visible, pasarela **Transbank Webpay Plus** y certificados de licencia pensados para **SCD / Content ID**.

El repositorio actual contiene el **frontend completo y funcional** (React SPA). Como no se dispone de las credenciales del proyecto original, la capa de backend está **emulada a nivel de aplicación** (`AppContext` + persistencia en `localStorage`), pero los modelos de datos fueron diseñados para ser **espejo 1:1 de las tablas Django originales**, de modo que conectar la API REST real sea un reemplazo mecánico, no una refactorización.

### Alineación con lo declarado en el Kick-Off (Fase 1)

| Declarado en la Guía/Kick-Off | Estado en este repo |
|---|---|
| Arquitectura desacoplada: API REST (Django) + Frontend React SPA | ✅ Frontend SPA desacoplado; toda la lógica de datos vive en un solo contexto (`AppContext`) que actúa como "capa de servicio" sustituirle por `fetch()` a la API DRF |
| React.js (Vite) + TypeScript + TailwindCSS | ✅ React 19 + Vite 6 + TS 5.7 + Tailwind v4 |
| PostgreSQL (usuarios, productos, licencias, compras, pagos) | ✅ Modelos tipados espejo de `HistorialVenta`, `HistorialCompra`, `WebpayTransaction` (ver `src/types.ts`) |
| Cloudflare R2 (Object Storage, Direct Upload, URLs firmadas) | 🔜 Flujo de subida y descarga implementado a nivel UI/lógica; el binario real se conecta cuando existan las credenciales R2 (presigned PUT → upload, presigned GET → descarga) |
| Transbank Webpay Plus (SDK Python) | ✅ Carrito + checkout con subtotal + IVA 19% + transacción simulada con `buyOrder`, `token`, estado `AUTHORIZED`; preparado para reemplazar la simulación por `webpayplus_create` real |
| Licencias (comercial/stems, exclusiva, maqueta) | ✅ `LicenseContract` con código único, hash SHA-256 de verificación, split de derechos 50/50 y términos de distribución; certificado imprimible/PDF y verificador público |
| Previsualización segura (marca de agua) | ✅ Regla central `isTrackProtected()` + atenuación real de audio en el motor (equivalente sonoro del tag protegido) |
| Tipos de recurso con clasificación simple (tag + color) | ✅ `instrumental / loop / acapella / drumkit` con badges de color (BEAT azul, LOOP ámbar, VOX morado, KIT verde) |
| Filtros específicos + fallback automático de metadatos | ✅ Formulario de subida exige especificación máxima (tipo, género, subgénero, BPM, tonalidad, mood, stems/WAV/MIDI, watermark) + analizador acústico de respaldo |
| Reproductor continuo sin recargas | ✅ `GlobalAudioPlayer` persistente durante toda la navegación SPA |

---

## 2. Stack Tecnológico Real

| Capa | Tecnología | Detalle |
|---|---|---|
| Framework UI | React 19 + TypeScript 5.7 | SPA, hooks, Context API |
| Build / Dev | Vite 6 | `npm run dev` puerto 3000, `--host 0.0.0.0` |
| Estilos | Tailwind CSS v4 (`@tailwindcss/vite`) | Tema oscuro "studio", acento ámbar |
| Íconos | lucide-react | — |
| Audio | Web Audio API pura | Motor procedural propio (sin librerías) |
| Persistencia (demo) | localStorage | Claves `bc_users`, `bc_tracks`, `bc_cart`, `bc_sales`, `bc_purchases`, `bc_current_user_id` |
| Backend objetivo | Django + DRF + PostgreSQL + Cloudflare R2 + Transbank SDK | No incluido (sin credenciales); contratos de datos ya definidos |

**Total de código fuente:** ~8.100 líneas en 24 archivos TypeScript/TSX. Sin dependencias de runtime más allá de React y lucide.

---

## 3. Estructura del Código

```
/workspace
├── index.html / metadata.json / vite.config.ts / tsconfig*.json
├── .env.example                 # placeholders VITE_TRANSBANK_* (sin keys reales)
├── src/
│   ├── main.tsx                 # bootstrap React
│   ├── App.tsx                  # shell SPA: sidebar + topbar + router por estado (tabs) + modales + player global
│   ├── types.ts                 # MODELO DE DOMINIO (espejo de tablas Django)
│   ├── context/AppContext.tsx   # "backend emulado": estado global, reglas de negocio, persistencia
│   ├── data/mockData.ts         # seed: 4 usuarios, 10 tracks, 3 suscripciones, ventas/compras históricas
│   ├── utils/
│   │   ├── audioEngine.ts       # motor Web Audio: secuenciadores por género + seguridad de preview
│   │   ├── audioAnalyzer.ts     # fallback DSP: detecta BPM/tono/tipo/mood desde nombre del archivo
│   │   └── resourceHelpers.ts   # taxonomía de recursos (tags + colores)
│   └── components/              # 18 vistas y modales (detalle abajo)
└── docs/                        # esta documentación
```

### Mapa de componentes

| Componente | Responsabilidad |
|---|---|
| `Sidebar` | Navegación principal: Descubrir, Catálogo, filtros por tipo de recurso (con contadores), Ventas (productor), Favoritos (artista), Directorio, **Verificar Licencia**, Sobre BeatsCloud; pie con perfil activo + **selector de rol demo** |
| `TopBar` | Búsqueda global, carrito con badge, acceso a login/subida, menú móvil |
| `DiscoverPage` | Home editorial: hero, destacados, géneros, CTA a catálogo |
| `CatalogPage` | Motor de catálogo: filtros combinables (tipo, género, tonalidad, mood, rango BPM, solo-stems, gratis/pago), ordenamiento, vista **tabla estilo DAW** y grid, acciones play/like/carrito/descarga |
| `TrackDetailModal` | Ficha completa: waveform visual, specs (BPM/Key/Mood/Stems), comentarios, comprar, reclamar gratis, descargar maqueta |
| `UploadTrackModal` | Publicación/especificación máxima + analizador de fallback + selector de archivo `.wav/.mp3/.aiff/.flac` |
| `CartPage` | Carrito, resumen subtotal + IVA 19% + total CLP, modal de checkout Webpay simulado, receipt `AUTHORIZED` |
| `GlobalAudioPlayer` | Barra fija inferior: transport, seek, volumen, visualizer FFT, indicador Preview/Full |
| `ProducerProfilePage` | Perfil productor: beats propios (editar/eliminar/watermark), métricas de ventas, suscripciones VIP, historial de ventas con **certificado por transacción** |
| `ArtistProfilePage` | Perfil artista: biblioteca de compras (contrato + descarga WAV+Stems), favoritos, suscripciones |
| `UsersCatalogPage` | Directorio de creadores (artistas y productores) |
| `AuthModal` | Login (por usuario/email) y registro con selección de rol |
| `LicenseCertificateModal` | Certificado oficial: código, hash copiables, split SCD, términos; imprimir o guardar PDF, descargar contrato .txt |
| `LicenseVerificationModal` | Registro público antifraude: consulta por `LIC-*` o `BC-*` → muestra contrato o rechaza códigos inexistentes |
| `AboutPage` | Manifiesto del proyecto (problemática, modelo local CLP/Webpay) |

---

## 4. Modelo de Datos (y su equivalencia Django)

Definido en `src/types.ts`:

- **`User`** ↔ modelo `Usuario/Perfil`: `role: 'artista' | 'productor'`, redes (spotify/youtube/instagram), `subscriptions[]`, `purchasedTrackIds[]`, `likedTrackIds[]`.
- **`Track`** ↔ `Instrumental/Recurso`: `resourceType` (instrumental/loop/acapella/drumkit), `genre`, `subgenre`, `price` (CLP), `bpm`, `scaleKey`, `mood`, `duration`, `hasStems/hasWav/hasMidi`, `isFree`, `allowFreeDownload`, `hasWatermark`, `comments[]`, `audioBeatType` (patrón rítmico sintetizado).
- **`SaleRecord`** ↔ **`HistorialVenta`**: comprador, track, monto, fecha, `status AUTHORIZED|PENDING|CANCELLED`, `buyOrder`, `licenseCode`, `verificationHash`, `licenseType`.
- **`PurchaseRecord`** ↔ **`HistorialCompra`**: equivalente lado artista + `downloadUrl` (futuro presigned URL de R2).
- **`WebpayTransactionRecord`** ↔ **`WebpayTransaction`**: `token`, `buyOrder`, `sessionId`, `amount`, estados `INITIALIZED/AUTHORIZED/FAILED/REJECTED` — idéntico al ciclo real de Webpay Plus.
- **`LicenseContract`**: licencia derivada de la compra: tipo (`comercial_wav_stems | exclusiva | maqueta_ensayo`), `musicRightsSplit` (50/50, SCD) y `distributionTerms` (streams, video monetizado, radio, en vivo, Content ID).

> **Regla de oro para la integración:** ningún componente consume `localStorage` directamente; todo pasa por `useApp()`. Al conectar DRF, cada función del contexto (`login`, `uploadTrack`, `checkoutCart`, …) se traduce a un endpoint REST sin tocar la UI.

---

## 5. Lógica de Negocio Central (`AppContext`)

### 5.1 Seguridad de previsualización ⭐
```
isTrackProtected(track) = track.hasWatermark && !usuarioLaAdquirió && !track.isFree
```
- Aplicada en `playTrack()` y `togglePlay()` → `audioEngine.setPreviewSecurityMode(true)` atenúa el master del motor (gain 0.45): la preview de pistas no compradas **suena realmente amortiguada** (equivalente sonoro del "Tag Protegido" de BeatStars).
- Al reproducir una pista propia o gratuita el gain vuelve a 1.0 ("Full Preview").
- El `GlobalAudioPlayer` muestra el estado: `PREVIEW PROTEGIDA` vs `Preview Full`.
- Espejo exacto de lo que hará el backend: servir MP3 acuñado públicamente y el WAV limpio solo tras `AUTHORIZED`.

### 5.2 Comercio (compra/venta)
- `addToCart`: previene duplicados y comprar algo ya poseído.
- `checkoutCart`: calcula **subtotal + IVA 19%**, genera `buyOrder` (`BC-######`), registra una `SaleRecord` por track (estado `AUTHORIZED`) y una `PurchaseRecord` con `licenseCode LIC-*` + `verificationHash SHA256:*`, habilita descargas en `purchasedTrackIds` y vacía el carrito. La simulación reproduce el ciclo completo Webpay (create → redirect → commit → status).
- `claimFreeTrack`: beats $0 generan compra `FREE-*` con licencia `maqueta_ensayo` (no comercial, requiere acreditar producción).
- Descargas: adquiridos → "WAV + Stems"; no adquiridos con `allowFreeDownload` → **maqueta de composición/ensayo** (el "punto medio" del modelo); gratuitos → demo con condiciones impresas.

### 5.3 Publicación con especificación + fallback
- El formulario de subida obliga a especificar: tipo de recurso, género/subgénero, precio CLP o gratis, BPM, tonalidad, mood, contenido entregable (Stems/WAV/MIDI), watermark on/off y permitir descarga de maqueta.
- Selector de archivo real (`accept=".wav,.mp3,.aiff,.flac"`): el nombre alimenta a `analyzeAudioFile()`, que detecta BPM/tonalidad/tipo/mood por convenciones (`trap_beat_140bpm_Aminor.wav` → Trap 140 A Minor) con reporte DSP y % de confianza — **fallback** cuando el productor no completa datos. En producción este análisis lo hará Mutagen en Django.

### 5.4 Motor de audio procedural
`audioEngine.ts` sintetiza en tiempo real con osciladores + ruido blanco (kick/snare/hats/808/leads) patrones de **trap, boom_bap, reggaeton, synthwave, rnb, lofi** a cualquier BPM, con secuenciador step-based, callbacks de tiempo, analyser FFT para el visualizer y volumen maestro. Permite demostrar reproducción continua sin archivos (hasta tener R2).

### 5.5 Identidad y comunidad
- `login/registerUser/switchUser/updateProfile`, roles que cambian la experiencia completa (menús, panel de ventas vs biblioteca de compras).
- `toggleLike`, comentarios con alta/baja, suscripciones VIP mensuales/anuales por productor.

---

## 6. Instrucciones de Instalación y Ejecución

**Prerrequisitos:** Node.js ≥ 18 (probado con 22). Sin Python ni PostgreSQL para esta fase.

```bash
git clone <repo>            # o descargar zip
cd beatscloud
npm install
npm run dev                 # http://localhost:3000
```

Producción / revisión de tipos:
```bash
npm run lint                # tsc -b (chequeo estricto de tipos)
npm run build               # tsc -b + vite build → dist/
npm run preview             # sirve el build en :3000
```

**Reset de datos de demostración:** borrar el `localStorage` del navegador (DevTools → Application → Local Storage → clear) o ejecutar:
```js
['bc_users','bc_tracks','bc_cart','bc_sales','bc_purchases','bc_current_user_id']
  .forEach(k => localStorage.removeItem(k));
```
Recargar la página: la app resemea automáticamente con `mockData.ts`.

### Cuentas semilla
| Usuario | Rol | Notas |
|---|---|---|
| `metrosantiago` | Productor | Dueño de varios beats; tiene venta histórica BC-541209 |
| `aurabeats` | Productora | Neo-soul/R&B |
| `nebulasound` | Productor | Reggaetón/Dembow |
| `mcflow` | Artista | Sesión inicial por defecto; ya compró "Santiago de Noche" |

Login: cualquier usuario registrado por username o email (sin contraseña en demo). También hay selector rápido de rol en el pie de la Sidebar.

---

## 7. Plan de Prueba Guiado (para mostrar al grupo) ⭐

Duración estimada: 15–20 min. Recorre los 4 focos críticos: **compra/venta, subida/descarga, seguridad de preview, plan gratuito**.

### Bloque A — Descubrimiento y catálogo (2 min)
1. Abrir la app → aterrizas como **MC Flow (artista)**. Verifica home con destacados.
2. Ir a **Catálogo**: alternar vista tabla↔grid; filtrar por **Loops** (badge ámbar) y **Acapellas** (morado) — confirma la separación de tipos de recurso; mover slider BPM a 80–100 → quedan dembow/boom-bap; activar "Solo con Stems".
3. Buscar `drill` en la barra global → debe aparecer el Drum Kit Vol.1 (verde, `KIT`).

### Bloque B — Reproducción y seguridad de preview (3 min)
4. Clic ▶ en **"Fuego Lento"** (no comprado): suena la preview **amortiguada**; el player inferior indica `PREVIEW PROTEGIDA`. Mover volumen y seek: el visualizer responde.
5. Play en **"Santiago de Noche"** (ya comprado por MC Flow): suena limpia, badge `Preview Full` → demuestra que la adquisición levanta la protección.

### Bloque C — Compra end-to-end (4 min)
6. Añadir al carrito "Terciopelo Violeta" ($14.000) y "Cyberpunk Skyline" ($19.500). Ver badge del TopBar.
7. Ir al carrito: revisar **subtotal $33.500 + IVA 19% $6.365 = total $39.865 CLP**.
8. "Proceder al Pago con Webpay" → modal de redirección simulada → confirmar → receipt **`AUTHORIZED (Código 0)`** con `buyOrder BC-*`.
9. Ir a **Perfil (artista)** → Compras: ambas pistas aparecen con botones **Ver Contrato** y **Descargar WAV + Stems** (desbloqueadas por la compra).
10. Abrir contrato → **Imprimir/Guardar PDF** y copiar el hash SHA-256.

### Bloque D — Verificador público de licencias (2 min)
11. Sidebar → **Verificar Licencia**: ingresar el `buyOrder` o `LIC-*` recién generado → aparece el contrato verificado (botón para abrir el certificado). Probar con `LIC-BC-541209` (histórico) y con un código inventado → el sistema lo **rechaza** (antifraude).

### Bloque E — Vista productor: subir y vender (5 min)
12. Pie de sidebar → **Alternar rol** a Metro Santiago. El menú cambia: aparece **Ventas & Transacciones**.
13. Botón **Subir Beat**: escribir/seleccionar archivo `boombap_lofi_88bpm_Fminor_loop.wav` → **Analizar** → verificar que el fallback detecta Loop, 88 BPM, F Minor, Chill. Completar precio $12.000, dejar watermark ON y "permitir maqueta" ON → Publicar.
14. Confirmar que el beat nuevo encabeza el catálogo con su badge de tipo/color y suena su patrón sintetizado.
15. Pestaña **Ventas**: tabla con la venta histórica de "Santiago de Noche" → botón **Certificado** (columna "Licencia") → mismo contrato legal que ve el comprador.
16. En el beat propio recién subido, toggle de marca de agua OFF → al reproducirlo el player muestra `Preview Full` (dueño sin protección).

### Bloque F — Plan gratuito / punto medio (2 min)
17. Filtrar **Gratis**: "Valparaíso Sunset" → **Reclamar Gratis** → se agrega a la biblioteca con licencia `maqueta_ensayo` (no comercial) y suena sin atenuación.
18. En un beat de pago con "permitir maqueta" activado (ej. el subido en E13) → botón **Maqueta para ensayo** descarga el texto de condiciones de uso.

**Resultados esperados:** todos los flujos sin errores en consola; persistencia verificable recargando la página (todo sigue gracias a localStorage).

---

## 8. Qué queda pendiente (roadmap hacia lo declarado en el Kick-Off)

Priorizados según los objetivos específicos del proyecto:

1. **Backend DRF real** (O.E. 2 y 4): serializar los modelos de `types.ts` a `models.py` (User→Usuario, Track→RecursoMusical, SaleRecord→HistorialVenta, PurchaseRecord→HistorialCompra, WebpayTransactionRecord→WebpayTransaction) y exponer `/api/auth`, `/api/tracks`, `/api/cart`, `/api/webpay/{create,commit,status}`, `/api/licenses/verify/<code>`. Reemplazo puntual de las funciones de `AppContext` por `fetch`.
2. **Cloudflare R2** (O.E. 3): presigned PUT en la subida (hoy solo se analiza el nombre del archivo), presigned GET en las descargas (`downloadUrl` ya existe en el modelo). Migrar el analizador JS → Mutagen en el servidor.
3. **Webpay Plus real** (O.E. 5): SDK `transbank-sdk-python` contra ambiente de integración; el frontend ya modela token/buyOrder/sessionId/estados. Decidir tratamiento del IVA en registros de venta (hoy `amount` = precio sin IVA; total cobrado = con IVA).
4. **Legal/licenciamiento** (acordado para después): T&C reales, generador de PDF server-side, firma del hash con HMAC-SHA256 secreto.
5. **UI orientada a app**: reestructurar navegación (mobile-first, bottom nav) y paleta; no altera la lógica.

---

*Documento generado sobre el estado real del código (verificado con `tsc -b` y `vite build` sin errores). Cualquier discrepancia entre este documento y el código: manda el código.*
