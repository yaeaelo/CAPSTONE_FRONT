# -*- coding: utf-8 -*-
"""
api_shim.py - Capa API JSON para el frontend React (CAPSTONE_FRONT).

Principio: este archivo NO reescribe reglas de negocio. Cada endpoint delega en
las mismas consultas y validaciones que ya viven en ``app/views.py``
(HistorialCompra/HistorialVenta como prueba de propiedad, IVA 19 % calculado en
el servidor, flujo Webpay create -> commit -> verificacion, preview FFmpeg de
30 s, guardas de reproduccion/descarga).

No requiere djangorestframework ni django-cors-headers: son vistas Django
clasicas que responden JSON. El navegador del SPA debe hablar con Django desde
el MISMO ORIGEN (en desarrollo, mediante el proxy de Vite), por lo que no hace
falta CORS y las cookies de sesion/CSRF funcionan sin configuracion extra.

Divergencias deliberadas respecto de views.py (revisar con el equipo):
  * ``POST /api/track/<id>/delete/`` rechaza (409) borrar un track con compras o
    ventas. views.eliminar_track() hoy no lo impide, y como HistorialVenta y
    HistorialCompra usan on_delete=CASCADE, borrar el track borraria tambien el
    historial de ventas y el acceso de los compradores.
  * Los payloads PUBLICOS no incluyen el email de nadie (solo el del usuario
    autenticado, en login/sesion).
  * Los errores de Transbank no se devuelven al cliente (se registran en log).

Los metadatos que usa la UI y que el modelo Track aun no tiene (bpm, mood,
resource_type, ...) se leen con getattr() y caen en valores por defecto; cuando
exista la migracion correspondiente apareceran solos.
"""
import json
import logging
import mimetypes
import random

import mutagen
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.core.paginator import Paginator
from django.db import transaction as db_transaction
from django.db.models import Q
from django.http import FileResponse, Http404, HttpResponseForbidden, JsonResponse
from django.middleware.csrf import get_token
from django.template.loader import render_to_string
from django.urls import path, reverse
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.views.decorators.csrf import ensure_csrf_cookie
from transbank.webpay.webpay_plus.transaction import Transaction, WebpayOptions

from .audio_utils import generar_preview_audio
from .forms import RegistroUsuarioForm, TrackForm
from .models import (
    Comentario,
    Genero_Musical,
    HistorialCompra,
    HistorialVenta,
    Suscripcion,
    Track,
    Usuario,
    Venta,
    WebpayTransaction,
)
from .views import ANON_USER_USERNAME  # única fuente del literal de la cuenta anónima

logger = logging.getLogger(__name__)

IVA_PCT = 0.19  # views.agregar_al_carrito(): iva = round(precio * 0.19)
TRACKS_POR_PAGINA = 6  # views.catalogo(): Paginator(tracks, 6)

FORMATOS_AUDIO = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}
FORMATOS_IMAGEN = {".jpg", ".jpeg", ".png", ".webp"}


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _json_body(request):
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _err(message, status=400, **extra):
    return JsonResponse({"detail": message, **extra}, status=status)


def _auth_required(request):
    """Devuelve una respuesta 401 si no hay sesion; None si todo bien."""
    if not request.user.is_authenticated:
        return _err("Autenticación requerida.", 401)
    return None


def _perfil(user):
    """Perfil Usuario del User autenticado (None si no tiene, p. ej. superuser)."""
    return Usuario.objects.filter(user=user).first()


def _media_url(field):
    if not field or not getattr(field, "name", ""):
        return None
    return field.url  # relativo a MEDIA_URL; el front lo resuelve


def _extension(nombre):
    nombre = (nombre or "").lower()
    return "." + nombre.rsplit(".", 1)[-1] if "." in nombre else ""


# --- Generos -----------------------------------------------------------------
# Genero_Musical.descripcion es un CharField con choices numericos. Segun como
# se hayan cargado los datos, la BD puede tener la etiqueta ("Hip-Hop") o la
# clave ("3"). La API siempre publica la etiqueta y acepta ambas al filtrar.
_GENERO_LABELS = {str(clave): etiqueta for clave, etiqueta in Genero_Musical.GENERO_CHOICES}


def _genero_label(genero):
    return _GENERO_LABELS.get(str(genero.descripcion), genero.descripcion)


def _genero_q(etiqueta):
    claves = [k for k, v in _GENERO_LABELS.items() if v == etiqueta]
    cond = Q(genero__descripcion=etiqueta)
    if claves:
        cond |= Q(genero__descripcion__in=claves)
    return cond


