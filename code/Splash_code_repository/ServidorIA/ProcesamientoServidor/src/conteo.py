"""
Splash - conteo de nadadores a la vez y descarte de cajas repetidas

ByteTrack le da un ID nuevo al mismo nadador cada vez que lo pierde (por ejemplo en cada vuelta contra
la pared), así que contar IDs únicos da cientos de "personas". Lo que sí es estable es cuántos
nadadores hay a la vez.
"""
from collections import deque

import numpy as np


def suprimir_contenidas(det, umbral=0.8):
    """Quita la caja chica cuando más de `umbral` de su área cae dentro de otra más grande
    (típico: la cabeza marcada como otro nadador). det: filas [x1, y1, x2, y2, conf, cls, ...]."""
    det = np.asarray(det)
    if len(det) < 2 or umbral <= 0:
        return det
    x1, y1, x2, y2 = det[:, 0], det[:, 1], det[:, 2], det[:, 3]
    area = np.maximum(x2 - x1, 0) * np.maximum(y2 - y1, 0)
    mantener = np.ones(len(det), dtype=bool)
    for i in range(len(det)):
        ix = np.maximum(0, np.minimum(x2[i], x2) - np.maximum(x1[i], x1))
        iy = np.maximum(0, np.minimum(y2[i], y2) - np.maximum(y1[i], y1))
        dentro = (ix * iy) / max(area[i], 1e-9)
        dentro[i] = 0
        # solo cuenta como "contenida" dentro de una caja más grande (si son iguales, se queda una)
        mayor = (area > area[i]) | ((area == area[i]) & (np.arange(len(det)) < i))
        if np.any((dentro > umbral) & mayor):
            mantener[i] = False
    return det[mantener]


class ContadorSimultaneo:
    """Cuántos nadadores hay a la vez, suavizado con la mediana de los últimos `ventana_s` segundos."""

    def __init__(self, ventana_s=4.0):
        self.ventana_s = ventana_s
        self._muestras = deque()          # (t, n)
        self.actual = 0
        self.maximo = 0
        self.t_maximo = None

    def update(self, n, t):
        self._muestras.append((t, int(n)))
        while self._muestras and t - self._muestras[0][0] > self.ventana_s:
            self._muestras.popleft()
        self.actual = int(round(float(np.median([m[1] for m in self._muestras]))))
        if self.actual > self.maximo:
            self.maximo, self.t_maximo = self.actual, t
        return self.actual
