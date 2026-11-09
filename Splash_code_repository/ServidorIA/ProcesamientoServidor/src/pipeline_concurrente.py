"""
Splash - pipeline concurrente: la captura y el procesamiento no dependen uno del otro

    [hilo de captura] --último frame--> [hilo de inferencia] --> identidades estables --> métricas

  * La captura lee la cámara sin parar a la velocidad de la cámara y NUNCA espera al modelo.
  * La inferencia toma siempre el frame MÁS RECIENTE. Si el modelo es más lento que la cámara,
    los frames viejos se descartan (modo "vivo"): la latencia no crece y la cola no se llena.
  * Cada frame lleva el timestamp del instante en que se capturó (en un archivo, el tiempo
    del video). Los tiempos de cruce de nodo y las velocidades se calculan con ESE valor, así
    que descartar frames o tardar en procesar no altera la medida.
  * Después del tracker, GestorIdentidades (identidad.py) convierte los IDs de ByteTrack en
    una identidad estable por nadador.

Modos de la fuente:
  vivo     cámara/RTSP/webcam: descarta frames viejos (lo que se usa en producción).
  archivo  video grabado: procesa TODOS los frames (para analizar y medir offline).

Ejemplos:
    # sin torch ni modelo: detector y tracker simulados, para ver la concurrencia
    python pipeline_concurrente.py --simulado --source video.mp4 --segundos 10

    # real (necesita torch, boxmot y best.pt)
    python pipeline_concurrente.py --source rtsp://... --weights best.pt --swimmer-only --zones zones.json --mostrar
    python pipeline_concurrente.py --source video.mp4 --modo archivo --track-buffer-s 4 --fps-proceso 10 --conf 0.10
"""
import argparse
import queue
import os
import sys
import threading
import time
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from enviador import EnviadorBackend  # noqa: E402
from identidad import GestorIdentidades  # noqa: E402
from trayectoria import Trayectorias  # noqa: E402
from zonas_activas import ZonasActivas  # noqa: E402

PREFIJOS_CAMARA = ("rtsp://", "rtmp://", "http://", "https://")


class Captura(threading.Thread):
    """Lee la fuente sin parar y deja los frames en una cola de un solo lugar."""

    def __init__(self, fuente, descartar, tiempo_real, parar):
        super().__init__(daemon=True, name="captura")
        self.fuente = fuente
        self.descartar = descartar
        self.tiempo_real = tiempo_real
        self.parar = parar
        self.cola = queue.Queue(maxsize=1 if descartar else 8)
        self.terminado = threading.Event()
        self.capturados = 0
        self.descartados = 0
        self.fps_fuente = 25.0
        self.t_inicio = None

    def run(self):
        cap = cv2.VideoCapture(self.fuente)
        if not cap.isOpened():
            print(f"ERROR: no pude abrir {self.fuente}")
            self.terminado.set()
            return
        es_archivo = isinstance(self.fuente, str) and not self.fuente.lower().startswith(PREFIJOS_CAMARA)
        self.fps_fuente = cap.get(cv2.CAP_PROP_FPS) or 25.0
        self.t_inicio = time.time()
        idx = 0
        try:
            while not self.parar.is_set():
                ret, frame = cap.read()
                if not ret:
                    break
                # cámara: reloj real; archivo: tiempo del video (reproducible)
                t_cap = idx / self.fps_fuente if es_archivo else time.time()
                paquete = (idx, t_cap, frame)
                if self.descartar:
                    try:
                        self.cola.put_nowait(paquete)
                    except queue.Full:
                        try:
                            self.cola.get_nowait()
                            self.descartados += 1
                        except queue.Empty:
                            pass
                        self.cola.put_nowait(paquete)
                else:
                    while not self.parar.is_set():
                        try:
                            self.cola.put(paquete, timeout=0.2)
                            break
                        except queue.Full:
                            continue
                idx += 1
                self.capturados += 1
                if es_archivo and self.tiempo_real:   # un archivo imita a una cámara: a su ritmo
                    espera = self.t_inicio + idx / self.fps_fuente - time.time()
                    if espera > 0:
                        time.sleep(espera)
        finally:
            cap.release()
            self.terminado.set()