# --- Propiedad -----------------------------------------------------------------
def _ya_compro(user, track):
    """Mismo criterio de views.agregar_al_carrito()/reproducir_track()."""
    perfil = _perfil(user)
    if perfil is None:
        return False
    return (
        HistorialCompra.objects.filter(usuario=perfil, track=track).exists()
        or HistorialVenta.objects.filter(comprador=user, track=track).exists()
    )


def _puede_escuchar_completo(user, track):
    if not user.is_authenticated:
        return False
    if track.usuario.user_id == user.id:
        return True
    return _ya_compro(user, track)


def _tiene_compras(track):
    """Mismo criterio de views.editar_track(): ventas o compras registradas."""
    return (
        HistorialVenta.objects.filter(track=track).exists()
        or HistorialCompra.objects.filter(track=track).exists()
    )


# --------------------------------------------------------------------------
# Serializadores
# --------------------------------------------------------------------------
def ser_user(u, private=False, perfil=None):
    """User + perfil Usuario en snake_case.

    ``private=True`` solo para el propio usuario autenticado (login/sesion):
    es el unico caso en que se incluye el email.
    """
    if perfil is None:
        perfil = _perfil(u)
    data = {
        "id": u.id,
        "username": u.username,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "email": u.email if private else "",
        "tipo_usu": perfil.tipo_usu if perfil else Usuario.ARTISTA,
        "descripcion": perfil.descripcion if perfil else None,
        "foto_perfil": _media_url(perfil.foto_perfil) if perfil else None,
        "foto_fondo": _media_url(perfil.foto_fondo) if perfil else None,
        "spotify": perfil.spotify if perfil else None,
        "youtube": perfil.youtube if perfil else None,
        "instagram": perfil.instagram if perfil else None,
    }
    if private:
        data["liked_track_ids"] = (
            list(perfil.tracks_gustados.values_list("id_track", flat=True)) if perfil else []
        )
    return data


def ser_genero(g):
    return {"id": g.id, "descripcion": _genero_label(g)}


def ser_track(t, viewer=None):
    """Espejo de DTrack (src/api/types.ts) + is_purchased / is_owner."""
    autenticado = viewer is not None and viewer.is_authenticated
    return {
        "id_track": t.id_track,
        "nombre_track": t.nombre_track,
        "precio": t.precio,
        "track": _media_url(t.track),      # NO reproducir desde aqui: /api/track/<id>/reproducir/
        "preview": _media_url(t.preview),  # idem: /api/track/<id>/preview/
        "descripcion": t.descripcion,
        "foto": _media_url(t.foto),
        "genero": ser_genero(t.genero),
        "usuario": ser_user(t.usuario.user, perfil=t.usuario),
        "likes_count": t.usuarios_que_dieron_like.count(),
        "is_purchased": bool(autenticado and _ya_compro(viewer, t)),
        "is_owner": bool(autenticado and t.usuario.user_id == viewer.id),
        # Metadatos de la UI aun sin columna en Track -> valores por defecto.
        "resource_type": getattr(t, "resource_type", "instrumental"),
        "bpm": getattr(t, "bpm", None),
        "scale_key": getattr(t, "scale_key", None),
        "mood": getattr(t, "mood", None),
        "has_stems": getattr(t, "has_stems", True),
        "has_wav": getattr(t, "has_wav", True),
        "has_midi": getattr(t, "has_midi", False),
        "allow_free_download": getattr(t, "allow_free_download", t.precio == 0),
        "has_watermark": getattr(t, "has_watermark", t.precio > 0),
        "duration": getattr(t, "duration", None),
    }


def ser_venta(v):
    return {
        "id": v.id,
        "detalle": v.detalle,
        "fecha": v.fecha.isoformat() if v.fecha else None,
        "precio": v.precio,
        "iva": v.iva,  # calculado en servidor; el SPA nunca lo recalcula
        "precio_total": v.precio_total,
        "track": v.track_id,
    }


def ser_comentario(c):
    return {
        "id": c.id,
        "usuario": ser_user(c.usuario),
        "track": c.track_id,
        "contenido": c.contenido,
        "fecha_creacion": c.fecha_creacion.isoformat(),
    }


def _owned_track_or_error(track_id, user):
    """Misma guarda de editar_track()/eliminar_track(): solo el dueño."""
    t = Track.objects.select_related("usuario__user", "genero").filter(id_track=track_id).first()
    if t is None:
        return None, _err("Track no encontrado.", 404)
    if t.usuario.user_id != user.id:
        return None, _err("No tienes permisos sobre este track.", 403)
    return t, None


