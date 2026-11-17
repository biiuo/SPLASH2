'use client'

import { Gauge, Timer, TrendingUp, Waves } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { carrilesDe, desdePeriodo, metricas, useDatosEntrenador } from '@/components/entrenador/datos'
import { Barras, Linea } from '@/components/graficos'
import { DetalleSesion } from '@/components/nadador/detalle-sesion'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, CAMPO, Kpi, Tarjeta } from '@/components/nadador/ui'
import { fechaCorta, formatearMetros, formatearSegundos, formatearVel, horaCorta } from '@/lib/largos'

const DIA = 24 * 60 * 60 * 1000
const diaCorto = (t: number) => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
const semanaDe = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime() - ((d.getDay() + 6) % 7) * DIA
}
const PERIODOS: [string, string][] = [['30', '30 días'], ['90', '3 meses'], ['365', '1 año'], ['todo', 'Todo']]

/** Análisis de rendimiento de un nadador: evolución, distancia, tiempos por largo y comparación entre períodos. */
export default function Rendimiento() {
  const { datos, problema } = useDatosEntrenador()
  const [nadadorId, setNadadorId] = useState('')
  const [periodo, setPeriodo] = useState('90')
  const [sesionId, setSesionId] = useState('')

  useEffect(() => {
    try {
      const n = new URLSearchParams(window.location.search).get('nadador')
      if (n) setNadadorId(n)
    } catch {
      /* sin URL */
    }
  }, [])
  useEffect(() => {
    if (!nadadorId && datos?.nadadores[0]) setNadadorId(datos.nadadores[0].id)
  }, [datos, nadadorId])

  const nadador = datos?.nadadores.find((n) => n.id === nadadorId) ?? null
  const todas = useMemo(() => (nadador && datos ? carrilesDe(nadador.usuario_id, datos.sesiones).filter((f) => f.sesion.estado !== 'cancelada') : []), [nadador, datos])
  const desde = desdePeriodo(periodo)
  const filas = todas.filter((f) => Date.parse(f.sesion.inicio) >= desde).sort((a, b) => a.sesion.inicio.localeCompare(b.sesion.inicio))
  const m = metricas(filas)
  // el período anterior, del mismo largo, para comparar
  const largo = periodo === 'todo' ? 0 : Number(periodo) * DIA
  const anterior = largo ? metricas(todas.filter((f) => Date.parse(f.sesion.inicio) >= desde - largo && Date.parse(f.sesion.inicio) < desde)) : null
  const semanas = useMemo(() => {
    const mapa = new Map<number, number>()
    for (const f of filas) {
      const k = semanaDe(Date.parse(f.sesion.inicio))
      mapa.set(k, (mapa.get(k) ?? 0) + f.carril.distancia_m)
    }
    return [...mapa.entries()].sort((a, b) => a[0] - b[0])
  }, [filas])
  const conVel = filas.filter((f) => f.carril.velocidad_media_ms !== null)
  const conLargos = [...filas].reverse().filter((f) => f.carril.largos > 0)
  const elegida = conLargos.find((f) => f.sesion.id === sesionId) ?? conLargos[0] ?? null

  const cambio = (a: number | null, b: number | null, mayorEsMejor = true) => {
    if (a === null || b === null || b === 0) return '—'
    const p = ((a - b) / b) * 100
    return `${p > 0 ? '+' : ''}${p.toFixed(1)} % ${(p > 0) === mayorEsMejor ? '▲' : '▼'}`
  }

  return (
    <>
      <Encabezado titulo="Rendimiento" bajada="Evolución de un nadador: velocidad, distancia, tiempos por largo y cómo le fue respecto del período anterior." />
      {problema && <div className="mb-4"><Aviso tipo="error">{problema}</Aviso></div>}
      <Tarjeta>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-[#64748B]">
            Nadador
            <select value={nadadorId} onChange={(e) => { setNadadorId(e.target.value); setSesionId('') }} className={CAMPO}>
              {datos?.nadadores.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
            {PERIODOS.map(([v, t]) => <button key={v} onClick={() => setPeriodo(v)} aria-pressed={periodo === v} className={periodo === v ? BOTON.primario : BOTON.terciario}>{t}</button>)}
          </div>
        </div>
      </Tarjeta>
      {datos && !datos.nadadores.length && <div className="mt-6"><Aviso>Todavía no tenés nadadores en tus grupos.</Aviso></div>}

      {nadador && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi icono={Waves} etiqueta="Distancia total" valor={Math.round(m.distancia_m).toLocaleString('es-CO')} unidad="m" nota={`${m.sesiones} sesiones`} />
            <Kpi icono={Gauge} etiqueta="Velocidad promedio" valor={m.velocidad_media_ms ? m.velocidad_media_ms.toFixed(2) : '—'} unidad="m/s" />
            <Kpi icono={TrendingUp} etiqueta="Velocidad máxima" valor={m.velocidad_max_ms ? m.velocidad_max_ms.toFixed(2) : '—'} unidad="m/s" nota="largo detectado" />
            <Kpi icono={Timer} etiqueta="Mejor largo" valor={formatearSegundos(m.mejor_largo_s)} nota="largo detectado" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Tarjeta titulo="Evolución de la velocidad" subtitulo="Velocidad media de cada sesión.">
              {conVel.length ? (
                <Linea
                  puntos={conVel.map((f) => ({ clave: f.sesion.id + f.carril.carril, x: Date.parse(f.sesion.inicio), y: f.carril.velocidad_media_ms as number, detalle: [formatearVel(f.carril.velocidad_media_ms), `${fechaCorta(f.sesion.inicio)} ${horaCorta(f.sesion.inicio)}`, `${f.carril.largos} largos`] }))}
                  formatoY={(v) => v.toFixed(2)}
                  marcasX={conVel.filter((_, i) => i % Math.ceil(conVel.length / 5) === 0).map((f) => ({ x: Date.parse(f.sesion.inicio), texto: diaCorto(Date.parse(f.sesion.inicio)) }))}
                  etiquetaX="fecha · m/s"
                  descripcion="Velocidad media por sesión"
                />
              ) : <Aviso>Sin sesiones con tramos en el período.</Aviso>}
            </Tarjeta>
            <Tarjeta titulo="Distancia por semana" subtitulo="Metros, de lunes a domingo.">
              {semanas.length ? (
                <Barras
                  datos={semanas.map(([k, v]) => ({ clave: String(k), etiqueta: diaCorto(k), valor: Math.round(v), detalle: [formatearMetros(v), `Semana del ${diaCorto(k)}`] }))}
                  formatoY={(v) => `${v} m`}
                  etiquetaX="semana"
                  descripcion="Distancia por semana"
                />
              ) : <Aviso>Sin distancia en el período.</Aviso>}
            </Tarjeta>
          </div>

          {anterior && (
            <Tarjeta className="mt-6" titulo="Este período contra el anterior" subtitulo={`Los últimos ${PERIODOS.find((p) => p[0] === periodo)?.[1]} contra los ${PERIODOS.find((p) => p[0] === periodo)?.[1]} de antes.`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm tabular-nums">
                  <thead className="text-xs uppercase tracking-wider text-[#94A3B8]"><tr><th className="py-2 pr-4">Métrica</th><th className="py-2 pr-4 text-right">Anterior</th><th className="py-2 pr-4 text-right">Actual</th><th className="py-2 text-right">Cambio</th></tr></thead>
                  <tbody>
                    {[
                      ['Distancia', formatearMetros(anterior.distancia_m), formatearMetros(m.distancia_m), cambio(m.distancia_m, anterior.distancia_m)],
                      ['Sesiones', String(anterior.sesiones), String(m.sesiones), cambio(m.sesiones, anterior.sesiones)],
                      ['Velocidad promedio', formatearVel(anterior.velocidad_media_ms), formatearVel(m.velocidad_media_ms), cambio(m.velocidad_media_ms, anterior.velocidad_media_ms)],
                      ['Velocidad máxima', formatearVel(anterior.velocidad_max_ms), formatearVel(m.velocidad_max_ms), cambio(m.velocidad_max_ms, anterior.velocidad_max_ms)],
                      ['Mejor largo', formatearSegundos(anterior.mejor_largo_s), formatearSegundos(m.mejor_largo_s), cambio(m.mejor_largo_s, anterior.mejor_largo_s, false)],
                    ].map(([k, a, b, c]) => (
                      <tr key={k} className="border-t border-[#F1F5F9]"><td className="py-2.5 pr-4 text-[#64748B]">{k}</td><td className="py-2.5 pr-4 text-right">{a}</td><td className="py-2.5 pr-4 text-right font-semibold">{b}</td><td className="py-2.5 text-right">{c}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Tarjeta>
          )}

          <Tarjeta className="mt-6" titulo="Tiempos por largo" subtitulo="Elegí una sesión para ver cada largo: el más rápido, el más lento y la velocidad de cada uno.">
            {conLargos.length === 0 ? <Aviso>Sin largos completos en el período.</Aviso> : (
              <label className="text-sm text-[#64748B]">
                Sesión
                <select value={elegida?.sesion.id ?? ''} onChange={(e) => setSesionId(e.target.value)} className={`${CAMPO} max-w-md`}>
                  {conLargos.map((f) => <option key={f.sesion.id} value={f.sesion.id}>{fechaCorta(f.sesion.inicio)} {horaCorta(f.sesion.inicio)} · {f.carril.largos} largos</option>)}
                </select>
              </label>
            )}
          </Tarjeta>
          {elegida && <div className="mt-6"><DetalleSesion key={elegida.sesion.id} sesion={elegida.sesion} carrilInicial={elegida.carril.carril} /></div>}
        </>
      )}
    </>
  )
}
