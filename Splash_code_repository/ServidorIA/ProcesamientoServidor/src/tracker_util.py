"""
Splash - crea el ByteTrack de boxmot con los parámetros de forma segura

Las versiones de boxmot no aceptan los mismos argumentos (min_conf y frame_rate no existen
en todas). Acá se mira la firma real del ByteTrack instalado y solo se pasa lo que acepta.

Además, el buffer se pide en SEGUNDOS: ByteTrack lo cuenta en frames procesados, y esos
frames duran distinto según el FPS de procesamiento (3 fps vs 30 fps).

    tracker, usados = crear_bytetrack(track_thresh=0.30, match_thresh=0.9,
                                      track_buffer_s=4, fps_proceso=10, min_conf=0.10)
"""
import inspect


def crear_bytetrack(track_thresh, match_thresh, track_buffer_s, fps_proceso, min_conf=0.10, asso_func=None):
    from boxmot import ByteTrack

    try:  # boxmot >= 26: los parámetros van en ByteTrackConfig; el buffer es 'max_lost_frames'
        from boxmot import ByteTrackConfig
    except ImportError:
        ByteTrackConfig = None
    if ByteTrackConfig is not None:
        kw = {"track_thresh": track_thresh, "match_thresh": match_thresh, "min_conf": min_conf,
              "max_lost_frames": max(1, round(track_buffer_s * fps_proceso))}
        if asso_func:       # diou también mira la distancia entre centros: corta menos los tracks de cajas chicas y rápidas
            kw["asso_func"] = asso_func
            if asso_func not in ("iou", "centroid"):
                kw.update(second_match_thresh=0.4, unconfirmed_match_thresh=0.8)
        return ByteTrack(ByteTrackConfig(**kw)), kw

    aceptados = inspect.signature(ByteTrack.__init__).parameters
    kw = {}
    if "track_thresh" in aceptados:
        kw["track_thresh"] = track_thresh
    if "match_thresh" in aceptados:
        kw["match_thresh"] = match_thresh
    if asso_func and "asso_func" in aceptados:
        kw["asso_func"] = asso_func
    if "min_conf" in aceptados:          # umbral bajo (el "track_low_thresh" de otras librerías)
        kw["min_conf"] = min_conf
    if "frame_rate" in aceptados:
        # boxmot: buffer real = frame_rate / 30 * track_buffer  ->  segundos * fps
        kw["frame_rate"] = max(1, round(fps_proceso))
        kw["track_buffer"] = max(1, round(track_buffer_s * 30))
    else:
        kw["track_buffer"] = max(1, round(track_buffer_s * fps_proceso))
    return ByteTrack(**kw), kw


def carriles_desde_zonas(zonas):
    """{nombre: polígono} con las zonas cuyo nombre empieza con lane o carril (ya reescaladas al video)."""
    return {z["name"]: p for z, p in zip(zonas.zones, zonas._polys)
            if z["name"].lower().startswith(("lane", "carril"))}