# --------------------------------------------------------------------------
# CSRF + sesion
# --------------------------------------------------------------------------
@ensure_csrf_cookie
def csrf_token(request):
    # Formato compatible con client.ts (lee j.detail).
    return JsonResponse({"detail": get_token(request)})


def session_view(request):
    if request.user.is_authenticated:
        return JsonResponse(ser_user(request.user, private=True))
    return JsonResponse(None, safe=False)


# --------------------------------------------------------------------------
# Autenticacion
# --------------------------------------------------------------------------
def login_api(request):
    if request.method != "POST":
        return _err("Método no permitido.", 405)
    body = _json_body(request)
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    user = authenticate(request, username=username, password=password)
    if user is None:
        # authenticate() tambien devuelve None para cuentas inactivas. Solo se
        # revela "falta activar" si la contraseña es correcta; asi no se puede
        # averiguar que usuarios existen.
        candidato = User.objects.filter(username=username).first()
        if candidato and not candidato.is_active and candidato.check_password(password):
            return _err(
                "Debes confirmar tu cuenta desde el correo de activación "
                "antes de iniciar sesión.",
                403,
            )
        return _err("Credenciales incorrectas.", 401)

    auth_login(request, user)
    return JsonResponse(ser_user(user, private=True))


def logout_api(request):
    if request.method != "POST":
        return _err("Método no permitido.", 405)
    auth_logout(request)
    return JsonResponse({"ok": True})


def registro_api(request):
    """Espejo JSON de views.registro(): misma RegistroUsuarioForm, cuenta
    inactiva, perfil Usuario y correo de activacion, todo en una transaccion."""
    if request.method != "POST":
        return _err("Método no permitido.", 405)

    form = RegistroUsuarioForm(request.POST, request.FILES)
    if not form.is_valid():
        errors = {campo: [str(m) for m in msgs] for campo, msgs in form.errors.items()}
        return _err("Datos inválidos.", 400, errors=errors)

    try:
        with db_transaction.atomic():
            user = form.save(commit=False)
            user.email = form.cleaned_data["email"].strip().lower()
            user.is_active = False
            user.save()

            Usuario.objects.create(
                user=user,
                tipo_usu=form.cleaned_data["tipo_usu"],
                foto_perfil=request.FILES.get("foto_perfil"),
                foto_fondo=request.FILES.get("foto_fondo"),
            )

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            activation_url = request.build_absolute_uri(
                reverse("activar_cuenta", kwargs={"uidb64": uid, "token": token})
            )

            html_content = render_to_string(
                "emails/confirmar_cuenta.html",
                {"usuario": user, "activation_url": activation_url},
            )
            text_content = (
                f"Hola {user.first_name or user.username},\n\n"
                "¡Bienvenido a BeatCloud!\n\n"
                "Gracias por crear tu cuenta. Para confirmar tu correo y activar "
                "tu cuenta, abre el siguiente enlace:\n\n"
                f"{activation_url}\n\n"
                "Si tú no creaste esta cuenta, puedes ignorar este mensaje.\n\n"
                "Equipo BeatCloud"
            )
            email = EmailMultiAlternatives(
                subject="Confirma tu cuenta | BeatCloud",
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)
    except Exception:
        logger.exception("api registro: no se pudo completar el registro")
        return _err(
            "No pudimos enviar el correo de confirmación. "
            "Revisa la configuración SMTP e inténtalo nuevamente.",
            500,
        )
    return JsonResponse(
        {"detail": "Registro exitoso. Revisa tu correo para activar la cuenta."},
        status=201,
    )


