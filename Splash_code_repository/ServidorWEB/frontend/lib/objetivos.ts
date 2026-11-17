// Cumplimiento de un objetivo a partir de las sesiones del nadador (las que puede ver quien mira).
import { formatearMetros, formatearSegundos, formatearVel } from './largos'
import type { Objetivo, ResumenSesion, TipoObjetivo } from './tipos'

export const NOMBRE_TIPO: Record<TipoObjetivo, string> = {
  distancia: 'Distancia',
  velocidad: 'Velocidad',
  tiempo_largo: 'Tiempo por largo',
}
export const UNIDAD_TIPO: Record<TipoObjetivo, string> = { distancia: 'm', velocidad: 'm/s', tiempo_largo: 's' }

export const formatearMeta = (tipo: TipoObjetivo, v: number | null) =>
  v === null ? '—' : tipo === 'distancia' ? formatearMetros(v) : tipo === 'velocidad' ? formatearVel(v) : formatearSegundos(v)

export type Cumplimiento = {
  /** Lo logrado: metros, mejor velocidad o mejor tiempo de largo en el período (null = todavía nada). */
  actual: number | null
  /** 0 a 100. */
  porcentaje: number
  alcanzado: boolean
  estado: 'alcanzado' | 'en_curso' | 'vencido' | 'por_empezar'
}

/**
 * Distancia: metros nadados entre las fechas. Velocidad: la mejor velocidad de largo detectado (los estimados no
 * cuentan). Tiempo por largo: el mejor tiempo de largo detectado; se cumple con la meta o menos.
 */
export function cumplimiento(o: Objetivo, sesiones: ResumenSesion[], hoy = new Date()): Cumplimiento {
  const desde = Date.parse(`${o.desde}T00:00:00`)
  const hasta = Date.parse(`${o.hasta}T23:59:59`)
  const carriles = sesiones
    .filter((s) => s.estado !== 'cancelada' && Date.parse(s.inicio) >= desde && Date.parse(s.inicio) <= hasta)
    .flatMap((s) => s.por_carril.filter((c) => o.usuario_id && c.usuario_id === o.usuario_id))
  let actual: number | null = null
  let porcentaje = 0
  if (o.tipo === 'distancia') {
    actual = carriles.reduce((a, c) => a + c.distancia_m, 0)
    porcentaje = (actual / o.meta) * 100
  } else if (o.tipo === 'velocidad') {
    const v = carriles.map((c) => c.velocidad_max_ms).filter((x): x is number => x !== null)
    actual = v.length ? Math.max(...v) : null
    porcentaje = actual ? (actual / o.meta) * 100 : 0
  } else {
    const t = carriles.map((c) => c.mejor_largo_s).filter((x): x is number => x !== null)
    actual = t.length ? Math.min(...t) : null
    porcentaje = actual ? (o.meta / actual) * 100 : 0
  }
  const alcanzado = porcentaje >= 100
  const ahora = hoy.getTime()
  const estado = alcanzado ? 'alcanzado' : ahora < desde ? 'por_empezar' : ahora > hasta ? 'vencido' : 'en_curso'
  return { actual, porcentaje: Math.min(100, Math.round(porcentaje)), alcanzado, estado }
}
