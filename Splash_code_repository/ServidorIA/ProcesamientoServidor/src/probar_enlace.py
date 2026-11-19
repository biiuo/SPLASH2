import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

# RTSP por TCP: muchas redes (la de la universidad, por ejemplo) bloquean UDP y el stream "abre" pero no entrega frames.
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
import cv2  # noqa: E402
import numpy as np  # noqa: E402

OK, MAL, AVISO = "[ OK ]", "[FALLA]", "[AVISO]"


def pedir(url, cuerpo=None, token=None, timeout=10):
    """(codigo_http, texto, segundos). Un error de red devuelve codigo None y el motivo en el texto."""
    cab = {"Content-Type": "application/json"}
    if token:
        cab["Authorization"] = f"Bearer {token}"
    t0 = time.time()
    req = urllib.request.Request(url, data=cuerpo, headers=cab, method="POST" if cuerpo is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace"), time.time() - t0
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), time.time() - t0
    except Exception as e:  # noqa: BLE001 - sin red, DNS, certificado, timeout...
        return None, f"{type(e).__name__}: {e}", time.time() - t0


def paso_backend(base):
    print(f"\n1) Backend: {base}")
    codigo, texto, seg = pedir(base + "/api/salud", timeout=15)
    if codigo == 200:
        print(f"{OK} responde ({seg * 1000:.0f} ms)")
        return True
    if codigo is None:
        print(f"{MAL} no se pudo conectar: {texto}")
        print("       - ¿La URL es la del BACKEND en Railway (no la de Vercel)? Tiene que empezar con https:// y no terminar en /api.")
        print("       - ¿La red de aquí deja salir a internet? Probá abrir esa URL + /api/salud en el navegador de esta PC.")
    else:
        print(f"{MAL} respondió {codigo}: {texto[:200]}")
        print("       - Si es 404, la URL no es la del backend (o termina en /api). Si es 502/503, Railway está reiniciando o caído.")
    return False


def abrir_fuente(args):
    if args.sin_camara:
        return None, "imagen de prueba"
    fuente = args.video or args.rtsp
    cap = cv2.VideoCapture(fuente)
    return (cap if cap.isOpened() else None), fuente


def paso_camara(args):
    print("\n2) Cámara")
    if args.sin_camara:
        print(f"{AVISO} salteado (--sin-camara): se usa una imagen de prueba")
        img = np.full((480, 640, 3), 90, np.uint8)
        cv2.putText(img, "prueba de enlace", (140, 250), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
        return img
    cap, fuente = abrir_fuente(args)
    mostrada = fuente if args.video else fuente.split("@")[-1]    # no imprimir la clave de la cámara
    if cap is None:
        print(f"{MAL} no abrió {mostrada}")
        print("       - ¿Esta PC está en la misma red que la cámara? Probá `ping IP-DE-LA-CAMARA`.")
        print("       - Revisá usuario y clave. Axis: rtsp://USUARIO:CLAVE@IP/axis-media/media.amp")
        print("       - Si la clave tiene @ : / # ? hay que escribirla codificada (%40 %3A %2F %23 %3F).")
        return None
    t0 = time.time()
    ret, frame = cap.read()
    if not ret:
        cap.release()
        print(f"{MAL} abrió {mostrada} pero no entregó ningún frame")
        print("       - Suele ser UDP bloqueado (aquí ya se fuerza TCP) o la cámara con demasiadas conexiones abiertas.")
        return None
    primero = time.time() - t0
    n, ultimo = 1, frame
    inicio = time.time()
    while time.time() - inicio < args.segundos:
        ret, f = cap.read()
        if not ret:
            break
        n, ultimo = n + 1, f
    cap.release()
    dur = max(time.time() - inicio, 1e-6)
    fps = (n - 1) / dur
    h, w = ultimo.shape[:2]
    print(f"{OK} {mostrada}: {w}x{h}, primer frame en {primero:.1f} s, {fps:.1f} fps medidos en {dur:.0f} s")
    if fps < 5 and not args.video:
        print(f"{AVISO} pocos fps: revisá el wifi/cable y la resolución del stream de la cámara")
    return ultimo


def paso_frame(base, token, frame):
    print("\n3) Mandar un frame al backend")
    if frame is None:
        print(f"{AVISO} salteado: no hay frame de la cámara")
        return False
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    cuerpo = json.dumps({"imagen": "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")}).encode()
    kb = len(cuerpo) / 1024
    tiempos = []
    for i in range(3):
        codigo, texto, seg = pedir(base + "/api/calibracion/frame-actual", cuerpo, token, timeout=30)
        if codigo != 200:
            break
        tiempos.append(seg)
    if len(tiempos) == 3:
        print(f"{OK} el backend aceptó el frame ({kb:.0f} KB, {sum(tiempos) / 3 * 1000:.0f} ms por envío; cada 3 s es el ritmo normal)")
        if sum(tiempos) / 3 > 2.5:
            print(f"{AVISO} cada envío tarda más de 2,5 s: el enlace de subida es lento. Subí --frame-cada-s o bajá la resolución")
        return True
    if codigo in (401, 403):
        print(f"{MAL} el backend rechazó el token ({codigo})")
        print("       - IA_TOKEN de aquí tiene que ser IDÉNTICO a la variable IA_TOKEN del servicio backend en Railway.")
    elif codigo == 404:
        print(f"{MAL} 404: ese backend no tiene /api/calibracion/frame-actual. ¿Railway tiene desplegada la última versión de main_codigo?")
    elif codigo is None:
        print(f"{MAL} no se pudo enviar: {texto}")
    else:
        print(f"{MAL} respondió {codigo}: {texto[:200]}")
    return False


def main():
    ap = argparse.ArgumentParser(description="Prueba cámara -> IA -> backend, un tramo a la vez")
    ap.add_argument("--rtsp", default=os.environ.get("CAMERA_SOURCE"), help="URL RTSP de la cámara (o CAMERA_SOURCE)")
    ap.add_argument("--video", help="usar un archivo de video en vez de la cámara")
    ap.add_argument("--sin-camara", action="store_true", help="solo probar el backend, con una imagen de prueba")
    ap.add_argument("--backend", default=os.environ.get("BACKEND_URL") or os.environ.get("IA_BACKEND_URL"), help="URL del backend")
    ap.add_argument("--token", default=os.environ.get("IA_TOKEN"), help="IA_TOKEN")
    ap.add_argument("--segundos", type=float, default=5.0, help="cuánto leer la cámara para medir los fps")
    args = ap.parse_args()
    if not args.backend or not args.token:
        sys.exit("Falta --backend y/o --token (o BACKEND_URL / IA_TOKEN en el entorno).")
    if not (args.rtsp or args.video or args.sin_camara):
        sys.exit("Falta --rtsp (o CAMERA_SOURCE), --video o --sin-camara.")
    base = args.backend.rstrip("/")
    if base.endswith("/api"):
        base = base[:-4]

    listo_backend = paso_backend(base)
    frame = paso_camara(args)
    listo_frame = paso_frame(base, args.token, frame) if listo_backend else False
    print("\n" + "=" * 60)
    if listo_backend and frame is not None and listo_frame:
        print("TODO BIEN. Ahora levantá el pipeline y, en la web, entrá como administrador > Calibración y tocá")
        print('"Usar la imagen de la cámara": tiene que aparecer este mismo frame.')
    else:
        print("Algo falló: arreglá el primer [FALLA] de arriba y volvé a correrlo.")
    sys.exit(0 if (listo_backend and frame is not None and listo_frame) else 1)


if __name__ == "__main__":
    main()