"""
Servidor de streaming para el procesamiento en el celular: lee la cámara (normalmente el relé RTSP) y manda los
frames por WebSocket al navegador del celular, que corre el modelo.

  * La cámara se abre UNA sola vez y la comparten todos los que se conecten.
  * Un hilo lee la cámara sin parar y se queda solo con el frame más reciente. A cada cliente se le manda siempre el
    último, a FPS_OBJETIVO: si el celular o la red van lentos, se saltan frames y el retraso no crece.
  * Cada mensaje es JSON:
      - timestamp: el instante EXACTO de captura (segundos desde 1970). Los tiempos de cruce y las velocidades se
        calculan con este valor, así la red y el procesamiento no alteran la medida.
      - frame_id: número de frame (para notar los saltados).
      - frame: la imagen en JPEG, en base64.
      - ancho, alto: tamaño del JPEG enviado.
  * El frame se achica a ANCHO de ancho, manteniendo la proporción (menos datos por la red). El celular vuelve a
    llevar sus posiciones al tamaño de la calibración antes de mandarlas.

Variables de entorno:
    CAMARA_SOURCE   rtsp://..., un archivo de video o el número de una webcam (por defecto rtsp://localhost:8554/cam)
    STREAM_ANCHO    ancho del frame enviado (por defecto 960)
    STREAM_FPS      frames por segundo enviados (por defecto 10)
    STREAM_CALIDAD  calidad JPEG 1-100 (por defecto 75)

Correr con:
    pip install -r requirements.txt
    python servidor_stream.py
"""
import asyncio
import base64
import json
import os
import threading
import time

import cv2
import websockets

FUENTE = os.environ.get("CAMARA_SOURCE", "rtsp://localhost:8554/cam")
ANCHO = int(os.environ.get("STREAM_ANCHO", "960"))
FPS_OBJETIVO = float(os.environ.get("STREAM_FPS", "10"))
CALIDAD_JPEG = int(os.environ.get("STREAM_CALIDAD", "75"))
PUERTO = 8765
PREFIJOS_CAMARA = ("rtsp://", "rtmp://", "http://", "https://")


class Camara(threading.Thread):
    """Lee la fuente sin parar y guarda solo el último frame (ya comprimido), con su hora de captura."""

    def __init__(self, fuente):
        super().__init__(daemon=True, name="camara")
        self.fuente = int(fuente) if str(fuente).isdigit() else fuente
        self.es_archivo = isinstance(self.fuente, str) and not self.fuente.lower().startswith(PREFIJOS_CAMARA)
        self._lock = threading.Lock()
        self._ultimo = None     # (frame_id, timestamp, jpg_b64, ancho, alto)
        self.leidos = 0

    def ultimo(self):
        with self._lock:
            return self._ultimo

    def run(self):
        while True:
            cap = cv2.VideoCapture(self.fuente)
            if not cap.isOpened():
                print(f"No pude abrir {self.fuente}; reintento en 3 s")
                time.sleep(3)
                continue
            fps_fuente = cap.get(cv2.CAP_PROP_FPS) or 25.0
            print(f"Cámara abierta: {self.fuente} ({fps_fuente:.0f} fps)")
            inicio = time.time()
            n = 0
            while True:
                ret, frame = cap.read()
                # la hora se toma apenas se lee el frame, antes de achicar, comprimir o mandar
                timestamp = time.time()
                if not ret:
                    break
                n += 1
                h, w = frame.shape[:2]
                if w > ANCHO:
                    frame = cv2.resize(frame, (ANCHO, round(h * ANCHO / w)), interpolation=cv2.INTER_AREA)
                ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, CALIDAD_JPEG])
                if ok:
                    self.leidos += 1
                    with self._lock:
                        self._ultimo = (self.leidos, timestamp, base64.b64encode(buf).decode("ascii"),
                                        frame.shape[1], frame.shape[0])
                if self.es_archivo:     # un archivo imita a una cámara: a su ritmo
                    espera = inicio + n / fps_fuente - time.time()
                    if espera > 0:
                        time.sleep(espera)
            cap.release()
            print("Se cortó la fuente" + ("; vuelvo a empezar el video" if self.es_archivo else "; reconecto"))
            time.sleep(0.5)


async def transmitir(websocket, camara):
    print(f"Cliente conectado: {websocket.remote_address}")
    ultimo_id = None
    try:
        while True:
            dato = camara.ultimo()
            if dato and dato[0] != ultimo_id:
                ultimo_id, timestamp, jpg, ancho, alto = dato
                await websocket.send(json.dumps({
                    "timestamp": timestamp, "frame_id": ultimo_id, "frame": jpg, "ancho": ancho, "alto": alto,
                }))
            await asyncio.sleep(1 / FPS_OBJETIVO)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        print(f"Cliente desconectado: {websocket.remote_address}")


async def main():
    camara = Camara(FUENTE)
    camara.start()
    print(f"Fuente: {FUENTE} | envío: {ANCHO} px de ancho, {FPS_OBJETIVO:g} fps, JPEG {CALIDAD_JPEG}")
    print(f"WebSocket en ws://0.0.0.0:{PUERTO} (desde el celular, usar la IP de esta PC)")
    async with websockets.serve(lambda ws: transmitir(ws, camara), "0.0.0.0", PUERTO, max_size=None):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
