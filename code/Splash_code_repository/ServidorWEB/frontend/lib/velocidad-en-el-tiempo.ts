// La velocidad de un carril a lo largo del tiempo, para la gráfica. Sale de lo que el backend ya guardó: los tramos
// (de una marca a la siguiente, con su velocidad) y los eventos de descanso. No hay cálculos nuevos de velocidad.
//
// Reglas:
//  - Un tramo cuenta desde la ÚLTIMA vez que se vio al nadador en la marca de la que sale (el motor actualiza ese
//    instante cada vez que vuelve a cruzar la misma marca) hasta la PRIMERA vez que se ve en la marca siguiente. Volver
//    a cruzar la misma marca no es movimiento: no abre un tramo nuevo.
//  - Descanso = pasan más de `descanso_s` (30 s) desde la última vez que cruzó una marca DISTINTA sin cruzar otra.
//    Entonces la velocidad es 0 desde ese último cruce hasta que vuelve a moverse: la última vez que se lo vio en la
//    marca donde estaba o, si el motor detectó que retomó el nado antes de cruzar, ese instante (`fin_descanso`).
//  - Si la sesión SIGUE en curso y pasan más de 30 s desde el último cruce, también es descanso hasta ahora. En una
//    sesión terminada no se dibuja: no se sabe si descansó o ya se había ido.
//  - Vista detallada: una serie por carril y por identidad del rastreador (si en un carril hubo dos rastros a la vez, un
//    salto de identidad o un fantasma, se ven como dos líneas). Vista unida (`unirRastros`): una serie por carril, con los
//    tramos de todos sus rastros en orden de tiempo; sirve cuando hay un solo nadador por carril y el rastreador le fue
//    cambiando de identidad.
//  - Un tramo más rápido que `VELOCIDAD_MAX_CREIBLE_MS` se marca como sospechoso: casi siempre es un salto del rastreo,
//    no natación.
import type { EventoGuardado, TramoGuardado } from './tipos'

export const DESCANSO_S = 30
/** Más rápido que esto (m/s) no es natación humana: es un salto del rastreo o un cruce mal medido. */
export const VELOCIDAD_MAX_CREIBLE_MS = 2.5

export type PuntoVelocidad = { t: number; v: number }
export type TramoDeSerie = { desde: number; hasta: number; v: number; descanso: boolean; sospechoso: boolean }

export type SerieCarril = {
  carril: number
  /** Identidad del rastreador (null: filas viejas sin identidad, o serie unida de todos los rastros del carril). */
  identidad: number | null
  /** Los tramos de la serie en orden: velocidad constante en cada uno (descanso = 0). Tiempos en ms (epoch). */
  segmentos: TramoDeSerie[]
  /** Los mismos tramos como puntos de una línea (cada tramo aporta su inicio y su fin). */
  puntos: PuntoVelocidad[]
}

type Opciones = {
  /** Hasta dónde llega la sesión (ms): ahora si sigue en curso, su fin si ya terminó. */
  hasta: number
  descanso_s?: number
  /** true = la sesión sigue en curso: si pasan más de 30 s del último cruce, el descanso se extiende hasta `hasta`. */
  enCurso?: boolean
  /** true = una serie por carril con los tramos de todas sus identidades (un nadador por carril). */
  unirRastros?: boolean
}

