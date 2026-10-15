# BeatsCloud - Capstone Project

**Asignatura / Sección:** 2026_2_MA_CAPSTONE_005D  
**Grupo:** GRUPO_4  
**Institución:** DUOC UC  

## 📋 Descripción del Proyecto
BeatsCloud es una plataforma web para la publicación, búsqueda, compra y venta de instrumentales y beats para la música urbana e independiente. Proporciona una vitrina justa para productores independientes y permite a los artistas adquirir licencias comerciales claras con preescucha interactiva en tiempo real.

## 👥 Equipo de Trabajo
- **Ismael Araya** - Líder de Proyecto / Desarrollador Frontend & Backend (@yaeaelo)
- **Felipe Urtubia** - Desarrollador Backend & Frontend (@felipeurtubia133)
- **Vicente Monroy** - Desarrollador Backend & Frontend (@monroyvicente1)

## 🚀 Características Principales
- **Catálogo de Beats:** Filtrado por géneros (Trap, Hip-Hop, Reggaetón, R&B, Electrónica, Pop, Rock, etc.), BPM, precio y tonalidad.
- **Motor de Audio Sintetizado:** Reproducción interactiva de instrumentales, barras de visualización de espectro de ondas y control de volumen y tiempo.
- **Perfiles Especializados:**
  - *Productor:* Publicación de instrumentales con fijación de precios en pesos chilenos ($ CLP), gestión de membresías VIP y panel de ventas autorizadas.
  - *Artista:* Biblioteca de compras con descarga ilimitada de stems/WAV y beats guardados en favoritos.
- **Carrito de Compras & Webpay Plus:** Cálculo transparente de subtotal, IVA (19%) y simulación de pago seguro de Transbank Webpay Plus.
- **Comunidad y Comentarios:** Espacio de retroalimentación e interacción entre músicos.

## 🛠️ Tecnologías
- **Frontend:** React 19 + TypeScript + Vite
- **Estilos:** Tailwind CSS v4 + Lucide Icons
- **Audio:** Web Audio API (secuenciador y motor procedural de audio)
- **Ejecución:** Node.js ≥ 18 (`npm run dev` en puerto 3000)

## 🗂️ Estructura del repositorio (importante antes de instalar nada)

```
CAPSTONE_FRONT/            ← raíz del repo (NO tiene package.json)
├── client/                ← Frontend React + Vite (aquí vive package.json) ✅
│   ├── .env               ← modo actual (VITE_API_URL=/api, proxy a Django)
│   └── .env.example       ← copia esto si necesitas otro modo (mock/rest)
├── server/                ← Backend Django (manage.py, requirements.txt)
├── backend-integration/   ← api_shim.py (API JSON sobre el backend de Felipe)
└── docs/                  ← Documentación e instructivo de integración
```

## ⚡ Cómo levantar el frontend (primera vez)

El error `ENOENT: Could not read package.json` ocurre por ejecutar `npm install` en la raíz del repo. **Hay que entrar primero a `client/`:**

```bash
cd CAPSTONE_FRONT/client    # ⚠️ donde está package.json, NO en la raíz
npm install                 # OBLIGATORIO la primera vez (crea node_modules/)
npm run dev                 # abre http://localhost:3000
```

Requisitos: **Node.js ≥ 18** (`node -v` para verificar).

> Si `npm run dev` falla con **"vite: orden no encontrada"**, es porque falta `npm install` dentro de `client/`. `node_modules/` a propósito NO se sube al repositorio.

### Modos del frontend (híbrido mock ↔ backend real)

Se controlan con variables en `client/.env` (ver `client/.env.example`):

| Modo | `VITE_API_MODE` | Qué hace |
|------|-----------------|----------|
| Demo sin backend | `mock` | Datos locales (localStorage), audio sintetizado. Ideal para presentar si el backend está caído. |
| Integración real | `rest`/`hybrid` | Llama a la API de Django vía proxy `/api` → `http://127.0.0.1:8000` (configurado en `client/vite.config.ts`). Con fallback automático a mock si el backend no responde. |

Para correr **solo el frontend** (no requiere backend): basta con `npm run dev` — el proxy solo se usa si el backend está levantado.

## 🐍 Cómo levantar el backend Django (para la integración real)

Requiere **Python 3.12+** y **PostgreSQL**. En una segunda terminal:

```bash
cd CAPSTONE_FRONT/server
python -m venv .venv && source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env    # crear con DB_NAME=beatsbd, DB_USER, DB_PASSWORD, TRANSBANK_* (claves TEST)
createdb beatsbd
python manage.py migrate && python manage.py createsuperuser
sudo apt install ffmpeg                             # necesario para generar previews de audio
python manage.py runserver 8000                     # deja el backend en http://localhost:8000
```

Con el backend en el puerto **8000** y el frontend corriendo `npm run dev` en otra terminal (dentro de `client/`), Vite redirige automáticamente `/api` y `/media` hacia Django — no hay que tocar nada más. Para exponer la API JSON sobre las vistas de Django, ver `backend-integration/README_FASE_B.md` (copiar `api_shim.py` al proyecto e incluir sus rutas).

> Instrucciones completas de integración: **[docs/INTEGRACION_BACKEND.md](docs/INTEGRACION_BACKEND.md)**

## 📖 Documentación completa del sistema

- **[docs/DOCUMENTACION_SISTEMA.md](docs/DOCUMENTACION_SISTEMA.md)** — arquitectura, modelo de datos (equivalencia con Django), lógica de negocio (seguridad de preview, comercio Webpay, licencias), instrucciones de instalación y **plan de prueba guiado paso a paso para demostrar el avance al grupo**.

## ✅ Estado actual (Alpha Frontend)

Sistema navegable completo: catálogo con filtros por tipo de recurso (instrumental/loop/acapella/drumkit con tags de color), reproductor global sintetizado con visualizer, **seguridad real de preescucha** (atenuación de pistas no adquiridas), carrito + checkout Webpay simulado (subtotal + IVA 19%), certificados de licencia con hash verificable, verificador público de licencias, subida con analizador acústico de fallback, perfiles productor/artista, favoritos, comentarios y suscripciones VIP. Backend Django/R2/Webpay real pendiente de credenciales (modelos ya alineados a las tablas originales).
