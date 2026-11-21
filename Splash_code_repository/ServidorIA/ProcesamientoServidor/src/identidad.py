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
    de mayor confianza. Excepción: si la caja más cercana lleva rato QUIETA (la misma posición varios segundos) y hay en
    el mismo carril otra que NO está quieta y está cerca (hasta 3 diagonales), se elige la que no está quieta (el nadador que sale de la pared deja atrás
    espuma o un reflejo que se queda detectado: sin esta excepción la identidad se quedaría pegada a esa caja). La quietud
    se mide por POSICIÓN, no por el ID de ByteTrack: un nadador que parpadea y cambia de ID no pierde su historia. Un
    "salto" de una sola caja lejos de lo esperado lo filtra después Trayectorias.
  * RUMBO: nadie da media vuelta en el medio de la piscina; solo se da la vuelta en las paredes. Se estima hacia dónde
    avanza el nadador a lo largo del carril, y una caja que quedaría DETRÁS de él (en el sentido contrario a su marcha,
    por más de `rumbo_margen_diag` diagonales) se ignora mientras se lo haya visto hace menos de `rumbo_s`. Así un reflejo
    o espuma fija en la pared lejana no le quita el carril cuando él ya viene de vuelta. Cerca de cualquiera de las dos
    paredes (`extremo_frac` del largo del carril) el rumbo se olvida y no se ignora nada: ahí se da la vuelta. Si pasan
    `rumbo_s` segundos sin una caja aceptable se suelta la regla (por si alguien sí dio media vuelta).
  * ALCANCE: mientras se le conoce un rumbo (o sea, se ha visto avanzar por el carril) y hasta `rumbo_s` desde la última vez
    que se lo vio moviéndose, una caja a más distancia de la que pudo recorrer (el mismo radio del
    re-enlace: diagonales de caja que crecen con el tiempo sin verlo) tampoco se acepta: un reflejo fijo DELANTE de él
    (en la ida) no le roba la identidad cuando lo pierden dos frames. Si lleva más de `rumbo_s` sin moverse (descansando) no
    hay alcance: puede salir de la pared por cualquier lado. Y si la identidad lleva más de `quieta_larga_s` sobre una caja
    quieta, cualquier caja que se mueva en el carril le gana (la identidad pudo quedar pegada a un reflejo desde el arranque).

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
    __slots__ = ("centro", "diag", "t_ultimo", "vel", "carril", "frames", "quieta", "quieta_desde", "movil")

    def __init__(self, centro, diag, t, carril):
        self.centro = centro
        self.diag = diag
        self.t_ultimo = t
        self.vel = np.zeros(2)
        self.carril = carril
        self.frames = 1
        self.quieta_desde = None   # desde cuándo la caja aceptada está quieta (None si se mueve)
        self.movil = None          # (centro, t, diag, vel) de la última caja aceptada que NO estaba quieta: donde estaba el nadador moviéndose
        self.quieta = False     # la caja aceptada en el último frame estaba quieta (reflejo, espuma o nadador descansando)


def _iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


