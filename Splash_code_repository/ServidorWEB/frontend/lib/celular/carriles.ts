// Del modelo a las posiciones que se mandan al backend, por carril. Es la versión para el celular de lo que en el
// servidor hacen identidad.py y trayectoria.py:
//   * un nadador por carril: de las cajas cuyo centro cae en el carril se queda una;
//   * PREDICCIÓN (lo que más aporta de ByteTrack con un nadador por carril): se calcula dónde debería estar el nadador
//     según su última posición y su velocidad, y solo se aceptan cajas cerca de ahí. Así un brazo del carril de al
//     lado, una salpicadura o alguien en el borde no lo hacen "saltar". De las cercanas, la más cercana a la predicción.
//     Si algo lejos aparece RECAPTURAR_CUADROS veces seguidas sin que haya nada cerca, se acepta: era el nadador (por
//     ejemplo, se lo había confundido al empezar). Si el nadador lleva más de RECAPTURAR_S sin verse, se acepta la caja
//     más confiable del carril, esté donde esté;
//   * una posición por carril a ritmo FIJO (3 por segundo): medida si se detectó en ese instante, y si no, ESTIMADA
//     (se extrapola con su velocidad hasta EXTRAPOLAR_MAX_S y después se mantiene), marcada como tal;
//   * si el carril pasa más de MAX_ESTIMADO_S sin detección, se deja de mandar; el próximo nadador es otra identidad.
import type { Caja } from './detector'
import type { Punto, Zona } from '../zonas'
import { esCarril } from '../zonas'

export type Muestra = { carril: number; identidad: number; t: number; px: [number, number]; estimada?: true }

export const HZ = 3
export const EXTRAPOLAR_MAX_S = 1.5
export const MAX_ESTIMADO_S = 20
/** Radio de aceptación alrededor de la predicción, en "tamaños de caja" (diagonal de la caja del nadador). */
export const RADIO_CAJAS = 1.5
/** Cuánto crece el radio por cada segundo sin ver al nadador (en tamaños de caja): la predicción es menos segura. */
export const RADIO_CRECE_POR_S = 1
export const RECAPTURAR_S = 2
export const RECAPTURAR_CUADROS = 3

const distancia = (a: Punto, b: Punto) => Math.hypot(a[0] - b[0], a[1] - b[1])
const centroDe = (c: Caja): Punto => [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2]
const diagonal = (c: Caja) => Math.hypot(c[2] - c[0], c[3] - c[1])

/** 'lane5' o 'carril_5' → 5 (igual que numero_de_carril en el servidor). */
export function numeroDeCarril(nombre: string): number | null {
  const m = /(\d+)\D*$/.exec(nombre)
  return m ? Number(m[1]) : null
}

function dentro([x, y]: Punto, poligono: Punto[]): boolean {
  let adentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i]
    const [xj, yj] = poligono[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro
  }
  return adentro
}

type Estado = {
  identidad: number
  centro: Punto | null
  t: number
  vel: Punto
  proximo: number
  /** Diagonal de la última caja aceptada: da la escala del radio de aceptación. */
  tam: number
  /** Cuadros seguidos en los que solo hubo cajas lejos de la predicción. */
  rechazos: number
}

export class TrayectoriasPorCarril {
  private readonly carriles: { numero: number; poligono: Punto[] }[]
  private readonly estados = new Map<number, Estado>()
  private readonly periodo = 1 / HZ

  /** `zonas` en píxeles del frame que se procesa. */
  constructor(zonas: Zona[]) {
    this.carriles = zonas
      .filter((z) => esCarril(z.name) && z.polygon.length >= 3)
      .map((z) => ({ numero: numeroDeCarril(z.name), poligono: z.polygon }))
      .filter((c): c is { numero: number; poligono: Punto[] } => c.numero !== null)
    for (const c of this.carriles) {
      this.estados.set(c.numero, { identidad: 1, centro: null, t: 0, vel: [0, 0], proximo: -Infinity, tam: 0, rechazos: 0 })
    }
  }