# --------------------------------------------------------------------------
# Catalogo y detalle (espejo de views.catalogo())
# --------------------------------------------------------------------------
def catalogo_api(request):
    tracks = Track.objects.select_related("usuario__user", "genero").exclude(
        usuario__user__username=ANON_USER_USERNAME,
    )

    q = request.GET.get("q", "").strip()
    if q:
        claves = [k for k, v in _GENERO_LABELS.items() if q.lower() in v.lower()]
        cond = (
            Q(nombre_track__icontains=q)
            | Q(usuario__user__username__icontains=q)
            | Q(genero__descripcion__icontains=q)
        )
        if claves:
            cond |= Q(genero__descripcion__in=claves)
        tracks = tracks.filter(cond)

    genero = request.GET.get("genero", "").strip()
    if genero:
        tracks = tracks.filter(_genero_q(genero))

    rangos = {
        "0-5000": (0, 5000),
        "5001-10000": (5001, 10000),
        "10001-20000": (10001, 20000),
    }
    precio = request.GET.get("precio", "").strip()
    if precio in rangos:
        minimo, maximo = rangos[precio]
        tracks = tracks.filter(precio__gte=minimo, precio__lte=maximo)
    elif precio == "20001-mas":
        tracks = tracks.filter(precio__gte=20001)

    ordenes = {
        "recientes": "-id_track",
        "antiguos": "id_track",
        "precio_menor": "precio",
        "precio_mayor": "-precio",
        "nombre": "nombre_track",
    }
    orden = request.GET.get("orden", "recientes")
    tracks = tracks.order_by(ordenes.get(orden, "-id_track"))

    paginator = Paginator(tracks, TRACKS_POR_PAGINA)
    page_obj = paginator.get_page(request.GET.get("page") or 1)

    comprados = set()
    if request.user.is_authenticated:
        perfil = _perfil(request.user)
        if perfil:
            comprados |= set(
                HistorialCompra.objects.filter(usuario=perfil).values_list("track_id", flat=True)
            )
        comprados |= set(
            HistorialVenta.objects.filter(comprador=request.user).values_list(
                "track_id", flat=True
            )
        )

    return JsonResponse(
        {
            "tracks": [ser_track(t, request.user) for t in page_obj],
            "total_resultados": paginator.count,
            "pagina_actual": page_obj.number,
            "total_paginas": paginator.num_pages,
            "tracks_comprados": sorted(comprados),
            "generos": [ser_genero(g) for g in Genero_Musical.objects.all()],
        }
    )


def track_detail_api(request, track_id):
    """GET detalle; PATCH/PUT delega en track_update_api (misma ruta REST)."""
    if request.method in ("PATCH", "PUT"):
        return track_update_api(request, track_id)
    t = Track.objects.select_related("usuario__user", "genero").filter(id_track=track_id).first()
    if t is None:
        return _err("Track no encontrado.", 404)
    return JsonResponse(ser_track(t, request.user))


# --------------------------------------------------------------------------
# Audio protegido (espejo de reproducir_preview_track / reproducir_track /
# descargar_track): preview abierto a todos; audio completo y descarga solo
# para el dueño o quien compro el track.
# --------------------------------------------------------------------------
def preview_stream_api(request, track_id):
    track = Track.objects.filter(id_track=track_id).first()
    if track is None or not track.preview:
        raise Http404("Este track todavía no tiene una vista previa disponible.")
    archivo = track.preview.open("rb")
    content_type, _ = mimetypes.guess_type(track.preview.name)
    return FileResponse(archivo, content_type=content_type or "audio/mpeg")


def full_stream_api(request, track_id):
    track = Track.objects.select_related("usuario__user").filter(id_track=track_id).first()
    if track is None:
        raise Http404()
    if not _puede_escuchar_completo(request.user, track):
        return HttpResponseForbidden("Debes comprar este track para escuchar el audio completo.")
    if not track.track:
        raise Http404("El archivo de audio no está disponible.")
    archivo = track.track.open("rb")
    nombre = track.track.name.rsplit("/", 1)[-1]
    response = FileResponse(
        archivo, content_type=mimetypes.guess_type(nombre)[0] or "application/octet-stream"
    )
    response["Content-Disposition"] = f'inline; filename="{nombre}"'
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response


def download_api(request, track_id):
    if not request.user.is_authenticated:
        return HttpResponseForbidden("Inicia sesión para descargar.")
    track = Track.objects.select_related("usuario__user").filter(id_track=track_id).first()
    if track is None:
        raise Http404()
    if not _puede_escuchar_completo(request.user, track):
        return HttpResponseForbidden("Debes comprar este track antes de poder descargarlo.")
    if not track.track:
        raise Http404("El archivo de este track no está disponible.")
    nombre = track.track.name.rsplit("/", 1)[-1]
    return FileResponse(track.track.open("rb"), as_attachment=True, filename=nombre)


# --------------------------------------------------------------------------
# Carrito (tabla Venta con completada=False; espejo de agregar_al_carrito())
# --------------------------------------------------------------------------
def cart_list_api(request):
    if (resp := _auth_required(request)) is not None:
        return resp
    ventas = Venta.objects.filter(usuario_id=_perfil(request.user), completada=False)
    items = [ser_venta(v) for v in ventas]
    subtotal = sum(v["precio"] for v in items)
    iva = sum(v["iva"] for v in items)
    return JsonResponse({"items": items, "subtotal": subtotal, "iva": iva, "total": subtotal + iva})


