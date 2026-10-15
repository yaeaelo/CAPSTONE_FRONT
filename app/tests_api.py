# -*- coding: utf-8 -*-
"""
Pruebas de la API JSON que consume el frontend React (app/api_shim.py).

Ejecutar:
    python manage.py test app.tests_api      # solo estas pruebas
    python manage.py test app                # todas (incluye app/tests.py)

Transbank se reemplaza por un mock (no se hacen llamadas de red) y el audio se
guarda en un MEDIA_ROOT temporal.
"""
import io
import json
import tempfile
import wave
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings

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

PASSWORD = "ClaveSegura123!"
WEBPAY_OK = {"url": "https://webpay.test/initTransaction", "token": "tok-123"}


def wav_bytes(segundos=1):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b"\x00\x00" * 8000 * segundos)
    return buffer.getvalue()


def leer(response):
    """Consume y cierra un FileResponse (evita archivos abiertos, sobre todo en Windows)."""
    try:
        return b"".join(response.streaming_content)
    finally:
        response.close()


class ApiBase(TestCase):
    def setUp(self):
        self.genero = Genero_Musical.objects.create(descripcion="Hip-Hop")
        self.prod_user, self.prod = self.crear_usuario("productor1", Usuario.PRODUCTOR)
        self.art_user, self.art = self.crear_usuario("artista1", Usuario.ARTISTA)
        self.t1 = Track.objects.create(
            nombre_track="Trap Oscuro",
            precio=10000,
            genero=self.genero,
            usuario=self.prod,
            descripcion="Beat oscuro",
        )
        self.t2 = Track.objects.create(
            nombre_track="Loop Gratis", precio=0, genero=self.genero, usuario=self.prod
        )

    def crear_usuario(self, username, tipo, activo=True):
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password=PASSWORD,
            is_active=activo,
        )
        return user, Usuario.objects.create(user=user, tipo_usu=tipo)

    def post_json(self, url, data=None):
        return self.client.post(url, data=json.dumps(data or {}), content_type="application/json")

    def patch_json(self, url, data):
        return self.client.patch(url, data=json.dumps(data), content_type="application/json")


