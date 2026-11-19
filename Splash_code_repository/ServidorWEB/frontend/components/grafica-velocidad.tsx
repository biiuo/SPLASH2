'use client'

import { useMemo, useState } from 'react'

import { formatearDuracion } from '@/lib/resultados'
import type { EventoGuardado, TramoGuardado } from '@/lib/tipos'
import { DESCANSO_S, VELOCIDAD_MAX_CREIBLE_MS, seriesDeVelocidad } from '@/lib/velocidad-en-el-tiempo'

const COLORES = ['#2563eb', '#f59e0b', '#10b981', '#e11d48', '#8b5cf6', '#0891b2']
const ANCHO = 720
const ALTO = 260
const M = { izq: 46, der: 16, arriba: 14, abajo: 30 }

type Vista = 'suave' | 'tramos'

/**
 * Curva suave (cúbica monótona, Fritsch–Carlson) por los puntos: pasa por todos y no se pasa de largo entre dos
 * (no inventa picos ni valores negativos).
 */
function curvaSuave(p: [number, number][]): string {
  const n = p.length
  if (n < 2) return ''
  const h = Array.from({ length: n - 1 }, (_, i) => p[i + 1][0] - p[i][0])
  const d = h.map((hi, i) => (p[i + 1][1] - p[i][1]) / hi)
  const m = Array.from({ length: n }, (_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2))
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i] }
  }
  let r = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    r += `C${(p[i][0] + h[i] / 3).toFixed(1)} ${(p[i][1] + (m[i] * h[i]) / 3).toFixed(1)} ${(p[i + 1][0] - h[i] / 3).toFixed(1)} ${(p[i + 1][1] - (m[i + 1] * h[i]) / 3).toFixed(1)} ${p[i + 1][0].toFixed(1)} ${p[i + 1][1].toFixed(1)}`
  }
  return r
}

/** El paso "redondo" de un eje: 1, 2, 5 × 10^n que deje unas 5 marcas. */
function paso(rango: number, marcas = 5): number {
  const bruto = rango / marcas
  const base = 10 ** Math.floor(Math.log10(bruto))
  return ([1, 2, 5, 10].find((m) => m * base >= bruto) ?? 10) * base
}
/** Pasos de tiempo que se leen bien en minutos y segundos. */
const PASOS_S = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

type Props = {
  tramos: TramoGuardado[]
  eventos: EventoGuardado[]
  /** Inicio de la sesión, en ms. */
  inicio: number
  /** Hasta dónde llega: ahora si sigue en curso, su fin si ya terminó (ms). */
  hasta: number
  /** true = la sesión sigue en curso: el descanso después del último cruce se dibuja hasta ahora. */
  enCurso: boolean
  /** Nombre del nadador de cada carril, para la leyenda. */
  nadadores?: Record<number, string | null | undefined>
}

