"""
Splash - publica el último frame de la cámara en el backend

Para qué sirve: la web (Calibración y Zonas de análisis) necesita una imagen de la piscina sobre la que marcar los
puntos y dibujar las zonas. En vez de subir una foto a mano, el servidor de IA deja en el backend el último frame
que está leyendo de la cámara (POST /api/calibracion/frame-actual) y la web lo trae con un botón.

  * Es el MISMO frame y la MISMA resolución que ve el pipeline, así que los píxeles que se marquen en la web
    coinciden con los que luego manda el servidor de IA.
  * Corre en su propio hilo y nunca frena a la captura ni a la inferencia: si el backend no responde, se
    salta ese frame y reintenta en el siguiente.
  * Manda uno cada `cada_s` segundos (por defecto 3). El backend guarda solo el último.

Solo usa la biblioteca estándar (más cv2, que el pipeline ya usa).
"""
import base64
import json
import threading
import urllib.error
import urllib.request

import cv2


class PublicadorFrame(threading.Thread):
    def __init__(self, url_base, obtener_frame, token=None, cada_s=3.0, calidad_jpeg=85, timeout_s=5.0, log=print):
        """obtener_frame(): devuelve el último frame (array de numpy, BGR) o None si todavía no hay ninguno.
        token: el IA_TOKEN con el que el backend reconoce al servidor de IA (sin él, el backend responde 401)."""
        super().__init__(daemon=True, name="publicador-frame")
        self.url = url_base.rstrip("/") + "/api/calibracion/frame-actual"
        self.obtener_frame = obtener_frame
        self.token = token
        self.cada_s, self.calidad, self.timeout_s, self.log = cada_s, calidad_jpeg, timeout_s, log
        self._parar = threading.Event()
        self._ultimo_error = None
        self.enviados = 0
        self.errores = 0

    def cerrar(self):
        self._parar.set()

    def run(self):
        while not self._parar.is_set():
            self._enviar_uno()
            self._parar.wait(self.cada_s)

    def _enviar_uno(self):
        frame = self.obtener_frame()
        if frame is None:
            return
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, self.calidad])
        if not ok:
            return
        cuerpo = json.dumps({"imagen": "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")}).encode()
        cabeceras = {"Content-Type": "application/json"}
        if self.token:
            cabeceras["Authorization"] = f"Bearer {self.token}"
        pedido = urllib.request.Request(self.url, data=cuerpo, headers=cabeceras, method="POST")
        try:
            with urllib.request.urlopen(pedido, timeout=self.timeout_s) as r:
                r.read()
            self.enviados += 1
            if self._ultimo_error:
                self.log("Frame de la cámara: el backend volvió a responder.")
                self._ultimo_error = None
        except urllib.error.HTTPError as e:
            self._registrar_error(f"el backend respondió {e.code}" + (" (revisá IA_TOKEN)" if e.code in (401, 403) else ""))
        except Exception as e:  # noqa: BLE001 - sin red, backend caído...
            self._registrar_error(f"no pude mandar el frame: {e}")

    def _registrar_error(self, texto):
        self.errores += 1
        if texto != self._ultimo_error:   # no llenar la consola con el mismo error cada 3 s
            self.log(f"AVISO frame de la cámara: {texto}")
            self._ultimo_error = texto