def cart_add_api(request, track_id):
    if request.method != "POST":
        return _err("Método no permitido.", 405)
    if (resp := _auth_required(request)) is not None:
        return resp

    track = Track.objects.select_related("usuario__user").filter(id_track=track_id).first()
    if track is None:
        return _err("Track no encontrado.", 404)
    perfil = _perfil(request.user)
    if perfil is None:
        return _err("Tu cuenta no tiene un perfil de BeatsCloud.", 403)

    if track.usuario.user.username == ANON_USER_USERNAME:
        return _err("Este track se conserva únicamente para compradores anteriores.", 409)
    if _ya_compro(request.user, track):
        return _err(
            "Ya compraste este track anteriormente. Puedes descargarlo desde esta página.", 409
        )
    if Venta.objects.filter(usuario_id=perfil, track=track, completada=False).exists():
        return _err("Este track ya está agregado a tu carrito.", 409)

    precio = track.precio
    iva = int(round(precio * IVA_PCT))
    venta = Venta.objects.create(
        detalle=track.nombre_track,
        fecha=timezone.localdate(),
        precio=precio,
        iva=iva,
        precio_total=precio + iva,
        usuario_id=perfil,
        track=track,
    )
    return JsonResponse(ser_venta(venta), status=201)


def cart_remove_api(request, venta_id):
    if request.method != "DELETE":
        return _err("Método no permitido.", 405)
    if (resp := _auth_required(request)) is not None:
        return resp
    venta = Venta.objects.filter(
        pk=venta_id, usuario_id=_perfil(request.user), completada=False
    ).first()
    if venta is None:
        return _err("Elemento no encontrado en tu carrito.", 404)
    venta.delete()
    return JsonResponse({"ok": True})


# --------------------------------------------------------------------------
# Pagos Webpay Plus. Estos endpoints SOLO inician el pago. El retorno de
# Transbank sigue siendo las vistas HTML exito_carrito()/exito() de views.py,
# donde vive la validacion completa (commit, response_code, AUTHORIZED,
# buy_order, monto, session_id) y el registro de compras.
#
# El navegador debe enviar un FORMULARIO POST con token_ws a url_webpay (asi lo
# hace app/templates/app/pago.html); NO basta con asignar window.location.
# --------------------------------------------------------------------------
def _webpay_tx():
    return Transaction(
        options=WebpayOptions(
            commerce_code=settings.TRANSBANK_COMMERCE_CODE,
            api_key=settings.TRANSBANK_API_KEY,
            integration_type=settings.TRANSBANK_INTEGRATION_TYPE,
        )
    )


def _nuevo_buy_order():
    return str(random.randrange(1000000, 99999999))  # mismo esquema que views.py


def _crear_pago(request, wt, return_url_name):
    """Llama a tx.create() y devuelve el payload que necesita el SPA."""
    amount = int(round(float(wt.amount)))
    return_url = request.build_absolute_uri(reverse(return_url_name))
    try:
        response = _webpay_tx().create(wt.buy_order, wt.session_id, amount, return_url)
        url_webpay, token_ws = response["url"], response["token"]
    except Exception:
        logger.exception("api pago: Transbank rechazó la creación de la transacción")
        wt.status = WebpayTransaction.ESTADO_CANCELADO
        wt.save(update_fields=["status"])
        return _err("No fue posible iniciar el pago con Webpay. Inténtalo nuevamente.", 502)

    return JsonResponse(
        {
            "url_webpay": url_webpay,
            "token_ws": token_ws,
            "buy_order": wt.buy_order,
            "session_id": wt.session_id,
            "amount": amount,
            "transaction_id": wt.id,
        }
    )


def pago_init_api(request):
    if request.method != "POST":
        return _err("Método no permitido.", 405)
    if (resp := _auth_required(request)) is not None:
        return resp

    ventas = Venta.objects.filter(usuario_id=_perfil(request.user), completada=False)
    if not ventas.exists():
        return _err("Tu carrito no tiene productos pendientes de pago.", 400)

    total = sum(v.precio for v in ventas) + sum(v.iva for v in ventas)
    wt = WebpayTransaction.objects.create(
        user=request.user,
        buy_order=_nuevo_buy_order(),
        session_id=request.user.username,  # misma convención que views.pago()
        amount=int(round(float(total))),
    )
    return _crear_pago(request, wt, "exito_carrito")


