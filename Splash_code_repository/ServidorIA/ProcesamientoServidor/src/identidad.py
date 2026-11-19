"""
Splash - identidades estables por nadador

ByteTrack le pone un ID nuevo a un nadador cada vez que lo pierde un rato (banderines,
brazo abajo, salpicaduras) y lo recupera. Este módulo se pone DESPUÉS del tracker y
traduce los IDs de ByteTrack a identidades estables, usando lo que sabemos de la piscina:

  * un nadador por carril (configurable con max_por_carril): si en un carril hay una
    identidad "perdida" y aparece un track nuevo, es la misma persona que volvió;
  * si no hay carriles definidos, se re-enlaza por posición: el track nuevo aparece
    cerca de donde se esperaba al perdido (posición + velocidad estimada);
  * un track que aparece en un carril YA ocupado por otro track activo es un duplicado
    (ByteTrack partió un nadador en dos cajas) y se descarta;
  * todo se mide en SEGUNDOS (timestamp de captura), no en frames, así que funciona igual
    con FPS bajos o irregulares (celular, frames descartados).

MODO "UN NADADOR POR CARRIL" (el de por defecto cuando hay carriles definidos y max_por_carril == 1):
  * la identidad ES el carril: hay una identidad por carril y no cambia en toda la sesión, pase lo que pase con los
    IDs de ByteTrack (se pierda un rato, vuelva con otro ID, o desaparezca 2 minutos). Solo se reinician cuando se
    cambian los carriles (otra sesión / otra calibración);
  * una detección fuera de todos los carriles se ignora (banderines, gente en el borde): no crea identidades;
  * si en un mismo carril hay varias cajas en un frame, se queda la más cercana a donde se esperaba al nadador (su
    última posición + velocidad). Si hace más de `reanclar_s` que no se lo ve, no hay posición confiable y se queda la
    de mayor confianza. Un "salto" de una sola caja lejos de lo esperado lo filtra después Trayectorias.

Los carriles salen de zones.json: los polígonos cuyo nombre empieza con "lane" o "carril"
(ver define_zones.py: --names lane4 lane5 lane6 blocks deck).

Uso:
    gestor = GestorIdentidades(carriles={"lane4": [[x, y], ...], ...})
    estables = gestor.update(tracks, t_captura)   # tracks: (N, >=7) [x1,y1,x2,y2,id,conf,cls,...]
    # estables: (M, 7) con el ID estable en la columna 4
"""
import math

import cv2
import numpy as np


class _Estado:
    __slots__ = ("centro", "diag", "t_ultimo", "vel", "carril", "frames")

    def __init__(self, centro, diag, t, carril):
        self.centro = centro
        self.diag = diag
        self.t_ultimo = t
        self.vel = np.zeros(2)
        self.carril = carril
        self.frames = 1


def _iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


