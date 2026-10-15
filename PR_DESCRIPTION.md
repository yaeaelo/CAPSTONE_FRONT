# Agrega API JSON (`/api/*`) para el frontend React

## Qué cambia
Agrega `app/api_shim.py`: vistas Django clásicas que responden JSON para el SPA React (repo `CAPSTONE_FRONT`).
Reutilizan las mismas consultas y validaciones de `views.py`; **no se modifica ninguna vista, plantilla ni modelo**.
No requiere dependencias nuevas (ni DRF ni django-cors-headers) ni migraciones.

| Archivo | Cambio |
|---|---|
| `app/api_shim.py` | Nuevo. Endpoints de sesión/CSRF, auth, catálogo, carrito, pagos, audio, productor, likes, comentarios, perfiles, usuarios y suscripciones. |
| `app/urls.py` | +3 líneas: `urlpatterns += api_shim.urlpatterns`. |
| `app/tests_api.py` | Nuevo. 56 pruebas (Transbank simulado, MEDIA_ROOT temporal). |
| `REGISTRO_CAMBIOS_BEATSCLOUD.md` | Entrada del 15-10-2026. |

## Reglas que se mantienen (espejo de `views.py`)
- IVA 19 % calculado en servidor al agregar al carrito; bloqueos anti-recompra y anti-duplicado.
- Los pagos **solo inician** la transacción (`/api/pago/`, `/api/suscripcion/<id>/pago/`). El retorno y toda la validación
  (commit, `response_code`, `AUTHORIZED`, `buy_order`, monto, `session_id`) siguen en `exito_carrito()` / `exito()`.
- Preview abierto; audio completo y descarga solo para dueño o compradores. `/media/canciones/` sigue bloqueado.
- Subida: mismas validaciones (extensión + `mutagen`) y preview de 30 s con FFmpeg.

## Diferencias deliberadas — **conviene revisarlas**
1. **Eliminar track:** la API responde 409 si el track tiene compras o ventas. `eliminar_track()` hoy no lo impide y,
   como `HistorialVenta`/`HistorialCompra` usan `on_delete=CASCADE`, borrarlo elimina ventas y el acceso de compradores.
   (Propuesta: aplicar la misma regla a la vista HTML en otro PR.)
2. **Privacidad:** los payloads públicos no incluyen el correo de nadie; solo login/sesión devuelven el del propio usuario.
3. Los errores de Transbank/FFmpeg se registran en log y no se devuelven al cliente.
4. Login: "cuenta sin activar" (403) solo se informa si la contraseña es correcta.
5. Géneros: la API publica siempre la etiqueta ("Hip-Hop") y filtra tanto si la BD guarda la etiqueta como la clave numérica.

## Cómo probarlo
```powershell
python manage.py test app          # incluye app.tests_api
python manage.py check
python manage.py makemigrations --check
```
Con el frontend: aplicar `frontend-fixes.patch` en `CAPSTONE_FRONT`, `npm install` y `VITE_API_MODE=rest npm run dev`.
Vite hace proxy de `/api`, `/media`, `/track`, `/pago`… a `127.0.0.1:8000`, por lo que no se necesita CORS.

## Fuera de alcance / pendiente
- El front aún no consume el cliente `src/api/client.ts` desde `AppContext` (Fase 2 del plan de integración).
- Tras pagar, el navegador aterriza en la página HTML `exito.html` de Django (el retorno no se movió).
- Metadatos de la UI (bpm, mood, stems…) usan valores por defecto hasta que exista una migración.
- Almacenamiento en R2/S3 (objetivo 3).

## Cómo se verificó antes de abrir el PR
Análisis estático contra los modelos reales (74 referencias ORM, imports y `reverse()`), compilación, y aplicación limpia
del parche sobre el repo. **Las pruebas no se ejecutaron en el entorno de preparación** (sin Django/PostgreSQL):
deben correrse con `python manage.py test app` antes de fusionar.
