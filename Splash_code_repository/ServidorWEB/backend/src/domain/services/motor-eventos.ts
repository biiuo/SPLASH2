/**
 * Motor de eventos: convierte la trayectoria de cada nadador (en metros) en cruces de marca, virajes, tramos con
 * su velocidad y cambios NADANDO / DESCANSANDO.
 *  - Todo el tiempo es el de CAPTURA del frame (ms), nunca el de procesamiento.
 *  - El instante de un cruce se interpola entre dos muestras y se confirma al alejarse `histeresis_m` de la marca.
 *  - Los extremos (0 y largo) cuentan como llegada a la pared a `margen_extremo_m` de ella, o donde diga la calibración
 *    (`llegada_inicio_m` / `llegada_fin_m`) si la cámara no ve hasta la pared.
 *  - Un evento es `observado: false` (inferido) si ocurrió en un hueco de muestras o con una posición estimada.
 */

export type TipoEventoDetectado = 'cruce_nodo' | 'viraje' | 'inicio_descanso' | 'fin_descanso'

export interface Muestra {
  carril: number
  /** Identidad estable del nadador (la que da el gestor de identidades, no el ID crudo de ByteTrack). */
  identidad: number
  /** Instante de captura del frame, en milisegundos. */
  t: number
  /** Posición a lo largo de la piscina, en metros. */
  x_m: number
  /** Posición a lo ancho, en metros. */
  y_m: number
  /** true si la posición se mantuvo o extrapoló porque el nadador no se detectó en ese instante. */
  estimada?: boolean
}

export interface EventoDetectado {
  carril: number
  identidad: number
  tipo: TipoEventoDetectado
  nodo_m: number | null
  t: number
  observado: boolean
}

export interface TramoDetectado {
  carril: number
  identidad: number
  nodo_desde_m: number
  nodo_hasta_m: number
  t_inicio: number
  t_fin: number
  distancia_m: number
  velocidad_ms: number
  observado: boolean
}

export interface ResultadoMotor {
  eventos: EventoDetectado[]
  tramos: TramoDetectado[]
}

export interface ResumenNadador {
  estado: 'nadando' | 'descansando'
  largos: number
  distancia_m: number
  descanso_s: number
}

export interface ConfigMotor {
  /** Marcas de la piscina, en metros: [0, 5, 10, 15, 20, 25]. */
  nodos: number[]
  /** Cuánto se tiene que alejar de una marca para confirmar que la cruzó. */
  histeresis_m: number
  /** A cuántos metros de la pared se considera que llegó. */
  margen_extremo_m: number
  /**
   * Dónde se cuenta la llegada a cada pared (en metros desde la pared de salida), si la cámara no ve hasta la pared:
   * por ejemplo, con la pared de salida tapada por la baranda, la llegada se cuenta en el último lugar donde se ve al
   * nadador (2 m) y ahí se marca el viraje y el largo. Si no se indica, `margen_extremo_m` de cada pared.
   */
  llegada_inicio_m?: number | null
  llegada_fin_m?: number | null
  /** Más tiempo que este entre dos muestras = hueco: lo que pasó adentro es inferido. */
  hueco_max_s: number
  /** Por debajo de esta velocidad se considera que descansa. */
  velocidad_minima_ms: number
  /** Ventana sobre la que se mide la velocidad instantánea. */
  ventana_velocidad_s: number
  /** Cuánto tiene que sostenerse la condición para cambiar de estado. */
  ventana_confirmacion_s: number
}

export const CONFIG_MOTOR_POR_DEFECTO: ConfigMotor = {
  nodos: [0, 5, 10, 15, 20, 25],
  histeresis_m: 0.3,
  margen_extremo_m: 0.4,
  hueco_max_s: 1.5,
  velocidad_minima_ms: 0.2,
  ventana_velocidad_s: 1.5,
  ventana_confirmacion_s: 3,
}

interface Umbral {
  /** Posición del umbral en metros (en los extremos está corrida hacia adentro `margen_extremo_m`). */
  x: number
  /** La marca que representa. */
  nodo: number
  extremo: boolean
  /** Solo extremos: el lado donde está la pared (-1 para el 0, +1 para el largo). */
  pared: -1 | 1
  /** Solo extremos: metros entre la línea de llegada y la pared que la cámara no ve (0 = se ve hasta la pared). */
  oculto: number
}

