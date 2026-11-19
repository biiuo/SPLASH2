"""
Splash - trayectoria de cada nadador, a un ritmo fijo

Después de GestorIdentidades hay una identidad estable por nadador. Este módulo convierte lo que el modelo
detecta (irregular: a veces 10 veces por segundo, a veces ninguna) en una posición por nadador a un ritmo FIJO
(3 por segundo por defecto):

  * si en ese instante el nadador se detectó, se usa su posición medida;
  * si no se detectó (banderines, salpicaduras, un frame descartado), la identidad NO desaparece: se le asigna una
    posición ESTIMADA y se marca como tal. Se extrapola con su última velocidad hasta `extrapolar_max_s`; pasado ese
    tiempo se mantiene la última posición. Se deja de estimar cuando la identidad lleva `max_estimado_s` perdida.

La posición estimada nunca se hace pasar por medida: el backend la marca como `observado: false` en los eventos que
dependen de ella y no la usa para decidir si el nadador está descansando.

Filtro de saltos: a veces la identidad "salta" por 1-2 muestras a una detección falsa (los banderines del fondo) o a
otra persona del carril y vuelve. Para el backend eso es cruzar varios nodos en una fracción de segundo (3-5 m/s). Una
detección que queda más lejos de la última aceptada que `salto_margen_px + salto_max_px_s * segundos_desde_ella` se
trata como "no detectado" (posición estimada). Si la identidad SIGUE en el sitio nuevo durante `salto_confirmar_s`, el
salto era real y se acepta.

Todo se mide con el tiempo de captura de los frames (segundos), igual que el resto del pipeline.
"""
import re

import numpy as np


def numero_de_carril(nombre):
    """'lane5' o 'carril_5' -> 5. None si el nombre no tiene número (o no hay carril)."""
    if not nombre:
        return None
    m = re.search(r"(\d+)\D*$", str(nombre))
    return int(m.group(1)) if m else None


class Trayectorias:
    def __init__(self, hz=3.0, extrapolar_max_s=1.5, max_estimado_s=20.0,
                 salto_max_px_s=120.0, salto_margen_px=60.0, salto_confirmar_s=1.5):
        if hz <= 0:
            raise ValueError("hz debe ser mayor que 0")
        self.periodo = 1.0 / hz
        self.extrapolar_max_s = extrapolar_max_s
        self.max_estimado_s = max_estimado_s
        self.salto_max_px_s = salto_max_px_s      # <= 0 apaga el filtro de saltos
        self.salto_margen_px = salto_margen_px
        self.salto_confirmar_s = salto_confirmar_s
        self._ultimo = {}      # identidad -> (centro, t, velocidad) de la última detección aceptada
        self._proximo = {}     # identidad -> instante del próximo tick de emisión
        self._salto = {}       # identidad -> (centro, t) de la primera detección "lejos" que todavía no se acepta
        self.sin_carril = 0    # identidades que no se pudieron enviar por no tener carril
        self.saltos_descartados = 0   # detecciones tratadas como "no detectado" por el filtro de saltos
        self.saltos_confirmados = 0   # saltos que se mantuvieron y se aceptaron

    def _lejos(self, a, b, dt):
        return np.linalg.norm(a - b) > self.salto_margen_px + self.salto_max_px_s * max(dt, 0.0)

    def _filtrar_salto(self, sid, centro, t):
        """True si la detección se acepta. Las lejanas se aceptan solo si se mantienen `salto_confirmar_s`."""
        if self.salto_max_px_s <= 0 or sid not in self._ultimo:
            return True
        previo, t_prev, _ = self._ultimo[sid]
        if not self._lejos(centro, previo, t - t_prev):
            self._salto.pop(sid, None)
            return True
        pend = self._salto.get(sid)
        if pend is None or self._lejos(centro, pend[0], t - pend[1]):
            self._salto[sid] = (centro, t)            # empieza (o cambia de sitio) un salto candidato
            pend = self._salto[sid]
        else:
            self._salto[sid] = (centro, pend[1])      # sigue ahí: se actualiza la posición, no el inicio
        if t - pend[1] >= self.salto_confirmar_s:
            self._salto.pop(sid, None)
            self.saltos_confirmados += 1
            return True
        self.saltos_descartados += 1
        return False

    def procesar(self, estables, gestor, t):
        """Muestras a emitir en el instante t: [{'carril', 'identidad', 't', 'px': [x, y], 'estimada'}]."""
        estables = np.asarray(estables, dtype=float).reshape(-1, 7) if len(estables) else np.empty((0, 7))
        detectados = {int(f[4]): np.array([(f[0] + f[2]) / 2, (f[1] + f[3]) / 2]) for f in estables}
        detectados = {sid: c for sid, c in detectados.items() if self._filtrar_salto(sid, c, t)}

        salida = []
        for sid, estado in gestor.estados.items():
            if sid in detectados:
                self._ultimo[sid] = (detectados[sid], t, np.array(estado.vel, dtype=float))
            if sid not in self._ultimo:
                continue
            # ticks fijos (no "un periodo desde la última"): con frames cada 0,1 s y 3 Hz esto da 3 por segundo, no 2,5
            if t < self._proximo.get(sid, -1e18) - 1e-6:
                continue

            carril = numero_de_carril(estado.carril)
            if carril is None:
                self.sin_carril += 1
                continue

            centro, t_det, vel = self._ultimo[sid]
            if sid in detectados:
                pos, estimada = centro, False
            else:
                perdido = t - t_det
                if perdido > self.max_estimado_s:
                    continue
                pos, estimada = centro + vel * min(perdido, self.extrapolar_max_s), True

            tick = self._proximo.get(sid, t)
            tick += self.periodo
            self._proximo[sid] = tick if tick > t - self.periodo else t + self.periodo   # sin ráfagas tras un corte
            salida.append({"carril": carril, "identidad": int(sid), "t": t,
                           "px": [round(float(pos[0]), 1), round(float(pos[1]), 1)], "estimada": estimada})
        return salida