def suscripcion_pago_api(request, suscripcion_id):
    """Espejo de views.realizar_pago() (rama POST). Retorna a la vista 'exito'."""
    if request.method != "POST":
        return _err("Método no permitido.", 405)
    if (resp := _auth_required(request)) is not None:
        return resp

    suscripcion = Suscripcion.objects.filter(id_sus=suscripcion_id).first()
    if suscripcion is None:
        return _err("Suscripción no encontrada.", 404)
    if WebpayTransaction.objects.filter(
        user=request.user,
        suscripcion=suscripcion,
        status=WebpayTransaction.ESTADO_AUTORIZADO,
    ).exists():
        return _err("Ya compraste esta suscripción anteriormente.", 409)

    wt = WebpayTransaction.objects.create(
        user=request.user,
        buy_order=_nuevo_buy_order(),
        session_id=request.user.username,
        amount=suscripcion.precio,
        suscripcion=suscripcion,
        status=WebpayTransaction.ESTADO_PENDIENTE,
    )
    return _crear_pago(request, wt, "exito")


def pago_cancel_api(request, transaction_id):
    """Espejo de views.cancelar_pago_pendiente(): PENDING -> CANCELLED."""
    if request.method != "POST":
        return _err("Método no permitido.", 405)
    if (resp := _auth_required(request)) is not None:
        return resp
    wt = WebpayTransaction.objects.filter(
        id=transaction_id, user=request.user, status=WebpayTransaction.ESTADO_PENDIENTE
    ).first()
    if wt is None:
        return _err("Transacción no encontrada o ya resuelta.", 404)
    wt.status = WebpayTransaction.ESTADO_CANCELADO
    wt.save(update_fields=["status"])
    return JsonResponse({"ok": True})


# --------------------------------------------------------------------------
# Productor: subir / editar / eliminar tracks
# --------------------------------------------------------------------------
def upload_api(request):
    """Espejo de views.upload_file(): TrackForm + validacion con mutagen."""
    if request.method != "POST":
        return _err("Método no permitido.", 405)
    if (resp := _auth_required(request)) is not None:
        return resp
    perfil = _perfil(request.user)
    if perfil is None or perfil.tipo_usu != Usuario.PRODUCTOR:
        return _err("Solo los productores pueden subir pistas.", 403)

    form = TrackForm(request.POST, request.FILES)
    formulario_valido = form.is_valid()
    errores = {}

    audio = request.FILES.get("track")
    if not audio:
        errores["track"] = "Debes seleccionar un archivo de audio."
    elif _extension(audio.name) not in FORMATOS_AUDIO:
        errores["track"] = "Archivo de audio inválido. Solo MP3, WAV, FLAC, M4A, AAC u OGG."
    else:
        try:
            audio.seek(0)
            if mutagen.File(audio) is None:
                errores["track"] = "El archivo seleccionado no contiene un audio válido."
        except Exception:
            errores["track"] = (
                "No fue posible validar el audio. Comprueba que el archivo no esté dañado."
            )
        finally:
            try:
                audio.seek(0)
            except Exception:
                pass

    imagen = request.FILES.get("foto")
    if imagen and _extension(imagen.name) not in FORMATOS_IMAGEN:
        errores["foto"] = "Imagen inválida. Solo se permiten JPG, JPEG, PNG o WEBP."

    if not formulario_valido or errores:
        errors = {campo: [str(m) for m in msgs] for campo, msgs in form.errors.items()}
        for campo, mensaje in errores.items():
            errors.setdefault(campo, []).append(mensaje)
        return _err("Errores de validación.", 400, errors=errors)

    track = form.save(commit=False)
    track.usuario = perfil
    track.save()
    try:
        generar_preview_audio(track)  # mp3 de 30 s: la seguridad de preview vive en servidor
    except Exception:
        logger.exception("api upload: falló la generación del preview (track %s)", track.pk)
        track.track.delete(save=False)
        track.delete()
        return _err("No fue posible generar la vista previa del audio. Inténtalo nuevamente.", 500)

    return JsonResponse(ser_track(track, request.user), status=201)