/** Velocidad (m/s) de cada carril a lo largo del tiempo, con el descanso como 0. */
export function GraficaVelocidad({ tramos, eventos, inicio, hasta, enCurso, nadadores = {} }: Props) {
  const [vista, setVista] = useState<Vista>('suave')
  const suave = vista === 'suave'
  const series = useMemo(() => seriesDeVelocidad(tramos, eventos, { hasta, enCurso, unirRastros: suave }), [tramos, eventos, hasta, enCurso, suave])
  if (series.length === 0) return null

  const segmentos = series.flatMap((s) => s.segmentos)
  // el eje llega hasta ahora si sigue en curso; si ya terminó, hasta el último dato (una hora sin datos no aplasta lo que sí hay)
  const t1 = Math.max(enCurso ? hasta : 0, ...segmentos.map((g) => g.hasta))
  const duracion = Math.max(t1 - inicio, 1000)
  // la escala vertical sale de las velocidades creíbles: un salto del rastreo de 5 m/s no aplasta todo lo demás
  const vCreible = Math.max(1.5, ...segmentos.filter((g) => !g.sospechoso).map((g) => g.v))
  const pasoV = paso(vCreible * 1.1)
  const yMax = Math.ceil((vCreible * 1.05) / pasoV) * pasoV
  const pasoT = (PASOS_S.find((p) => duracion / 1000 / p <= 6) ?? 3600) * 1000

  const x = (t: number) => M.izq + ((t - inicio) / duracion) * (ANCHO - M.izq - M.der)
  const y = (v: number) => ALTO - M.abajo - (Math.min(v, yMax) / yMax) * (ALTO - M.abajo - M.arriba)
  const marcasT = Array.from({ length: Math.floor(duracion / pasoT) + 1 }, (_, i) => i * pasoT)
  const marcasV = Array.from({ length: Math.round(yMax / pasoV) + 1 }, (_, i) => i * pasoV)

  const conPistas = (carril: number) => !suave && series.filter((s) => s.carril === carril).length > 1
  const etiqueta = (i: number) => {
    const s = series[i]
    return `Carril ${s.carril}${nadadores[s.carril] ? ` · ${nadadores[s.carril]}` : ''}${conPistas(s.carril) ? ` · rastro ${s.identidad ?? '?'}` : ''}`
  }
  const hayDudosos = segmentos.some((g) => g.sospechoso)

  // el descanso (velocidad 0) va punteado. Varias series pueden descansar a la vez sobre la misma línea: sus rayitas se
  // intercalan (cada una arranca desplazada) y los fondos blancos se dibujan todos antes que las rayitas.
  const raya = 4
  const hueco = Math.max(raya, (series.length - 1) * raya)
  const descansos = series.flatMap((s, i) =>
    s.segmentos.filter((g) => g.descanso).map((g) => ({ clave: `${i}-${g.desde}`, color: COLORES[i % COLORES.length], x1: x(g.desde), x2: x(g.hasta), desfase: i * raya })),
  )

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Velocidad en el tiempo</h3>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold" role="group" aria-label="Vista de la gráfica">
          {([['suave', 'Suave'], ['tramos', 'Por tramos']] as const).map(([v, nombre]) => (
            <button key={v} type="button" onClick={() => setVista(v)} aria-pressed={vista === v} className={`px-3 py-1.5 transition ${vista === v ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{nombre}</button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {series.map((s, i) => (
          <span key={`${s.carril}-${s.identidad}`} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: COLORES[i % COLORES.length] }} />
            {etiqueta(i)}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="mt-2 w-full" role="img" aria-label="Velocidad de cada carril a lo largo del tiempo, con el descanso en cero">
        {marcasV.map((v) => (
          <g key={v}>
            <line x1={M.izq} x2={ANCHO - M.der} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={M.izq - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#94a3b8">{+v.toFixed(2)}</text>
          </g>
        ))}
        {marcasT.map((t) => (
          <text key={t} x={x(inicio + t)} y={ALTO - 10} textAnchor="middle" fontSize={11} fill="#94a3b8">{formatearDuracion(t)}</text>
        ))}
        <text x={12} y={ALTO / 2} fontSize={11} fill="#94a3b8" textAnchor="middle" transform={`rotate(-90 12 ${ALTO / 2 - 10})`}>m/s</text>

        {suave && series.map((s, i) => {
          // un punto por tramo (a la mitad del tramo, con su velocidad media) unidos con una curva suave. Si entre dos puntos
          // pasaron más de DESCANSO_S s la línea se corta: no se inventa nada donde no se midió.
          const pts = s.segmentos
            .filter((g) => !g.descanso && !g.sospechoso)
            .map((g) => [x((g.desde + g.hasta) / 2), y(g.v), (g.desde + g.hasta) / 2] as [number, number, number])
            .sort((a, b) => a[2] - b[2])
            .filter((q, k, todos) => k === 0 || q[2] > todos[k - 1][2])
          const trozos: [number, number][][] = []
          pts.forEach((q, k) => {
            if (k === 0 || q[2] - pts[k - 1][2] > DESCANSO_S * 1000) trozos.push([])
            trozos[trozos.length - 1].push([q[0], q[1]])
          })
          const color = COLORES[i % COLORES.length]
          return (
            <g key={`suave-${s.carril}`}>
              {trozos.map((t, k) => <path key={k} d={curvaSuave(t)} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />)}
              {pts.map((q) => <circle key={q[2]} cx={q[0]} cy={q[1]} r={3} fill={color} />)}
            </g>
          )
        })}
        {!suave && series.map((s, i) => {
          // una sola línea por serie; si entre dos tramos hay un hueco (volvió a cruzar la misma marca), se corta
          let d = ''
          let previo: number | null = null
          for (const g of s.segmentos) {
            d += `${previo !== null && g.desde - previo <= 1000 && g.desde >= previo ? 'L' : 'M'}${x(g.desde).toFixed(1)} ${y(g.v).toFixed(1)}L${x(g.hasta).toFixed(1)} ${y(g.v).toFixed(1)}`
            previo = g.hasta
          }
          return <path key={`${s.carril}-${s.identidad}`} d={d} fill="none" stroke={COLORES[i % COLORES.length]} strokeWidth={2} strokeLinejoin="round" />
        })}
        {descansos.map((r) => <line key={`f-${r.clave}`} x1={r.x1} x2={r.x2} y1={y(0)} y2={y(0)} stroke="white" strokeWidth={4} />)}
        {descansos.map((r) => <line key={`d-${r.clave}`} x1={r.x1} x2={r.x2} y1={y(0)} y2={y(0)} stroke={r.color} strokeWidth={2} strokeDasharray={`${raya} ${hueco}`} strokeDashoffset={r.desfase} />)}

        {/* un tramo poco creíble se marca con un círculo rojo (y se recorta arriba: el valor real está en el tooltip) */}
        {series.flatMap((s, i) =>
          s.segmentos.filter((g) => g.sospechoso).map((g) => (
            <circle key={`s-${i}-${g.desde}`} cx={(x(g.desde) + x(g.hasta)) / 2} cy={y(g.v)} r={4.5} fill="white" stroke="#dc2626" strokeWidth={2}>
              <title>{`${g.v.toFixed(2)} m/s: poco creíble (más de ${VELOCIDAD_MAX_CREIBLE_MS} m/s), probable salto del rastreo`}</title>
            </circle>
          )),
        )}
      </svg>
      <p className="mt-1 text-xs text-slate-400">
        {suave
          ? 'Cada punto es la velocidad media de un tramo entre dos marcas, ubicado a mitad del tramo; la curva los une y se corta donde pasaron más de 30 s sin medir. Se unen todos los rastros de un carril (un nadador por carril). '
          : 'Cada línea es un rastro del seguimiento: si el seguimiento perdió y volvió a asignar al nadador, aparece como otra línea. '}
        Línea punteada en 0 = descanso: pasaron más de {DESCANSO_S} s sin cruzar una marca distinta de la última. Volver a cruzar la misma marca no cuenta como movimiento.
        {hayDudosos && <> Círculo rojo = velocidad poco creíble (más de {VELOCIDAD_MAX_CREIBLE_MS} m/s), probablemente un salto del rastreo: pasá el mouse para ver el valor.</>}
        {!enCurso && ' La sesión terminó: no se dibuja descanso después del último cruce.'}
      </p>
    </div>
  )
}
