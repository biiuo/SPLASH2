"""
Prueba de detección (YOLOv5) + tracking (ByteTrack) en esta PC, sobre una cámara RTSP, una webcam o un video
grabado, mostrando el resultado en una ventana o guardándolo en un video. Sirve para revisar a ojo que la
detección y el tracking andan bien.

Dependencias:
    pip install opencv-python boxmot imageio-ffmpeg      (torch se instala aparte, desde pytorch.org)

Ejemplos:
    python realtime_local_test.py --source grabacion.mp4
    python realtime_local_test.py --source grabacion.mp4 --process-every 3                  # ~3x más rápido en CPU
    python realtime_local_test.py --source grabacion.mp4 --no-show --save-video salida.mp4  # sin ventana

--asso-func diou asocia mejor las cajas chicas y rápidas que iou (en la prueba bajó de 695 a 175 IDs).
--contenidas descarta las cajas casi enteras dentro de otra (la cabeza marcada como otro nadador).
El contador muestra los nadadores a la vez (conteo.py) y no los IDs únicos: un mismo nadador recibe un ID nuevo
en cada vuelta.
"""
import argparse
import os
import pathlib
import platform
import subprocess
import sys
import time
from datetime import datetime

import cv2
import numpy as np
import torch
from boxmot import ByteTrack, ByteTrackConfig

from conteo import ContadorSimultaneo, suprimir_contenidas

try:
    import imageio_ffmpeg
    FFMPEG_BINARY = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG_BINARY = "ffmpeg"
# Valores por defecto: todo se puede cambiar por línea de comandos.
# CONFIGURACIÓN POR DEFECTO -- todo se puede cambiar por línea de comandos
# ============================================================

# Fuente del video:
#   0                -> webcam local
#   'rtsp://...'     -> stream RTSP de la cámara Axis
#   'ruta/video.mp4' -> un archivo de video ya grabado
VIDEO_SOURCE = "rtsp://root:root@169.254.57.130/axis-media/media.amp"

# Ruta al modelo entrenado (best.pt), junto a este script.
WEIGHTS_PATH = os.environ.get('SPLASH_WEIGHTS') or pathlib.Path(__file__).resolve().parents[1] / 'modelo' / 'best.pt'

# Resolución de inferencia -- bajá este número si va muy lento en CPU
# (960 = la resolución de entrenamiento, más preciso pero más lento;
#  640/480/320 = más rápido, algo menos preciso)
IMG_SIZE = 640

CONF_THRESHOLD = 0.30  # umbral de confianza -- más bajo = más recall, más falsas alarmas
CLASS_NAMES = ['persona', 'swimmer']
COLORS = {0: (0, 200, 0), 1: (0, 140, 255)}  # verde / naranja (BGR)


# Compatibilidad de rutas: el checkpoint se guardó en Colab (Linux) y hay que traducir los PosixPath a WindowsPath.
def cargar_modelo(weights_path, conf_threshold):
    assert os.path.exists(weights_path), f'No encuentro el modelo en {weights_path}'

    if platform.system() == 'Windows':
        _original_posix_path = pathlib.PosixPath
        pathlib.PosixPath = pathlib.WindowsPath
    else:
        _original_posix_path = None

    try:
        # force_reload=False: usa la copia de YOLOv5 que ya está en caché
        # (la primera vez igual la descarga)
        # trust_repo=True: sin esto, torch.hub PREGUNTA en la consola si se confía en el repositorio; en Docker (o como
        # servicio) nadie puede contestar y falla con EOFError. Es el repositorio oficial de YOLOv5 de Ultralytics.
        model = torch.hub.load('ultralytics/yolov5', 'custom', path=str(weights_path), force_reload=False,
                               trust_repo=True)
    finally:
        if _original_posix_path is not None:
            pathlib.PosixPath = _original_posix_path

    model.conf = conf_threshold
    model.iou = 0.45

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model.to(device)
    print(f'Modelo cargado en: {device}')
    if device == 'cpu':
        print('Corriendo en CPU -- va a ser lento. Bajá --img-size o usá --process-every 3.')

    return model


def detectar(model, frame, img_size, letterbox):
    """Devuelve un array (N, 6) [x1, y1, x2, y2, conf, cls] en coordenadas del frame ORIGINAL."""
    if letterbox:
        # el modelo respeta la relación de aspecto y devuelve cajas en coordenadas del frame
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        det = model(rgb, size=img_size).xyxy[0].cpu().numpy()
    else:
        # como la versión original: aplastar a un cuadrado y reescalar las cajas
        h, w = frame.shape[:2]
        resized = cv2.resize(frame, (img_size, img_size))
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        det = model(rgb, size=img_size).xyxy[0].cpu().numpy()
        if det.shape[0] > 0:
            det[:, [0, 2]] *= w / img_size
            det[:, [1, 3]] *= h / img_size
    return det if det.shape[0] > 0 else np.empty((0, 6))