def track_update_api(request, track_id):
    """Edita nombre, precio y descripcion. El audio no se reemplaza por esta via."""
    if request.method not in ("PATCH", "PUT"):
        return _err("Método no permitido.", 405)
    if (resp := _auth_required(request)) is not None:
        return resp
    t, error = _owned_track_or_error(track_id, request.user)
    if error:
        return error

    body = _json_body(request)
    errores = {}
    cambios = {}

    if "nombre_track" in body:
        nombre = body["nombre_track"]
        if not isinstance(nombre, str) or not nombre.strip() or len(nombre.strip()) > 200:
            errores["nombre_track"] = "El nombre es obligatorio y admite hasta 200 caracteres."
        else:
            cambios["nombre_track"] = nombre.strip()

    if "precio" in body:
        precio = body["precio"]
        if (
            isinstance(precio, bool)
            or not isinstance(precio, (int, float))
            or int(precio) != precio
            or precio < 0
        ):
            errores["precio"] = "El precio debe ser un entero en CLP mayor o igual a 0."
        else:
            cambios["precio"] = int(precio)

    if "descripcion" in body:
        descripcion = body["descripcion"]
        if descripcion is not None and (not isinstance(descripcion, str) or len(descripcion) > 500):
            errores["descripcion"] = "La descripción admite hasta 500 caracteres."
        else:
            cambios["descripcion"] = descripcion

    if errores:
        return _err("Datos inválidos.", 400, errors=errores)

    for campo, valor in cambios.items():
        setattr(t, campo, valor)
    if cambios:
        t.save(update_fields=list(cambios))
    return JsonResponse(ser_track(t, request.user))


def track_delete_api(request, track_id):
    if request.method != "POST":
        return _err("Método no permitido.", 405)
    if (resp := _auth_required(request)) is not None:
        return resp
    t, error = _owned_track_or_error(track_id, request.user)
    if error:
        return error
    # Divergencia deliberada (ver docstring del modulo): proteger historial.
    if _tiene_compras(t):
        return _err("No puedes eliminar un track que ya ha sido comprado o vendido.", 409)
    t.delete()
    return JsonResponse({"ok": True})


def mis_ventas_api(request):
    if (resp := _auth_required(request)) is not None:
        return resp
    ventas = HistorialVenta.objects.filter(track__usuario__user=request.user).select_related(
        "track__usuario__user", "track__genero", "comprador"
    )
    return JsonResponse(
        [
            {
                "id": v.pk,
                # Objeto {id, username} (o null si la cuenta fue eliminada), como
                # espera DHistorialVenta / mapHistorialVenta() en el front.
                "comprador": (
                    {"id": v.comprador.id, "username": v.comprador.username}
                    if v.comprador
                    else None
                ),
                "precio": float(v.precio),
                "track": ser_track(v.track, request.user),
                "fecha_venta": v.fecha_venta.isoformat(),
            }
            for v in ventas
        ],
        safe=False,
    )


# --------------------------------------------------------------------------
# Artista / comunidad
# --------------------------------------------------------------------------
def mis_compras_api(request):
    if (resp := _auth_required(request)) is not None:
        return resp
    compras = HistorialCompra.objects.filter(usuario=_perfil(request.user)).select_related(
        "track__usuario__user", "track__genero"
    )
    return JsonResponse(
        [
            {
                "id": c.pk,
                "track": ser_track(c.track, request.user),
                "fecha_compra": c.fecha_compra.isoformat(),
            }
            for c in compras
        ],
        safe=False,
    )


def like_toggle_api(request, track_id):
    if request.method != "POST":
        return _err("Método no permitido.", 405)
    if (resp := _auth_required(request)) is not None:
        return resp
    track = Track.objects.filter(id_track=track_id).first()
    perfil = _perfil(request.user)
    if track is None or perfil is None:
        return _err("No encontrado.", 404)
    if perfil.tracks_gustados.filter(pk=track.pk).exists():
        perfil.tracks_gustados.remove(track)
        liked = False
    else:
        perfil.tracks_gustados.add(track)
        liked = True
    return JsonResponse({"liked": liked, "likes_count": track.usuarios_que_dieron_like.count()})


def comments_api(request, track_id):
    track = Track.objects.filter(id_track=track_id).first()
    if track is None:
        return _err("Track no encontrado.", 404)
    if request.method == "GET":
        return JsonResponse(
            [ser_comentario(c) for c in track.comentarios.select_related("usuario")],
            safe=False,
        )
    if request.method == "POST":
        if (resp := _auth_required(request)) is not None:
            return resp
        contenido = (_json_body(request).get("contenido") or "").strip()
        if not contenido:
            return _err("El comentario no puede estar vacío.", 400)
        c = Comentario.objects.create(usuario=request.user, track=track, contenido=contenido)
        return JsonResponse(ser_comentario(c), status=201)
    return _err("Método no permitido.", 405)


