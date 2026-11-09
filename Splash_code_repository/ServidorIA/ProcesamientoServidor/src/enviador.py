"""
Splash - envío de las posiciones al backend

El servidor de IA NO calcula metros, cruces ni velocidades: manda las posiciones en PÍXELES, con la hora de captura
del frame, y el backend hace el resto (homografía, motor de eventos, base de datos). Así el celular y el servidor
entregan exactamente lo mismo.

  * Puede haber VARIAS sesiones a la vez, cada una en sus carriles (la de un entrenador con su grupo, la sesión libre de
    un nadador...). El servidor mira todos los carriles y manda todo junto a POST /api/sesiones/trayectorias: el
    backend pone cada posición en la sesión dueña de su carril y descarta las de carriles libres.
  * Las sesiones con modo "celular" las procesa un teléfono: no cuentan aquí (y el backend descarta sus carriles).
  * Mientras no hay ninguna sesión que procese el servidor, `en_sesion` es False y el pipeline no corre el modelo.
  * Se entera de las sesiones por los AVISOS EN VIVO del backend (SSE, GET /api/sesiones/eventos): el backend avisa al
    instante cuando una empieza o termina. Al (re)conectarse, el primer aviso trae todas las que están en curso, así no
    se pierde nada. Si no puede usar los avisos, pregunta cada `busca_sesion_cada_s` segundos (GET /api/sesiones/activas).
  * Cuando empieza a medir (o cambia la calibración en uso) avisa con al_unirse(sesion), para que el pipeline use las
    zonas de esa calibración. Todas las sesiones usan la calibración activa (hay una sola cámara).
  * Con --sesion (sesion_id) se manda solo a esa sesión, como antes.
  * Manda en lotes, sin frenar nunca al pipeline: encolar() no espera a la red.
  * Si el backend no responde, guarda los lotes (hasta `max_pendientes` muestras; si se pasa, descarta las más viejas)
    y reintenta con espera creciente. Reenviar es seguro: el backend reconoce lo repetido.

Solo usa la biblioteca estándar.
"""
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque


class EnviadorBackend(threading.Thread):
    def __init__(self, url_base, sesion_id=None, lote_max=200, cada_s=1.0, max_pendientes=20000,
                 timeout_s=5.0, busca_sesion_cada_s=2.0, log=print, al_unirse=None, token=None):
        """al_unirse(sesion): se llama (desde este hilo) al empezar a medir y cada vez que cambia la calibración de las
        sesiones en curso, con una sesión del backend ({'id', 'modo', 'calibracion_id', 'carriles', ...}). Sirve para
        cargar las zonas de esa calibración.
        token: el IA_TOKEN con el que el backend reconoce al servidor de IA (sin él, el backend responde 401)."""
        super().__init__(daemon=True, name="enviador")
        self.url = url_base.rstrip("/")
        self.token = token
        self.sesion_fija = sesion_id
        self.al_unirse = al_unirse
        self.lote_max, self.cada_s, self.timeout_s = lote_max, cada_s, timeout_s
        self.busca_sesion_cada_s = busca_sesion_cada_s
        self.log = log
        self._cola = deque(maxlen=max_pendientes)
        self._lock = threading.Lock()
        self._parar = threading.Event()
        self._espera_error = 0.0
        self._sesiones = {}                     # id -> sesión en curso que procesa el servidor (modo "servidor")
        self._calibracion_en_uso = None         # la de las zonas que está usando el pipeline
        self._fija_viva = sesion_id is not None
        self.enviadas = 0
        self.lotes = 0
        self.descartadas_sin_sesion = 0
        self.descartadas_por_desborde = 0
        self.errores = 0
        self.eventos = 0
        self.tramos = 0
        self._avisos_ok = threading.Event()     # hay una conexión de avisos (SSE) abierta y viva
        self._sin_avisos = False                # el backend no tiene avisos: solo se pregunta
        self._oyente = None

    @property
    def en_sesion(self):
        """True si hay al menos una sesión a la que enviar. Si no, el pipeline no necesita procesar."""
        if self.sesion_fija:
            return self._fija_viva
        with self._lock:
            return bool(self._sesiones)

    @property
    def sesiones(self):
        """Las sesiones en curso que procesa el servidor (copia)."""
        with self._lock:
            return list(self._sesiones.values())

    # ---- lo que usa el pipeline ----
    def encolar(self, muestra):
        """Nunca bloquea. `muestra`: {'carril', 'identidad', 't' (ms), 'px', 'estimada'}."""
        if not self.en_sesion:
            self.descartadas_sin_sesion += 1
            return
        with self._lock:
            if len(self._cola) == self._cola.maxlen:
                self.descartadas_por_desborde += 1
            self._cola.append(muestra)

    def cerrar(self, espera_s=5.0):
        """Para el hilo e intenta enviar lo que quedó."""
        # Primero se para el hilo (termina el envío que tenga en curso): si los dos enviaran a la vez, mandarían el
        # mismo lote dos veces y lo sacarían dos veces de la cola.
        self._parar.set()
        if self.is_alive():
            self.join(timeout=self.timeout_s + 1)
        limite = time.time() + espera_s
        while self.pendientes and self.en_sesion and time.time() < limite:
            if not self._enviar_un_lote():
                time.sleep(0.2)

    @property
    def pendientes(self):
        with self._lock:
            return len(self._cola)

    def pedir_zonas(self, calibracion_id):
        """Las zonas de una calibración ({'image_size', 'zones'} como zones.json), o None si no tiene. Puede lanzar."""
        return self._pedir("GET", f"/api/calibracion/{urllib.parse.quote(str(calibracion_id))}/zonas")

    # ---- hilo ----
    def run(self):
        if self.sesion_fija:
            self._preparar_sesion_fija()
        else:
            self._oyente = threading.Thread(target=self._escuchar_avisos, daemon=True, name="avisos")
            self._oyente.start()
        proxima_busqueda = 0.0
        while not self._parar.is_set():
            ahora = time.time()
            # sin avisos en vivo, se pregunta cada tanto qué sesiones hay (también sirve para notar las que terminaron)
            if not self.sesion_fija and not self._avisos_ok.is_set() and ahora >= proxima_busqueda:
                self._buscar_sesiones()
                proxima_busqueda = ahora + self.busca_sesion_cada_s
            if not self.en_sesion:
                self._parar.wait(0.2)
                continue
            if self._espera_error > 0:
                self._parar.wait(self._espera_error)
            if not self.pendientes:
                self._parar.wait(self.cada_s if self._avisos_ok.is_set() else 0.2)
                continue
            self._enviar_un_lote()
            self._parar.wait(0.05)

    # ---- sesiones en curso ----
    def _buscar_sesiones(self):
        try:
            activas = self._pedir("GET", "/api/sesiones/activas")
        except urllib.error.HTTPError as e:
            if e.code == 404:   # backend viejo: una sola sesión
                try:
                    activa = self._pedir("GET", "/api/sesiones/activa")
                    self._poner_sesiones([activa] if activa else [])
                except Exception as e2:  # noqa: BLE001
                    self._registrar_error(f"no pude consultar las sesiones: {e2}")
                return
            self._registrar_error(f"no pude consultar las sesiones ({e.code})")
            return
        except Exception as e:  # noqa: BLE001 - sin red / backend caído: se reintenta
            self._registrar_error(f"no pude consultar las sesiones: {e}")
            return
        self._espera_error = 0.0
        self._poner_sesiones(activas or [])

    def _poner_sesiones(self, lista):
        """Reemplaza el conjunto de sesiones en curso (solo cuentan las que procesa el servidor)."""
        nuevas = {s["id"]: s for s in lista if s and s.get("id") and s.get("modo") != "celular"}
        with self._lock:
            antes = set(self._sesiones)
            self._sesiones = nuevas
            if not nuevas:
                self._cola.clear()
        for sid in set(nuevas) - antes:
            s = nuevas[sid]
            self.log(f"[enviador] sesión {sid} en curso (carriles {self._carriles_de(s)})")
        for sid in antes - set(nuevas):
            self.log(f"[enviador] la sesión {sid} terminó")
        if not nuevas and antes:
            self.log("[enviador] no hay sesiones en curso: el modelo queda en pausa")
        self._revisar_calibracion()

    def _agregar_sesion(self, sesion):
        if sesion.get("modo") == "celular":
            self.log(f"[enviador] la sesión {sesion.get('id')} la procesa un celular: el servidor no la mide")
            return
        with self._lock:
            nueva = sesion["id"] not in self._sesiones
            self._sesiones[sesion["id"]] = sesion
        if nueva:
            self.log(f"[enviador] sesión {sesion['id']} en curso (carriles {self._carriles_de(sesion)})")
        self._revisar_calibracion()

    def _quitar_sesion(self, sesion_id):
        with self._lock:
            if self._sesiones.pop(sesion_id, None) is None:
                return
            vacio = not self._sesiones
            if vacio:
                self._cola.clear()
        self.log(f"[enviador] la sesión {sesion_id} terminó" + ("; el modelo queda en pausa" if vacio else ""))

    def _revisar_calibracion(self):
        """Si la calibración de las sesiones en curso cambió, se le avisa al pipeline para que cargue sus zonas."""
        sesiones = self.sesiones
        if not sesiones:
            return
        sesion = sesiones[-1]
        cal = sesion.get("calibracion_id")
        if cal and cal != self._calibracion_en_uso:
            self._calibracion_en_uso = cal
            self._avisar(sesion)

    @staticmethod
    def _carriles_de(sesion):
        return ", ".join(str(c.get("carril")) for c in sesion.get("carriles") or []) or "—"

    def _preparar_sesion_fija(self):
        """Con --sesion no se escuchan avisos, pero igual hace falta la calibración de esa sesión."""
        try:
            for s in self._pedir("GET", "/api/sesiones/activas") or []:
                if s.get("id") == self.sesion_fija:
                    self._avisar(s)
                    return
        except Exception as e:  # noqa: BLE001
            self.log(f"[enviador] no pude consultar la sesión {self.sesion_fija}: {e}")

    def _avisar(self, sesion):
        if not self.al_unirse:
            return
        try:
            self.al_unirse(sesion)
        except Exception as e:  # noqa: BLE001 - un error al preparar las zonas no debe frenar el envío
            self.log(f"[enviador] error al preparar la sesión {sesion.get('id')}: {e}")

    # ---- avisos en vivo (SSE) ----
    def _escuchar_avisos(self):
        espera = 1.0
        while not self._parar.is_set() and not self._sin_avisos:
            try:
                self._leer_avisos()
                espera = 1.0      # se cortó después de haber andado: reconectar enseguida
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    self._sin_avisos = True
                    self.log(f"[enviador] el backend no tiene avisos en vivo; pregunto cada {self.busca_sesion_cada_s:g} s")
                    break
                if e.code in (401, 403):
                    self.log(f"[enviador] el backend rechazó la conexión de avisos ({e.code}): revisá IA_TOKEN")
            except Exception as e:  # noqa: BLE001 - backend caído, red cortada, latido que no llegó
                if self._avisos_ok.is_set() or espera == 1.0:
                    self.log(f"[enviador] sin avisos en vivo ({e}); reintento")
            finally:
                self._avisos_ok.clear()
            self._parar.wait(espera)
            espera = min(espera * 2, 10.0)

    def _leer_avisos(self):
        cabeceras = {"Accept": "text/event-stream"}
        if self.token:
            cabeceras["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(self.url + "/api/sesiones/eventos", headers=cabeceras)
        # el backend manda un latido cada 20 s: si en 45 s no llega nada, la conexión está muerta
        with urllib.request.urlopen(req, timeout=45) as r:
            self._avisos_ok.set()
            self.log("[enviador] escuchando los avisos en vivo del backend")
            tipo, datos = "message", []
            while not self._parar.is_set():
                linea = r.readline()
                if not linea:
                    return      # el backend cerró la conexión
                linea = linea.decode("utf-8").rstrip("\r\n")
                if linea == "":
                    if datos:
                        self._al_aviso(tipo, "\n".join(datos))
                    tipo, datos = "message", []
                elif linea.startswith("event:"):
                    tipo = linea[6:].strip()
                elif linea.startswith("data:"):
                    datos.append(linea[5:].lstrip())

    def _al_aviso(self, tipo, texto):
        try:
            datos = json.loads(texto)
        except ValueError:
            return
        if not isinstance(datos, dict):
            return
        sesion = datos.get("sesion")
        if tipo == "estado":
            # el backend nuevo manda todas las sesiones en curso; uno viejo, solo una
            lista = datos.get("sesiones")
            self._poner_sesiones(lista if isinstance(lista, list) else ([sesion] if sesion else []))
        elif tipo == "sesion_iniciada" and sesion and sesion.get("id"):
            self._agregar_sesion(sesion)
        elif tipo == "sesion_finalizada" and sesion and sesion.get("id"):
            self._quitar_sesion(sesion["id"])

    # ---- envío ----
    def _ruta_envio(self):
        if self.sesion_fija:
            return f"/api/sesiones/{urllib.parse.quote(str(self.sesion_fija))}/trayectorias"
        return "/api/sesiones/trayectorias"     # el backend reparte cada posición a la sesión de su carril

    def _enviar_un_lote(self):
        with self._lock:
            lote = [self._cola[i] for i in range(min(self.lote_max, len(self._cola)))]
        if not lote:
            return True
        try:
            r = self._pedir("POST", self._ruta_envio(), {"muestras": lote})
        except urllib.error.HTTPError as e:
            return self._error_http(e, len(lote))
        except Exception as e:  # noqa: BLE001
            self._registrar_error(f"no pude enviar ({e}); {self.pendientes} muestras en espera")
            return False
        with self._lock:
            for _ in range(min(len(lote), len(self._cola))):
                self._cola.popleft()
        self.enviadas += len(lote)
        self.lotes += 1
        r = r or {}
        if "por_sesion" in r:
            self.eventos += sum(p.get("eventos", 0) for p in r["por_sesion"])
            self.tramos += sum(p.get("tramos", 0) for p in r["por_sesion"])
        else:
            self.eventos += len(r.get("eventos", []))
            self.tramos += len(r.get("tramos", []))
        self._espera_error = 0.0
        return True

    def _error_http(self, e, n):
        try:
            detalle = json.loads(e.read().decode("utf-8"))
        except Exception:  # noqa: BLE001
            detalle = {}
        if self.sesion_fija and (e.code == 404 or (e.code == 400 and "terminó" in str(detalle.get("error", "")))):
            self.log(f"[enviador] la sesión fija {self.sesion_fija} terminó o no existe: dejo de enviar")
            self._fija_viva = False
            with self._lock:
                self._cola.clear()
            return False
        if e.code in (401, 403):
            # reintentar no lo arregla: falta IA_TOKEN o no coincide con el del backend
            self._registrar_error(f"el backend rechazó al servidor de IA ({e.code}): revisá IA_TOKEN")
            return False
        if e.code == 400:
            # el lote está mal formado: reintentar no lo arregla; se descarta para no trabar el resto
            self.log(f"[enviador] el backend rechazó un lote ({detalle.get('errores') or detalle.get('error')}); lo descarto")
            with self._lock:
                for _ in range(min(n, len(self._cola))):
                    self._cola.popleft()
            self.errores += 1
            return False
        self._registrar_error(f"el backend respondió {e.code}")
        return False

    def _registrar_error(self, mensaje):
        self.errores += 1
        self._espera_error = min(max(self._espera_error * 2, 0.5), 10.0)
        if self.errores <= 3 or self.errores % 20 == 0:
            self.log(f"[enviador] {mensaje}")

    def _pedir(self, metodo, ruta, cuerpo=None):
        datos = None if cuerpo is None else json.dumps(cuerpo).encode("utf-8")
        cabeceras = {"Content-Type": "application/json"} if datos else {}
        if self.token:
            cabeceras["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(self.url + ruta, data=datos, method=metodo, headers=cabeceras)
        with urllib.request.urlopen(req, timeout=self.timeout_s) as r:
            return json.loads(r.read().decode("utf-8") or "null")