  get numeros(): number[] {
    return this.carriles.map((c) => c.numero)
  }

  /** Cajas del modelo en el instante `t` (segundos) → posiciones a mandar (px en el frame, t en segundos). */
  procesar(cajas: Caja[], t: number): { carril: number; identidad: number; t: number; px: Punto; estimada: boolean }[] {
    const salida: { carril: number; identidad: number; t: number; px: Punto; estimada: boolean }[] = []
    for (const carril of this.carriles) {
      const estado = this.estados.get(carril.numero)!
      const delCarril = cajas.filter((c) => dentro(centroDe(c), carril.poligono))
      const mejor = this.elegir(estado, delCarril, t)

      if (mejor) {
        const centro = centroDe(mejor)
        estado.tam = diagonal(mejor)
        if (estado.centro && t - estado.t > MAX_ESTIMADO_S) estado.identidad += 1   // otro nadador
        if (estado.centro && t - estado.t > 0 && t - estado.t < 2) {
          // velocidad suavizada: una detección mala no la dispara
          const vx = (centro[0] - estado.centro[0]) / (t - estado.t)
          const vy = (centro[1] - estado.centro[1]) / (t - estado.t)
          estado.vel = [0.6 * estado.vel[0] + 0.4 * vx, 0.6 * estado.vel[1] + 0.4 * vy]
        } else {
          estado.vel = [0, 0]
        }
        estado.centro = centro
        estado.t = t
      }
      if (!estado.centro || t < estado.proximo - 1e-6) continue

      let px: Punto
      let estimada: boolean
      if (mejor) {
        px = estado.centro
        estimada = false
      } else {
        const perdido = t - estado.t
        if (perdido > MAX_ESTIMADO_S) continue
        const dt = Math.min(perdido, EXTRAPOLAR_MAX_S)
        px = [estado.centro[0] + estado.vel[0] * dt, estado.centro[1] + estado.vel[1] * dt]
        estimada = true
      }
      // ticks fijos; tras un corte largo no se manda una ráfaga para ponerse al día
      const tick = (Number.isFinite(estado.proximo) ? estado.proximo : t) + this.periodo
      estado.proximo = tick > t - this.periodo ? tick : t + this.periodo
      salida.push({ carril: carril.numero, identidad: estado.identidad, t, px, estimada })
    }
    return salida
  }

  /** La caja que corresponde al nadador del carril, o null si no se lo ve (o solo hay cosas lejos de donde debería estar). */
  private elegir(estado: Estado, cajas: Caja[], t: number): Caja | null {
    if (!cajas.length) return null
    const masConfiable = () => cajas.reduce((a, b) => (b[4] > a[4] ? b : a))
    const perdido = t - estado.t

    // sin historia reciente no hay predicción: vale la más confiable
    if (!estado.centro || perdido > RECAPTURAR_S) {
      estado.rechazos = 0
      return masConfiable()
    }

    const dt = Math.min(perdido, EXTRAPOLAR_MAX_S)
    const prediccion: Punto = [estado.centro[0] + estado.vel[0] * dt, estado.centro[1] + estado.vel[1] * dt]
    const radio = estado.tam * (RADIO_CAJAS + RADIO_CRECE_POR_S * perdido)
    let cerca: Caja | null = null
    for (const c of cajas) {
      const d = distancia(centroDe(c), prediccion)
      if (d <= radio && (!cerca || d < distancia(centroDe(cerca), prediccion))) cerca = c
    }
    if (cerca) {
      estado.rechazos = 0
      return cerca
    }

    // todo lejos: se ignora, salvo que se repita (entonces el que estaba mal era el seguido)
    estado.rechazos += 1
    if (estado.rechazos >= RECAPTURAR_CUADROS) {
      estado.rechazos = 0
      // la posición y la velocidad eran de otra cosa: se empieza de cero (si no, el salto daría una velocidad enorme)
      estado.centro = null
      estado.vel = [0, 0]
      return masConfiable()
    }
    return null
  }
}