class GestorIdentidades:
    def __init__(self, carriles=None, max_hueco_s=20.0, max_por_carril=1,
                 iou_duplicado=0.5, gate_base=1.5, gate_por_s=2.0, un_nadador_por_carril=True, reanclar_s=3.0):
        """
        carriles        {nombre: [[x, y], ...]} polígonos de cada carril, o None.
        max_hueco_s     segundos máximos que una identidad perdida sigue "viva" para ser recuperada.
        max_por_carril  nadadores simultáneos esperados por carril.
        iou_duplicado   dos cajas del mismo carril que se solapan más que esto son el mismo nadador.
        gate_base/_por_s  radio de búsqueda para re-enlazar (en diagonales de caja; crece con el tiempo perdido).
        un_nadador_por_carril  la identidad es el carril (ver arriba). Solo rige con carriles definidos y max_por_carril == 1.
        reanclar_s      si hace más que esto que no se ve al nadador de un carril, no se usa su posición para elegir entre cajas.
        """
        self.carriles = {n: np.array(p, dtype=np.float32) for n, p in (carriles or {}).items()}
        self.max_hueco_s = max_hueco_s
        self.max_por_carril = max_por_carril
        self.iou_duplicado = iou_duplicado
        self.gate_base = gate_base
        self.gate_por_s = gate_por_s
        self.un_nadador_por_carril = un_nadador_por_carril
        self.reanclar_s = reanclar_s

        self.fuera_de_carril = 0   # detecciones ignoradas por estar fuera de todos los carriles (solo en el modo por carril)
        self._sid_de_carril = {}   # nombre de carril -> su identidad (modo por carril)
        self.estados = {}   # ID estable -> _Estado
        self.mapa = {}      # ID de ByteTrack -> ID estable
        self._siguiente = 1
        self.reenlaces = 0
        self.duplicados = 0

    def cambiar_carriles(self, carriles):
        """
        Usa otros polígonos de carril (otra posición de la cámara). Las identidades vivas se olvidan, porque su carril
        era el de las zonas viejas; los números nuevos siguen después de los usados, así no se confunden con los anteriores.
        """
        self.carriles = {n: np.array(p, dtype=np.float32) for n, p in (carriles or {}).items()}
        self.estados.clear()
        self.mapa.clear()
        self._sid_de_carril.clear()

    @property
    def _modo_carril(self):
        return self.un_nadador_por_carril and self.max_por_carril == 1 and bool(self.carriles)

    # ---- utilidades ----
    def _carril_de(self, cx, cy):
        for nombre, poly in self.carriles.items():
            if cv2.pointPolygonTest(poly, (float(cx), float(cy)), False) >= 0:
                return nombre
        return None

    def _nueva(self, centro, diag, t, carril):
        sid = self._siguiente
        self._siguiente += 1
        self.estados[sid] = _Estado(centro, diag, t, carril)
        return sid

    def _asignar(self, centro, diag, t, carril, reclamados):
        """ID estable para un track nuevo, o None si es un duplicado."""
        activas = [s for s, e in self.estados.items() if t - e.t_ultimo <= self.max_hueco_s]
        vivos = [s for s in activas if self.estados[s].carril == carril]
        perdidos = [s for s in vivos if s not in reclamados]
        # para re-enlazar por posición también valen los perdidos de otro carril si el track
        # nuevo cayó fuera de los polígonos (o el perdido estaba fuera de ellos)
        candidatos = [s for s in activas if s not in reclamados and
                      (carril is None or self.estados[s].carril is None or self.estados[s].carril == carril)]

        # a) re-enlace por posición esperada
        mejor = None
        for s in candidatos:
            e = self.estados[s]
            dt = max(t - e.t_ultimo, 1e-3)
            pred = e.centro + e.vel * min(dt, 1.0)
            dist = float(np.linalg.norm(centro - pred))
            puerta = e.diag * (self.gate_base + self.gate_por_s * min(dt, 3.0))
            if dist <= puerta and (mejor is None or dist < mejor[0]):
                mejor = (dist, s)
        if mejor:
            self.reenlaces += 1
            return mejor[1]

        # b) hay lugar en el carril: nadador nuevo
        if carril is None or len(vivos) < self.max_por_carril:
            return self._nueva(centro, diag, t, carril)

        # c) un nadador por carril: hereda la identidad perdida más reciente
        if perdidos:
            self.reenlaces += 1
            return max(perdidos, key=lambda s: self.estados[s].t_ultimo)

        # d) el carril ya está ocupado por un track activo: duplicado
        self.duplicados += 1
        return None

    # ---- API ----
    def _update_por_carril(self, tracks, t):
        """Una identidad por carril. De cada carril se queda UNA caja por frame: la más cercana a lo esperado."""
        por_carril = {}
        for fila in tracks:
            x1, y1, x2, y2 = fila[:4]
            centro = np.array([(x1 + x2) / 2, (y1 + y2) / 2])
            carril = self._carril_de(*centro)
            if carril is None:
                self.fuera_de_carril += 1
                continue
            por_carril.setdefault(carril, []).append((fila, centro))

        salida = []
        for carril, cajas in por_carril.items():
            sid = self._sid_de_carril.get(carril)
            e = self.estados.get(sid) if sid is not None else None
            if e is not None and t - e.t_ultimo <= self.reanclar_s:
                dt = max(t - e.t_ultimo, 1e-3)
                esperado = e.centro + e.vel * min(dt, 1.0)
                fila, centro = min(cajas, key=lambda c: float(np.linalg.norm(c[1] - esperado)))
            else:
                fila, centro = max(cajas, key=lambda c: float(c[0][5]))     # sin posición confiable: la más segura
            self.duplicados += len(cajas) - 1
            x1, y1, x2, y2, tid, conf, cls = fila
            diag = math.hypot(x2 - x1, y2 - y1)
            if e is None:
                sid = self._nueva(centro, diag, t, carril)
                self._sid_de_carril[carril] = sid
                e = self.estados[sid]
            elif self.mapa.get(int(tid)) != sid:
                self.reenlaces += 1          # otro ID de ByteTrack para el mismo nadador
            self.mapa[int(tid)] = sid
            dt = t - e.t_ultimo
            if dt > 1e-3:
                e.vel = 0.5 * e.vel + 0.5 * (centro - e.centro) / dt
            e.centro, e.diag, e.t_ultimo, e.frames = centro, diag, t, e.frames + 1
            e.carril = carril
            salida.append([x1, y1, x2, y2, sid, conf, cls])
        return np.array(salida) if salida else np.empty((0, 7))

    def update(self, tracks, t):
        tracks = np.asarray(tracks, dtype=float)
        if tracks.size == 0:
            return np.empty((0, 7))
        tracks = tracks.reshape(len(tracks), -1)[:, :7]
        if self._modo_carril:
            return self._update_por_carril(tracks, t)

        reclamados = set()
        filas = []
        # los tracks ya conocidos van primero: uno nuevo no les puede quitar la identidad
        orden = sorted(range(len(tracks)), key=lambda i: int(tracks[i][4]) not in self.mapa)
        for i in orden:
            x1, y1, x2, y2, tid, conf, cls = tracks[i]
            tid = int(tid)
            centro = np.array([(x1 + x2) / 2, (y1 + y2) / 2])
            diag = math.hypot(x2 - x1, y2 - y1)
            carril = self._carril_de(*centro)

            sid = self.mapa.get(tid)
            if sid is not None and sid in reclamados:
                self.duplicados += 1
                continue
            if sid is None:
                sid = self._asignar(centro, diag, t, carril, reclamados)
                if sid is None:
                    continue
                self.mapa[tid] = sid
            reclamados.add(sid)

            e = self.estados[sid]
            dt = t - e.t_ultimo
            if dt > 1e-3:
                e.vel = 0.5 * e.vel + 0.5 * (centro - e.centro) / dt
            e.centro, e.diag, e.t_ultimo, e.frames = centro, diag, t, e.frames + 1
            if carril is not None:
                e.carril = carril
            filas.append([x1, y1, x2, y2, sid, conf, cls])

        return self._sin_solapados(filas)

    def _sin_solapados(self, filas):
        """Dos cajas muy solapadas en el mismo carril son un solo nadador: queda la identidad más vieja."""
        filas.sort(key=lambda f: f[4])
        salida = []
        for f in filas:
            carril = self.estados[int(f[4])].carril
            if any(_iou(f, g) > self.iou_duplicado and self.estados[int(g[4])].carril == carril for g in salida):
                self.duplicados += 1
                continue
            salida.append(f)
        return np.array(salida) if salida else np.empty((0, 7))

    def resumen(self):
        return {"identidades": len(self.estados), "ids_bytetrack": len(self.mapa),
                "reenlaces": self.reenlaces, "duplicados_descartados": self.duplicados,
                "fuera_de_carril": self.fuera_de_carril}
