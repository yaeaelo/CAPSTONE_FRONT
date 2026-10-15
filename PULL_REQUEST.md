# PR: Pulido frontend Sprint 1 — modo híbrido (mockup + integración real con backend)

**Rama:** `qwen-code-56c2b5b8-a5a2-47f3-8b6a-bdafe34602ac` → `main` · **Commits:** 2 · **+621 / −28** en 12 archivos

## Resumen
Frontend listo para la demo del Sprint 1 con un punto medio entre mockup e integración real:
la app corre sola con datos simulados, pero si el backend Django está levantado consume la API
real y reproduce audio auténtico (`/api/track/<id>/preview|reproducir`) sin tocar código.
Incluye la corrección de las instrucciones de instalación tras el paso a monorepo (`client/` + `server/`).

## Cambios
### Integración híbrida de API
- `client/src/services/client.ts`: capa HTTP única conmutada por `VITE_API_MODE` (`mock` default | `rest`).
- `client/src/services/django.service.ts`: adaptador `mapTrack()` que normaliza payloads de Django e inyecta `previewSrc`/`fullSrc`.
- `AppContext.tsx`: fuente de datos conmutable con fallback automático a mock si el backend no responde.
- Proxy de Vite `/api` y `/media` → `localhost:8000`.

### Correcciones de build/runtime
- `App.tsx`: el reproductor usaba propiedades inexistentes (`previewUrl`/`audioUrl`); ahora consume `previewSrc`/`fullSrc` — el audio suena de verdad.
- `client/src/vite-env.d.ts` (nuevo): tipado de `import.meta.env`, eliminaba errores de `tsc`.
- Tailwind v4: removido `postcss.config.js` obsoleto, añadido plugin `@tailwindcss/vite`, `index.css` migrado a `@import "tailwindcss"`.

### Documentación (fix error `ENOENT` reportado por el equipo)
- `README.md`: estructura monorepo, `cd client` antes de `npm install`, tabla de modos y setup del backend.
- `docs/INTEGRACION_BACKEND.md` y `docs/DOCUMENTACION_SISTEMA.md` actualizados.

## Cómo probar
```bash
cd client && npm install && npm run dev        # http://localhost:5173 (modo mock, sin backend)
# Real: cd server && python manage.py runserver  +  VITE_API_MODE=rest en client/.env.local
```

## Verificación
✅ `tsc -b` sin errores · ✅ `npm run build` exitoso · ✅ dev server verificado con curl (HTTP 200) · ✅ comandos del README reproducibles desde cero.

## Notas para revisión
- Sin dependencias nuevas fuera de las ya declaradas; no hay breaking changes de UI (los componentes consumen siempre el modelo normalizado).