export function serieDeCarril(
  carril: number,
  identidad: number | null | 'todas',
  tramos: TramoGuardado[],
  eventos: EventoGuardado[],
  { hasta, descanso_s = DESCANSO_S, enCurso = true }: Opciones,
): SerieCarril {
  const umbral = descanso_s * 1000
  const mios = tramos
    .filter((t) => t.carril === carril && (identidad === 'todas' || (t.identidad ?? null) === identidad))
    .map((t) => ({ ...t, ini: Date.parse(t.t_inicio), fin: Date.parse(t.t_fin) }))
    .sort((a, b) => a.ini - b.ini || a.fin - b.fin)
  const retomas = eventos
    .filter((e) => e.carril === carril && (identidad === 'todas' || (e.identidad ?? null) === identidad) && e.tipo === 'fin_descanso')
    .map((e) => Date.parse(e.ts_captura))
    .sort((a, b) => a - b)

  const segmentos: TramoDeSerie[] = []
  const mover = (desde: number, hasta_: number, v: number) =>
    segmentos.push({ desde, hasta: hasta_, v, descanso: false, sospechoso: v > VELOCIDAD_MAX_CREIBLE_MS })
  mios.forEach((t, i) => {
    // el último cruce de una marca distinta: el fin del tramo anterior (el primer tramo no tiene antes)
    const ref = i > 0 ? mios[i - 1].fin : t.ini
    if (i > 0 && t.fin - ref > umbral) {
      // pasó más de 30 s sin cruzar otra marca: descansó. Se mueve de nuevo cuando lo dice el motor, y si no, desde la última vez que se lo vio en la marca
      const retoma = [...retomas].reverse().find((r) => r > ref && r <= t.fin)
      const mueve = Math.min(Math.max(t.ini, retoma ?? t.ini), t.fin)
      if (mueve > ref) segmentos.push({ desde: ref, hasta: mueve, v: 0, descanso: true, sospechoso: false })
      mover(mueve, t.fin, mueve === t.ini || t.fin <= mueve ? t.velocidad_ms : t.distancia_m / ((t.fin - mueve) / 1000))
    } else {
      mover(t.ini, t.fin, t.velocidad_ms)
    }
  })
  // la sesión sigue y hace más de 30 s que no cruza ninguna marca
  const ultimo = mios.length ? mios[mios.length - 1].fin : null
  if (enCurso && ultimo !== null && hasta - ultimo > umbral) segmentos.push({ desde: ultimo, hasta, v: 0, descanso: true, sospechoso: false })

  return { carril, identidad: identidad === 'todas' ? null : identidad, segmentos, puntos: segmentos.flatMap((s) => [{ t: s.desde, v: s.v }, { t: s.hasta, v: s.v }]) }
}

/** Una serie por carril e identidad que tenga tramos, ordenadas por carril y por cuándo apareció cada una. */
export function seriesDeVelocidad(tramos: TramoGuardado[], eventos: EventoGuardado[], opciones: Opciones): SerieCarril[] {
  if (opciones.unirRastros) {
    return [...new Set(tramos.map((t) => t.carril))].sort((a, b) => a - b).map((c) => serieDeCarril(c, 'todas', tramos, eventos, opciones))
  }
  const claves = new Map<string, { carril: number; identidad: number | null; primero: number }>()
  for (const t of tramos) {
    const identidad = t.identidad ?? null
    const k = `${t.carril}:${identidad}`
    const primero = Date.parse(t.t_inicio)
    const previa = claves.get(k)
    if (!previa || primero < previa.primero) claves.set(k, { carril: t.carril, identidad, primero })
  }
  const series = [...claves.values()]
    .sort((a, b) => a.carril - b.carril || a.primero - b.primero)
    .map((c) => serieDeCarril(c.carril, c.identidad, tramos, eventos, opciones))
  // si un carril tiene varios rastros, solo el que cruzó una marca más recientemente sigue "descansando" hasta ahora:
  // los otros (un fantasma que se apagó) no arrastran una cola de descanso falsa
  const ultimoCruce = (s: SerieCarril) => Math.max(0, ...s.segmentos.filter((g) => !g.descanso).map((g) => g.hasta))
  for (const s of series) {
    const hermanas = series.filter((o) => o.carril === s.carril)
    const cola = s.segmentos[s.segmentos.length - 1]
    if (hermanas.length > 1 && cola?.descanso && cola.hasta === opciones.hasta && hermanas.some((o) => ultimoCruce(o) > ultimoCruce(s))) s.segmentos.pop()
    s.puntos = s.segmentos.flatMap((g) => [{ t: g.desde, v: g.v }, { t: g.hasta, v: g.v }])
  }
  return series
}
