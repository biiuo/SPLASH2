"""
Splash - graba clips de video SOLO cuando hay nadadores, sin parar el stream

El pipeline corre todo el día mientras la gente entra y sale de la piscina. Guardar todo ese video no sirve (y llena el
disco): este grabador abre un clip cuando aparece un nadador en un carril y lo cierra unos segundos después de que
deja de haber alguien. Cada clip empieza unos segundos ANTES de la primera detección (el nadador ya venía) y termina
unos segundos DESPUÉS de la última.

  * Corre en su propio hilo: la cámara y el modelo nunca esperan al disco. Si el disco no alcanza, se descartan frames
    del clip (se avisa), no se frena la inferencia.
  * Por defecto el clip lleva el video LIMPIO, tal como llegó de la cámara (sin cajas ni texto): es lo que sirve para
    volver a correr el pipeline con el archivo y para el informe. La hora de captura de cada frame procesado queda en
    clip_*.tiempos.csv al lado, para cruzarlo con el CSV de posiciones enviadas.
    Con GRABAR_ANOTADO=1 el clip lleva lo mismo que ve la ventana de depuración (cajas, zonas, hora).
  * Códec: MJPG en .avi con calidad 95 (pesa más, pero se ve como la cámara y funciona en cualquier instalación de OpenCV,
    sin ffmpeg). H.264 solo si se pide con GRABAR_CODEC=h264: en Windows con pip OpenCV suele decir que lo abrió y no
    haber podido iniciar el encoder (falta openh264), y el clip queda vacío. También existe GRABAR_CODEC=mp4v.
  * El clip se escribe a un ritmo FIJO (`fps_salida`, 10 por defecto) ubicando cada frame procesado por su hora de
    captura: si el modelo va más rápido se saltan frames, si va más lento se repiten. Así el clip siempre se ve a
    velocidad real, aunque el ritmo de procesamiento cambie.
  * Un tope de disco (`max_gb`) borra los clips más viejos.

Con continuo=True (--video-continuo) no se espera a un nadador: se graba TODO lo que se procesa, de corrido, en un solo clip
(solo se corta al llegar a `max_clip_s`, o cuando el stream se calla porque terminó la sesión). Una sesión = un clip.

Solo usa OpenCV y la biblioteca estándar.
"""
import collections
import os
import datetime as dt
import queue
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
                 cola_max=120, fps_salida=10.0, continuo=False, log=print):
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
        self._tiempos = None
        self.anotado = os.environ.get("GRABAR_ANOTADO", "0") == "1"
        self._codec = None          # (fourcc, extensión), se decide la primera vez
        self._tam = None
        self._t_clip = 0.0          # t_cap del primer frame del clip
        self._t_actividad = 0.0     # t_cap de la última vez que hubo un nadador
        self._visto = 0.0           # hora real de la última vez que llegó un frame (para cerrar si el stream se calla)
        self._n = 0
        self.fps_salida = fps_salida
        self.continuo = continuo     # un solo clip con TODO lo que se procesa (una sesión = un clip), haya o no nadadores
        self._t_sig = 0.0          # t_cap que le toca al próximo frame del clip
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
        hay = self.continuo or len(estables) > 0
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

    def _abrir_clip(self, w, h):
        base = self._previo[0][0] if self._previo else time.time()
        marca = (dt.datetime.fromtimestamp(base) if base > 1e9 else dt.datetime.now()).strftime("%Y%m%d_%H%M%S")
        self._writer, self._ruta = self._abrir_writer(marca, self.fps_salida, (w, h))
        if self._writer is None:
            raise RuntimeError("no pude abrir ningún códec de video para grabar (probé H.264, MJPG y mp4v)")
        self._tiempos = open(self._ruta.with_suffix(".tiempos.csv"), "w", encoding="utf-8")
        self._tiempos.write("frame,hora,t_cap\n")
        self._tam, self._n = (w, h), 0
        self._t_clip = self._previo[0][0] if self._previo else 0.0
        self._t_sig = self._t_clip
        self.log(f"[grabador] empieza {self._ruta.name} ({self.fps_salida:g} fps)")

    def _abrir_writer(self, marca, fps, tam):
        """Abre el primer códec que funcione; el que funcionó se recuerda para los clips siguientes."""
        pedido = os.environ.get("GRABAR_CODEC", "").lower()
        todos = {"h264": [("avc1", ".mp4"), ("H264", ".mp4")], "mjpg": [("MJPG", ".avi")], "mp4v": [("mp4v", ".mp4")]}
        orden = [self._codec] if self._codec else (todos[pedido] if pedido in todos else todos["mjpg"] + todos["mp4v"])
        for fourcc, ext in orden:
            ruta = self.carpeta / f"clip_{marca}{ext}"
            w = cv2.VideoWriter(str(ruta), cv2.VideoWriter_fourcc(*fourcc), fps, tam)
            if w.isOpened():
                if fourcc == "MJPG":
                    w.set(cv2.VIDEOWRITER_PROP_QUALITY, 95)
                if self._codec is None:
                    self.log(f"[grabador] códec: {fourcc} ({ext})")
                self._codec = (fourcc, ext)
                return w, ruta
            w.release()
            ruta.unlink(missing_ok=True)
        return None, None

    def _escribir(self, t_cap, frame, estables, zonas):
        """Ubica el frame por su hora de captura en el ritmo fijo del clip: se salta o se repite según haga falta."""
        if t_cap < self._t_sig - 1e-6:
            return                                     # el modelo va más rápido que fps_salida
        if t_cap - self._t_sig > 2.0:
            self._t_sig = t_cap                        # hueco largo (stream cortado): no rellenar con el frame repetido
        img = self.dibujar(frame, estables, f"{hora_de(t_cap)} | nadadores: {len(estables)}", zonas) if self.anotado else frame
        self._tiempos.write(f"{self._n},{hora_de(t_cap)},{t_cap:.3f}\n")
        while self._t_sig <= t_cap + 1e-6:             # el modelo va más lento: se repite para mantener la velocidad real
            self._writer.write(img)
            self._t_sig += 1.0 / self.fps_salida
            self._n += 1
            self.frames_escritos += 1

    def _cerrar_clip(self):
        if self._writer is None:
            return
        self._writer.release()
        self._writer = None
        if self._tiempos is not None:
            self._tiempos.close()
            self._tiempos = None
        self.clips += 1
        self.log(f"[grabador] clip guardado: {self._ruta.name} ({self._n} frames)")
        self._limitar_disco()

    def _limitar_disco(self):
        clips = sorted((p for p in self.carpeta.glob("clip_*") if p.suffix in (".mp4", ".avi")), key=lambda p: p.stat().st_mtime)
        total = sum(p.stat().st_size for p in clips)
        while clips and total > self.max_gb * 1024 ** 3:
            viejo = clips.pop(0)
            total -= viejo.stat().st_size
            viejo.unlink(missing_ok=True)
            viejo.with_suffix(".tiempos.csv").unlink(missing_ok=True)
            self.log(f"[grabador] disco lleno ({self.max_gb} GB): borré {viejo.name}")