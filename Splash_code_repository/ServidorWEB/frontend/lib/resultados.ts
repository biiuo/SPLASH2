// Cuentas simples sobre los resultados de una sesión, para mostrarlos. Los cálculos de verdad (metros, velocidades,
// cruces) los hace el backend; acá solo se agrupa y se da formato.
import type { ResultadosSesion } from './tipos'

export type ResumenCarril = {
  carril: number
  /** Cuántos tramos se midieron. */
  tramos: number
  /** Cuántos de esos tramos incluyen algo inferido (no se veía al nadador). */
  inferidos: number
  ultimoNodo_m: number | null
  ultimaVelocidad_ms: number | null
  velocidadMedia_ms: number | null
  enDescanso: boolean
}

/** Un resumen por carril, ordenado por número de carril. */
export function resumenPorCarril(r: ResultadosSesion): ResumenCarril[] {
  const carriles = new Set<number>([...r.eventos.map((e) => e.carril), ...r.tramos.map((t) => t.carril)])
  return [...carriles]
    .sort((a, b) => a - b)
    .map((carril) => {
      const tramos = r.tramos.filter((t) => t.carril === carril).sort((a, b) => a.t_fin.localeCompare(b.t_fin))
      const eventos = r.eventos.filter((e) => e.carril === carril).sort((a, b) => a.ts_captura.localeCompare(b.ts_captura))
      const ultimoCruce = [...eventos].reverse().find((e) => e.tipo === 'cruce_nodo')
      const ultimoDescanso = [...eventos].reverse().find((e) => e.tipo === 'inicio_descanso' || e.tipo === 'fin_descanso')
      const metros = tramos.reduce((suma, t) => suma + t.distancia_m, 0)
      const segundos = tramos.reduce((suma, t) => suma + (Date.parse(t.t_fin) - Date.parse(t.t_inicio)) / 1000, 0)
      return {
        carril,
        tramos: tramos.length,
        inferidos: tramos.filter((t) => !t.observado).length,
        ultimoNodo_m: ultimoCruce?.nodo_m ?? null,
        ultimaVelocidad_ms: tramos.length ? tramos[tramos.length - 1].velocidad_ms : null,
        // la media es distancia total / tiempo total, no el promedio de las velocidades de cada tramo
        velocidadMedia_ms: segundos > 0 ? metros / segundos : null,
        enDescanso: ultimoDescanso?.tipo === 'inicio_descanso',
      }
    })
}

/** 83_000 ms -> «01:23»; desde una hora, «1:01:23». */
export function formatearDuracion(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const dos = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`
}

export const formatearVelocidad = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)} m/s`)
