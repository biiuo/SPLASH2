"""
Splash - recorte de los carriles centrales ANTES del modelo

zones.py ignora las detecciones de afuera de las zonas DESPUÉS de que el modelo ya procesó el
frame completo. Acá se hace lo que hace falta para ir más rápido: recortar la imagen al
rectángulo que contiene los 3 carriles y pasarle solo eso al modelo.

  * el modelo trabaja con menos píxeles (más FPS) y ve a los nadadores más grandes;
  * las cajas se devuelven en coordenadas del frame ORIGINAL (volver), así que la calibración,
    las zonas y las identidades siguen funcionando igual;
  * lo que quede dentro del rectángulo pero fuera del polígono lo descarta zones.py como siempre.

Los carriles salen de zones.json: polígonos cuyo nombre empieza con "lane" o "carril"
(define_zones.py --names lane4 lane5 lane6 blocks deck). Si no hay ninguno con ese nombre,
se usan todas las zonas.

Uso:
    zonas = Zones.load("zones.json").fit_to(ancho, alto)
    roi = Recorte(zonas, ancho, alto, margen=0.03)
    det = roi.volver(detectar(modelo, roi.aplicar(frame)))   # coordenadas del frame original
    det, _ = zonas.split(det)

Recomendado con --letterbox: el recorte es una franja ancha y no hay que deformarla a un cuadrado.
"""
import numpy as np


class Recorte:
    def __init__(self, zonas, ancho, alto, margen=0.03, prefijos=("lane", "carril")):
        """
        zonas   Zones ya reescalada al tamaño del video (fit_to).
        margen  proporción del rectángulo que se agrega alrededor (para no cortar cajas de borde).
        """
        polys = [p for z, p in zip(zonas.zones, zonas._polys) if z["name"].lower().startswith(prefijos)]
        if not polys:
            polys = list(zonas._polys)
        puntos = np.vstack(polys)
        x1, y1 = puntos.min(axis=0)
        x2, y2 = puntos.max(axis=0)
        mx, my = (x2 - x1) * margen, (y2 - y1) * margen
        self.x1 = int(max(0, np.floor(x1 - mx)))
        self.y1 = int(max(0, np.floor(y1 - my)))
        self.x2 = int(min(ancho, np.ceil(x2 + mx)))
        self.y2 = int(min(alto, np.ceil(y2 + my)))
        self.ancho_original, self.alto_original = ancho, alto

    @property
    def caja(self):
        return self.x1, self.y1, self.x2, self.y2

    @property
    def fraccion_area(self):
        """Qué parte del frame original queda (menos = más ahorro)."""
        return ((self.x2 - self.x1) * (self.y2 - self.y1)) / (self.ancho_original * self.alto_original)

    def aplicar(self, frame):
        """Recorta el frame (una vista, no una copia)."""
        return frame[self.y1:self.y2, self.x1:self.x2]

    def volver(self, det):
        """Pasa las cajas (N, >=4) de coordenadas del recorte a coordenadas del frame original."""
        det = np.asarray(det, dtype=float)
        if det.size == 0:
            return det.reshape(0, det.shape[-1] if det.ndim == 2 else 6)
        out = det.copy()
        out[:, [0, 2]] += self.x1
        out[:, [1, 3]] += self.y1
        return out