class Inferencia(threading.Thread):
    """Toma el frame más reciente, detecta, rastrea y asigna identidades estables.

    debe_procesar(): si se indica y devuelve False (no hay sesión), el modelo NO corre: con una cámara los frames se
    leen y se descartan (la conexión sigue viva y al empezar la sesión no hay que reconectar); con un archivo se
    espera sin avanzar el video. crear_tracker(): al volver a procesar se empieza con un tracker limpio, para que no
    se mezclen los nadadores de la sesión anterior."""

    def __init__(self, captura, detector, tracker, gestor, zonas_activas, parar, on_resultado=None,
                 debe_procesar=None, crear_tracker=None):
        super().__init__(daemon=True, name="inferencia")
        self.captura, self.detector, self.tracker = captura, detector, tracker
        self.gestor, self.zonas_activas, self.parar = gestor, zonas_activas, parar
        self.on_resultado = on_resultado
        self.debe_procesar, self.crear_tracker = debe_procesar, crear_tracker
        self.procesados = 0
        self.en_espera = 0          # frames descartados porque no había sesión
        self.esperando = False
        self.ids_bytetrack = set()
        self.ultimo = None          # (idx, t_captura, tracks_estables, frame)
        self.terminado = threading.Event()

    def _esperar_sesion(self):
        """Sin sesión: no corre el modelo. Devuelve True si hay que saltear este ciclo."""
        if self.debe_procesar is None or self.debe_procesar():
            if self.esperando:
                self.esperando = False
                print("[inferencia] hay sesión: empiezo a procesar")
                if self.crear_tracker:
                    self.tracker = self.crear_tracker()
            return False
        if not self.esperando:
            self.esperando = True
            print("[inferencia] sin sesión activa: el modelo queda en pausa hasta que se inicie una desde la web")
        if self.captura.descartar:          # cámara: leer y tirar, para no perder la conexión
            try:
                idx, t_cap, frame = self.captura.cola.get(timeout=0.2)
                self.en_espera += 1
                self.ultimo = (idx, t_cap, np.empty((0, 7)), frame)
            except queue.Empty:
                pass
        else:                               # archivo: el video no avanza hasta que haya sesión
            self.parar.wait(0.2)
        return True

    def run(self):
        try:
            while not self.parar.is_set():
                if self._esperar_sesion():
                    if self.captura.terminado.is_set() and self.captura.cola.empty():
                        break
                    continue
                try:
                    idx, t_cap, frame = self.captura.cola.get(timeout=0.2)
                except queue.Empty:
                    if self.captura.terminado.is_set():
                        break
                    continue
                # zonas nuevas (la sesión usa otra posición de cámara): se cambian entre dos frames, nunca a mitad de uno
                if self.zonas_activas and self.zonas_activas.aplicar_pendiente() and self.gestor:
                    self.gestor.cambiar_carriles(self.zonas_activas.carriles)
                det = self.detector(frame)
                zonas = self.zonas_activas.zonas if self.zonas_activas else None
                if zonas is not None:
                    det, _ = zonas.split(det)
                tracks = self.tracker.update(det, frame)
                if len(tracks):     # sin tracks, reshape(0, -1) falla
                    for t in np.asarray(tracks).reshape(len(tracks), -1):
                        self.ids_bytetrack.add(int(t[4]))
                estables = self.gestor.update(tracks, t_cap) if self.gestor else tracks
                self.procesados += 1
                self.ultimo = (idx, t_cap, estables, frame)
                if self.on_resultado:
                    self.on_resultado(idx, t_cap, estables)
        finally:
            self.terminado.set()


# ---------------- componentes simulados (para probar sin torch) ----------------
class DetectorSimulado:
    """3 nadadores, uno por carril, con una demora fija que imita a un modelo lento."""

    def __init__(self, demora_s):
        self.demora_s = demora_s

    def __call__(self, frame):
        time.sleep(self.demora_s)
        x = 100 + (time.time() * 60) % 700
        return np.array([[x - 40, y - 15, x + 40, y + 15, 0.8, 1] for y in (100, 200, 300)])