class GestorIdentidades:
    def __init__(self, carriles=None, max_hueco_s=20.0, max_por_carril=1,
                 iou_duplicado=0.5, gate_base=1.5, gate_por_s=2.0, un_nadador_por_carril=True, reanclar_s=3.0,
                 quieta_s=2.0, radio_quieta=0.35, usar_rumbo=True, rumbo_s=6.0, rumbo_ventana_s=3.0,
                 rumbo_min_diag=0.8, rumbo_margen_diag=1.5, extremo_frac=0.10, quieta_larga_s=3.0):
        """
        carriles        {nombre: [[x, y], ...]} polígonos de cada carril, o None.
        max_hueco_s     segundos máximos que una identidad perdida sigue "viva" para ser recuperada.
        max_por_carril  nadadores simultáneos esperados por carril.
        iou_duplicado   dos cajas del mismo carril que se solapan más que esto son el mismo nadador.
        gate_base/_por_s  radio de búsqueda para re-enlazar (en diagonales de caja; crece con el tiempo perdido).
        un_nadador_por_carril  la identidad es el carril (ver arriba). Solo rige con carriles definidos y max_por_carril == 1.
        reanclar_s      si hace más que esto que no se ve al nadador de un carril, no se usa su posición para elegir entre cajas.
        quieta_s        una caja que sigue en la misma posición (dentro de `radio_quieta` diagonales de caja) más de estos
                        segundos está "quieta": espuma, un reflejo, o un nadador descansando.
        radio_quieta    radio (en diagonales de caja) de "la misma posición"; cubre el temblor de la caja.
        usar_rumbo      ignora cajas que quedan detrás del nadador respecto a su sentido de marcha (ver arriba).
        rumbo_s         segundos máximos sin ver al nadador durante los que se sigue aplicando la regla del rumbo.
        rumbo_ventana_s ventana (s) sobre la que se mide hacia dónde avanza.
        rumbo_min_diag  cuánto tiene que haberse movido a lo largo del carril en la ventana (en diagonales de caja) para decir
                        que tiene un rumbo; menos que eso = quieto, sin rumbo.
        rumbo_margen_diag  una caja detrás del nadador por menos de esto (en diagonales) no cuenta como "detrás" (temblor).
        quieta_larga_s  si la identidad lleva más de esto sobre una caja quieta, cualquier caja que se mueva en el carril le gana.
        extremo_frac    fracción del largo del carril, en cada punta, donde se da la vuelta (el rumbo se olvida y no se ignora nada).
        """
        self.carriles = {n: np.array(p, dtype=np.float32) for n, p in (carriles or {}).items()}
        self._calcular_ejes()
        self.max_hueco_s = max_hueco_s
        self.max_por_carril = max_por_carril
        self.iou_duplicado = iou_duplicado
        self.gate_base = gate_base
        self.gate_por_s = gate_por_s
        self.un_nadador_por_carril = un_nadador_por_carril
        self.reanclar_s = reanclar_s

        self.quieta_s, self.radio_quieta = quieta_s, radio_quieta
        self.quieta_larga_s = quieta_larga_s
        self.usar_rumbo, self.rumbo_s, self.rumbo_ventana_s = usar_rumbo, rumbo_s, rumbo_ventana_s
        self.rumbo_min_diag, self.rumbo_margen_diag, self.extremo_frac = rumbo_min_diag, rumbo_margen_diag, extremo_frac
        self._hist = {}            # carril -> [(t, s)] posiciones aceptadas de la ventana, para estimar el rumbo
        self._se_movio = set()     # carriles donde ya se vio avanzar al nadador (tiene rumbo conocido alguna vez)
        self._rumbo = {}           # carril -> +1 / -1 / 0 (sin rumbo)
        self.contra_rumbo = 0      # cajas ignoradas por estar detrás del nadador
        self._anclas = {}          # carril -> [[cx, cy, t_primera, t_ultima]]: posiciones donde se vio una caja (modo por carril)
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
        self._anclas.clear()
        self._hist.clear()
        self._rumbo.clear()
        self._se_movio.clear()
        self._calcular_ejes()

    @property
    def _modo_carril(self):
        return self.un_nadador_por_carril and self.max_por_carril == 1 and bool(self.carriles)

    # ---- utilidades ----
    def _calcular_ejes(self):
        """Eje largo de cada carril (componente principal de sus vértices) y hasta dónde llega a cada lado."""
        self._ejes = {}
        for n, poly in self.carriles.items():
            pts = np.asarray(poly, dtype=float).reshape(-1, 2)
            if len(pts) < 3:
                continue
            c = pts.mean(axis=0)
            _, vec = np.linalg.eigh(np.cov((pts - c).T))
            eje = vec[:, -1]
            s = (pts - c) @ eje
            self._ejes[n] = (c, eje, float(s.min()), float(s.max()))

    def _s(self, carril, centro):
        """Posición a lo largo del carril (px) y si está en una de las puntas, o None si el carril no tiene eje."""
        d = self._ejes.get(carril)
        if d is None:
            return None, False
        c, eje, smin, smax = d
        s = float((np.asarray(centro, dtype=float) - c) @ eje)
        borde = self.extremo_frac * (smax - smin)
        return s, (s <= smin + borde or s >= smax - borde)

    def _detras(self, carril, ref, diag_ref, centro_caja, diag_caja):
        """True si la caja queda detrás del nadador (de su sentido de marcha) y hay que ignorarla."""
        rumbo = self._rumbo.get(carril, 0)
        if rumbo == 0:
            return False
        s_ref, _ = self._s(carril, ref)
        s_c, _ = self._s(carril, centro_caja)
        if s_ref is None or s_c is None:
            return False
        return (s_c - s_ref) * rumbo < -self.rumbo_margen_diag * max(diag_caja, diag_ref)

    def _actualizar_rumbo(self, carril, centro, diag, t):
        """Con la posición aceptada de este frame: en una punta se olvida el rumbo; en el medio se estima hacia dónde va."""
        s, punta = self._s(carril, centro)
        if s is None:
            return
        hist = self._hist.setdefault(carril, [])
        if punta:
            hist.clear()
            self._rumbo[carril] = 0
            return
        hist.append((t, s))
        while hist and t - hist[0][0] > self.rumbo_ventana_s:
            hist.pop(0)
        if len(hist) >= 4 and hist[-1][0] - hist[0][0] >= 0.5 * self.rumbo_ventana_s:
            k = max(1, len(hist) // 3)
            antes = sum(h[1] for h in hist[:k]) / k
            ahora = sum(h[1] for h in hist[-k:]) / k
            if abs(ahora - antes) >= self.rumbo_min_diag * diag:
                self._rumbo[carril] = 1 if ahora > antes else -1
                self._se_movio.add(carril)

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
    def _quieta(self, carril, centro, diag, t):
        """True si hay una caja en esta posición desde hace más de `quieta_s` (se mide por posición, no por ID)."""
        anclas = self._anclas.setdefault(carril, [])
        radio = max(8.0, self.radio_quieta * diag)
        for a in anclas:
            if t - a[3] <= 2.0 and math.hypot(centro[0] - a[0], centro[1] - a[1]) <= radio:
                a[3] = t
                return t - a[2] >= self.quieta_s
        anclas.append([float(centro[0]), float(centro[1]), t, t])
        return False

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
            diag = math.hypot(fila[2] - fila[0], fila[3] - fila[1])
            por_carril.setdefault(carril, []).append((fila, centro, self._quieta(carril, centro, diag, t)))

        salida = []
        for carril, cajas in por_carril.items():
            sid = self._sid_de_carril.get(carril)
            e = self.estados.get(sid) if sid is not None else None
            mv = e.movil if (self.usar_rumbo and e is not None) else None
            if mv is not None and t - mv[1] <= self.rumbo_s:
                # el nadador se estaba moviendo hace poco: se ignoran las cajas detrás de él y las fuera de su alcance, aunque
                # estén quietas (un reflejo que aparece solo cuando lo pierden no le quita la identidad)
                dt_m = max(t - mv[1], 1e-3)
                esp = mv[0] + mv[3] * min(dt_m, 1.0)
                puerta = mv[2] * (self.gate_base + self.gate_por_s * min(dt_m, 3.0))

                def _ok(c):
                    diag_c = math.hypot(c[0][2] - c[0][0], c[0][3] - c[0][1])
                    if self._detras(carril, mv[0], mv[2], c[1], diag_c):
                        return False
                    return float(np.linalg.norm(c[1] - esp)) <= max(puerta, 2.0 * diag_c)
                buenas = [c for c in cajas if _ok(c)]
                self.contra_rumbo += len(cajas) - len(buenas)
                if not buenas:
                    continue                  # solo hay cajas descartadas: el nadador queda sin detectar este frame (Trayectorias lo estima)
                cajas = buenas
            if e is not None and t - e.t_ultimo <= self.reanclar_s:
                dt = max(t - e.t_ultimo, 1e-3)
                esperado = e.centro + e.vel * min(dt, 1.0)
                dist = lambda c: float(np.linalg.norm(c[1] - esperado))
                # una caja que no está quieta le gana a una quieta, pero solo si está cerca de donde se esperaba al nadador (el
                # que sale de la pared arranca pegado a ella): una caja nueva lejos no le quita el carril a un nadador que descansa
                # (si la identidad lleva mucho quieta, `quieta_larga_s`, vale cualquier caja que se mueva del carril: el nadador pudo
                # salir de la pared mientras la identidad seguía pegada a un reflejo)
                espera = self.quieta_larga_s if self._rumbo.get(carril, 0) or carril in self._se_movio else 0.5   # una identidad que nunca se movió no es un nadador: más rápido
                larga = e.quieta_desde is not None and t - e.quieta_desde >= espera
                libres = [c for c in cajas if not c[2] and (larga or dist(c) <= 3.0 * math.hypot(c[0][2] - c[0][0], c[0][3] - c[0][1]))]
                fila, centro, quieta = min(libres or cajas, key=dist)
            else:
                libres = [c for c in cajas if not c[2]]
                fila, centro, quieta = max(libres or cajas, key=lambda c: float(c[0][5]))     # sin posición confiable: la más segura
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
            e.quieta = bool(quieta)
            if quieta:
                if e.quieta_desde is None:
                    e.quieta_desde = t
            else:
                e.quieta_desde = None
                e.movil = (centro, t, diag, e.vel.copy())
            if self.usar_rumbo:
                self._actualizar_rumbo(carril, centro, diag, t)
            salida.append([x1, y1, x2, y2, sid, conf, cls])
        for carril, anclas in self._anclas.items():
            anclas[:] = [a for a in anclas if t - a[3] <= 2.0]
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
                "fuera_de_carril": self.fuera_de_carril, "contra_rumbo": self.contra_rumbo}
