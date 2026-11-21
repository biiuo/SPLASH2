"""
Splash - fantasmas: detecciones falsas que están siempre en el mismo lugar (un reflejo de luz en medio del carril)

Un reflejo no se puede recortar con la zona ni con un rectángulo si cae en el centro del carril. Pero se queda quieto,
y un nadador no: pasa por ahí en una fracción de segundo. Así que, con la piscina VACÍA, se "aprenden" unos segundos:
las detecciones que aparecen siempre en el mismo lugar se anotan como fantasmas, y después se descartan las detecciones
cuyo centro cae sobre alguno.

Costo: un nadador que pasa por encima de un fantasma se pierde mientras lo cruza (un instante). Trayectorias lo cubre
con una posición estimada, igual que cuando parpadea la detección.

Uso:
    --aprender-fantasmas 15      con la piscina vacía y una sesión activa: aprende 15 s y sigue con el filtro puesto
    --fantasmas fantasmas.json   dónde guardar lo aprendido y de dónde cargarlo la próxima vez (misma posición de cámara)
"""
import json
import math

import numpy as np


class MapaFantasmas:
    def __init__(self, aprender_s=0.0, archivo=None, radio_min_px=30.0, radio_diag=0.6, min_frac=0.25, log=print):
        self.aprender_s, self.archivo, self.log = aprender_s, archivo, log
        self.radio_min_px, self.radio_diag, self.min_frac = radio_min_px, radio_diag, min_frac
        self.fantasmas = []          # [(cx, cy, radio)]
        self.aprendiendo = aprender_s > 0
        self._t0 = None
        self._frames = 0
        self._centros = []           # (cx, cy, diag) de cada detección vista mientras se aprende
        self.descartadas = 0
        if not self.aprendiendo and archivo:
            self.cargar(archivo)

    # ---- aprender ----
    def observar(self, det, t):
        """Llamar con las detecciones de cada frame (aunque no haya ninguna) mientras se aprende."""
        if not self.aprendiendo:
            return
        if self._t0 is None:
            self._t0 = t
            self.log(f"[fantasmas] aprendiendo {self.aprender_s:.0f} s: la piscina tiene que estar VACÍA")
        self._frames += 1
        for d in np.asarray(det).reshape(len(det), -1) if len(det) else []:
            self._centros.append(((d[0] + d[2]) / 2, (d[1] + d[3]) / 2, math.hypot(d[2] - d[0], d[3] - d[1])))
        if t - self._t0 >= self.aprender_s:
            self._terminar()

    def _terminar(self):
        self.aprendiendo = False
        grupos = []                  # [cx, cy, diag, cuenta]
        for cx, cy, diag in self._centros:
            for g in grupos:
                if math.hypot(cx - g[0], cy - g[1]) <= max(self.radio_min_px, self.radio_diag * g[2]):
                    g[3] += 1
                    g[0] += (cx - g[0]) / g[3]
                    g[1] += (cy - g[1]) / g[3]
                    g[2] += (diag - g[2]) / g[3]
                    break
            else:
                grupos.append([cx, cy, diag, 1])
        minimo = max(3, self.min_frac * self._frames)
        self.fantasmas = [(g[0], g[1], max(self.radio_min_px, self.radio_diag * g[2])) for g in grupos if g[3] >= minimo]
        if self.fantasmas:
            self.log(f"[fantasmas] {len(self.fantasmas)} fantasma(s) en {self._frames} frames: "
                     + ", ".join(f"({x:.0f},{y:.0f}) r={r:.0f}" for x, y, r in self.fantasmas))
        else:
            self.log(f"[fantasmas] no encontré detecciones fijas en {self._frames} frames: no hay nada que descartar")
        self._centros = []
        if self.archivo:
            with open(self.archivo, "w", encoding="utf-8") as f:
                json.dump({"fantasmas": [{"x": x, "y": y, "r": r} for x, y, r in self.fantasmas]}, f)
            self.log(f"[fantasmas] guardados en {self.archivo}")

    def cargar(self, ruta):
        try:
            with open(ruta, encoding="utf-8") as f:
                self.fantasmas = [(g["x"], g["y"], g["r"]) for g in json.load(f)["fantasmas"]]
            self.log(f"[fantasmas] {len(self.fantasmas)} cargados de {ruta}")
        except FileNotFoundError:
            self.log(f"[fantasmas] {ruta} no existe: sin filtro (usá --aprender-fantasmas para crearlo)")

    # ---- filtrar ----
    def filtrar(self, det):
        """Quita las detecciones cuyo centro cae sobre un fantasma. No filtra mientras aprende."""
        if self.aprendiendo or not self.fantasmas or len(det) == 0:
            return det
        cx, cy = (det[:, 0] + det[:, 2]) / 2, (det[:, 1] + det[:, 3]) / 2
        fuera = np.zeros(len(det), dtype=bool)
        for x, y, r in self.fantasmas:
            fuera |= np.hypot(cx - x, cy - y) <= r
        self.descartadas += int(fuera.sum())
        return det[~fuera]
