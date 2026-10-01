# Guía para integrar el backend de Felipe (API Django/DRF)

## Cómo facilitarme su repo (elige UNA opción)

### Opción A — La mejor: URL pública del repo
Si su repo está en GitHub (público o invítame como collaborator), dime la URL y yo ejecuto:
```bash
git clone https://github.com/<usuario>/<repo-backend>.git backend-felipe
```

### Opción B — ZIP / carpeta compartida
Sube el ZIP a este chat (o copia la carpeta descomprimida dentro de /workspace).
Antes de comprimir, que **borre** de su repo: `node_modules/`, `.venv/`, `db.sqlite3`, `__pycache__/`, `.env` (pero SÍ incluya `.env.example`).

### Opción C — Solo los archivos clave
Si no puede compartir todo, mándme al menos:
1. `requirements.txt` (versiones exactas de Django/DRF)
2. `settings.py` (apps instaladas, CORS, storage R2, medios de pago)
3. `urls.py` raíz + `urls.py` de cada app (esto define la "huella" de la API)
4. `models.py` de cada app (Beats, Users, Sales, Licenses, Cart…)
5. `serializers.py` y `views.py`/`viewsets.py` (endpoints reales)
6. Ejemplo de respuesta JSON de `/api/beats/` (aunque sea un curl copiado)

Con eso puedo generar los tipos TypeScript sin ejecutar su backend.

## Qué haré una vez lo tenga (plan de trabajo)

### Fase 1 — Inventario (no toca UI)
- Mapear endpoints → rutas exactas (`GET /api/beats/?search=&bpm_min=...`)
- Comparar sus modelos Django con `src/types.ts` (nombres de campos, PKs, fechas)
- Detectar auth: ¿JWT simple, djangorestframework-simplejwt, session cookie? ¿Registro?
- Verificar CORS y puerto (típico: http://localhost:8000)

### Fase 2 — Capa API (reemplazo de AppContext mock)
- Crear `src/api/client.ts`: fetch wrapper con token, manejo de errores, baseURL desde `VITE_API_URL`
- Crear `src/api/endpoints.ts`: una función por endpoint de él (firmas tipadas)
- Reescribir `src/context/AppContext.tsx` para que CADA método existente
  (`login`, `register`, `uploadTrack`, `addToCart`, `checkoutCart`, `toggleFavorite`,
   `addComment`, `purchaseLicense`, …) llame a su API en lugar de localStorage.
  **La interfaz pública de useApp() NO cambia** → ningún componente se reescribe.
- Mantener el mock actual detrás de un flag `VITE_USE_MOCK=true/false` para poder
  demostrar sin backend si hay problemas de red en la presentación.

### Fase 3 — Reglas que deben vivir solo en su backend (verificar con él)
Estas son las que el proyecto exige "a pie de letra" y debo validar que existan:
- [ ] Descarga habilitada SOLO tras Webpay APPROVED (no confiar en el frontend)
- [ ] URLs firmadas de R2 (presigned GET) para WAV/Stems; MP3 público con watermark
- [ ] Mutagen: BPM/tono/duración extraídos server-side al subir (fallback del analizador)
- [ ] Transbank: create → commit → status; reject si no AUTHORIZE(0)
- [ ] Generación de código de licencia server-side (hoy es hash client-side)

### Fase 4 — UI/UX (donde ustedes mandan)
Una vez conectado, todo cambio es en `src/components/*` sin riesgo de romper lógica.

## Preguntas que le conviene hacerle a Felipe AHORA (respóndeme esto junto con el repo)
1. ¿Corre con PostgreSQL local o sqlite? ¿Script de migraciones/seeds incluido?
2. ¿Qué env vars necesita (R2 keys, Webpay commerce code)? → van a su .env, NUNCA al repo
3. ¿Ya tiene CORS configurado para Vite (localhost:3000)?
4. ¿Auth: ¿endpoint de login devuelve access+refresh? ¿Hay registro público?
5. ¿Subida de audio: multipart a Django o presigned PUT directo a R2?