def perfil_publico_api(request, username):
    u = User.objects.filter(username=username, is_active=True).first()
    perfil = _perfil(u) if u else None
    if u is None or perfil is None or u.username == ANON_USER_USERNAME:
        return _err("Perfil no encontrado.", 404)
    data = ser_user(u, perfil=perfil)
    tracks = Track.objects.select_related("usuario__user", "genero").filter(usuario=perfil)
    data["tracks"] = [ser_track(t, request.user) for t in tracks.order_by("-id_track")]
    return JsonResponse(data)


def usuarios_api(request):
    """Espejo de views.catalogo_usuarios()."""
    usuarios = (
        Usuario.objects.select_related("user")
        .exclude(user__username=ANON_USER_USERNAME)
        .order_by("user__username")
    )
    tipo = (request.GET.get("tipo") or "todos").strip().lower()
    if tipo == "artistas":
        usuarios = usuarios.filter(tipo_usu=Usuario.ARTISTA)
    elif tipo == "productores":
        usuarios = usuarios.filter(tipo_usu=Usuario.PRODUCTOR)

    q = (request.GET.get("q") or "").strip()
    if q:
        usuarios = usuarios.filter(
            Q(user__username__icontains=q)
            | Q(user__first_name__icontains=q)
            | Q(user__last_name__icontains=q)
        )
    return JsonResponse([ser_user(p.user, perfil=p) for p in usuarios], safe=False)


def suscripciones_api(request):
    """Suscripciones ofrecidas por un productor (?user=<id del User>)."""
    qs = Suscripcion.objects.select_related("user__user")
    uid = request.GET.get("user")
    if uid:
        if not uid.isdigit():
            return _err("Parámetro user inválido.", 400)
        qs = qs.filter(user__user__id=int(uid))

    suscritas = set()
    if request.user.is_authenticated:
        suscritas = set(
            WebpayTransaction.objects.filter(
                user=request.user, status=WebpayTransaction.ESTADO_AUTORIZADO
            ).values_list("suscripcion_id", flat=True)
        )
    return JsonResponse(
        [
            {
                "id_sus": s.id_sus,
                "detalle": s.detalle,
                "precio": s.precio,
                "user": ser_user(s.user.user, perfil=s.user),
                "is_subscribed": s.id_sus in suscritas,
            }
            for s in qs
        ],
        safe=False,
    )


# --------------------------------------------------------------------------
# URLs: app/urls.py las agrega con  urlpatterns += api_shim.urlpatterns
# --------------------------------------------------------------------------
urlpatterns = [
    path("api/csrf/", csrf_token, name="api_csrf"),
    path("api/session/", session_view, name="api_session"),
    path("api/auth/login/", login_api, name="api_login"),
    path("api/auth/logout/", logout_api, name="api_logout"),
    path("api/auth/registro/", registro_api, name="api_registro"),
    path("api/catalogo/", catalogo_api, name="api_catalogo"),
    path("api/track/<int:track_id>/", track_detail_api, name="api_track"),
    path("api/track/<int:track_id>/preview/", preview_stream_api, name="api_preview"),
    path("api/track/<int:track_id>/reproducir/", full_stream_api, name="api_full"),
    path("api/track/<int:track_id>/descargar/", download_api, name="api_download"),
    path("api/track/<int:track_id>/delete/", track_delete_api, name="api_delete"),
    path("api/track/<int:track_id>/comentarios/", comments_api, name="api_comments"),
    path("api/carrito/", cart_list_api, name="api_cart"),
    path("api/carrito/agregar/<int:track_id>/", cart_add_api, name="api_cart_add"),
    path("api/carrito/<int:venta_id>/", cart_remove_api, name="api_cart_remove"),
    path("api/pago/", pago_init_api, name="api_pago"),
    path("api/pago/cancelar/<int:transaction_id>/", pago_cancel_api, name="api_pago_cancel"),
    path("api/suscripcion/<int:suscripcion_id>/pago/", suscripcion_pago_api, name="api_suscripcion_pago"),
    path("api/upload/", upload_api, name="api_upload"),
    path("api/mis-ventas/", mis_ventas_api, name="api_sales"),
    path("api/mis-compras/", mis_compras_api, name="api_purchases"),
    path("api/like/<int:track_id>/", like_toggle_api, name="api_like"),
    path("api/perfil/<str:username>/", perfil_publico_api, name="api_profile"),
    path("api/usuarios/", usuarios_api, name="api_usuarios"),
    path("api/suscripciones/", suscripciones_api, name="api_suscripciones"),
]