interface EstadoUmbral {
  /** Lado confirmado (0 = todavía no se sabe). */
  lado: -1 | 0 | 1
  /** Lado de la última muestra. */
  ladoCrudo: -1 | 1
  /** Instante del último cambio de lado crudo (interpolado) y si fue observado. */
  tCruce?: number
  obsCruce?: boolean
  /** Solo extremos: llegó desde afuera (no empezó pegado a la pared) y el punto más cercano a la pared. */
  llego: boolean
  xExtremo: number
  tExtremo: number
  /** Solo extremos con tramo oculto: instante (estimado) en que llegó a la pared. */
  tLlegada?: number
}

interface Paso {
  nodo: number
  t: number
  observado: boolean
}

interface EstadoNadador {
  ultima?: Muestra
  umbrales: Map<number, EstadoUmbral>
  paso: Paso | null
  /** Pared de la que salió por última vez (para contar largos completos). */
  partida: number | null
  largos: number
  distancia_m: number
  ventana: Muestra[]
  estado: 'nadando' | 'descansando'
  candidato: { estado: 'nadando' | 'descansando'; desde: number } | null
  descanso_ms: number
  inicioDescanso: number | null
}

const lado = (v: number): -1 | 1 => (v >= 0 ? 1 : -1)

export class MotorEventos {
  readonly config: ConfigMotor
  private readonly umbrales: Umbral[]
  private readonly nadadores = new Map<string, EstadoNadador>()

  constructor(config: Partial<ConfigMotor> = {}) {
    this.config = { ...CONFIG_MOTOR_POR_DEFECTO, ...config }
    const nodos = [...this.config.nodos].sort((a, b) => a - b)
    if (nodos.length < 2) throw new Error('El motor necesita al menos dos marcas')
    const primero = nodos[0]
    const ultimo = nodos[nodos.length - 1]
    // la llegada no puede pasar la marca siguiente (dejando lugar para la histéresis), ni quedar fuera de la piscina
    const h = this.config.histeresis_m
    const xInicio = Math.min(Math.max(this.config.llegada_inicio_m ?? primero + this.config.margen_extremo_m, primero), nodos[1] - 2 * h)
    const xFin = Math.max(Math.min(this.config.llegada_fin_m ?? ultimo - this.config.margen_extremo_m, ultimo), nodos[nodos.length - 2] + 2 * h)
    // tramo que la cámara no ve: entre la línea de llegada y donde se contaría la llegada si se viera la pared
    const m = this.config.margen_extremo_m
    const oculto = (x: number) => (x > 1e-6 ? x : 0)
    this.umbrales = nodos.map((nodo) => {
      if (nodo === primero) return { x: xInicio, nodo, extremo: true, pared: -1, oculto: oculto(xInicio - (primero + m)) }
      if (nodo === ultimo) return { x: xFin, nodo, extremo: true, pared: 1, oculto: oculto(ultimo - m - xFin) }
      return { x: nodo, nodo, extremo: false, pared: 1, oculto: 0 }
    })
  }

  /** Velocidad a lo largo (m/s) del nadador en lo último que se vio, o null si casi no se movió. */
  private velocidadX(e: EstadoNadador, previa: Muestra, m: Muestra): number | null {
    const desde = e.ventana.length > 0 && m.t - e.ventana[0].t > 300 ? e.ventana[0] : previa
    const dt = (m.t - desde.t) / 1000
    const v = dt > 0 ? Math.abs(m.x_m - desde.x_m) / dt : 0
    return v >= this.config.velocidad_minima_ms ? v : null
  }

  /** Procesa una muestra y devuelve lo que se detectó con ella. Las muestras de un nadador deben llegar en orden. */
  procesar(m: Muestra): ResultadoMotor {
    const salida: ResultadoMotor = { eventos: [], tramos: [] }
    const e = this.estadoDe(m)
    const previa = e.ultima
    if (previa && m.t <= previa.t) return salida // repetida o fuera de orden: se ignora

    if (previa) this.cruces(e, previa, m, salida)
    else this.iniciar(e, m)

    if (!m.estimada) this.descanso(e, m, salida)
    e.ultima = m
    return salida
  }

  /** Procesa varias muestras (de cualquier nadador) en orden de tiempo. */
  procesarLote(muestras: Muestra[]): ResultadoMotor {
    const total: ResultadoMotor = { eventos: [], tramos: [] }
    for (const m of [...muestras].sort((a, b) => a.t - b.t)) {
      const r = this.procesar(m)
      total.eventos.push(...r.eventos)
      total.tramos.push(...r.tramos)
    }
    return total
  }

