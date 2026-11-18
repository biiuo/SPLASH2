"""
Splash - graba clips de video SOLO cuando hay nadadores, sin parar el stream

El pipeline corre todo el día mientras la gente entra y sale de la piscina. Guardar todo ese video no sirve (y llena el
disco): este grabador abre un clip cuando aparece un nadador en un carril y lo cierra unos segundos después de que
deja de haber alguien. Cada clip empieza unos segundos ANTES de la primera detección (el nadador ya venía) y termina
unos segundos DESPUÉS de la última.

  * Corre en su propio hilo: la cámara y el modelo nunca esperan al disco. Si el disco no alcanza, se descartan frames
    del clip (se avisa), no se frena la inferencia.
  * El clip lleva lo mismo que ve la ventana de depuración: cajas con el id de cada nadador, las zonas y la hora de
    captura del frame, para poder cruzarlo con el CSV de posiciones enviadas.
  * Se guarda lo que el modelo procesó, a los fps a los que procesó: el video se ve a velocidad real.
  * Un tope de disco (`max_gb`) borra los clips más viejos.

Solo usa OpenCV y la biblioteca estándar.
"""
import collections
import datetime as dt
import queue
import statistics
import threading
import time
from pathlib import Path

import cv2


def hora_de(t_cap):
    """'HH:MM:SS.mmm' de un instante de captura (hora real de la cámara). Si es tiempo de video (un archivo), 'T+12.3 s'."""
    if t_cap > 1e9:
        return dt.datetime.fromtimestamp(t_cap).strftime("%H:%M:%S.%f")[:-3]
    return f"T+{t_cap:.1f} s"


class GrabadorActividad(threading.Thread):
    def __init__(self, carpeta, dibujar, pre_s=3.0, post_s=10.0, max_clip_s=600.0, max_gb=5.0, max_pre_frames=60,
                 cola_max=120, log=print):
        """dibujar(frame, estables, texto, zonas) -> imagen anotada (la misma que usa la ventana de depuración)."""
        super().__init__(daemon=True, name="grabador")
        self.carpeta = Path(carpeta)
        self.carpeta.mkdir(parents=True, exist_ok=True)
        self.dibujar = dibujar
        self.pre_s, self.post_s, self.max_clip_s, self.max_gb, self.log = pre_s, post_s, max_clip_s, max_gb, log
        self._cola = queue.Queue(maxsize=cola_max)
        self._previo = collections.deque(maxlen=max_pre_frames)     # (t_cap, frame, estables, zonas): lo de ANTES de empezar
        self._parar = threading.Event()
        self._writer = None
        self._ruta = None
        self._tam = None
        self._t_clip = 0.0          # t_cap del primer frame del clip
        self._t_actividad = 0.0     # t_cap de la última vez que hubo un nadador
        self._visto = 0.0           # hora real de la última vez que llegó un frame (para cerrar si el stream se calla)
        self._n = 0
        self.clips = 0
        self.descartados = 0
        self.frames_escritos = 0

    # ---- lo que usa el pipeline (nunca bloquea) ----
    def ofrecer(self, t_cap, frame, estables, zonas=None):
        """Un frame procesado. `estables`: las cajas de los nadadores en carriles (vacío = nadie)."""
        try:
            self._cola.put_nowait((t_cap, frame, estables, zonas))
        except queue.Full:
            self.descartados += 1

    def cerrar(self):
        self._parar.set()
        self.join(timeout=10)
        self._cerrar_clip()

    @property
    def grabando(self):
        return self._writer is not None

    # ---- el hilo ----
    def run(self):
        while not self._parar.is_set():
            try:
                item = self._cola.get(timeout=0.5)
            except queue.Empty:
                # el stream se calló (se acabó la sesión): si hay un clip abierto y pasó el tiempo, se cierra
                if self._writer is not None and time.time() - self._visto > self.post_s:
                    self._cerrar_clip()
                continue
            try:
                self._procesar(*item)
            except Exception as e:  # noqa: BLE001 - un error de disco no debe tumbar el pipeline
                self.log(f"[grabador] error: {e}")
                self._cerrar_clip()

    def _procesar(self, t_cap, frame, estables, zonas):
        self._visto = time.time()
        hay = len(estables) > 0
        if self._writer is None:
            self._previo.append((t_cap, frame, estables, zonas))
            while self._previo and t_cap - self._previo[0][0] > self.pre_s:
                self._previo.popleft()
            if hay:
                self._abrir_clip(frame.shape[1], frame.shape[0])
                for item in list(self._previo):      # incluye el frame actual
                    self._escribir(*item)
                self._previo.clear()
                self._t_actividad = t_cap
            return
        if (frame.shape[1], frame.shape[0]) != self._tam:
            self._cerrar_clip()                        # cambió el tamaño del video: clip nuevo
            self._previo.append((t_cap, frame, estables, zonas))
            return
        if hay:
            self._t_actividad = t_cap
        self._escribir(t_cap, frame, estables, zonas)
        if t_cap - self._t_actividad > self.post_s or t_cap - self._t_clip > self.max_clip_s:
            self._cerrar_clip()

    def _fps(self):
        ts = [x[0] for x in self._previo]
        if len(ts) >= 3:
            d = statistics.median(b - a for a, b in zip(ts, ts[1:]) if b > a) if any(b > a for a, b in zip(ts, ts[1:])) else 0
            if d > 0:
                return max(1.0, min(30.0, 1.0 / d))
        return 10.0

    def _abrir_clip(self, w, h):
        base = self._previo[0][0] if self._previo else time.time()
        marca = (dt.datetime.fromtimestamp(base) if base > 1e9 else dt.datetime.now()).strftime("%Y%m%d_%H%M%S")
        self._ruta = self.carpeta / f"clip_{marca}.mp4"
        self._writer = cv2.VideoWriter(str(self._ruta), cv2.VideoWriter_fourcc(*"mp4v"), self._fps(), (w, h))
        if not self._writer.isOpened():
            self._writer = None
            raise RuntimeError(f"no pude abrir {self._ruta} para grabar")
        self._tam, self._n = (w, h), 0
        self._t_clip = self._previo[0][0] if self._previo else 0.0
        self.log(f"[grabador] empieza {self._ruta.name} ({self._fps():.1f} fps)")

    def _escribir(self, t_cap, frame, estables, zonas):
        texto = f"{hora_de(t_cap)} | nadadores: {len(estables)}"
        self._writer.write(self.dibujar(frame, estables, texto, zonas))
        self._n += 1
        self.frames_escritos += 1

    def _cerrar_clip(self):
        if self._writer is None:
            return
        self._writer.release()
        self._writer = None
        self.clips += 1
        self.log(f"[grabador] clip guardado: {self._ruta.name} ({self._n} frames)")
        self._limitar_disco()

    def _limitar_disco(self):
        clips = sorted(self.carpeta.glob("clip_*.mp4"), key=lambda p: p.stat().st_mtime)
        total = sum(p.stat().st_size for p in clips)
        while clips and total > self.max_gb * 1024 ** 3:
            viejo = clips.pop(0)
            total -= viejo.stat().st_size
            viejo.unlink(missing_ok=True)
            self.log(f"[grabador] disco lleno ({self.max_gb} GB): borré {viejo.name}")
