"""
Splash - registro CSV de las posiciones que el pipeline manda al backend

Una fila por muestra encolada (lo que se manda, en píxeles, con su hora de captura). Sirve para depurar: cruzado con el
CSV de la sesión (que baja la web) se ve qué mandó la IA y qué calculó el backend con eso. Solo biblioteca estándar.
"""
import datetime as dt
import threading

COLUMNAS = ("hora", "t_ms", "carril", "identidad", "px_x", "px_y", "estimada")


class RegistroCSV:
    def __init__(self, ruta, cada_s=1.0):
        self._f = open(ruta, "a", encoding="utf-8", newline="")
        if self._f.tell() == 0:
            self._f.write(",".join(COLUMNAS) + "\r\n")
        self._lock = threading.Lock()
        self._cada_s = cada_s
        self._sig = 0.0
        self.filas = 0

    def escribir(self, muestra):
        t = muestra["t"]
        hora = dt.datetime.fromtimestamp(t / 1000).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] if t > 1e12 else ""
        x, y = muestra["px"]
        fila = f"{hora},{t},{muestra['carril']},{muestra['identidad']},{x},{y},{int(bool(muestra.get('estimada')))}\r\n"
        with self._lock:
            self._f.write(fila)
            self.filas += 1
            if t / 1000 >= self._sig:          # vacía al disco cada tanto, no en cada fila
                self._f.flush()
                self._sig = t / 1000 + self._cada_s

    def cerrar(self):
        with self._lock:
            self._f.flush()
            self._f.close()