  resumen(carril: number, identidad: number): ResumenNadador | undefined {
    const e = this.nadadores.get(clave(carril, identidad))
    if (!e) return undefined
    return { estado: e.estado, largos: e.largos, distancia_m: e.distancia_m, descanso_s: e.descanso_ms / 1000 }
  }

  // ------------------------------------------------------------------------------------------------

  private estadoDe(m: Muestra): EstadoNadador {
    const k = clave(m.carril, m.identidad)
    let e = this.nadadores.get(k)
    if (!e) {
      e = {
        umbrales: new Map(),
        paso: null,
        partida: null,
        largos: 0,
        distancia_m: 0,
        ventana: [],
        estado: 'nadando',
        candidato: null,
        descanso_ms: 0,
        inicioDescanso: null,
      }
      this.nadadores.set(k, e)
    }
    return e
  }

  private iniciar(e: EstadoNadador, m: Muestra): void {
    for (const u of this.umbrales) {
      const s = lado(m.x_m - u.x)
      const lejos = Math.abs(m.x_m - u.x) >= this.config.histeresis_m || (u.extremo && s === u.pared)
      e.umbrales.set(u.nodo, {
        lado: lejos ? s : 0,
        ladoCrudo: s,
        llego: false,
        xExtremo: m.x_m,
        tExtremo: m.t,
      })
    }
  }

  private cruces(e: EstadoNadador, previa: Muestra, m: Muestra, salida: ResultadoMotor): void {
    const huecoMs = this.config.hueco_max_s * 1000
    const enHueco = m.t - previa.t > huecoMs
    const sinVer = enHueco || !!previa.estimada || !!m.estimada
    const pendientes: EventoDetectado[] = []

    for (const u of this.umbrales) {
      const st = e.umbrales.get(u.nodo)!
      const s = lado(m.x_m - u.x)

      if (s !== st.ladoCrudo) {
        const f = (u.x - previa.x_m) / (m.x_m - previa.x_m)
        st.tCruce = previa.t + f * (m.t - previa.t)
        st.obsCruce = !sinVer
        st.ladoCrudo = s
      }

      // En los extremos, mientras está del lado de la pared se guarda su punto más cercano a ella.
      if (u.extremo && st.lado === u.pared) {
        if ((m.x_m - st.xExtremo) * u.pared > 0) {
          st.xExtremo = m.x_m
          st.tExtremo = m.t
        }
      }

      // Se confirma al alejarse `histeresis_m` de la marca. La llegada a la pared se confirma al cruzar el umbral:
      // detrás de la pared no hay nada, y el centro del nadador casi nunca llega a pegarse a ella.
      const confirmado = Math.abs(m.x_m - u.x) >= this.config.histeresis_m || (u.extremo && s === u.pared)
      if (!confirmado || s === st.lado) continue

      const antes = st.lado
      st.lado = s
      const tc = st.tCruce ?? m.t
      const obs = st.obsCruce ?? !sinVer
      st.tCruce = undefined
      st.obsCruce = undefined
      if (antes === 0) continue // primera vez que se ve de qué lado está: no es un cruce

      if (!u.extremo) {
        pendientes.push(this.evento(m, 'cruce_nodo', u.nodo, tc, obs))
      } else if (s === u.pared) {
        // llegó a la pared
        st.llego = true
        st.xExtremo = m.x_m
        st.tExtremo = m.t
        let t = tc
        let o = obs
        if (u.oculto > 0) {
          // cruzó la línea de llegada pero la pared está más allá, donde no se ve: se estima cuándo la alcanza con
          // su velocidad, y queda como inferido
          const v = this.velocidadX(e, previa, m)
          if (v) t = tc + (u.oculto / v) * 1000
          o = false
        }
        st.tLlegada = t
        pendientes.push(this.evento(m, 'cruce_nodo', u.nodo, t, o))
      } else {
        // se alejó de la pared. Si había llegado, es un viraje y su instante es el punto más cercano a ella.
        // Si empezó pegado a la pared es una salida: no es un evento, solo marca de dónde parte el tramo.
        if (st.llego) {
          let t = st.tExtremo
          let o = obs
          if (u.oculto > 0) {
            // el viraje pasó donde no se ve: se estima cuándo dejó la pared (antes de volver a cruzar la línea)
            const dt = (m.t - previa.t) / 1000
            const v = dt > 0 ? Math.abs(m.x_m - previa.x_m) / dt : 0
            const llegada = st.tLlegada ?? st.tExtremo
            t = v >= this.config.velocidad_minima_ms ? tc - (u.oculto / v) * 1000 : (llegada + tc) / 2
            t = Math.min(Math.max(t, llegada), tc)
            o = false
          }
          pendientes.push(this.evento(m, 'viraje', u.nodo, t, o))
        } else if (u.oculto > 0) {
          // salió de la pared donde no se ve: se estima cuándo, con la velocidad con que aparece
          const dt = (m.t - previa.t) / 1000
          const v = dt > 0 ? Math.abs(m.x_m - previa.x_m) / dt : 0
          e.paso = { nodo: u.nodo, t: v >= this.config.velocidad_minima_ms ? tc - (u.oculto / v) * 1000 : tc, observado: false }
        } else e.paso = { nodo: u.nodo, t: tc, observado: obs }
        e.partida = u.nodo
        st.llego = false
      }
    }

    pendientes.sort((a, b) => a.t - b.t)
    for (const ev of pendientes) this.aplicar(e, ev, salida)
  }

