// Los datos de una sesión como CSV, para depurar: cada evento y cada tramo que guardó el backend, en orden de tiempo,
// con el tiempo relativo al inicio de la sesión (para compararlo con el video). Se arma en el navegador.
import type { ResultadosSesion } from './tipos'
import { VELOCIDAD_MAX_CREIBLE_MS } from './velocidad-en-el-tiempo'

const COLUMNAS = [
  'sesion_id', 'fila', 'carril', 'nadador', 'identidad', 'tipo', 'nodo_desde_m', 'nodo_hasta_m',
  'inicio', 'fin', 't_inicio_s', 't_fin_s', 'duracion_s', 'distancia_m', 'velocidad_ms', 'observado', 'sospechoso',
] as const

/** Escapa un valor: entre comillas si lleva coma, comillas o salto de línea. */
function celda(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const redondear = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d

/**
 * Una fila por evento y una por tramo, ordenadas por tiempo. `t_*_s` son segundos desde el inicio de la sesión.
 * `sospechoso` = un tramo más rápido de lo que puede nadar una persona (casi siempre, un salto del rastreo).
 */
export function csvDeSesion(
  sesion: { id: string; inicio: string },
  resultados: ResultadosSesion,
  nadadores: Record<number, string | null | undefined> = {},
): string {
  const t0 = Date.parse(sesion.inicio)
  const rel = (iso: string) => redondear((Date.parse(iso) - t0) / 1000)
  type Fila = { t: number; valores: Record<(typeof COLUMNAS)[number], string | number | boolean | null | undefined> }
  const filas: Fila[] = []

  for (const e of resultados.eventos) {
    filas.push({
      t: Date.parse(e.ts_captura),
      valores: {
        sesion_id: sesion.id, fila: 'evento', carril: e.carril, nadador: nadadores[e.carril], identidad: e.identidad, tipo: e.tipo,
        nodo_desde_m: e.nodo_m, nodo_hasta_m: null, inicio: e.ts_captura, fin: null, t_inicio_s: rel(e.ts_captura), t_fin_s: null,
        duracion_s: null, distancia_m: null, velocidad_ms: null, observado: e.observado, sospechoso: null,
      },
    })
  }
  for (const t of resultados.tramos) {
    filas.push({
      t: Date.parse(t.t_inicio),
      valores: {
        sesion_id: sesion.id, fila: 'tramo', carril: t.carril, nadador: nadadores[t.carril], identidad: t.identidad, tipo: 'tramo',
        nodo_desde_m: t.nodo_desde_m, nodo_hasta_m: t.nodo_hasta_m, inicio: t.t_inicio, fin: t.t_fin, t_inicio_s: rel(t.t_inicio), t_fin_s: rel(t.t_fin),
        duracion_s: redondear((Date.parse(t.t_fin) - Date.parse(t.t_inicio)) / 1000), distancia_m: redondear(t.distancia_m, 2), velocidad_ms: redondear(t.velocidad_ms),
        observado: t.observado, sospechoso: t.velocidad_ms > VELOCIDAD_MAX_CREIBLE_MS,
      },
    })
  }
  filas.sort((a, b) => a.t - b.t)
  return [COLUMNAS.join(','), ...filas.map((f) => COLUMNAS.map((c) => celda(f.valores[c])).join(','))].join('\r\n') + '\r\n'
}

/** Nombre de archivo: safesplash-sesion-20261113-1530-ab12cd34.csv */
export function nombreCsv(sesion: { id: string; inicio: string }): string {
  const d = new Date(sesion.inicio)
  const dos = (n: number) => String(n).padStart(2, '0')
  return `safesplash-sesion-${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}-${sesion.id.slice(0, 8)}.csv`
}

/** Baja el texto como archivo. La marca BOM del principio hace que Excel lo abra en UTF-8 (con tildes bien). */
export function descargarCsv(nombre: string, texto: string): void {
  const url = URL.createObjectURL(new Blob(['\ufeff', texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
