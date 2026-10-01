"""Smoke test del api_shim contra los modelos REALES de Felipe (BD en memoria).

Cómo ejecutarlo:
  1. Clonar el repo de Felipe y copiar api_shim.py dentro de app/:
       git clone https://github.com/felipe-urtubia/BeatsCloud.git beatscloud
       cp api_shim.py beatscloud/app/
  2. Copiar este test + test_settings.py + test_urls.py (ver gist abajo) a beatscloud/
     — o usar `python manage.py shell` con settings normales y BD temporal sqlite.
  3. pip install django mutagen pillow stripe  (transbank-sdk se stubea via PYTHONPATH)
  4. PYTHONPATH=/ruta/al/stub_transbank python3 test_smoke.py
Resultado esperado: 36 checks PASS, exit 0. (Ejecutado y verificado 01-10-2026.)
"""
import os, sys, json
sys.path.insert(0, '/tmp/stub')  # transbank stub
os.environ['DJANGO_SETTINGS_MODULE'] = 'test_settings'
import django
django.setup()

from django.test.utils import setup_test_environment, get_runner
from django.test import Client
from django.conf import settings

setup_test_environment()
runner = get_runner(settings)()
old_config = runner.setup_databases()

from django.contrib.auth.models import User
from app.models import Usuario, Genero_Musical, Track, Venta, HistorialCompra, HistorialVenta

c = Client()
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' | ' + str(extra)[:200] if extra and not cond else ''))
    if not cond: fails.append(name)

# ---- seed ----
pop = Genero_Musical.objects.create(descripcion='Hip-Hop')
prod_user = User.objects.create_user('productor1', 'p@t.cl', 'pass1234', is_active=True)
perfil_prod = Usuario.objects.create(user=prod_user, tipo_usu=Usuario.PRODUCTOR)
art_user = User.objects.create_user('artista1', 'a@t.cl', 'pass1234', is_active=True)
perfil_art = Usuario.objects.create(user=art_user, tipo_usu=Usuario.ARTISTA)
t1 = Track.objects.create(nombre_track='Trap Oscuro', precio=10000, genero=pop, usuario=perfil_prod, descripcion='d')
t2 = Track.objects.create(nombre_track='Loop Gratis', precio=0, genero=pop, usuario=perfil_prod)

# ---- CSRF handshake ----
r = c.get('/api/csrf/')
check('csrf handshake', r.status_code == 200 and 'detail' in r.json(), r.content[:100])
token = r.json()['detail']
c.headers = {'X-CSRFToken': token, 'Referer': 'http://localhost:8000/api/'}

# ---- session anonima ----
r = c.get('/api/session/')
check('session anon = null', r.status_code == 200 and r.json() is None)

# ---- login ----
r = c.post('/api/auth/login/', json.dumps({'username':'artista1','password':'pass1234'}), content_type='application/json')
check('login ok', r.status_code == 200 and r.json()['username'] == 'artista1', r.content)
r = c.post('/api/auth/login/', json.dumps({'username':'artista1','password':'MALA'}), content_type='application/json')
check('login malo = 401', r.status_code == 401)

# ---- catalogo ----
r = c.get('/api/catalogo/')
j = r.json()
check('catalogo 2 tracks', r.status_code==200 and j['total_resultados']==2 and len(j['tracks'])==2, j)
check('catalogo snake_case fields', set(['id_track','nombre_track','precio','genero','usuario','preview','is_purchased']) <= set(j['tracks'][0].keys()))
r = c.get('/api/catalogo/?q=trap&orden=precio_mayor')
check('filtro q+orden', r.json()['total_resultados']==1)

# ---- carrito: IVA server-side + anti-duplicado ----
r = c.post(f'/api/carrito/agregar/{t1.id_track}/')
v = r.json()
check('cart add 201 + iva 19%', r.status_code==201 and v['precio']==10000 and v['iva']==1900 and v['precio_total']==11900, v)
r = c.post(f'/api/carrito/agregar/{t1.id_track}/')
check('cart duplicado = 409', r.status_code==409, r.content)
r = c.get('/api/carrito/')
j = r.json()
check('cart list subtotal/iva/total', j['subtotal']==10000 and j['iva']==1900 and j['total']==11900, j)