  /** Registra el evento y, si cierra un tramo, lo calcula. */
  private aplicar(e: EstadoNadador, ev: EventoDetectado, salida: ResultadoMotor): void {
    salida.eventos.push(ev)
    const nodo = ev.nodo_m as number
    const esExtremo = this.umbrales.find((u) => u.nodo === nodo)?.extremo ?? false

    const paso = e.paso
    if (ev.tipo === 'cruce_nodo' || ev.tipo === 'viraje') {
      // el viraje solo mueve el punto de partida del próximo tramo: el tramo se cierra con un cruce
      if (paso && paso.nodo !== nodo && ev.tipo === 'cruce_nodo') {
        const distancia = Math.abs(nodo - paso.nodo)
        const dt = (ev.t - paso.t) / 1000
        if (dt > 0) {
          salida.tramos.push({
            carril: ev.carril,
            identidad: ev.identidad,
            nodo_desde_m: paso.nodo,
            nodo_hasta_m: nodo,
            t_inicio: paso.t,
            t_fin: ev.t,
            distancia_m: distancia,
            velocidad_ms: distancia / dt,
            observado: ev.observado && paso.observado,
          })
          e.distancia_m += distancia
        }
        // largo completo: llegó a la pared opuesta a la que salió
        if (esExtremo && e.partida !== null && e.partida !== nodo) {
          e.largos += 1
          e.partida = null
        }
      }
      e.paso = { nodo, t: ev.t, observado: ev.observado }
    }
  }

  private evento(m: Muestra, tipo: TipoEventoDetectado, nodo: number | null, t: number, observado: boolean): EventoDetectado {
    return { carril: m.carril, identidad: m.identidad, tipo, nodo_m: nodo, t, observado }
  }

  // ---- NADANDO / DESCANSANDO ---------------------------------------------------------------------

  private descanso(e: EstadoNadador, m: Muestra, salida: ResultadoMotor): void {
    const ventanaMs = this.config.ventana_velocidad_s * 1000
    e.ventana.push(m)
    while (e.ventana.length > 1 && m.t - e.ventana[0].t > ventanaMs) e.ventana.shift()

    const primera = e.ventana[0]
    const span = m.t - primera.t
    if (span < ventanaMs * 0.5) return // todavía no alcanza para medir velocidad

    const v = Math.hypot(m.x_m - primera.x_m, m.y_m - primera.y_m) / (span / 1000)
    const condicion: 'nadando' | 'descansando' = v < this.config.velocidad_minima_ms ? 'descansando' : 'nadando'

    if (condicion === e.estado) {
      e.candidato = null
      return
    }
    if (!e.candidato || e.candidato.estado !== condicion) e.candidato = { estado: condicion, desde: m.t }
    if (m.t - e.candidato.desde < this.config.ventana_confirmacion_s * 1000) return

    const desde = e.candidato.desde
    e.estado = condicion
    e.candidato = null
    const obs = !m.estimada
    if (condicion === 'descansando') {
      e.inicioDescanso = desde
      salida.eventos.push(this.evento(m, 'inicio_descanso', null, desde, obs))
    } else {
      if (e.inicioDescanso !== null) e.descanso_ms += desde - e.inicioDescanso
      e.inicioDescanso = null
      salida.eventos.push(this.evento(m, 'fin_descanso', null, desde, obs))
    }
  }
}

function clave(carril: number, identidad: number): string {
  return `${carril}:${identidad}`
}
