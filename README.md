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
- **Ejecución:** Node.js 22 (`npm run dev` en puerto 3000)

## 📖 Documentación completa del sistema

- **[docs/DOCUMENTACION_SISTEMA.md](docs/DOCUMENTACION_SISTEMA.md)** — arquitectura, modelo de datos (equivalencia con Django), lógica de negocio (seguridad de preview, comercio Webpay, licencias), instrucciones de instalación y **plan de prueba guiado paso a paso para demostrar el avance al grupo**.

## ✅ Estado actual (Alpha Frontend)

Sistema navegable completo: catálogo con filtros por tipo de recurso (instrumental/loop/acapella/drumkit con tags de color), reproductor global sintetizado con visualizer, **seguridad real de preescucha** (atenuación de pistas no adquiridas), carrito + checkout Webpay simulado (subtotal + IVA 19%), certificados de licencia con hash verificable, verificador público de licencias, subida con analizador acústico de fallback, perfiles productor/artista, favoritos, comentarios y suscripciones VIP. Backend Django/R2/Webpay real pendiente de credenciales (modelos ya alineados a las tablas originales).