# ---- pago init (stub webpay) ----
r = c.post('/api/pago/')
j = r.json()
check('pago init url_webpay+amount', r.status_code==200 and j['amount']==11900 and 'url_webpay' in j, j)
from app.models import WebpayTransaction
wt = WebpayTransaction.objects.order_by('-id').first()
check('WebpayTransaction PENDING creada', wt.status=='PENDING' and wt.amount==11900, wt.__dict__)
r = c.post(f'/api/pago/cancelar/{wt.id}/')
wt.refresh_from_db()
check('cancel -> CANCELLED', r.status_code==200 and wt.status=='CANCELLED')

# ---- seguridad audio sin comprar ----
r = c.get(f'/api/track/{t1.id_track}/reproducir/')
check('full stream sin compra = 403', r.status_code==403)
r = c.get(f'/api/track/{t1.id_track}/descargar/')
check('download sin compra = 403', r.status_code==403)
r = c.get(f'/api/track/{t1.id_track}/preview/')
check('preview sin preview file = 404', r.status_code==404)

# ---- registrar compra "como lo haria exito_carrito" y revalidar acceso ----
HistorialCompra.objects.create(usuario=perfil_art, track=t1)
HistorialVenta.objects.create(comprador=art_user, precio=10000, track=t1)
r = c.get(f'/api/track/{t1.id_track}/')
check('is_purchased tras compra', r.json()['is_purchased'] is True)
r = c.get('/api/mis-compras/')
check('mis-compras 1 item', r.status_code==200 and len(r.json())==1)

# ---- recompra bloqueada ----
r = c.post(f'/api/carrito/agregar/{t1.id_track}/')
check('recompra = 409', r.status_code==409, r.content)

# ---- likes ----
r = c.post(f'/api/like/{t2.id_track}/')
check('like toggle true', r.json()=={'liked': True})
r = c.post(f'/api/like/{t2.id_track}/')
check('like toggle false', r.json()=={'liked': False})

# ---- comentarios ----
r = c.post(f'/api/track/{t1.id_track}/comentarios/', json.dumps({'contenido':'buena base'}), content_type='application/json')
check('comment create 201', r.status_code==201)
r = c.get(f'/api/track/{t1.id_track}/comentarios/')
check('comment list', len(r.json())==1 and r.json()[0]['contenido']=='buena base')

# ---- productor: logout, login prod, ventas ----
c.post('/api/auth/logout/')
c.cookies.clear()
r = c.post('/api/auth/login/', json.dumps({'username':'productor1','password':'pass1234'}), content_type='application/json')
check('login productor', r.status_code==200)
r = c.get('/api/mis-ventas/')
check('mis-ventas del productor ve la venta', len(r.json())==1 and r.json()[0]['precio']==10000.0, r.content)

# t1 tiene venta -> no borrable; t2 libre -> si
r = c.post(f'/api/track/{t1.id_track}/delete/')
check('delete con ventas = 409', r.status_code==409)
r = c.post(f'/api/track/{t2.id_track}/delete/')
check('delete propio ok', r.status_code==200)
r = c.patch(f'/api/track/{t1.id_track}/', json.dumps({'nombre_track':'Renombrado'}), content_type='application/json')
check('patch meta propio', r.status_code==200 and r.json()['nombre_track']=='Renombrado')

# artista intenta borrar ajeno
c.post('/api/auth/logout/'); c.cookies.clear()
c.post('/api/auth/login/', json.dumps({'username':'artista1','password':'pass1234'}), content_type='application/json')
r = c.post(f'/api/track/{t1.id_track}/delete/')
check('delete ajeno = 403', r.status_code==403)

# ---- perfil publico ----
r = c.get('/api/perfil/productor1/')
check('perfil publico con tracks', r.status_code==200 and 'tracks' in r.json())

# ---- registro via API (correo locmem) ----
from django.core import mail
data = {'username':'nuevo1','email':'NUEVO@t.cl','password1':'Sup3r!Secret9','password2':'Sup3r!Secret9','tipo_usu':'2','first_name':'N','last_name':'V'}
r = c.post('/api/auth/registro/', data)
check('registro 201 + correo enviado', r.status_code==201 and len(mail.outbox)==1, (r.status_code, r.content[:200], len(mail.outbox)))
nu = User.objects.filter(username='nuevo1').first()
check('usuario inactivo awaiting activacion', nu is not None and not nu.is_active)
r = c.post('/api/auth/login/', json.dumps({'username':'nuevo1','password':'Sup3r!Secret9'}), content_type='application/json')
check('login inactivo = 403', r.status_code==403, r.content)

print('\n===== RESULTADO:', 'TODO OK' if not fails else f'{len(fails)} FALLAS: {fails}')
sys.exit(1 if fails else 0)