# ============================================================
# Guardado del video anotado (H.264, se reproduce en navegador/VS Code)
# ============================================================
def ruta_segura(path):
    """Si el archivo ya existe, NO lo pisa: guarda con un nombre con fecha/hora."""
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    nuevo = f"{base}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
    print(f"AVISO: '{path}' ya existe -- guardo en '{nuevo}' para no pisarlo.")
    return nuevo


def iniciar_escritor(path, width, height, fps):
    cmd = [
        FFMPEG_BINARY, '-f', 'rawvideo', '-pix_fmt', 'bgr24',
        '-s', f'{width}x{height}', '-r', str(fps), '-i', '-',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast',
        '-movflags', 'frag_keyframe+empty_moov', '-n', path,
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)


def cerrar_escritor(proc):
    if proc is None:
        return
    try:
        proc.stdin.close()
    except (BrokenPipeError, OSError):
        pass
    proc.wait(timeout=30)


def main():
    parser = argparse.ArgumentParser(description='Detección + tracking local (YOLOv5 + ByteTrack)')
    parser.add_argument('--source', default=VIDEO_SOURCE, help='RTSP, índice de webcam o archivo de video')
    parser.add_argument('--weights', default=str(WEIGHTS_PATH), help='Ruta a best.pt')
    parser.add_argument('--img-size', type=int, default=IMG_SIZE, help='Resolución de inferencia')
    parser.add_argument('--conf', type=float, default=CONF_THRESHOLD, help='Umbral de confianza del detector')
    parser.add_argument('--track-thresh', type=float, default=CONF_THRESHOLD,
                        help='Umbral alto de ByteTrack. Las detecciones entre --conf y este valor solo sirven para '
                             'mantener vivos tracks existentes (ej: --conf 0.10 --track-thresh 0.30)')
    parser.add_argument('--track-buffer', type=int, default=30,
                        help='Frames que ByteTrack espera antes de soltar un ID perdido (30 = ~1 s; probá 90)')
    parser.add_argument('--match-thresh', type=float, default=0.8,
                        help='ByteTrack: 0.8 pide ~20%% de solapamiento para re-asociar un track perdido, 0.9 ~10%% '
                             '(más re-asociaciones tras oclusiones, pero también más errores)')
    parser.add_argument('--asso-func', default='diou', choices=['iou', 'diou', 'giou', 'ciou', 'centroid'],
                        help='Cómo ByteTrack asocia cajas entre frames. diou también usa la distancia entre centros: '
                             'con cajas chicas y rápidas (fondo de la piscina) corta mucho menos los tracks que iou')
    parser.add_argument('--contenidas', type=float, default=0.8,
                        help='Descartar una caja de nadador si más de esta fracción cae dentro de otra (0 = desactivado)')
    parser.add_argument('--ventana-conteo', type=float, default=4.0,
                        help='Segundos para suavizar el conteo de nadadores a la vez')
    parser.add_argument('--letterbox', action='store_true',
                        help='Mantener la relación de aspecto (por defecto se aplasta a un cuadrado, como antes)')
    parser.add_argument('--process-every', type=int, default=1, help='Usar un frame de cada N')
    parser.add_argument('--swimmer-only', action='store_true',
                        help='Trackear solo la clase nadador (igual que mine_missed_frames.py y velocity_compare.py). '
                             'Sin esto, persona y nadador comparten el mismo tracker y los números de ID no coinciden')
    parser.add_argument('--swimmer-class', type=int, default=1, help='Id de la clase nadador (por defecto 1)')
    parser.add_argument('--zones', default=None,
                        help='zones.json (de define_zones.py): se ignoran las detecciones fuera de las zonas activas')
    parser.add_argument('--dim-outside', action='store_true',
                        help='Oscurecer lo que está fuera de las zonas en el video mostrado/guardado (el modelo ve todo)')
    parser.add_argument('--show-ignored', action='store_true', help='Dibujar en gris las detecciones ignoradas')
    parser.add_argument('--no-show', action='store_true', help='No abrir ventana')
    parser.add_argument('--save-video', default=None, help='Guardar el video anotado en esta ruta (.mp4)')
    args = parser.parse_args()

    print('Cargando modelo...')
    model = cargar_modelo(args.weights, args.conf)

    print('Cargando tracker ByteTrack...')
    extra = {} if args.asso_func in ('iou', 'centroid') else {'second_match_thresh': 0.4, 'unconfirmed_match_thresh': 0.8}
    tracker = ByteTrack(ByteTrackConfig(
        track_thresh=args.track_thresh,
        max_lost_frames=args.track_buffer,  # antes 'track_buffer' en boxmot < 26
        match_thresh=args.match_thresh,
        asso_func=args.asso_func,
        **extra,
    ))

    source = int(args.source) if str(args.source).isdigit() else args.source
    print(f'Abriendo fuente de video: {source}')
    cap = cv2.VideoCapture(source)
    assert cap.isOpened(), f'No pude abrir la fuente de video: {source}'
    fps_fuente = cap.get(cv2.CAP_PROP_FPS) or 25
    zones = None
    if args.zones:
        from zones import Zones
        zones = Zones.load(args.zones).fit_to(int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
        print(f'Zonas activas cargadas: {len(zones.zones)}')
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    escritor = None
    ruta_salida = None
    if args.save_video:
        ruta_salida = ruta_segura(args.save_video)

    unique_ids_seen = {0: set(), 1: set()}   # solo informativo: NO es la cantidad de personas
    contador = ContadorSimultaneo(ventana_s=args.ventana_conteo)
    en_vivo = isinstance(source, int) or str(source).lower().startswith(('rtsp:', 'http:', 'https:'))
    t_inicio = time.monotonic()

    frame_idx = 0
    procesados = 0
    t_fps = time.time()
    fps_actual = 0.0

    if not args.no_show:
        print('\nVentana abierta -- tocá "q" para salir.\n')

    try:
        while True:
            if frame_idx % args.process_every != 0:
                if not cap.grab():
                    break
                frame_idx += 1
                continue

            ret, frame = cap.read()
            if not ret:
                print('No se pudo leer más frames (fin del video, o se cortó la fuente)')
                break

            # --- Detección ---
            det = detectar(model, frame, args.img_size, args.letterbox)
            if args.swimmer_only:
                det = det[det[:, 5] == args.swimmer_class]

            # --- Zonas activas: lo de afuera no entra al tracker ---
            ignoradas = np.empty((0, 6))
            if zones is not None:
                det, ignoradas = zones.split(det)
            if args.contenidas > 0:
                det = suprimir_contenidas(det, args.contenidas)

            # --- Tracking ---
            tracks = tracker.update(det, frame)

            if zones is not None and args.dim_outside:
                zones.dim_outside(frame)  # solo para mostrar/guardar: la detección ya se hizo
            if args.show_ignored:
                for d in ignoradas:
                    cv2.rectangle(frame, (int(d[0]), int(d[1])), (int(d[2]), int(d[3])), (150, 150, 150), 1)

            # --- Nadadores a la vez (tiempo real en vivo, tiempo del video en archivos) ---
            t_frame = time.monotonic() - t_inicio if en_vivo else frame_idx / fps_fuente
            n_nadadores = sum(1 for t in tracks if int(t[6]) == args.swimmer_class)
            contador.update(n_nadadores, t_frame)

            for t in tracks:
                x1, y1, x2, y2, track_id, conf, cls = t[:7]
                cls = int(cls)
                track_id = int(track_id)
                unique_ids_seen.setdefault(cls, set()).add(track_id)

                color = COLORS.get(cls, (255, 255, 255))
                nombre = CLASS_NAMES[cls] if cls < len(CLASS_NAMES) else str(cls)
                label = f'{nombre} #{track_id} {conf:.2f}'
                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                cv2.putText(frame, label, (int(x1), int(y1) - 6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            # --- FPS en pantalla ---
            procesados += 1
            if procesados % 10 == 0:
                ahora = time.time()
                fps_actual = 10 / (ahora - t_fps)
                t_fps = ahora

            cv2.putText(frame, f'FPS: {fps_actual:.1f}', (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
            cv2.putText(frame, f'Nadadores ahora: {contador.actual}   max sesion: {contador.maximo}',
                        (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

            # --- Guardar video anotado ---
            if ruta_salida:
                if escritor is None:
                    alto, ancho = frame.shape[:2]
                    escritor = iniciar_escritor(ruta_salida, ancho, alto, fps_fuente / args.process_every)
                try:
                    escritor.stdin.write(frame.tobytes())
                except (BrokenPipeError, OSError):
                    print('No pude escribir el video de salida (¿ffmpeg instalado?).')
                    ruta_salida = None

            # --- Mostrar / progreso ---
            if not args.no_show:
                cv2.imshow('Deteccion + Tracking (local, prueba) - q para salir', frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            elif procesados % 100 == 0:
                print(f'  {frame_idx}/{total_frames} frames ({fps_actual:.1f} fps de procesamiento)')

            frame_idx += 1
    finally:
        cap.release()
        cv2.destroyAllWindows()
        cerrar_escritor(escritor)

    print('\nResumen final:')
    if contador.t_maximo is not None:
        m, sg = divmod(int(contador.t_maximo), 60)
        print(f'  Máximo de nadadores a la vez: {contador.maximo} (primera vez a los {m}:{sg:02d})')
    print(f'  IDs de tracker (persona/nadador): {len(unique_ids_seen.get(0, set()))}/{len(unique_ids_seen.get(1, set()))} '
          f'-- informativo: un mismo nadador recibe varios IDs, no son personas distintas')
    if escritor is not None:
        print(f'  Video anotado guardado en: {ruta_salida}')


if __name__ == '__main__':
    main()
