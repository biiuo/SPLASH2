"""
Splash - las zonas que está usando el pipeline, y el cambio a otras sin reiniciar

Las zonas (carriles, bloques, borde) dependen de la posición de la cámara. En el backend cada calibración guarda las
suyas, y cada sesión queda atada a la calibración con la que empezó. Por eso el servidor de IA:

  * arranca con las de --zones (si hay), para poder procesar antes de que exista una sesión;
  * al unirse a una sesión pide al backend las zonas de SU calibración y pasa a usarlas.

El cambio lo pide el hilo del enviador (proponer) pero lo aplica el hilo de inferencia entre dos frames
(aplicar_pendiente), así un frame nunca se procesa con el recorte de unas zonas y los carriles de otras.
"""
import json
import threading

from roi import Recorte
from zones import Zones

PREFIJOS_CARRIL = ("lane", "carril")


class ZonasActivas:
    def __init__(self, ancho, alto, margen_recorte=0.03, sin_recorte=False, log=print):
        self.ancho, self.alto = ancho, alto
        self.margen_recorte, self.sin_recorte = margen_recorte, sin_recorte
        self.log = log
        self.zonas = None       # Zones reescalada al video, o None (no se filtra nada)
        self.carriles = {}      # {nombre: polígono} de las zonas lane*/carril*
        self.recorte = None     # Recorte que ve el modelo, o None (frame completo)
        self.origen = "ninguna"
        self._pendiente = None
        self._lock = threading.Lock()

    # ---- cargar ----
    def usar(self, archivo, origen):
        """Aplica ya unas zonas ({'image_size', 'zones'} como zones.json). Solo desde el hilo que procesa (o antes de empezar)."""
        zonas = Zones(archivo["zones"], archivo.get("image_size")).fit_to(self.ancho, self.alto)
        self.zonas = zonas
        # _polys ya viene reescalado al tamaño real del video
        self.carriles = {z["name"]: p for z, p in zip(zonas.zones, zonas._polys)
                         if z["name"].lower().startswith(PREFIJOS_CARRIL)}
        self.recorte = None if self.sin_recorte else Recorte(zonas, self.ancho, self.alto, margen=self.margen_recorte)
        self.origen = origen
        self.log(f"Zonas ({origen}): {len(zonas.zones)} | carriles para identidades: {list(self.carriles)}")
        if self.recorte:
            self.log(f"Recorte: {self.recorte.caja} -> el modelo ve el {self.recorte.fraccion_area:.0%} del frame")

    def cargar_archivo(self, ruta):
        with open(ruta, encoding="utf-8") as f:
            self.usar(json.load(f), f"archivo {ruta}")

    # ---- cambiar desde otro hilo ----
    def proponer(self, archivo, origen):
        """Deja unas zonas nuevas para que el hilo de inferencia las aplique antes del próximo frame."""
        if not archivo or not archivo.get("zones"):
            return
        with self._lock:
            self._pendiente = (archivo, origen)

    def aplicar_pendiente(self):
        """True si había zonas nuevas y se aplicaron (entonces hay que avisarle al gestor de identidades)."""
        with self._lock:
            pendiente, self._pendiente = self._pendiente, None
        if pendiente is None:
            return False
        archivo, origen = pendiente
        try:
            self.usar(archivo, origen)
        except Exception as e:  # noqa: BLE001 - unas zonas rotas no deben tirar abajo el pipeline
            self.log(f"AVISO: no pude usar las zonas de {origen} ({e}); sigo con las de {self.origen}")
            return False
        return True