class TrackerSimulado:
    """Imita la fragmentación de ByteTrack: el nadador 1 cambia de ID cada 25 frames."""

    def __init__(self):
        self.n = 0

    def update(self, det, frame):
        self.n += 1
        filas = []
        for i, d in enumerate(det):
            tid = (i + 1) if i else 100 + self.n // 25
            filas.append([*d[:4], tid, d[4], d[5]])
        return np.array(filas)


CARRILES_SIMULADOS = {f"lane{4 + i}": [[0, y - 50], [900, y - 50], [900, y + 50], [0, y + 50]]
                      for i, y in enumerate((100, 200, 300))}


def construir_real(args, activas):
    """activas: ZonasActivas. El recorte se lee en cada frame, así cambia cuando cambian las zonas."""
    import realtime_local_test as rt                  # importa torch y boxmot recién acá
    from conteo import suprimir_contenidas
    from tracker_util import crear_bytetrack

    model = rt.cargar_modelo(args.weights, args.conf)

    def crear_tracker():
        return crear_bytetrack(args.track_thresh, args.match_thresh, args.track_buffer_s,
                               args.fps_proceso, args.min_conf, args.asso_func)[0]

    tracker, usados = crear_bytetrack(args.track_thresh, args.match_thresh, args.track_buffer_s,
                                      args.fps_proceso, args.min_conf, args.asso_func)
    print(f"ByteTrack: {usados}")

    def detector(frame):
        # con recorte el modelo solo ve los carriles; las cajas vuelven a coordenadas del frame completo
        recorte = activas.recorte
        vista = recorte.aplicar(frame) if recorte else frame
        det = rt.detectar(model, vista, args.img_size, args.letterbox)
        if recorte:
            det = recorte.volver(det)
        det = det[det[:, 5] == args.swimmer_class] if args.swimmer_only else det
        return suprimir_contenidas(det, args.contenidas)   # cabeza marcada como otro nadador

    return detector, tracker, crear_tracker


