"""
Splash - heartbeat del servidor de IA

Cada `cada_s` segundos le avisa al backend que está vivo y en qué estado (POST /api/latidos). Con eso el administrador
ve en "Monitoreo en tiempo real" si la cámara transmite, si se está procesando y a cuántos fps, y se entera cuando el
servidor de IA se cae (deja de latir).

`obtener_estado()` arma el estado en el momento (lo da el pipeline). Si el backend no responde, lo vuelve a intentar en
el próximo latido: un latido perdido no importa. Solo usa la biblioteca estándar.
"""
import json
import threading
import urllib.request


class PublicadorLatido(threading.Thread):
    def __init__(self, url_base, obtener_estado, token=None, componente="ia", cada_s=5.0, timeout_s=3.0, log=print):
        super().__init__(daemon=True, name="latido")
        self.url = url_base.rstrip("/") + "/api/latidos"
        self.obtener_estado = obtener_estado
        self.token = token
        self.componente = componente
        self.cada_s, self.timeout_s, self.log = cada_s, timeout_s, log
        self._parar = threading.Event()
        self._fallando = False

    def cerrar(self):
        self._parar.set()

    def run(self):
        while not self._parar.is_set():
            self._latir()
            self._parar.wait(self.cada_s)

    def _latir(self):
        try:
            estado = self.obtener_estado()
            cuerpo = json.dumps({"componente": self.componente, "estado": estado}).encode("utf-8")
            cabeceras = {"Content-Type": "application/json"}
            if self.token:
                cabeceras["Authorization"] = f"Bearer {self.token}"
            req = urllib.request.Request(self.url, data=cuerpo, method="POST", headers=cabeceras)
            with urllib.request.urlopen(req, timeout=self.timeout_s):
                pass
            if self._fallando:
                self.log("[latido] el backend volvió a responder")
            self._fallando = False
        except Exception as e:  # noqa: BLE001 - un latido perdido no debe frenar nada
            if not self._fallando:
                self.log(f"[latido] no pude avisar al backend ({e}); sigo intentando")
            self._fallando = True