# --------------------------------------------------------------------------
# CSRF, sesion y autenticacion
# --------------------------------------------------------------------------
class AutenticacionTests(ApiBase):
    LOGIN = "/api/auth/login/"

    def test_mutaciones_exigen_token_csrf_y_el_handshake_lo_entrega(self):
        cliente = Client(enforce_csrf_checks=True)
        credenciales = json.dumps({"username": "artista1", "password": PASSWORD})

        sin_token = cliente.post(self.LOGIN, credenciales, content_type="application/json")
        self.assertEqual(sin_token.status_code, 403)

        token = cliente.get("/api/csrf/").json()["detail"]
        con_token = cliente.post(
            self.LOGIN,
            credenciales,
            content_type="application/json",
            headers={"X-CSRFToken": token},
        )
        self.assertEqual(con_token.status_code, 200)

    def test_sesion_anonima_es_null(self):
        response = self.client.get("/api/session/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json())

    def test_login_correcto_inicia_sesion_y_devuelve_email_propio(self):
        response = self.post_json(self.LOGIN, {"username": "artista1", "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["username"], "artista1")
        self.assertEqual(data["email"], "artista1@example.com")
        self.assertEqual(data["tipo_usu"], Usuario.ARTISTA)
        self.assertEqual(self.client.get("/api/session/").json()["username"], "artista1")

    def test_login_con_clave_incorrecta_es_401(self):
        response = self.post_json(self.LOGIN, {"username": "artista1", "password": "MALA"})
        self.assertEqual(response.status_code, 401)

    def test_cuenta_inactiva_solo_se_revela_con_la_clave_correcta(self):
        self.crear_usuario("pendiente1", Usuario.ARTISTA, activo=False)

        correcta = self.post_json(self.LOGIN, {"username": "pendiente1", "password": PASSWORD})
        self.assertEqual(correcta.status_code, 403)

        incorrecta = self.post_json(self.LOGIN, {"username": "pendiente1", "password": "MALA"})
        self.assertEqual(incorrecta.status_code, 401)

    def test_logout_cierra_sesion(self):
        self.client.force_login(self.art_user)
        self.assertEqual(self.post_json("/api/auth/logout/").status_code, 200)
        self.assertIsNone(self.client.get("/api/session/").json())

    def test_logout_por_get_no_esta_permitido(self):
        self.client.force_login(self.art_user)
        self.assertEqual(self.client.get("/api/auth/logout/").status_code, 405)
        self.assertEqual(self.client.get("/api/session/").json()["username"], "artista1")

    def test_usuario_sin_perfil_no_rompe_la_api(self):
        admin = User.objects.create_superuser("admin1", "admin1@example.com", PASSWORD)
        self.client.force_login(admin)
        self.assertEqual(self.client.get("/api/session/").json()["username"], "admin1")
        self.assertEqual(self.client.get("/api/carrito/").json()["items"], [])
        self.assertEqual(self.client.get("/api/mis-compras/").json(), [])
        self.assertEqual(self.client.post("/api/upload/").status_code, 403)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class RegistroApiTests(ApiBase):
    def datos(self, **extra):
        base = {
            "username": "nuevo1",
            "email": "nuevo1@example.com",
            "password1": PASSWORD,
            "password2": PASSWORD,
            "first_name": "Nuevo",
            "last_name": "Usuario",
            "tipo_usu": str(Usuario.ARTISTA),
        }
        base.update(extra)
        return base

    def test_registro_crea_cuenta_inactiva_perfil_y_correo_de_activacion(self):
        response = self.client.post("/api/auth/registro/", self.datos())
        self.assertEqual(response.status_code, 201)

        user = User.objects.get(username="nuevo1")
        self.assertFalse(user.is_active)
        self.assertEqual(Usuario.objects.get(user=user).tipo_usu, Usuario.ARTISTA)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/activar/", mail.outbox[0].body)

    def test_registro_rechaza_correo_duplicado(self):
        response = self.client.post(
            "/api/auth/registro/", self.datos(email="artista1@example.com")
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.json()["errors"])
        self.assertFalse(User.objects.filter(username="nuevo1").exists())


# --------------------------------------------------------------------------
# Privacidad: ningun payload publico debe incluir emails
# --------------------------------------------------------------------------
class PrivacidadTests(ApiBase):
    def test_payloads_publicos_no_exponen_emails(self):
        Comentario.objects.create(usuario=self.art_user, track=self.t1, contenido="Fuego")

        catalogo = self.client.get("/api/catalogo/").json()
        self.assertEqual(catalogo["tracks"][0]["usuario"]["email"], "")

        comentarios = self.client.get(f"/api/track/{self.t1.id_track}/comentarios/").json()
        self.assertEqual(comentarios[0]["usuario"]["email"], "")

        perfil = self.client.get("/api/perfil/productor1/").json()
        self.assertEqual(perfil["email"], "")

        usuarios = self.client.get("/api/usuarios/").json()
        self.assertTrue(all(u["email"] == "" for u in usuarios))

        self.assertNotIn("example.com", json.dumps([catalogo, comentarios, perfil, usuarios]))


# --------------------------------------------------------------------------
# Catalogo
# --------------------------------------------------------------------------
class CatalogoTests(ApiBase):
    def test_estructura_total_y_filtros(self):
        data = self.client.get("/api/catalogo/").json()
        self.assertEqual(data["total_resultados"], 2)
        self.assertEqual(data["pagina_actual"], 1)
        self.assertTrue(
            {"id_track", "nombre_track", "precio", "genero", "usuario", "preview", "is_purchased"}
            <= set(data["tracks"][0])
        )

        self.assertEqual(self.client.get("/api/catalogo/?q=trap").json()["total_resultados"], 1)
        self.assertEqual(
            self.client.get("/api/catalogo/?precio=0-5000").json()["tracks"][0]["nombre_track"],
            "Loop Gratis",
        )
        mayor = self.client.get("/api/catalogo/?orden=precio_mayor").json()["tracks"]
        self.assertEqual([t["precio"] for t in mayor], [10000, 0])

    def test_paginacion_de_6_por_pagina(self):
        for i in range(5):
            Track.objects.create(
                nombre_track=f"Extra {i}", precio=1000, genero=self.genero, usuario=self.prod
            )
        pagina1 = self.client.get("/api/catalogo/").json()
        pagina2 = self.client.get("/api/catalogo/?page=2").json()
        self.assertEqual(pagina1["total_resultados"], 7)
        self.assertEqual(pagina1["total_paginas"], 2)
        self.assertEqual(len(pagina1["tracks"]), 6)
        self.assertEqual(len(pagina2["tracks"]), 1)

    def test_generos_funcionan_con_etiqueta_o_con_clave_numerica_en_la_bd(self):
        # Algunas BD guardan la etiqueta ("Hip-Hop"); otras la clave ("1").
        pop = Genero_Musical.objects.create(descripcion=Genero_Musical.POP)
        Track.objects.create(nombre_track="Pop Track", precio=5000, genero=pop, usuario=self.prod)

        por_etiqueta = self.client.get("/api/catalogo/?genero=Pop").json()
        self.assertEqual(por_etiqueta["total_resultados"], 1)
        self.assertEqual(por_etiqueta["tracks"][0]["genero"]["descripcion"], "Pop")

        por_texto = self.client.get("/api/catalogo/?q=pop").json()
        self.assertGreaterEqual(por_texto["total_resultados"], 1)

        hiphop = self.client.get("/api/catalogo/?genero=Hip-Hop").json()
        self.assertEqual(hiphop["total_resultados"], 2)

    def test_excluye_la_cuenta_anonima(self):
        anonimo = User.objects.create_user("UsuarioAnonimo", "anon@example.com", PASSWORD)
        perfil = Usuario.objects.create(user=anonimo, tipo_usu=Usuario.PRODUCTOR)
        Track.objects.create(
            nombre_track="Huérfano", precio=1000, genero=self.genero, usuario=perfil
        )
        data = self.client.get("/api/catalogo/").json()
        self.assertEqual(data["total_resultados"], 2)
        self.assertEqual(self.client.get("/api/perfil/UsuarioAnonimo/").status_code, 404)

    def test_marca_tracks_comprados_del_usuario(self):
        HistorialCompra.objects.create(usuario=self.art, track=self.t1)
        self.client.force_login(self.art_user)
        data = self.client.get("/api/catalogo/").json()
        self.assertEqual(data["tracks_comprados"], [self.t1.id_track])
        comprado = next(t for t in data["tracks"] if t["id_track"] == self.t1.id_track)
        self.assertTrue(comprado["is_purchased"])

    def test_detalle_indica_propiedad_y_compra(self):
        url = f"/api/track/{self.t1.id_track}/"
        self.assertEqual(self.client.get("/api/track/999999/").status_code, 404)

        anonimo = self.client.get(url).json()
        self.assertFalse(anonimo["is_purchased"])
        self.assertFalse(anonimo["is_owner"])

        self.client.force_login(self.prod_user)
        self.assertTrue(self.client.get(url).json()["is_owner"])


# --------------------------------------------------------------------------
# Carrito
# --------------------------------------------------------------------------
class CarritoTests(ApiBase):
    def agregar(self, track):
        return self.client.post(f"/api/carrito/agregar/{track.id_track}/")

    def test_requiere_sesion(self):
        self.assertEqual(self.client.get("/api/carrito/").status_code, 401)
        self.assertEqual(self.agregar(self.t1).status_code, 401)

    def test_agregar_calcula_iva_en_el_servidor(self):
        self.client.force_login(self.art_user)
        response = self.agregar(self.t1)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual((data["precio"], data["iva"], data["precio_total"]), (10000, 1900, 11900))
        self.assertFalse(Venta.objects.get(pk=data["id"]).completada)

    def test_totales_del_carrito(self):
        self.client.force_login(self.art_user)
        self.agregar(self.t1)
        self.agregar(self.t2)
        data = self.client.get("/api/carrito/").json()
        self.assertEqual(len(data["items"]), 2)
        self.assertEqual((data["subtotal"], data["iva"], data["total"]), (10000, 1900, 11900))

    def test_bloquea_duplicados_y_recompras(self):
        self.client.force_login(self.art_user)
        self.assertEqual(self.agregar(self.t1).status_code, 201)
        self.assertEqual(self.agregar(self.t1).status_code, 409)

        HistorialCompra.objects.create(usuario=self.art, track=self.t2)
        self.assertEqual(self.agregar(self.t2).status_code, 409)

    def test_bloquea_tracks_de_la_cuenta_anonima(self):
        anonimo = User.objects.create_user("UsuarioAnonimo", "anon@example.com", PASSWORD)
        perfil = Usuario.objects.create(user=anonimo, tipo_usu=Usuario.PRODUCTOR)
        track = Track.objects.create(
            nombre_track="Huérfano", precio=1000, genero=self.genero, usuario=perfil
        )
        self.client.force_login(self.art_user)
        self.assertEqual(self.agregar(track).status_code, 409)

    def test_agregar_por_get_no_esta_permitido(self):
        self.client.force_login(self.art_user)
        self.assertEqual(
            self.client.get(f"/api/carrito/agregar/{self.t1.id_track}/").status_code, 405
        )

    def test_eliminar_solo_del_propio_carrito(self):
        self.client.force_login(self.art_user)
        venta_id = self.agregar(self.t1).json()["id"]

        otro_user, _ = self.crear_usuario("artista2", Usuario.ARTISTA)
        self.client.force_login(otro_user)
        self.assertEqual(self.client.delete(f"/api/carrito/{venta_id}/").status_code, 404)

        self.client.force_login(self.art_user)
        self.assertEqual(self.client.delete(f"/api/carrito/{venta_id}/").status_code, 200)
        self.assertEqual(self.client.get("/api/carrito/").json()["items"], [])


# --------------------------------------------------------------------------
# Pagos (Transbank mockeado)
# --------------------------------------------------------------------------
@patch("app.api_shim._webpay_tx")
class PagoTests(ApiBase):
    def test_pago_crea_transaccion_pendiente_con_el_total_con_iva(self, tx):
        tx.return_value.create.return_value = WEBPAY_OK
        self.client.force_login(self.art_user)
        self.client.post(f"/api/carrito/agregar/{self.t1.id_track}/")

        response = self.client.post("/api/pago/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["url_webpay"], WEBPAY_OK["url"])
        self.assertEqual(data["token_ws"], WEBPAY_OK["token"])
        self.assertEqual(data["amount"], 11900)

        wt = WebpayTransaction.objects.get(pk=data["transaction_id"])
        self.assertEqual(wt.status, WebpayTransaction.ESTADO_PENDIENTE)
        self.assertEqual(int(wt.amount), 11900)
        self.assertEqual(wt.user, self.art_user)

        buy_order, session_id, amount, return_url = tx.return_value.create.call_args.args
        self.assertEqual(buy_order, wt.buy_order)
        self.assertEqual(session_id, "artista1")
        self.assertEqual(amount, 11900)
        self.assertTrue(return_url.endswith("/pago/exito-carrito/"))

    def test_iniciar_el_pago_no_otorga_acceso_al_track(self, tx):
        tx.return_value.create.return_value = WEBPAY_OK
        self.client.force_login(self.art_user)
        self.client.post(f"/api/carrito/agregar/{self.t1.id_track}/")
        self.client.post("/api/pago/")

        self.assertFalse(HistorialCompra.objects.exists())
        self.assertFalse(HistorialVenta.objects.exists())
        self.assertEqual(Venta.objects.filter(completada=False).count(), 1)

    def test_carrito_vacio_y_sin_sesion(self, tx):
        self.assertEqual(self.client.post("/api/pago/").status_code, 401)
        self.client.force_login(self.art_user)
        self.assertEqual(self.client.post("/api/pago/").status_code, 400)
        tx.return_value.create.assert_not_called()

    def test_si_transbank_falla_se_cancela_y_no_se_filtra_el_error(self, tx):
        tx.return_value.create.side_effect = RuntimeError("credencial-secreta-xyz")
        self.client.force_login(self.art_user)
        self.client.post(f"/api/carrito/agregar/{self.t1.id_track}/")

        response = self.client.post("/api/pago/")

        self.assertEqual(response.status_code, 502)
        self.assertNotIn("credencial-secreta-xyz", response.content.decode())
        self.assertEqual(WebpayTransaction.objects.get().status, WebpayTransaction.ESTADO_CANCELADO)

    def test_cancelar_pago_pendiente(self, tx):
        wt = WebpayTransaction.objects.create(
            user=self.art_user, buy_order="123456", session_id="artista1", amount=11900
        )
        self.assertEqual(self.client.post(f"/api/pago/cancelar/{wt.pk}/").status_code, 401)

        otro_user, _ = self.crear_usuario("artista2", Usuario.ARTISTA)
        self.client.force_login(otro_user)
        self.assertEqual(self.client.post(f"/api/pago/cancelar/{wt.pk}/").status_code, 404)

        self.client.force_login(self.art_user)
        self.assertEqual(self.client.post(f"/api/pago/cancelar/{wt.pk}/").status_code, 200)
        wt.refresh_from_db()
        self.assertEqual(wt.status, WebpayTransaction.ESTADO_CANCELADO)
        # una transacción ya resuelta no se puede cancelar otra vez
        self.assertEqual(self.client.post(f"/api/pago/cancelar/{wt.pk}/").status_code, 404)

    def test_pago_de_suscripcion(self, tx):
        tx.return_value.create.return_value = WEBPAY_OK
        suscripcion = Suscripcion.objects.create(detalle="VIP mensual", precio=5000, user=self.prod)
        self.client.force_login(self.art_user)

        response = self.client.post(f"/api/suscripcion/{suscripcion.id_sus}/pago/")

        self.assertEqual(response.status_code, 200)
        wt = WebpayTransaction.objects.get(pk=response.json()["transaction_id"])
        self.assertEqual(wt.suscripcion, suscripcion)
        self.assertEqual(int(wt.amount), 5000)
        return_url = tx.return_value.create.call_args.args[3]
        self.assertTrue(return_url.endswith("/pago/exito/"))

    def test_no_se_puede_comprar_dos_veces_la_misma_suscripcion(self, tx):
        suscripcion = Suscripcion.objects.create(detalle="VIP mensual", precio=5000, user=self.prod)
        WebpayTransaction.objects.create(
            user=self.art_user,
            buy_order="777",
            session_id="artista1",
            amount=5000,
            suscripcion=suscripcion,
            status=WebpayTransaction.ESTADO_AUTORIZADO,
        )
        self.client.force_login(self.art_user)
        self.assertEqual(self.client.post(f"/api/suscripcion/{suscripcion.id_sus}/pago/").status_code, 409)
        tx.return_value.create.assert_not_called()


# --------------------------------------------------------------------------
# Audio protegido
# --------------------------------------------------------------------------
class AudioTests(ApiBase):
    def setUp(self):
        super().setUp()
        carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(carpeta.cleanup)
        override = override_settings(MEDIA_ROOT=carpeta.name)
        override.enable()
        self.addCleanup(override.disable)

        self.con_audio = Track.objects.create(
            nombre_track="Con audio",
            precio=8000,
            genero=self.genero,
            usuario=self.prod,
            track=SimpleUploadedFile("full.wav", wav_bytes(), content_type="audio/wav"),
            preview=SimpleUploadedFile("preview.mp3", b"ID3-preview", content_type="audio/mpeg"),
        )
        self.url = f"/api/track/{self.con_audio.id_track}"

    def test_preview_es_publico(self):
        response = self.client.get(f"{self.url}/preview/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(leer(response), b"ID3-preview")

    def test_preview_inexistente_es_404(self):
        self.assertEqual(self.client.get(f"/api/track/{self.t1.id_track}/preview/").status_code, 404)

    def test_audio_completo_solo_para_dueno_y_compradores(self):
        self.assertEqual(self.client.get(f"{self.url}/reproducir/").status_code, 403)

        self.client.force_login(self.art_user)
        self.assertEqual(self.client.get(f"{self.url}/reproducir/").status_code, 403)

        HistorialCompra.objects.create(usuario=self.art, track=self.con_audio)
        comprador = self.client.get(f"{self.url}/reproducir/")
        self.assertEqual(comprador.status_code, 200)
        self.assertIn("no-store", comprador["Cache-Control"])
        self.assertEqual(leer(comprador), wav_bytes())

        self.client.force_login(self.prod_user)
        dueno = self.client.get(f"{self.url}/reproducir/")
        self.assertEqual(dueno.status_code, 200)
        leer(dueno)

    def test_descarga_solo_para_dueno_y_compradores(self):
        self.assertEqual(self.client.get(f"{self.url}/descargar/").status_code, 403)

        self.client.force_login(self.art_user)
        self.assertEqual(self.client.get(f"{self.url}/descargar/").status_code, 403)

        HistorialVenta.objects.create(comprador=self.art_user, precio=8000, track=self.con_audio)
        descarga = self.client.get(f"{self.url}/descargar/")
        self.assertEqual(descarga.status_code, 200)
        self.assertIn("attachment", descarga["Content-Disposition"])
        leer(descarga)

    def test_acceso_directo_a_media_canciones_sigue_bloqueado(self):
        self.assertEqual(self.client.get(f"/media/{self.con_audio.track.name}").status_code, 404)


# --------------------------------------------------------------------------
# Productor
# --------------------------------------------------------------------------
class ProductorTests(ApiBase):
    def datos_subida(self, **extra):
        base = {
            "nombre_track": "Nuevo beat",
            "precio": 5000,
            "genero": self.genero.pk,
            "descripcion": "Subido por API",
            "track": SimpleUploadedFile("beat.wav", wav_bytes(), content_type="audio/wav"),
        }
        base.update(extra)
        return base

    def subir(self, **extra):
        carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(carpeta.cleanup)
        with override_settings(MEDIA_ROOT=carpeta.name):
            return self.client.post("/api/upload/", self.datos_subida(**extra))

    # --- subida ---
    def test_subida_requiere_sesion_y_rol_productor(self):
        self.assertEqual(self.client.post("/api/upload/").status_code, 401)
        self.client.force_login(self.art_user)
        self.assertEqual(self.client.post("/api/upload/").status_code, 403)

    @patch("app.api_shim.generar_preview_audio")
    def test_subida_valida_genera_preview_y_asigna_al_productor(self, preview):
        self.client.force_login(self.prod_user)
        response = self.subir()
        self.assertEqual(response.status_code, 201, response.content)

        track = Track.objects.get(nombre_track="Nuevo beat")
        self.assertEqual(track.usuario, self.prod)
        preview.assert_called_once()
        self.assertTrue(response.json()["is_owner"])

    @patch("app.api_shim.generar_preview_audio")
    def test_subida_rechaza_archivos_invalidos(self, preview):
        self.client.force_login(self.prod_user)

        sin_audio = self.client.post(
            "/api/upload/",
            {"nombre_track": "X", "precio": 1000, "genero": self.genero.pk},
        )
        self.assertEqual(sin_audio.status_code, 400)
        self.assertIn("track", sin_audio.json()["errors"])

        extension = self.subir(
            track=SimpleUploadedFile("virus.exe", b"MZ....", content_type="application/octet-stream")
        )
        self.assertEqual(extension.status_code, 400)

        falso = self.subir(
            track=SimpleUploadedFile("falso.mp3", b"esto no es audio", content_type="audio/mpeg")
        )
        self.assertEqual(falso.status_code, 400)

        imagen = self.subir(
            foto=SimpleUploadedFile("portada.gif", b"GIF89a", content_type="image/gif")
        )
        self.assertEqual(imagen.status_code, 400)

        self.assertFalse(Track.objects.filter(nombre_track="X").exists())
        preview.assert_not_called()

    @patch("app.api_shim.generar_preview_audio", side_effect=RuntimeError("ffmpeg caído"))
    def test_si_falla_el_preview_no_queda_un_track_a_medias(self, preview):
        self.client.force_login(self.prod_user)
        antes = Track.objects.count()
        response = self.subir()
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("ffmpeg", response.content.decode())
        self.assertEqual(Track.objects.count(), antes)

    # --- edicion ---
    def test_editar_track_ajeno_es_403(self):
        self.client.force_login(self.art_user)
        response = self.patch_json(f"/api/track/{self.t1.id_track}/", {"precio": 1})
        self.assertEqual(response.status_code, 403)

    def test_editar_valida_los_datos(self):
        self.client.force_login(self.prod_user)
        url = f"/api/track/{self.t1.id_track}/"
        for invalido in ({"precio": -5}, {"precio": "10"}, {"precio": True}, {"precio": 1.5},
                         {"nombre_track": "  "}, {"nombre_track": "x" * 201}):
            with self.subTest(invalido=invalido):
                self.assertEqual(self.patch_json(url, invalido).status_code, 400)
        self.t1.refresh_from_db()
        self.assertEqual(self.t1.precio, 10000)

    def test_editar_actualiza_nombre_precio_y_descripcion(self):
        self.client.force_login(self.prod_user)
        response = self.patch_json(
            f"/api/track/{self.t1.id_track}/",
            {"nombre_track": "Trap Rojo", "precio": 12000, "descripcion": "Nueva"},
        )
        self.assertEqual(response.status_code, 200)
        self.t1.refresh_from_db()
        self.assertEqual((self.t1.nombre_track, self.t1.precio, self.t1.descripcion),
                         ("Trap Rojo", 12000, "Nueva"))

    # --- eliminacion ---
    def test_eliminar_exige_ser_el_dueno(self):
        self.client.force_login(self.art_user)
        self.assertEqual(self.post_json(f"/api/track/{self.t1.id_track}/delete/").status_code, 403)
        self.assertTrue(Track.objects.filter(pk=self.t1.pk).exists())

    def test_no_se_elimina_un_track_con_ventas_ni_con_compras(self):
        self.client.force_login(self.prod_user)
        HistorialVenta.objects.create(comprador=self.art_user, precio=10000, track=self.t1)
        HistorialCompra.objects.create(usuario=self.art, track=self.t2)

        self.assertEqual(self.post_json(f"/api/track/{self.t1.id_track}/delete/").status_code, 409)
        self.assertEqual(self.post_json(f"/api/track/{self.t2.id_track}/delete/").status_code, 409)
        self.assertEqual(Track.objects.count(), 2)

    def test_eliminar_track_propio_sin_compras(self):
        self.client.force_login(self.prod_user)
        self.assertEqual(self.post_json(f"/api/track/{self.t2.id_track}/delete/").status_code, 200)
        self.assertFalse(Track.objects.filter(pk=self.t2.pk).exists())

    def test_eliminar_por_get_no_esta_permitido(self):
        self.client.force_login(self.prod_user)
        self.assertEqual(self.client.get(f"/api/track/{self.t2.id_track}/delete/").status_code, 405)

    # --- historiales ---
    def test_mis_ventas_incluye_al_comprador_como_objeto(self):
        HistorialVenta.objects.create(comprador=self.art_user, precio=10000, track=self.t1)
        self.client.force_login(self.prod_user)
        ventas = self.client.get("/api/mis-ventas/").json()
        self.assertEqual(len(ventas), 1)
        self.assertEqual(ventas[0]["comprador"], {"id": self.art_user.id, "username": "artista1"})
        self.assertEqual(ventas[0]["track"]["id_track"], self.t1.id_track)

    def test_mis_ventas_con_comprador_eliminado(self):
        HistorialVenta.objects.create(comprador=None, precio=10000, track=self.t1)
        self.client.force_login(self.prod_user)
        self.assertIsNone(self.client.get("/api/mis-ventas/").json()[0]["comprador"])

    def test_mis_compras_marca_los_tracks_como_comprados(self):
        HistorialCompra.objects.create(usuario=self.art, track=self.t1)
        self.client.force_login(self.art_user)
        compras = self.client.get("/api/mis-compras/").json()
        self.assertEqual(len(compras), 1)
        self.assertTrue(compras[0]["track"]["is_purchased"])


# --------------------------------------------------------------------------
# Comunidad: likes, comentarios, perfiles, usuarios, suscripciones
# --------------------------------------------------------------------------
class ComunidadTests(ApiBase):
    def test_like_alterna_y_cuenta(self):
        url = f"/api/like/{self.t1.id_track}/"
        self.assertEqual(self.client.post(url).status_code, 401)

        self.client.force_login(self.art_user)
        primero = self.client.post(url).json()
        self.assertEqual((primero["liked"], primero["likes_count"]), (True, 1))
        self.assertEqual(self.client.get("/api/session/").json()["liked_track_ids"], [self.t1.id_track])

        segundo = self.client.post(url).json()
        self.assertEqual((segundo["liked"], segundo["likes_count"]), (False, 0))

    def test_comentarios(self):
        url = f"/api/track/{self.t1.id_track}/comentarios/"
        self.assertEqual(self.client.get(url).json(), [])
        self.assertEqual(self.post_json(url, {"contenido": "Hola"}).status_code, 401)

        self.client.force_login(self.art_user)
        self.assertEqual(self.post_json(url, {"contenido": "   "}).status_code, 400)
        creado = self.post_json(url, {"contenido": "Muy bueno"})
        self.assertEqual(creado.status_code, 201)
        self.assertEqual(creado.json()["usuario"]["username"], "artista1")
        self.assertEqual(len(self.client.get(url).json()), 1)
        self.assertEqual(self.client.get("/api/track/999999/comentarios/").status_code, 404)

    def test_perfil_publico(self):
        data = self.client.get("/api/perfil/productor1/").json()
        self.assertEqual(data["username"], "productor1")
        self.assertEqual(len(data["tracks"]), 2)
        self.assertEqual(self.client.get("/api/perfil/no_existe/").status_code, 404)

    def test_perfil_publico_oculta_cuentas_sin_perfil_o_inactivas(self):
        User.objects.create_superuser("admin1", "admin1@example.com", PASSWORD)
        self.crear_usuario("pendiente1", Usuario.ARTISTA, activo=False)
        self.assertEqual(self.client.get("/api/perfil/admin1/").status_code, 404)
        self.assertEqual(self.client.get("/api/perfil/pendiente1/").status_code, 404)

    def test_directorio_de_usuarios(self):
        todos = self.client.get("/api/usuarios/").json()
        self.assertEqual([u["username"] for u in todos], ["artista1", "productor1"])

        productores = self.client.get("/api/usuarios/?tipo=productores").json()
        self.assertEqual([u["username"] for u in productores], ["productor1"])

        busqueda = self.client.get("/api/usuarios/?q=arti").json()
        self.assertEqual([u["username"] for u in busqueda], ["artista1"])

    def test_suscripciones_de_un_productor(self):
        suscripcion = Suscripcion.objects.create(detalle="VIP", precio=5000, user=self.prod)
        url = f"/api/suscripciones/?user={self.prod_user.id}"

        data = self.client.get(url).json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["user"]["username"], "productor1")
        self.assertFalse(data[0]["is_subscribed"])

        WebpayTransaction.objects.create(
            user=self.art_user,
            buy_order="888",
            session_id="artista1",
            amount=5000,
            suscripcion=suscripcion,
            status=WebpayTransaction.ESTADO_AUTORIZADO,
        )
        self.client.force_login(self.art_user)
        self.assertTrue(self.client.get(url).json()[0]["is_subscribed"])

        self.assertEqual(self.client.get("/api/suscripciones/?user=abc").status_code, 400)
        self.assertEqual(self.client.get(f"/api/suscripciones/?user={self.art_user.id}").json(), [])