def dibujar(frame, estables, texto):
    vista = frame.copy()
    for x1, y1, x2, y2, sid, conf, _ in np.asarray(estables).reshape(-1, 7):
        cv2.rectangle(vista, (int(x1), int(y1)), (int(x2), int(y2)), (0, 140, 255), 2)
        cv2.putText(vista, f"nadador {int(sid)}  {conf:.2f}", (int(x1), int(y1) - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 140, 255), 2)
    cv2.putText(vista, texto, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    return vista


def main():
    ap = argparse.ArgumentParser(description="Captura e inferencia concurrentes con identidades estables")
    ap.add_argument("--source", required=True, help="RTSP, índice de webcam o archivo")
    ap.add_argument("--modo", choices=["vivo", "archivo"], default=None,
                    help="vivo: descarta frames viejos | archivo: procesa todos (por defecto según la fuente)")
    ap.add_argument("--simulado", action="store_true", help="detector y tracker de mentira (sin torch)")
    ap.add_argument("--demora-simulada", type=float, default=0.30, help="segundos por frame del detector simulado")
    ap.add_argument("--segundos", type=float, default=0, help="cortar después de N segundos (0 = hasta el final)")
    ap.add_argument("--mostrar", action="store_true", help="abrir ventana (q para salir)")
    ap.add_argument("--weights", default=os.environ.get("SPLASH_WEIGHTS") or str(Path(__file__).resolve().parents[1] / "modelo" / "best.pt"))
    ap.add_argument("--img-size", type=int, default=640)
    ap.add_argument("--conf", type=float, default=0.10, help="umbral bajo: el tracker usa las detecciones débiles")
    ap.add_argument("--track-thresh", type=float, default=0.30)
    ap.add_argument("--min-conf", type=float, default=0.10, help="umbral bajo de ByteTrack (track_low_thresh)")
    ap.add_argument("--track-buffer-s", type=float, default=4.0, help="segundos que ByteTrack espera a un perdido")
    ap.add_argument("--fps-proceso", type=float, default=10.0, help="FPS a los que se espera procesar (escala el buffer)")
    ap.add_argument("--match-thresh", type=float, default=0.9)
    ap.add_argument("--asso-func", default="diou", choices=["iou", "diou", "giou", "ciou", "centroid"],
                    help="cómo ByteTrack asocia cajas entre frames; diou corta menos los tracks (695 -> 175 IDs en la prueba)")
    ap.add_argument("--contenidas", type=float, default=0.8,
                    help="descartar una caja si más de esta fracción cae dentro de otra (0 = desactivado)")
    ap.add_argument("--letterbox", action="store_true")
    ap.add_argument("--swimmer-only", action="store_true")
    ap.add_argument("--swimmer-class", type=int, default=1)
    ap.add_argument("--zones", default=None, help="zones.json; los polígonos lane*/carril* definen los carriles "
                                                  "y el recorte que ve el modelo. Con --backend-url, al unirse a una "
                                                  "sesión se reemplazan por las de la calibración de la sesión")
    ap.add_argument("--sin-recorte", action="store_true", help="con --zones, pasar el frame completo al modelo")
    ap.add_argument("--margen-recorte", type=float, default=0.03, help="margen alrededor de los carriles (proporción)")
    ap.add_argument("--max-por-carril", type=int, default=1)
    ap.add_argument("--max-hueco", type=float, default=20.0, help="segundos que una identidad perdida sigue viva")
    ap.add_argument("--backend-url", default=os.environ.get("BACKEND_URL"),
                    help="si se indica, manda las posiciones a la sesión activa del backend (por ejemplo http://backend:3001)")
    ap.add_argument("--sesion", default=os.environ.get("SESION_ID") or None,
                    help="id de la sesión a la que enviar; por defecto se une a la que esté activa")
    ap.add_argument("--hz-envio", type=float, default=3.0, help="posiciones por segundo y por nadador que se envían")
    ap.add_argument("--extrapolar-max-s", type=float, default=1.5,
                    help="segundos que se extrapola la posición de un nadador perdido antes de mantener la última")
    args = ap.parse_args()

    fuente = int(args.source) if str(args.source).isdigit() else args.source
    es_archivo = isinstance(fuente, str) and not fuente.lower().startswith(PREFIJOS_CAMARA)
    modo = args.modo or ("archivo" if es_archivo and not args.simulado else "vivo")

    sonda = cv2.VideoCapture(fuente)
    ancho, alto = int(sonda.get(cv2.CAP_PROP_FRAME_WIDTH)), int(sonda.get(cv2.CAP_PROP_FRAME_HEIGHT))
    sonda.release()

    activas = None   # con el detector simulado los carriles son fijos y las zonas del backend no aplican
    if args.simulado:
        detector, tracker, crear_tracker = DetectorSimulado(args.demora_simulada), TrackerSimulado(), TrackerSimulado
        carriles = CARRILES_SIMULADOS
    else:
        activas = ZonasActivas(ancho, alto, margen_recorte=args.margen_recorte, sin_recorte=args.sin_recorte)
        if args.zones:
            activas.cargar_archivo(args.zones)
        detector, tracker, crear_tracker = construir_real(args, activas)
        carriles = activas.carriles

    gestor = GestorIdentidades(carriles=carriles, max_hueco_s=args.max_hueco, max_por_carril=args.max_por_carril)
    parar = threading.Event()

    def al_unirse(sesion):
        """Cada sesión usa las zonas de la posición de cámara (calibración) con la que empezó."""
        cal = sesion.get("calibracion_id")
        if activas is None or not cal:
            return
        archivo = enviador.pedir_zonas(cal)
        if archivo and archivo.get("zones"):
            activas.proponer(archivo, f"calibración {cal[:8]} de la sesión")
        else:
            print(f"AVISO: la calibración {cal[:8]} de la sesión no tiene zonas; sigo con las de {activas.origen}. "
                  "Dibujalas en la web (Zonas de análisis).")

    # envío al backend: posiciones en píxeles a un ritmo fijo; lo medido y lo estimado van marcados
    enviador, al_resultado = None, None
    if args.backend_url:
        if not carriles:
            print("AVISO: todavía no hay carriles (zonas lane*/carril*): no se envía nada hasta que la sesión traiga "
                  "las zonas de su calibración.")
        trayectorias = Trayectorias(args.hz_envio, args.extrapolar_max_s, args.max_hueco)
        enviador = EnviadorBackend(args.backend_url, args.sesion, al_unirse=al_unirse,
                                   token=os.environ.get("IA_TOKEN") or None)
        # cámara: t_cap ya es la hora real; archivo: t_cap es el tiempo del video y se suma a la hora de arranque
        base_ms = time.time() * 1000 if es_archivo else 0.0

        def al_resultado(idx, t_cap, estables):
            for m in trayectorias.procesar(estables, gestor, t_cap):
                muestra = {"carril": m["carril"], "identidad": m["identidad"], "px": m["px"],
                           "t": int(round(base_ms + m["t"] * 1000))}
                if m["estimada"]:
                    muestra["estimada"] = True
                enviador.encolar(muestra)

    captura = Captura(fuente, descartar=(modo == "vivo"), tiempo_real=(modo == "vivo" and es_archivo), parar=parar)
    # con backend y sin una sesión fija, el modelo solo corre mientras haya una sesión activa
    debe_procesar = (lambda: enviador.en_sesion) if enviador and not args.sesion else None
    inferencia = Inferencia(captura, detector, tracker, gestor, activas, parar, on_resultado=al_resultado,
                            debe_procesar=debe_procesar, crear_tracker=crear_tracker)

    print(f"Modo: {modo} | fuente: {fuente} | {ancho}x{alto}")
    t0 = time.time()
    if enviador:
        enviador.start()
    captura.start()
    inferencia.start()

    proximo = t0 + 2
    try:
        while not inferencia.terminado.is_set():
            time.sleep(0.05 if args.mostrar else 0.2)
            ahora = time.time()
            transcurrido = ahora - t0
            if args.segundos and transcurrido >= args.segundos:
                break
            if args.mostrar and inferencia.ultimo:
                _, t_cap, est, frame = inferencia.ultimo
                texto = ("esperando que se inicie una sesion en la web" if inferencia.esperando else
                         f"captura {captura.capturados / transcurrido:.1f} fps | "
                         f"proceso {inferencia.procesados / transcurrido:.1f} fps | "
                         f"identidades {len(gestor.estados)}")
                cv2.imshow("pipeline concurrente - q para salir", dibujar(frame, est, texto))
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
            if ahora >= proximo:
                print(f"[{transcurrido:5.1f}s] captura {captura.capturados / transcurrido:5.1f} fps | "
                      f"proceso {inferencia.procesados / transcurrido:5.1f} fps | "
                      f"descartados {captura.descartados} | identidades {len(gestor.estados)}"
                      + (" | en pausa: sin sesión" if inferencia.esperando else ""))
                proximo += 2
    except KeyboardInterrupt:
        pass
    finally:
        parar.set()
        captura.join(timeout=3)
        inferencia.join(timeout=3)
        if enviador:
            enviador.cerrar()
        cv2.destroyAllWindows()

    dur = max(time.time() - t0, 1e-6)
    print("\nResumen")
    print(f"  duración              {dur:.1f} s")
    print(f"  capturados            {captura.capturados}  ({captura.capturados / dur:.1f} fps; fuente {captura.fps_fuente:.1f} fps)")
    print(f"  procesados            {inferencia.procesados}  ({inferencia.procesados / dur:.1f} fps)")
    print(f"  descartados           {captura.descartados}")
    print(f"  sin sesión (en pausa) {inferencia.en_espera}")
    print(f"  IDs de ByteTrack      {len(inferencia.ids_bytetrack)}")
    print(f"  identidades estables  {len(gestor.estados)}")
    print(f"  re-enlaces / duplicados descartados: {gestor.reenlaces} / {gestor.duplicados}")
    if enviador:
        print(f"  enviadas al backend   {enviador.enviadas} en {enviador.lotes} lotes "
              f"(eventos {enviador.eventos}, tramos {enviador.tramos}); sin enviar: {enviador.pendientes}; "
              f"sin sesión: {enviador.descartadas_sin_sesion}; errores: {enviador.errores}")


if __name__ == "__main__":
    main()
